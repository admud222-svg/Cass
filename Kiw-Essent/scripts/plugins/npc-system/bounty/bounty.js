import { system, world, ActionFormData, ModalFormData } from "../../../core.js"
import { addMoney, removeMoney, getFullMoney } from "../../../function/moneySystem.js"
import { Database } from "../../../function/Database.js"

const bountyDB = Database.getDatabase("bounty")

function getAllBounties() {
    return Array.from(bountyDB.values()).filter(b => b.status === "active")
}

function getPlayerBounties(name) {
    return getAllBounties().filter(b => b.target === name)
}

function getMySetBounties(name) {
    return getAllBounties().filter(b => b.setter === name)
}

function getActiveBountyBySetterAndTarget(setterName, targetName) {
    return getAllBounties().find(b => b.setter === setterName && b.target === targetName)
}

function getMinBounty() {
    const val = world.getDynamicProperty("bounty:minAmount")
    return val ? parseInt(val) : 5000
}

function setMinBounty(amount) {
    world.setDynamicProperty("bounty:minAmount", amount.toString())
}

function getRefundPercent() {
    const val = world.getDynamicProperty("bounty:refundPercent")
    return val ? parseInt(val) : 75
}

function setRefundPercent(percent) {
    world.setDynamicProperty("bounty:refundPercent", percent.toString())
}

function getBountyCooldown() {
    const val = world.getDynamicProperty("bounty:cooldown")
    return val ? parseInt(val) : 300
}

function setBountyCooldown(ms) {
    world.setDynamicProperty("bounty:cooldown", ms.toString())
}

function getBountyExpire() {
    const val = world.getDynamicProperty("bounty:expire");
    return val ? parseInt(val) : 3600000 // 1 jam default
}

function setBountyExpire(ms) {
    world.setDynamicProperty("bounty:expire", ms.toString())
}

function getLastBountyTime(player) {
    return player.getDynamicProperty("bounty:lastSet") || 0
}

function setLastBountyTime(player, time) {
    player.setDynamicProperty("bounty:lastSet", time)
}

function addBounty(setter, target, amount) {
    const minBounty = getMinBounty()
    const cooldown = getBountyCooldown()
    const expire = getBountyExpire()
    const now = Date.now()
    if (setter.name === target.name) return { ok: false, msg: "You can't set a bounty on yourself." }
    if (amount < minBounty) return { ok: false, msg: `Minimum bounty is $${minBounty}.` }
    if (getActiveBountyBySetterAndTarget(setter.name, target.name)) return { ok: false, msg: "You already have an active bounty on this player." }
    if (cooldown > 0) {
        const last = getLastBountyTime(setter)
        if (now - last < cooldown) {
            const left = Math.ceil((cooldown - (now - last)) / 1000)
            return { ok: false, msg: `You must wait ${left}s before setting another bounty.` }
        }
    }
    if (!removeMoney(setter, amount)) return { ok: false, msg: "Transaction failed: You do not have enough balance to set this bounty." }
    const id = Date.now() + "_" + Math.floor(Math.random() * 1000)
    bountyDB.set(id, {
        id,
        target: target.name,
        setter: setter.name,
        amount,
        status: "active",
        created: now,
        expire: now + expire,
        claimedBy: null
    })
    setLastBountyTime(setter, now)
    world.sendMessage(`§e[BOUNTY] §a${setter.name} has set a bounty on §c${target.name} §afor §6$${amount}§a!`)
    return { ok: true }
}

function getPlayerList(excludeName) {
    const onlinePlayers = world.getPlayers().map(p => p.name)
    const allPlayers = [...new Set(onlinePlayers)]
    return allPlayers
        .filter(name => name !== excludeName)
        .map(name => ({
            name,
            isOnline: onlinePlayers.includes(name),
            display: `${name} ${onlinePlayers.includes(name) ? '[ONLINE]' : '[OFFLINE]'}`
        }))
}

