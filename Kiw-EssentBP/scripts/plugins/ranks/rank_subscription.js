import { world, system } from "@minecraft/server"
import { ActionFormData, ModalFormData } from "@minecraft/server-ui"
import { Database } from "../../function/Database.js"
import { uuidRanks, RANK_PREFIX, setDefaultRank } from "./rank.js"
const subscriptionDB = new Database("rankSubscriptions")
const playerDB = Database.getDatabase("players") || new Database("players")
let subscribedPlayersCache = null
let lastCacheUpdate = 0
const CACHE_DURATION = 5000
export const SUBSCRIPTION_PERIODS = {
  "10_seconds": 10 * 1000,
  "30_seconds": 30 * 1000,
  "1_minute": 60 * 1000,
  "5_minutes": 5 * 60 * 1000,
  "1_day": 24 * 60 * 60 * 1000,
  "3_days": 3 * 24 * 60 * 60 * 1000,
  "1_week": 7 * 24 * 60 * 60 * 1000,
  "2_weeks": 14 * 24 * 60 * 60 * 1000,
  "1_month": 30 * 24 * 60 * 60 * 1000,
  "3_months": 90 * 24 * 60 * 60 * 1000,
  "6_months": 180 * 24 * 60 * 60 * 1000,
  "1_year": 365 * 24 * 60 * 60 * 1000,
}
export const PERIOD_NAMES = {
  "10_seconds": "10 Seconds",
  "30_seconds": "30 Seconds",
  "1_minute": "1 Minute",
  "5_minutes": "5 Minutes",
  "1_day": "1 Day",
  "3_days": "3 Days",
  "1_week": "1 Week",
  "2_weeks": "2 Weeks",
  "1_month": "1 Month",
  "3_months": "3 Months",
  "6_months": "6 Months",
  "1_year": "1 Year",
}
function getStoredPlayers() {
  try {
    return playerDB.get("playerList", [])
  } catch (error) {
    return []
  }
}
function addStoredPlayer(playerName) {
  try {
    let players = getStoredPlayers()
    if (!players.includes(playerName)) {
      players.push(playerName)
      playerDB.set("playerList", players)
    }
  } catch (error) {}
}
function getSubscribedPlayers() {
  const currentTime = Date.now()
  if (subscribedPlayersCache && currentTime - lastCacheUpdate < CACHE_DURATION) {
    return subscribedPlayersCache
  }
  try {
    const subscriptionData = subscriptionDB.get("subscriptions", {})
    subscribedPlayersCache = subscriptionData
    lastCacheUpdate = currentTime
    return subscribedPlayersCache
  } catch (error) {
    return {}
  }
}
async function saveSubscribedPlayers(subscriptions) {
  try {
    subscriptionDB.set("subscriptions", subscriptions)
    subscribedPlayersCache = subscriptions
    lastCacheUpdate = Date.now()
    return true
  } catch (error) {
    return false
  }
}
async function getPlayerList() {
  try {
    const onlinePlayers = [...world.getAllPlayers()]
    const onlineNames = onlinePlayers.map(p => p.name)
    let storedPlayers = getStoredPlayers()
    for (const playerName of onlineNames) {
      if (!storedPlayers.includes(playerName)) {
        addStoredPlayer(playerName)
      }
    }
    storedPlayers = getStoredPlayers()
    const allPlayers = [...new Set([...onlineNames, ...storedPlayers])]
    return allPlayers.map(name => ({
      name,
      isOnline: onlineNames.includes(name),
      display: `${name} ${onlineNames.includes(name) ? "[§aONLINE§f]" : "[§4OFFLINE§f]"}`,
    }))
  } catch (error) {
    return []
  }
}
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  const remainingMinutes = minutes % 60
  const remainingSeconds = seconds % 60
  const parts = []
  if (days > 0) parts.push(`${days}d`)
  if (remainingHours > 0) parts.push(`${remainingHours}h`)
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}m`)
  if (remainingSeconds > 0 || parts.length === 0) parts.push(`${remainingSeconds}s`)
  return parts.join(" ")
}
export async function showRankSubscriptionAdminMenu(player) {
  try {
    const form = new ActionFormData().title("Rank Subscription Admin").body("§eManage player rank subscriptions:").button("§fCreate Subscription\n§8Add new subscription", "textures/ui/icon_recipe_item").button("§fRemove Subscription\n§8Remove existing subscription", "textures/ui/trash_default").button("§fSubscription List\n§8View all subscriptions", "textures/ui/copy").button("§fBack\n§8Return to main menu", "textures/ui/arrow_left")
    const response = await form.show(player)
    if (response.canceled) return
    switch (response.selection) {
      case 0:
        await showCreateSubscriptionMenu(player)
        break
      case 1:
        await showRemoveSubscriptionMenu(player)
        break
      case 2:
        await showSubscriptionList(player)
        break
      case 3:
        return
    }
  } catch (error) {
    player.sendMessage("§cError displaying admin rank subscription menu!")
  }
}
function checkExpiredSubscriptions() {
  try {
    const currentTime = Date.now()
    const subscriptions = getSubscribedPlayers()
    let hasChanges = false
    for (const [playerName, subscription] of Object.entries(subscriptions)) {
      if (subscription.endTime <= currentTime) {
        const player = world.getAllPlayers().find(p => p.name === playerName)
        if (player) {
          setDefaultRank(player)
          player.sendMessage("§cYour rank subscription has expired!")
          player.playSound("random.break")
        }
        delete subscriptions[playerName]
        hasChanges = true
      }
    }
    if (hasChanges) {
      saveSubscribedPlayers(subscriptions)
    }
  } catch (error) {}
}
async function showCreateSubscriptionMenu(player) {
  try {
    const allPlayers = await getPlayerList()
    const players = allPlayers
    if (players.length === 0) {
      players.push({
        name: player.name,
        isOnline: true,
        display: `${player.name} [§aONLINE§f]`,
      })
    }
    const ranks = uuidRanks.filter(r => r.trim() !== "")
    if (ranks.length === 0) {
      player.sendMessage("§cNo ranks available!")
      return
    }
    const periodKeys = Object.keys(SUBSCRIPTION_PERIODS)
    const periodNames = periodKeys.map(key => PERIOD_NAMES[key])
    const form = new ModalFormData()
      .title("Create Rank Subscription")
      .dropdown(
        "§fSelect Player\n§6Choose player to set rank",
        players.map(p => p.display),
        {
          defaultValueIndex: 0,
          tooltip: "§6Select player to give subscription rank",
        }
      )
      .dropdown("§fSelect Rank\n§6Choose rank to give", ranks, {
        defaultValueIndex: 0,
        tooltip: "§6Select rank to give to player",
      })
      .dropdown("§fSelect Duration\n§6Choose subscription duration", periodNames, {
        defaultValueIndex: 0,
        tooltip: "§6Select how long the rank will be active",
      })
      .toggle("§fConfirm\n§6Confirm subscription settings", {
        defaultValue: true,
        tooltip: "§6Confirm to set rank subscription",
      })
    const response = await form.show(player)
    if (response.canceled || !response.formValues[3]) return showRankSubscriptionAdminMenu(player)
    const [playerIndex, rankIndex, periodIndex] = response.formValues
    const selectedPlayer = players[playerIndex]
    const selectedRank = ranks[rankIndex]
    const selectedPeriodKey = periodKeys[periodIndex]
    const currentTime = Date.now()
    const endTime = currentTime + SUBSCRIPTION_PERIODS[selectedPeriodKey]
    const subscription = {
      rank: selectedRank,
      startTime: currentTime,
      endTime: endTime,
      durationKey: selectedPeriodKey,
      issuedBy: player.name,
      isOffline: !selectedPlayer.isOnline,
    }
    const subscriptions = getSubscribedPlayers()
    subscriptions[selectedPlayer.name] = subscription
    if (!(await saveSubscribedPlayers(subscriptions))) {
      player.sendMessage("§cFailed to save subscription data!")
      return showRankSubscriptionAdminMenu(player)
    }
    const onlinePlayer = world.getAllPlayers().find(p => p.name === selectedPlayer.name)
    if (onlinePlayer) {
      subscription.isOffline = false
      const rankTags = onlinePlayer.getTags().filter(t => t.startsWith(RANK_PREFIX))
      for (const tag of rankTags) {
        onlinePlayer.removeTag(tag)
      }
      onlinePlayer.addTag(`${RANK_PREFIX}${selectedRank}`)
      onlinePlayer.addTag(`subscription:${endTime}`)
      onlinePlayer.sendMessage(`§aSubscription rank §6${selectedRank} §ahas been activated!`)
      onlinePlayer.sendMessage(`§aValid until: §f${new Date(endTime).toLocaleString()}`)
      onlinePlayer.playSound("random.levelup")
    }
    player.sendMessage(`§aSubscription rank §6${selectedRank} §ahas been set for §f${selectedPlayer.name}§a!`)
    world.sendMessage(`[RANK SYSTEM]\n§f${selectedPlayer.name} §ahas received rank §6${selectedRank} §afor §f${PERIOD_NAMES[selectedPeriodKey]}`)
    return showRankSubscriptionAdminMenu(player)
  } catch (error) {
    player.sendMessage("§cError creating subscription!")
    return showRankSubscriptionAdminMenu(player)
  }
}
async function showRemoveSubscriptionMenu(player) {
  try {
    const subscriptions = getSubscribedPlayers()
    const currentTime = Date.now()
    const activeSubscriptions = Object.entries(subscriptions)
      .filter(([_, subInfo]) => subInfo.endTime > currentTime)
      .map(([playerName, subInfo]) => ({
        name: playerName,
        display: `${playerName} - ${subInfo.rank} (${formatDuration(subInfo.endTime - currentTime)})${subInfo.isOffline ? " [OFFLINE]" : ""}`,
      }))
    if (activeSubscriptions.length === 0) {
      const errorForm = new ActionFormData().title("Error").body("§cNo active subscriptions!").button("OK")
      await errorForm.show(player)
      return showRankSubscriptionAdminMenu(player)
    }
    const form = new ModalFormData()
      .title("Remove Subscription")
      .dropdown(
        "§fSelect Subscription\n§6Choose subscription to remove",
        activeSubscriptions.map(s => s.display),
        {
          defaultValueIndex: 0,
          tooltip: "§6Select subscription to remove",
        }
      )
      .toggle("§fConfirm\n§6Confirm subscription removal", {
        defaultValue: true,
        tooltip: "§6Confirm to remove subscription",
      })
    const response = await form.show(player)
    if (response.canceled || !response.formValues[1]) return showRankSubscriptionAdminMenu(player)
    const selectedSubscription = activeSubscriptions[response.formValues[0]]
    delete subscriptions[selectedSubscription.name]
    if (!(await saveSubscribedPlayers(subscriptions))) {
      player.sendMessage("§cFailed to remove subscription!")
      return showRankSubscriptionAdminMenu(player)
    }
    const onlinePlayer = world.getAllPlayers().find(p => p.name === selectedSubscription.name)
    if (onlinePlayer) {
      setDefaultRank(onlinePlayer)
      onlinePlayer.sendMessage("§cYour rank subscription has been removed!")
      onlinePlayer.playSound("random.break")
    }
    player.sendMessage(`§aSubscription for §f${selectedSubscription.name} §ahas been removed!`)
    return showRankSubscriptionAdminMenu(player)
  } catch (error) {
    player.sendMessage("§cError removing subscription!")
    return showRankSubscriptionAdminMenu(player)
  }
}
async function showSubscriptionList(player) {
  try {
    const subscriptions = getSubscribedPlayers()
    const currentTime = Date.now()
    const activeSubscriptions = Object.entries(subscriptions)
      .filter(([_, subInfo]) => subInfo.endTime > currentTime)
      .map(([playerName, subInfo]) => ({
        name: playerName,
        rank: subInfo.rank,
        timeLeft: formatDuration(subInfo.endTime - currentTime),
        issuedBy: subInfo.issuedBy,
        startDate: new Date(subInfo.startTime).toLocaleString(),
        endDate: new Date(subInfo.endTime).toLocaleString(),
        isOffline: subInfo.isOffline,
      }))
    const form = new ActionFormData()
      .title("Subscription List")
      .body(activeSubscriptions.length === 0 ? "§cNo active subscriptions." : activeSubscriptions.map(sub => `§fPlayer: §e${sub.name} ${sub.isOffline ? "§7[OFFLINE]§f" : "§a[ONLINE]§f"}\n` + `§fRank: §6${sub.rank}\n` + `§fTime Left: §a${sub.timeLeft}\n` + `§fIssued by: §e${sub.issuedBy}\n` + `§fStart: §7${sub.startDate}\n` + `§fEnd: §7${sub.endDate}`).join("\n\n"))
      .button("Back")
    await form.show(player)
    return showRankSubscriptionAdminMenu(player)
  } catch (error) {
    player.sendMessage("§cError displaying subscription list!")
    return showRankSubscriptionAdminMenu(player)
  }
}
export async function showRankSubscriptionStatusMenu(player) {
  try {
    const subscriptions = getSubscribedPlayers()
    const subscription = subscriptions[player.name]
    const currentTime = Date.now()
    const form = new ActionFormData()
      .title("Rank Subscription Status")
      .body(subscription && subscription.endTime > currentTime ? `§fYour active subscription:\n\n` + `§fRank: §6${subscription.rank}\n` + `§fTime Left: §a${formatDuration(subscription.endTime - currentTime)}\n` + `§fIssued by: §e${subscription.issuedBy}\n` + `§fStart: §7${new Date(subscription.startTime).toLocaleString()}\n` + `§fEnd: §7${new Date(subscription.endTime).toLocaleString()}` : "§cYou don't have any active rank subscription.")
      .button("Back")
    await form.show(player)
  } catch (error) {
    player.sendMessage("§cError displaying subscription status!")
  }
}
system.runInterval(checkExpiredSubscriptions, 100)
world.afterEvents.playerSpawn.subscribe(event => {
  const player = event.player
  addStoredPlayer(player.name)
  const subscriptions = getSubscribedPlayers()
  const subscription = subscriptions[player.name]
  const currentTime = Date.now()
  if (subscription) {
    if (subscription.endTime <= currentTime) {
      setDefaultRank(player)
      delete subscriptions[player.name]
      saveSubscribedPlayers(subscriptions)
      player.sendMessage("§cYour rank subscription has expired!")
      player.playSound("random.break")
    } else {
      subscription.isOffline = false
      saveSubscribedPlayers(subscriptions)
      const rankTags = player.getTags().filter(t => t.startsWith(RANK_PREFIX))
      for (const tag of rankTags) {
        player.removeTag(tag)
      }
      player.addTag(`${RANK_PREFIX}${subscription.rank}`)
      player.addTag(`subscription:${subscription.endTime}`)
      player.sendMessage(`§aRank subscription §6${subscription.rank} §ais still active!`)
      player.sendMessage(`§aValid until: §f${new Date(subscription.endTime).toLocaleString()}`)
      player.playSound("random.levelup")
    }
  }
})
export async function extendSubscription(player, periodKey) {
  try {
    const subscriptions = getSubscribedPlayers()
    const subscription = subscriptions[player.name]
    const currentTime = Date.now()
    if (!subscription || subscription.endTime <= currentTime) {
      player.sendMessage("§cYou don't have an active subscription to extend!")
      return false
    }
    const extensionTime = SUBSCRIPTION_PERIODS[periodKey]
    if (!extensionTime) {
      player.sendMessage("§cInvalid subscription period!")
      return false
    }
    subscription.endTime += extensionTime
    if (!(await saveSubscribedPlayers(subscriptions))) {
      player.sendMessage("§cFailed to extend subscription!")
      return false
    }
    player.sendMessage(`§aYour §6${subscription.rank} §asubscription has been extended!`)
    player.sendMessage(`§aNew expiration date: §f${new Date(subscription.endTime).toLocaleString()}`)
    player.playSound("random.levelup")
    return true
  } catch (error) {
    player.sendMessage("§cError extending subscription!")
    return false
  }
}
