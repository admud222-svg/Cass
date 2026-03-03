import { world, system, ActionFormData, ModalFormData } from "../../core"
import { Database } from "../../function/Database.js"
import "./events.js" 

const MENU_TITLE = "§6Combat Log Menu"
const MENU_OPTIONS = {
  SET_POS1: "Set Position 1",
  SET_POS2: "Set Position 2",
  SET_PVP_AREA: "Set PvP Area",
  TOGGLE: "Toggle Combat Log",
  VIEW_HISTORY: "View Combat History",
  CLEAR_HISTORY: "Clear History",
  VIEW_AREAS: "View PvP Areas",
  REMOVE_AREA: "Remove PvP Area",
}


const NOTIFICATIONS = {
  PVP_OVERWORLD_ONLY: "§cPvP areas can only be created in the Overworld!",
  BOTH_POSITIONS_SET: "§aBoth positions are set! You can now use 'Set PvP Area' button to create the PvP area.",
  BOTH_POSITIONS_REQUIRED: "§cBoth positions must be set first!",
  SAME_DIMENSION_REQUIRED: "§cBoth positions must be in the same dimension!",
  VALID_AREA_NAME_REQUIRED: "§cPlease enter a valid area name!",
  COMBAT_HISTORY_CLEARED: "§aCombat history has been cleared!",
  NO_COMBAT_HISTORY: "§eNo combat history available.",
  NO_PVP_AREAS: "§eNo PvP areas found.",
  NO_PVP_AREAS_TO_REMOVE: "§eNo PvP areas to remove.",
  PVP_PROTECTION: "§aYou were protected from PvP damage in the Overworld!",
  PVP_ENABLED: "§cPvP is now enabled!",
  PVP_DISABLED: "§aPvP is now disabled",
  ENTERED_PVP_AREA: "§aYou entered PvP area: §e",
  LEFT_PVP_AREA: "§aYou left the PvP area",
}

let combatHistory = []
let isCombatLogEnabled = true
let playerPositions = new Map()

const pvpAreasDb = Database.getDatabase("pvpAreas")
const combatLogDb = Database.getDatabase("combatLog")

export function showCombatLogMenu(player, previousMenu = null) {
  const playerName = player.name
  const positions = playerPositions.get(playerName)
  const hasBothPositions = positions && positions.pos1 && positions.pos2
  const form = new ActionFormData().title(MENU_TITLE).button(MENU_OPTIONS.SET_POS1).button(MENU_OPTIONS.SET_POS2)
  if (hasBothPositions) {
    form.button(MENU_OPTIONS.SET_PVP_AREA)
  }
  form.button(MENU_OPTIONS.TOGGLE).button(MENU_OPTIONS.VIEW_HISTORY).button(MENU_OPTIONS.CLEAR_HISTORY).button(MENU_OPTIONS.VIEW_AREAS).button(MENU_OPTIONS.REMOVE_AREA).button("§cBack")
  form.show(player).then(response => {
    if (response.canceled) {
      if (previousMenu && typeof previousMenu === "function") {
        previousMenu(player)
      }
      return
    }
    let buttonIndex = 0
    if (response.selection === buttonIndex) {
      setPosition(player, 1)
      return
    }
    buttonIndex++
    if (response.selection === buttonIndex) {
      setPosition(player, 2)
      return
    }
    buttonIndex++
    if (hasBothPositions) {
      if (response.selection === buttonIndex) {
        showCreateAreaForm(player, () => showCombatLogMenu(player, previousMenu))
        return
      }
      buttonIndex++
    }
    if (response.selection === buttonIndex) {
      isCombatLogEnabled = !isCombatLogEnabled
      player.sendMessage(`Combat Log has been ${isCombatLogEnabled ? "§aenabled" : "§cdisabled"}`)
      return
    }
    buttonIndex++
    if (response.selection === buttonIndex) {
      showCombatHistory(player, () => showCombatLogMenu(player, previousMenu))
      return
    }
    buttonIndex++
    if (response.selection === buttonIndex) {
      combatHistory = []
      player.sendMessage(NOTIFICATIONS.COMBAT_HISTORY_CLEARED)
      return
    }
    buttonIndex++
    if (response.selection === buttonIndex) {
      showPvPAreas(player, () => showCombatLogMenu(player, previousMenu))
      return
    }
    buttonIndex++
    if (response.selection === buttonIndex) {
      showRemoveAreaMenu(player, () => showCombatLogMenu(player, previousMenu))
      return
    }
    buttonIndex++
    if (response.selection === buttonIndex) {
      if (previousMenu && typeof previousMenu === "function") {
        previousMenu(player)
      }
      return
    }
  })
}