async function showAddBounty(player) {
    const minBounty = getMinBounty()
    const players = getPlayerList(player.name).filter(p => p.isOnline)
    if (players.length === 0) return player.sendMessage("No other players online!")
    const form = new ModalFormData()
        .title("Set a Bounty")
        .dropdown("Select target", players.map(p => p.display), { defaultValue: 0 })
        .textField(`Bounty amount (min ${minBounty})`, minBounty.toString(), { defaultValue: minBounty.toString() })
    const res = await form.show(player)
    if (res.canceled) return
    const selected = players[res.formValues[0]]
    const targetPlayer = world.getPlayers().find(p => p.name === selected.name)
    if (!targetPlayer) {
        player.sendMessage("Target player is no longer online.")
        return
    }
    if (getActiveBountyBySetterAndTarget(player.name, targetPlayer.name)) {
        player.sendMessage("You already have an active bounty on this player.")
        return
    }
    const amount = parseInt(res.formValues[1])
    const result = addBounty(player, targetPlayer, amount)
    if (result.ok) player.sendMessage(`Bounty on ${selected.name} has been set!`)
    else player.sendMessage(result.msg)
}

function cancelBounty(setter, bounty) {
    if (bounty.status !== "active" || bounty.setter !== setter.name) return { ok: false, msg: "You can't cancel this bounty." }
    bounty.status = "cancelled"
    bountyDB.set(bounty.id, bounty)
    const refund = Math.floor(bounty.amount * getRefundPercent() / 100)
    addMoney(setter, refund)
    return { ok: true, refund }
}

function claimBounty(killer, bounty) {
    if (bounty.status !== "active") return false
    bounty.status = "claimed"
    bounty.claimedBy = killer.name
    bountyDB.set(bounty.id, bounty)
    addMoney(killer, bounty.amount)
    return true
}

world.afterEvents.entityDie.subscribe(ev => {
    const { deadEntity, damageSource } = ev
    if (!deadEntity || !damageSource?.damagingEntity) return
    if (deadEntity.typeId !== "minecraft:player" || damageSource.damagingEntity.typeId !== "minecraft:player") return
    const target = deadEntity.name
    const killer = damageSource.damagingEntity
    const bounties = getPlayerBounties(target)
    if (bounties.length === 0) return
    for (const bounty of bounties) {
        if (claimBounty(killer, bounty)) {
            killer.sendMessage(`§a+ $${bounty.amount} bounty reward!`)
            world.sendMessage(`§c${target} was killed by ${killer.name} (BOUNTY $${bounty.amount})!`)
        }
    }
})

function checkExpiredBounties() {
    const now = Date.now()
    for (const bounty of getAllBounties()) {
        if (bounty.expire && now > bounty.expire && bounty.status === "active") {
            bounty.status = "expired"
            bountyDB.set(bounty.id, bounty)
            const setter = world.getPlayers().find(p => p.name === bounty.setter)
            const refund = Math.floor(bounty.amount * getRefundPercent() / 100)
            addMoney(setter, refund)
            if (setter) setter.sendMessage(`§e[BOUNTY] Your bounty on ${bounty.target} has expired! You received $${refund} refund.`)
        }
    }
}

system.runInterval(checkExpiredBounties, 100)

export async function showBountyMenu(player) {
    const isAdmin = typeof player.hasTag === 'function' && player.hasTag("admin")
    const myBounties = getMySetBounties(player.name)
    const hasActiveBounty = myBounties.length > 0
    const targetInfo = hasActiveBounty ? myBounties[0].target : null
    const form = new ActionFormData()
        .title("§c✦ Bounty System ✦")
        .body("Choose a bounty menu:" + (hasActiveBounty ? `\n§cYou already have an active bounty on ${targetInfo}` : ""))
        .button("View Active Bounties", "textures/ui/regeneration_effect")
    if (hasActiveBounty) {
        form.button("§8Set a Bounty (Already Active)", "textures/ui/red_dot")
    } else {
        form.button("Set a Bounty", "textures/ui/red_dot")
    }
    form.button("Cancel My Bounty", "textures/ui/listx")
    if (isAdmin) form.button("Settings", "textures/ui/gear")
    if (isAdmin) form.button("Customize NPC", "textures/ui/dressing_room_skins")
    form.button("Close", "textures/ui/cancel")
    const res = await form.show(player)
    if (res.canceled) return
    let idx = 0
    if (res.selection === idx++) return showBountyList(player)
    if (hasActiveBounty) idx++ // skip set bounty if disabled
    else if (res.selection === idx++) return showAddBounty(player)
    if (res.selection === idx++) return showCancelBounty(player)
    if (isAdmin && res.selection === idx++) return showBountySettings(player)
    if (isAdmin && res.selection === idx++) {
        player.runCommand('dialogue open @e[type=npc,c=1,r=5] @s')
        return
    }
}

