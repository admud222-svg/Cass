import { world, system } from "../../core"
import { isInPvPArea, logCombat } from "./index.js"

const MSG = {
  PVP_ON: "§cPvP is now enabled!", PVP_OFF: "§aPvP is now disabled",
  ENTER: "§aYou entered PvP area: §e", LEAVE: "§aYou left the PvP area",
  LEFT: "§ePlayer left during combat!", WIN: "§a§lVICTORY! §r§7You won!",
  LOSE: "§c§lDEFEAT! §r§7You lost!", OPP_LEFT: "§e§lOPPONENT LEFT §r§7Your opponent left!"
}

const inCombat = new Map(), battles = new Map(), countdowns = new Map()

function startBattle(p1, p2) {
  const id = `${p1.name}_vs_${p2.name}`
  battles.set(id, { p1, p2, start: Date.now() })
  battles.set(`${p2.name}_vs_${p1.name}`, { p1: p2, p2: p1, start: Date.now() })
}

function endBattle(n1, n2) { battles.delete(`${n1}_vs_${n2}`); battles.delete(`${n2}_vs_${n1}`) }

function getOpponent(name) {
  for (const [, b] of battles) {
    if (b.p1.name === name) return world.getAllPlayers().find(p => p.name === b.p2.name) || null
    if (b.p2.name === name) return world.getAllPlayers().find(p => p.name === b.p1.name) || null
  }
  return null
}

function startCountdown(leftName, opp) {
  let cd = 7
  const int = system.runInterval(() => {
    if (cd > 0) {
      try { opp.onScreenDisplay.setActionBar(`§e§lOPPONENT LEFT! §r§7Auto-win in: §c${cd}s`) } catch { system.clearRun(int); countdowns.delete(leftName); return }
      cd--
    } else {
      try { opp.onScreenDisplay.setActionBar(MSG.WIN); opp.playSound("random.orb"); opp.runCommand("playsound random.levelup @s") } catch { }
      system.clearRun(int); countdowns.delete(leftName); endBattle(leftName, opp.name)
    }
  }, 20)
  countdowns.set(leftName, int)
}

world.beforeEvents.playerLeave.subscribe(({ player }) => {
  const name = player.name, opp = getOpponent(name)
  if (opp) { startCountdown(name, opp); opp.onScreenDisplay.setActionBar(MSG.OPP_LEFT) }
  if (inCombat.has(name)) {
    const pvp = isInPvPArea(player)
    if (pvp.inArea) for (const p of world.getPlayers()) {
      const pp = isInPvPArea(p)
      if (pp.inArea && pp.areaName === pvp.areaName) p.onScreenDisplay.setActionBar(`§c${name} ${MSG.LEFT}`)
    }
    inCombat.delete(name)
  }
  if (countdowns.has(name)) { system.clearRun(countdowns.get(name)); countdowns.delete(name) }
})

world.afterEvents.playerSpawn.subscribe(({ player }) => {
  const name = player.name
  if (countdowns.has(name)) {
    system.clearRun(countdowns.get(name)); countdowns.delete(name)
    const opp = getOpponent(name)
    if (opp) {
      player.onScreenDisplay.setActionBar("§a§lYOU RETURNED! §r§7Battle continues!")
      opp.onScreenDisplay.setActionBar("§e§lOPPONENT RETURNED! §r§7Battle continues!")
    }
  }
})

world.afterEvents.entityHurt.subscribe(e => {
  const { hurtEntity: t, damageSource: s } = e
  if (t.typeId !== "minecraft:player" || s.damagingEntity?.typeId !== "minecraft:player") return
  const atk = s.damagingEntity, tgt = t
  if (atk.dimension.id !== "minecraft:overworld" || tgt.dimension.id !== "minecraft:overworld") return
  const aPvp = isInPvPArea(atk), tPvp = isInPvPArea(tgt)
  if (!aPvp.inArea || !tPvp.inArea) return
  const wpn = atk.getComponent("minecraft:equippable")?.getEquipment("Mainhand")?.typeId || "Hand"
  logCombat(atk, tgt, e.damage, wpn)
  const existing = getOpponent(atk.name)
  if (!existing || existing.name !== tgt.name) {
    startBattle(atk, tgt)
    atk.onScreenDisplay.setActionBar(`§c§lPVP! §r§7vs ${tgt.name}`)
    tgt.onScreenDisplay.setActionBar(`§c§lPVP! §r§7vs ${atk.name}`)
    atk.playSound("note.pling", { volume: 1, pitch: 0.5 }); tgt.playSound("note.pling", { volume: 1, pitch: 0.5 })
  }
  const now = Date.now()
  inCombat.set(atk.name, { time: now, opp: tgt.name, area: aPvp.areaName })
  inCombat.set(tgt.name, { time: now, opp: atk.name, area: tPvp.areaName })
})

// Combined interval - was 2 separate (20 and 100 ticks), now 1 at 40 ticks
let cleanupCnt = 0
system.runInterval(() => {
  const now = Date.now()
  // PvP area status check (was every 20 ticks)
  for (const p of world.getPlayers()) {
    const pvp = isInPvPArea(p)
    if (!p.pvpAreaStatus) p.pvpAreaStatus = { inArea: false, areaName: null }
    if (pvp.inArea !== p.pvpAreaStatus.inArea) {
      if (pvp.inArea) {
        p.onScreenDisplay.setActionBar(`${MSG.ENTER}${pvp.areaName}`)
        p.onScreenDisplay.setActionBar(MSG.PVP_ON)
      } else {
        p.onScreenDisplay.setActionBar(MSG.LEAVE)
        p.onScreenDisplay.setActionBar(MSG.PVP_OFF)
        inCombat.delete(p.name)
      }
      p.pvpAreaStatus = pvp
    }
  }

  // Combat timeout cleanup (was every 100 ticks, now every 3rd iteration = 120 ticks)
  if (++cleanupCnt >= 3) {
    cleanupCnt = 0
    for (const [name, data] of inCombat) if (now - data.time > 30000) inCombat.delete(name)
  }
}, 40)

export function isPlayerInCombat(name) { return inCombat.has(name) }
export function getCombatData(name) { return inCombat.get(name) }
export function removeFromCombat(name) { return inCombat.delete(name) }
export { startBattle as startPvPBattle, endBattle as endPvPBattle, getOpponent, }
export function endPvPBattleManually(p1, p2, winner = null) {
  if (countdowns.has(p1.name)) { system.clearRun(countdowns.get(p1.name)); countdowns.delete(p1.name) }
  if (countdowns.has(p2.name)) { system.clearRun(countdowns.get(p2.name)); countdowns.delete(p2.name) }
  endBattle(p1.name, p2.name)
  if (winner) {
    const loser = winner.name === p1.name ? p2 : p1
    winner.onScreenDisplay.setActionBar(MSG.WIN); winner.playSound("random.orb")
    loser.onScreenDisplay.setActionBar(MSG.LOSE)
  }
}