function showCombatHistory(player, previousMenu = null) {
  if (combatHistory.length === 0) {
    player.sendMessage(NOTIFICATIONS.NO_COMBAT_HISTORY)
    if (previousMenu && typeof previousMenu === "function") {
      previousMenu(player)
    }
    return
  }
  const form = new ActionFormData().title("§6Combat History")
  combatHistory.forEach(log => {
    form.button(log)
  })
  form.button("§cBack")
  form.show(player).then(response => {
    if (response.canceled || response.selection === combatHistory.length) {
      if (previousMenu && typeof previousMenu === "function") {
        previousMenu(player)
      }
    }
  })
}

function setPosition(player, posNumber) {
  const playerName = player.name
  const location = player.location
  if (player.dimension.id !== "minecraft:overworld") {
    player.sendMessage(NOTIFICATIONS.PVP_OVERWORLD_ONLY)
    return
  }
  if (!playerPositions.has(playerName)) {
    playerPositions.set(playerName, {})
  }
  const positions = playerPositions.get(playerName)
  positions[`pos${posNumber}`] = {
    x: Math.floor(location.x),
    y: -64,
    z: Math.floor(location.z),
    dimension: player.dimension.id,
  }
  player.sendMessage(`§aPosition ${posNumber} set at: §e${Math.floor(location.x)}, -64-320, ${Math.floor(location.z)} §7(Full height protection)`)
  if (positions.pos1 && positions.pos2) {
    player.sendMessage(NOTIFICATIONS.BOTH_POSITIONS_SET)
  }
}

function showCreateAreaForm(player, previousMenu = null) {
  const form = new ModalFormData().title("§6Create PvP Area").textField("Area Name:", "Enter area name", { defaultValue: "" }).toggle("Enable PvP in this area", { defaultValue: true })
  form.show(player).then(response => {
    if (response.canceled) {
      if (previousMenu && typeof previousMenu === "function") {
        previousMenu(player)
      }
      return
    }
    const areaName = response.formValues[0]
    const enablePvP = response.formValues[1]
    if (!areaName || areaName.trim() === "") {
      player.sendMessage(NOTIFICATIONS.VALID_AREA_NAME_REQUIRED)
      if (previousMenu && typeof previousMenu === "function") {
        previousMenu(player)
      }
      return
    }
    createPvPArea(player, areaName.trim(), enablePvP)
    if (previousMenu && typeof previousMenu === "function") {
      previousMenu(player)
    }
  })
}

function createPvPArea(player, areaName, enablePvP) {
  const playerName = player.name
  const positions = playerPositions.get(playerName)
  if (!positions || !positions.pos1 || !positions.pos2) {
    player.sendMessage(NOTIFICATIONS.BOTH_POSITIONS_REQUIRED)
    return
  }
  if (positions.pos1.dimension !== positions.pos2.dimension) {
    player.sendMessage(NOTIFICATIONS.SAME_DIMENSION_REQUIRED)
    return
  }
  if (positions.pos1.dimension !== "minecraft:overworld") {
    player.sendMessage(NOTIFICATIONS.PVP_OVERWORLD_ONLY)
    return
  }
  const minX = Math.min(positions.pos1.x, positions.pos2.x)
  const maxX = Math.max(positions.pos1.x, positions.pos2.x)
  const minY = -64
  const maxY = 320
  const minZ = Math.min(positions.pos1.z, positions.pos2.z)
  const maxZ = Math.max(positions.pos1.z, positions.pos2.z)
  const areaData = {
    name: areaName,
    creator: playerName,
    dimension: positions.pos1.dimension,
    bounds: { minX, maxX, minY, maxY, minZ, maxZ },
    enablePvP: enablePvP,
    created: new Date().toISOString(),
  }
  pvpAreasDb.set(areaName, areaData)
  player.sendMessage(`§aPvP Area '§e${areaName}§a' created successfully in Overworld!`)
  player.sendMessage(`§7Area: §f${minX},-64,${minZ} §7to §f${maxX},320,${maxZ} §7(Full height protection)`)
  playerPositions.delete(playerName)
}