async function showBountySettings(player) {
    const isAdmin = typeof player.hasTag === 'function' && player.hasTag("admin")
    if (!isAdmin) {
        showBountyMenu(player)
        return
    }
    const minBounty = getMinBounty()
    const refundPercent = getRefundPercent()
    const cooldown = getBountyCooldown()
    const expire = getBountyExpire()
    const form = new ModalFormData()
        .title("Bounty Settings")
        .textField("Minimum bounty amount", minBounty.toString(), { defaultValue: minBounty.toString(), tooltip: "Set the minimum bounty amount" })
        .textField("Refund percent (1-100)", refundPercent.toString(), { defaultValue: refundPercent.toString(), tooltip: "Set the refund percent for cancel" })
        .textField("Bounty cooldown (seconds, 0 = no cooldown)", (cooldown / 1000).toString(), { defaultValue: (cooldown / 1000).toString(), tooltip: "Cooldown between setting bounties" })
        .textField("Bounty expire (minutes, 0 = never)", (expire / 60000).toString(), { defaultValue: (expire / 60000).toString(), tooltip: "How long before bounty expires" })
    const res = await form.show(player)
    if (res.canceled) {
        showBountyMenu(player)
        return
    }
    const newMin = parseInt(res.formValues[0])
    const newRefund = parseInt(res.formValues[1])
    const newCooldown = Math.max(0, parseInt(res.formValues[2]) || 0) * 1000
    const newExpire = Math.max(0, parseInt(res.formValues[3]) || 0) * 60000
    if (isNaN(newMin) || newMin < 1) {
        player.sendMessage("Invalid minimum bounty amount.")
        showBountySettings(player)
        return
    }
    if (isNaN(newRefund) || newRefund < 1 || newRefund > 100) {
        player.sendMessage("Invalid refund percent (must be 1-100).")
        showBountySettings(player)
        return
    }
    if (isNaN(newCooldown) || newCooldown < 0) {
        player.sendMessage("Invalid cooldown value.")
        showBountySettings(player)
        return
    }
    if (isNaN(newExpire) || newExpire < 0) {
        player.sendMessage("Invalid expire value.")
        showBountySettings(player)
        return
    }
    setMinBounty(newMin)
    setRefundPercent(newRefund)
    setBountyCooldown(newCooldown)
    setBountyExpire(newExpire)
    player.sendMessage(`Minimum bounty set to $${newMin}, refund percent set to ${newRefund}%, cooldown set to ${newCooldown / 1000}s, expire set to ${newExpire / 60000}m`)
    showBountyMenu(player)
}

async function showBountyList(player) {
    const bounties = getAllBounties()
    const form = new ActionFormData().title("Active Bounties")
    if (bounties.length === 0) form.body("No active bounties!")
    else bounties.forEach(b => form.button(`${b.target} - $${b.amount}\nSet by: ${b.setter}`))
    form.button("Back", "textures/ui/arrow_left")
    const res = await form.show(player)
    if (!res.canceled && res.selection === bounties.length) showBountyMenu(player)
}

async function showCancelBounty(player) {
    const myBounties = getMySetBounties(player.name)
    if (myBounties.length === 0) {
        player.sendMessage("You have no active bounty to cancel.")
        return
    }
    const bounty = myBounties[0]
    const form = new ActionFormData()
        .title("Cancel Bounty")
        .body(`You have an active bounty on ${bounty.target} for $${bounty.amount}.\nRefund: $${Math.floor(bounty.amount * getRefundPercent() / 100)}\nAre you sure you want to cancel?`)
        .button("Yes, Cancel Bounty", "textures/ui/realms_red_x")
        .button("No, Go Back", "textures/ui/arrow_left")
    const res = await form.show(player)
    if (res.canceled || res.selection === 1) return showBountyMenu(player)
    const result = cancelBounty(player, bounty)
    if (result.ok) player.sendMessage(`Bounty cancelled. You received $${result.refund} refund.`)
    else player.sendMessage(result.msg)
    showBountyMenu(player)
}