import { system, CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, Player } from "../../core"
import { getAllWarps, teleportToWarp } from "../../warp.js"
import { teleportToDeathLocation } from "../../menu_member/back_to_die/tp_to_die.js"
import { showMemberMenu, featureStatus } from "../../member.js"
import { random_tp_instant } from "../../menu_member/random_teleport.js"
import { Shop } from "../../menu_member/functions/shop/index.js"
import { TeleportRequest } from "../../menu_member/Request Teleport.js"

const getPlayer = origin => origin?.initiator || origin.sourceEntity
const isPlayer = player => player instanceof Player
const success = () => ({ status: CustomCommandStatus.Success })
const failure = (message = "Players only.") => ({ status: CustomCommandStatus.Failure, message })

const checkFeature = (player, feature, featureName) => {
  if (!featureStatus[feature]) {
    player.sendMessage(`§c✘ ${featureName} feature is currently disabled by admin.`)
    system.run(() => player.playSound("note.bass"))
    return false
  }
  return true
}

const handlers = {
  clearchat: origin => {
    const player = getPlayer(origin)
    if (!isPlayer(player)) return failure("This command is for players only.")

    system.run(() => player.runCommand(`execute as @e[c=2] as @e[c=2] as @e[c=2] as @e[c=2] as @e[c=2] as @e[c=2] as @e[c=2] run tellraw @a {\"rawtext\":[{\"text\":\"clearchat-nperma\"}]}`))
    system.runTimeout(() => {
      player.sendMessage(`§a§l[ClearChat] §r§aChat cleared successfully.`)
      player.playSound("random.orb")
    }, 20)
    return success()
  },

  help: origin => {
    const player = getPlayer(origin)
    if (!isPlayer(player)) return failure()

    const message = [
      "§l§9━━━[ KIW ESSENTIALS HELP ]━━━§r",
      "§bCommands:§r",
      "§3• §f/kiw:help §7- Show this help",
      "§3• §f/kiw:info §7- Server info",
      "§3• §f/kiw:rules §7- Server rules",
      "§3• §f/kiw:warp §7- List/teleport to warps",
      "§3• §f/kiw:back §7- Return to last death location",
      "§3• §f/kiw:menu §7- Open member menu",
      "§3• §f/kiw:rtp §7- Random teleport",
      "§3• §f/kiw:shop §7- Open shop menu",
      "§3• §f/kiw:tpa §7- View teleport menu",
      "§3• §f/kiw:clearchat §7- Clear your chat",
      "",
      "§eTips:§r",
      "§7- Use §f/kiw:help§7 anytime for this menu",
      "§7- Commands are not case-sensitive",
      "§8━━━━━━━━━━━━━━━━━━━━━━§r",
    ].join("\n")

    player.sendMessage(message)
    return success()
  },

  info: origin => {
    const player = getPlayer(origin)
    if (!isPlayer(player)) return failure()

    const message = ["§l§2━━━[ SERVER INFO ]━━━§r", "§a• §fCreator: §bKiworaID", "§a• §fVersion: §e5.0.0", "§a• §fWebsite: §9kiworastudio.com", "§8© 2025 Kiw-Essentials. All rights reserved.", "§8━━━━━━━━━━━━━━━━━━━━━━§r"].join("\n")

    player.sendMessage(message)
    return success()
  },

  rules: origin => {
    const player = getPlayer(origin)
    if (!isPlayer(player)) return failure()

    const message = ["§l§6━━━[ SERVER RULES ]━━━§r", "§c1. §fNo griefing", "§c2. §fBe respectful", "§c3. §fNo cheating or hacking", "§c4. §fNo spamming", "§c5. §fNo advertising", "§c6. §fNo scamming", "§c7. §fNo toxic or hate speech", "§c8. §fFollow staff instructions", "", "§eBreaking rules may result in mute, kick, or ban.", "§8━━━━━━━━━━━━━━━━━━━━━━§r"].join("\n")

    player.sendMessage(message)
    return success()
  },

  warp: (origin, name) => {
    const player = getPlayer(origin)
    if (!isPlayer(player)) return failure()
    if (!checkFeature(player, "warp", "Warp")) return failure("Warp feature is disabled")

    if (!name) {
      const warps = getAllWarps()
      if (!warps.length) {
        player.sendMessage("§cNo warps have been created yet.")
        return success()
      }
      const list = warps.map(w => `§b${w.Name}`).join("§7, ")
      player.sendMessage(`§aAvailable Warps: ${list}`)
      player.sendMessage(`§aUse /kiw:warp / warp <warp name> to teleport to a warp. Warp names must be one word, no spaces allowed.`)
      return success()
    }

    const warps = getAllWarps()
    const idx = warps.findIndex(w => w.Name.toLowerCase() === name.toLowerCase())
    if (idx === -1) {
      player.sendMessage(`§cWarp "${name}" tidak ditemukan.`)
      return failure()
    }

    teleportToWarp(player, warps, idx)
    return success()
  },

  back: origin => {
    const player = getPlayer(origin)
    if (!isPlayer(player)) return failure()
    if (!checkFeature(player, "setHome", "Set Home")) return failure("Set Home feature is disabled")

    teleportToDeathLocation(player)
    return success()
  },

  menu: origin => {
    const player = getPlayer(origin)
    if (!isPlayer(player)) return failure()

    if (!Object.values(featureStatus).some(status => status)) {
      player.sendMessage("§c✘ All member features are currently disabled by admin.")
      system.run(() => player.playSound("note.bass"))
      return failure("All member features are disabled")
    }

    system.run(() => showMemberMenu(player))
    return success()
  },

  rtp: origin => {
    const player = getPlayer(origin)
    if (!isPlayer(player)) return failure()
    if (!checkFeature(player, "randomTeleport", "Random Teleport")) return failure("Random teleport feature is disabled")

    random_tp_instant(player)
    return success()
  },

  shop: origin => {
    const player = getPlayer(origin)
    if (!isPlayer(player)) return failure()
    if (!checkFeature(player, "shop", "Shop")) return failure("Shop feature is disabled")

    system.run(() => Shop(player))
    return success()
  },

  tpa: origin => {
    const player = getPlayer(origin)
    if (!isPlayer(player)) return failure()

    system.run(() => TeleportRequest(player))
    return success()
  },
}

const commands = [
  { name: "kiw:clearchat", description: "Clear your chat", handler: handlers.clearchat },
  { name: "kiw:help", description: "Show help message", handler: handlers.help },
  { name: "kiw:info", description: "Dev information", handler: handlers.info },
  { name: "kiw:rules", description: "View server rules", handler: handlers.rules },
  { name: "kiw:warp", description: "List or teleport to a warp", handler: handlers.warp, params: [{ name: "name", type: CustomCommandParamType.String }] },
  { name: "kiw:back", description: "Return to last death location", handler: handlers.back },
  { name: "kiw:menu", description: "Open member menu", handler: handlers.menu },
  { name: "kiw:rtp", description: "Random teleport", handler: handlers.rtp },
  { name: "kiw:shop", description: "Open shop menu", handler: handlers.shop },
  { name: "kiw:tpa", description: "View player join/leave logs", handler: handlers.tpa },
]

export function registerCustomCommands(system) {
  system.beforeEvents.startup.subscribe(init => {
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i]
      const commandConfig = {
        name: cmd.name,
        description: cmd.description,
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
        ...(cmd.params && { optionalParameters: cmd.params }),
      }
      init.customCommandRegistry.registerCommand(commandConfig, cmd.handler)
    }
  })
}