function showPvPAreas(player, previousMenu = null) {
  const areas = []
  for (const [name, data] of pvpAreasDb) {
    areas.push({ name, data })
  }
  if (areas.length === 0) {
    player.sendMessage(NOTIFICATIONS.NO_PVP_AREAS)
    if (previousMenu && typeof previousMenu === "function") {
      previousMenu(player)
    }
    return
  }
  const form = new ActionFormData().title("§6PvP Areas")
  areas.forEach(area => {
    const bounds = area.data.bounds
    const info = `§e${area.name}\n§7Creator: §f${area.data.creator}§f | §7Bounds: §f${bounds.minX},${bounds.minY},${bounds.minZ} §7to §f${bounds.maxX},${bounds.maxY},${bounds.maxZ}\n§7PvP: ${area.data.enablePvP ? "§aEnabled" : "§cDisabled"}`
    form.button(info, "textures/block/bedrock")
  })
  form.button("§cBack")
  form.show(player).then(response => {
    if (response.canceled || response.selection === areas.length) {
      if (previousMenu && typeof previousMenu === "function") {
        previousMenu(player)
      }
    }
  })
}

function showRemoveAreaMenu(player, previousMenu = null) {
  const areas = []
  for (const [name, data] of pvpAreasDb) {
    areas.push({ name, data })
  }
  if (areas.length === 0) {
    player.sendMessage(NOTIFICATIONS.NO_PVP_AREAS_TO_REMOVE)
    if (previousMenu && typeof previousMenu === "function") {
      previousMenu(player)
    }
    return
  }
  const form = new ActionFormData().title("§cRemove PvP Area")
  areas.forEach(area => {
    form.button(`§c${area.name}\n§7Creator: §f${area.data.creator}`)
  })
  form.button("§cBack")
  form.show(player).then(response => {
    if (response.canceled) {
      if (previousMenu && typeof previousMenu === "function") {
        previousMenu(player)
      }
      return
    }
    if (response.selection === areas.length) {
      if (previousMenu && typeof previousMenu === "function") {
        previousMenu(player)
      }
      return
    }
    const selectedArea = areas[response.selection]
    if (selectedArea) {
      pvpAreasDb.delete(selectedArea.name)
      player.sendMessage(`§aPvP Area '§e${selectedArea.name}§a' has been removed!`)
      if (previousMenu && typeof previousMenu === "function") {
        previousMenu(player)
      }
    }
  })
}

export function isInPvPArea(player) {
  const location = player.location
  const dimension = player.dimension.id
  if (dimension !== "minecraft:overworld") {
    return { inArea: false }
  }
  for (const [name, data] of pvpAreasDb) {
    if (data.dimension !== dimension || !data.enablePvP) continue
    const bounds = data.bounds
    if (location.x >= bounds.minX && location.x <= bounds.maxX && location.y >= -64 && location.y <= 320 && location.z >= bounds.minZ && location.z <= bounds.maxZ) {
      return { inArea: true, areaName: name, areaData: data }
    }
  }
  return { inArea: false }
}

export function logCombat(attacker, target, damage, weapon = "Unknown") {
  if (!isCombatLogEnabled) return
  const timestamp = new Date().toLocaleString()
  const logEntry = `§7[${timestamp}] §c${attacker.name} §7attacked §c${target.name} §7with §e${weapon} §7for §c${damage} §7damage`
  combatHistory.push(logEntry)
  if (combatHistory.length > 50) {
    combatHistory.shift()
  }
  const combatData = {
    attacker: attacker.name,
    target: target.name,
    damage: damage,
    weapon: weapon,
    timestamp: timestamp,
    attackerPos: attacker.location,
    targetPos: target.location,
  }
  const logId = `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  combatLogDb.set(logId, combatData)
}



system.runTimeout(async () => {
  await combatLogDb.ready()
  await pvpAreasDb.ready()
  const recentLogs = []
  for (const [logId, logData] of combatLogDb) {
    if (logData.timestamp) {
      const logEntry = `§7[${logData.timestamp}] §c${logData.attacker} §7attacked §c${logData.target} §7with §e${logData.weapon} §7for §c${logData.damage} §7damage`
      recentLogs.push({ timestamp: new Date(logData.timestamp), entry: logEntry })
    }
  }
  recentLogs.sort((a, b) => b.timestamp - a.timestamp)
  combatHistory = recentLogs.slice(0, 50).map(log => log.entry)
  console.log("Combat Log system initialized successfully!")
}, 100)
