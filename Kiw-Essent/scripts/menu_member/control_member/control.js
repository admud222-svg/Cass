import { ModalFormData, ActionFormData } from "@minecraft/server-ui"
import { world, system } from "@minecraft/server"
import { featureStatus, toggleFeature } from "../../member.js"
import { invalidateHomeCache } from "../../plugins/sethome/Set Home.js"
import { metricNumbers } from "../../lib/game.js"
import { openBattlepassAdmin } from "../../admin_menu/battlepass_admin.js"
import { getAllButtons } from "../../admin_menu/custom_button/custom_database.js"
import { AdminLandConfig } from "../../admin_menu/LandSystem/LandConfig.js"
import { showShopConfigMenu } from "../../admin_menu/shopConfig.js"
import { resetBank } from "../../plugins/bank/resetBank.js"
import { showResetBankMenu } from "../../plugins/bank/resetBank.js"
import { showClanAdminMenu } from "../../plugins/clan/admin.js"
import { ShowAdminPwarpSettings } from "../../admin_menu/pwarp_settings/index.js"
import { configureBackpackSystem } from "../../plugins/backpack/menu.js"

const rtpConfig = {
  maxUses: 3,
  cooldownTime: 5 * 60,
  maxDistance: 2000,
  teleportDelay: 3,
}
const clanConfig = {
  minMembers: 2,
  inactivityDays: 30,
  maxInactivePlayers: 5,
  autoCleanupEnabled: false,
}
const homeConfig = {
  maxHomes: 5,
  minY: -64,
  teleportDelay: 3,
}
const transferConfig = {
  minTransfer: 1000,
  maxTransfer: 1000000,
  enabled: true,
}

export const pwarpConfig = {
  maxPlayerWarps: 5,
}

const buttonTextures = {
  teleport: "textures/ui/conduit_power_effect",
  randomTeleport: "textures/ui/broadcast_glyph_color",
  warp: "textures/ui/icon_recipe_construction",
  pwarp: "textures/ui/glyph_realms",
  setHome: "textures/ui/icon_bell",
  claimLand: "textures/ui/icon_map",
  transferMoney: "textures/ui/invite_base",
  bank: "textures/ui/icon_book_writable",
  clan: "textures/ui/button_custom/clan",
  shop: "textures/ui/button_custom/shop",
  playerShop: "textures/icon_custom/my_characters",
  reportPlayer: "textures/items/trial_key",
  barter: "textures/ui/icon_book_writable",
  backpack: "textures/items/bundle",
  battlepass: "textures/ui/icon_book_writable",
  transferServer: "textures/ui/icon_book_writable",
  emote: "textures/ui/button_custom/snow_angel",
  language: "textures/ui/language_glyph",
}

const textureSettings = {
  useCustomPath: {},
}

const defaultIcons = {
  teleport: "textures/ui/conduit_power_effect",
  randomTeleport: "textures/ui/broadcast_glyph_color",
  warp: "textures/ui/icon_recipe_construction",
  pwarp: "textures/ui/glyph_realms",
  setHome: "textures/ui/icon_bell",
  claimLand: "textures/ui/icon_map",
  transferMoney: "textures/ui/invite_base",
  bank: "textures/ui/icon_book_writable",
  clan: "textures/ui/button_custom/clan",
  shop: "textures/ui/button_custom/shop",
  playerShop: "textures/icon_custom/my_characters",
  reportPlayer: "textures/items/trial_key",
  barter: "textures/ui/icon_book_writable",
  backpack: "textures/items/bundle",
  battlepass: "textures/ui/icon_book_writable",
  transferServer: "textures/ui/world_glyph_color",
  emote: "textures/ui/button_custom/snow_angel",
  language: "textures/ui/language_glyph",
}

const iconSuggestions = ["textures/ui/icon_bell", "textures/ui/creative_icon", "textures/ui/csb_faq_fox", "textures/ui/fire_resistance_effect", "textures/ui/hanging_sign_bamboo", "textures/ui/icon_deals", "textures/ui/icon_balloon", "textures/ui/icon_recipe_nature", "textures/ui/icon_multiplayer", "textures/ui/icon_book_writable", "textures/ui/icon_recipe_item", "textures/ui/icon_recipe_construction", "textures/ui/icon_recipe_nature", "textures/ui/icon_recipe_equipment"]

const messages = {
  success: JSON.stringify({ rawtext: [{ text: "§a✔ Feature status updated successfully!" }] }),
  error: JSON.stringify({ rawtext: [{ text: "§c✘ Failed to update feature status!" }] }),
  configSaved: JSON.stringify({ rawtext: [{ text: "§a✔ Configuration saved successfully!" }] }),
  clanDeleted: JSON.stringify({ rawtext: [{ text: "§a✔ Clan has been deleted successfully!" }] }),
  cleanupStarted: JSON.stringify({ rawtext: [{ text: "§a✔ Clan cleanup process started!" }] }),
}

const features = {
  teleport: { desc: "Teleport to other players" },
  randomTeleport: { desc: "Teleport to random locations" },
  warp: { desc: "Teleport to preset locations" },
  pwarp: { desc: "Teleport to player warps" },
  setHome: { desc: "Set and teleport to home" },
  transferMoney: { desc: "Send money to other players" },
  bank: { desc: "Access banking features" },
  clan: { desc: "Manage clans and members" },
  shop: { desc: "Buy and sell items" },
  playerShop: { desc: "Buy and sell items" },
  reportPlayer: { desc: "Report rule violations" },
  claimLand: { desc: "Claim and manage lands" },
  barter: { desc: "Trade items with other players" },
  backpack: { desc: "Access your backpack" },
  battlepass: { desc: "View battlepass progress" },
  transferServer: { desc: "Transfer to other servers" },
  emote: { desc: "Use player animations and emotes" },
  language: { desc: "Change interface language" },
}

export function control_member(player) {
  showMainMenu(player)
}

function showMainMenu(player) {
  const form = new ActionFormData().title("CONTROL PANEL").body("§eServer Features Settings\n§fManage and configure server features").button("Toggle Features\n§8Enable/Disable Features", "textures/ui/toggle_on").button("Features Status\n§8View All Features Status", "textures/ui/creative_icon").button("Advanced Config\n§8Configure Feature Settings", "textures/ui/creator_glyph_color").button("Custom Textures\n§8Change Button Icons", "textures/ui/icon_setting")
  if (player.name === "admin") form.button("Clan Admin Menu", "textures/ui/button_custom/clan")
  form.button("Back", "textures/ui/arrow_left")

  form.show(player).then(response => {
    if (response.canceled) return
    switch (response.selection) {
      case 0:
        showToggleMenu(player)
        break
      case 1:
        showStatus(player)
        break
      case 2:
        showAdvancedConfig(player)
        break
      case 3:
        configureButtonTextures(player)
        break
      case 4:
        if (player.name === "admin") {
          import("../../plugins/clan/admin.js").then(mod => mod.showAllClansMenu(player))
        } else {
          // If not admin, button 4 is "Back"
          import("../../kiwora.js").then(mod => mod.showMainMenu(player));
        }
        break
      case 5:
        // If admin, button 5 is "Back"
        if (player.name === "admin") {
             import("../../kiwora.js").then(mod => mod.showMainMenu(player));
        }
        break
    }
  })
}

async function showToggleMenu(player) {
  const form = new ActionFormData().title("TOGGLE FEATURES").body("§eFeature Status Settings\n§fClick to enable or disable features")

  // Add standard features
  for (const [feature, status] of Object.entries(featureStatus)) {
    if (!feature.startsWith("custom_")) {
      const { desc } = features[feature] || { desc: "Unknown feature" }
      form.button(`${feature}\n${status ? "§a[ENABLED]" : "§c[DISABLED]"}\n§7${desc}`, status ? "textures/ui/toggle_on" : "textures/ui/toggle_off")
    }
  }

  // Add custom buttons
  const customButtons = getAllButtons()
  for (const btn of customButtons) {
    const feature = `custom_${btn.name}`
    const status = featureStatus[feature] || false
    form.button(`${btn.name}\n${status ? "§a[ENABLED]" : "§c[DISABLED]"}\n§7Custom Button`, status ? "textures/ui/toggle_on" : "textures/ui/toggle_off")
  }

  form.button("Back", "textures/ui/arrow_left")

  try {
    const response = await form.show(player)
    if (response.canceled) return

    const allFeatures = [...Object.keys(featureStatus).filter(f => !f.startsWith("custom_")), ...customButtons.map(b => `custom_${b.name}`)]

    if (response.selection < allFeatures.length) {
      const feature = allFeatures[response.selection]
      featureStatus[feature] = !featureStatus[feature]
      toggleFeature(feature, featureStatus[feature])
      await saveFeatureSettings()
      player.runCommand(`titleraw @s actionbar ${messages.success}`)
      player.runCommand("playsound random.levelup @s")
      showToggleMenu(player)
    } else {
      showMainMenu(player)
    }
  } catch (error) {
    console.warn("Toggle menu error:", error)
    player.runCommand(`titleraw @s actionbar ${messages.error}`)
  }
}

function showStatus(player) {
  const form = new ActionFormData()
    .title("FEATURES STATUS")
    .body(
      "§eFeatures Status List\n§fHere are all available features status:\n\n" +
        Object.entries(featureStatus)
          .map(([feature, status]) => {
            const { desc } = features[feature] || { desc: "Unknown feature" }
            return `${feature}\n§7${desc}\n${status ? "§a✔ ENABLED" : "§c✘ DISABLED"}`
          })
          .join("\n\n")
    )
    .button("Back", "textures/ui/arrow_left")

  form.show(player).then(response => {
    if (response.canceled) return
    showMainMenu(player)
  })
}

function showAdvancedConfig(player) {
  const form = new ActionFormData()
    .title("ADVANCED CONFIGURATION")
    .body("§l§eFEATURE CONFIGURATIONS\n§r§fSelect a feature to configure:")
    .button("Random Teleport\n§r§8Configure RTP Settings", "textures/ui/icon_winter")
    .button("Set Home\n§r§8Configure Home Settings", "textures/ui/icon_recipe_item")
    .button("Transfer Money\n§r§8Configure Transfer Settings", "textures/ui/invite_base")
    .button("Land System\n§r§8Configure Land Claims", "textures/ui/icon_map")
    .button("Shop Config\n§r§8Manage Shop Categories & Items", "textures/ui/icon_blackfriday")
    .button("Backpack System\n§r§8Configure Storage Settings", "textures/ui/realmsStoriesIcon")
    .button("Battlepass\n§r§8Configure Battlepass Settings", "textures/ui/icon_book_writable")
    .button("Clan Admin Menu\n§r§8Configure Clan Settings", "textures/ui/button_custom/clan")
    .button("Reset Bank Player\n§r§8Admin Only", "textures/ui/icon_trash")
    .button("PWarp Config\n§r§8Configure Player Warp", "textures/ui/glyph_realms")
    .button("Button Textures\n§r§8Customize Button Icons", "textures/ui/icon_setting")
    .button("BACK", "textures/ui/arrow_left")

  form.show(player).then(response => {
    if (response.canceled) return
    switch (response.selection) {
      case 0:
        configureRandomTeleport(player)
        break
      case 1:
        configureSetHome(player)
        break
      case 2:
        configureTransferMoney(player)
        break
      case 3:
        configureLandSystem(player)
        break
      case 4:
        configureCustomShop(player)
        break
      case 5:
        configureBackpackSystem(player)
        break
      case 6:
        openBattlepassAdmin(player)
        break
      case 7:
        showClanAdminMenu(player)
        break
      case 8:
        showResetBankMenu(player)
        break
        case 9:
        ShowAdminPwarpSettings(player)
        break
      case 10:
        configureButtonTextures(player)
        break
      case 11:
        showMainMenu(player)
        break
    }
  })
}

function configureRandomTeleport(player) {
  const form = new ModalFormData()
    .title("RTP Configuration")
    .slider("§eMaximum Uses Per Cooldown", 1, 10, {
      defaultValue: rtpConfig.maxUses,
      valueStep: 1,
      tooltip: "Maximum number of times player can use RTP",
    })
    .slider("§eCooldown Time (minutes)", 1, 60, {
      defaultValue: rtpConfig.cooldownTime / 60,
      valueStep: 1,
      tooltip: "Time between uses in minutes",
    })
    .slider("§eMaximum Teleport Distance", 1000, 10000, {
      defaultValue: rtpConfig.maxDistance,
      valueStep: 1000,
      tooltip: "Maximum distance for random teleport",
    })
    .slider("§eTeleport Delay (seconds)", 1, 10, {
      defaultValue: rtpConfig.teleportDelay,
      valueStep: 1,
      tooltip: "Countdown before teleporting",
    })

  form.show(player).then(async response => {
    if (response.canceled) {
      showAdvancedConfig(player)
      return
    }

    const [maxUses, cooldownMinutes, maxDistance, teleportDelay] = response.formValues
    rtpConfig.maxUses = maxUses
    rtpConfig.cooldownTime = cooldownMinutes * 60
    rtpConfig.maxDistance = maxDistance
    rtpConfig.teleportDelay = teleportDelay

    try {
      await world.setDynamicProperty("rtpConfig", JSON.stringify(rtpConfig))
      player.runCommand(`titleraw @s actionbar ${messages.configSaved}`)
      player.runCommand("playsound random.levelup @s")
      new ActionFormData()
        .title("Configuration Saved")
        .body("§eRandom Teleport Settings Updated:\n\n" + `§r§fMaximum Uses: §b${maxUses} times\n` + `§fCooldown Time: §b${cooldownMinutes} minutes\n` + `§fMax Distance: §b${maxDistance} blocks\n` + `§fTeleport Delay: §b${teleportDelay} seconds\n\n` + "§7Changes will take effect immediately.")
        .button("BACK", "textures/ui/arrow_left")
        .show(player)
        .then(() => showAdvancedConfig(player))
    } catch (error) {
      console.warn("Failed to save RTP config:", error)
      player.runCommand(`titleraw @s actionbar ${messages.error}`)
      player.runCommand("playsound note.bass @s")
    }
  })
}

function configureSetHome(player) {
  const form = new ActionFormData()
    .title("SET HOME CONFIGURATION")
    .body("§eMANAGE SET HOME SYSTEM\n§fConfigure settings or view player homes")
    .button("§eGeneral Settings\n§7Max homes, teleport delay, etc.", "textures/ui/icon_setting")
    .button("§bView Player Homes\n§7See and manage player homes", "textures/ui/icon_bell")
    .button("BACK", "textures/ui/arrow_left")

  form.show(player).then(response => {
    if (response.canceled) {
      showAdvancedConfig(player)
      return
    }

    switch (response.selection) {
      case 0:
        configureSetHomeSettings(player)
        break
      case 1:
        showPlayerHomeList(player)
        break
      case 2:
        showAdvancedConfig(player)
        break
    }
  })
}

function configureSetHomeSettings(player) {
  const form = new ModalFormData()
    .title("Set Home Configuration")
    .slider("§eMaximum Homes Per Player", 1, 10, {
      defaultValue: homeConfig.maxHomes,
      valueStep: 1,
      tooltip: "Maximum number of homes per player",
    })
    .slider("§eMinimum Y Level", -64, 0, {
      defaultValue: homeConfig.minY,
      valueStep: 1,
      tooltip: "Minimum Y level for setting home",
    })
    .slider("§eTeleport Delay (seconds)", 1, 10, {
      defaultValue: homeConfig.teleportDelay,
      valueStep: 1,
      tooltip: "Delay before teleporting to home",
    })

  form.show(player).then(async response => {
    if (response.canceled) {
      configureSetHome(player)
      return
    }

    const [maxHomes, minY, teleportDelay] = response.formValues
    homeConfig.maxHomes = maxHomes
    homeConfig.minY = minY
    homeConfig.teleportDelay = teleportDelay

    try {
      await world.setDynamicProperty("homeConfig", JSON.stringify(homeConfig))
      player.runCommand(`titleraw @s actionbar ${messages.configSaved}`)
      player.runCommand("playsound random.levelup @s")
      new ActionFormData()
        .title("Configuration Saved")
        .body("§eSet Home Settings Updated:\n\n" + `§r§fMaximum Homes: §b${maxHomes}\n` + `§fMinimum Y Level: §b${minY}\n` + `§fTeleport Delay: §b${teleportDelay} seconds\n\n` + "§7Changes will take effect immediately.")
        .button("BACK", "textures/ui/arrow_left")
        .show(player)
        .then(() => configureSetHome(player))
    } catch (error) {
      console.warn("Failed to save home config:", error)
      player.runCommand(`titleraw @s actionbar ${messages.error}`)
      player.runCommand("playsound note.bass @s")
    }
  })
}

function getPlayerHomes(pl) {
  const homes = []
  const tags = pl.getTags()

  for (const tag of tags) {
    if (!tag.startsWith('{"Home":{')) continue

    try {
      const parsed = JSON.parse(tag)
      if (parsed?.Home) homes.push({ ...parsed.Home, rawTag: tag })
    } catch {}
  }
  return homes
}

function showPlayerHomeList(player) {
  const allPlayers = world.getAllPlayers()
  const playersWithHomes = []

  for (const pl of allPlayers) {
    const homes = getPlayerHomes(pl)
    if (homes.length > 0) {
      playersWithHomes.push({ player: pl, homes, count: homes.length })
    }
  }

  const form = new ActionFormData()
    .title("PLAYER HOMES")
    .body(`§eONLINE PLAYERS WITH HOMES\n§fTotal: §b${playersWithHomes.length} players\n§7Click to view their homes`)

  if (playersWithHomes.length === 0) {
    form.body("§cNo players with homes found!")
  }

  for (const { player: pl, count } of playersWithHomes) {
    form.button(
      `§e${pl.name}\n§7${count} home${count > 1 ? 's' : ''} set`,
      "textures/ui/icon_bell"
    )
  }

  form.button("BACK", "textures/ui/arrow_left")

  form.show(player).then(response => {
    if (response.canceled) {
      configureSetHome(player)
      return
    }

    if (response.selection < playersWithHomes.length) {
      const selected = playersWithHomes[response.selection]
      const freshHomes = getPlayerHomes(selected.player)
      showPlayerHomeDetails(player, selected.player, freshHomes)
    } else {
      configureSetHome(player)
    }
  })
}

function showPlayerHomeDetails(admin, targetPlayer, homes) {
  const form = new ActionFormData()
    .title(`§e${targetPlayer.name}'s HOMES`)
    .body(`§eMANAGE PLAYER HOMES\n§fTotal: §b${homes.length} home${homes.length > 1 ? 's' : ''}`)

  for (const home of homes) {
    const dimColor = home.Dimension === 'nether' ? '§c' : home.Dimension === 'the_end' ? '§d' : '§a'
    form.button(
      `§e${home.Name}\n§7${dimColor}${home.Dimension} §8| ${home.Pos}`,
      home.Icon || "textures/ui/icon_bell"
    )
  }

  form.button("BACK", "textures/ui/arrow_left")

  form.show(admin).then(response => {
    if (response.canceled) {
      showPlayerHomeList(admin)
      return
    }

    if (response.selection < homes.length) {
      const selectedHome = homes[response.selection]
      showHomeActionMenu(admin, targetPlayer, selectedHome, homes)
    } else {
      showPlayerHomeList(admin)
    }
  })
}

function showHomeActionMenu(admin, targetPlayer, home, allHomes) {
  const form = new ActionFormData()
    .title(`§e${home.Name}`)
    .body(
      `§eHOME DETAILS\n\n` +
      `§fName: §e${home.Name}\n` +
      `§fDescription: §7${home.Description || 'None'}\n` +
      `§fPosition: §b${home.Pos}\n` +
      `§fDimension: §a${home.Dimension}\n` +
      `§fWelcome Message: §7${home.WelcomeMessage || 'None'}\n\n` +
      `§fPlayer: §e${targetPlayer.name}`
    )
    .button("§eTeleport to Home", "textures/ui/conduit_power_effect")
    .button("§cDelete Home", "textures/ui/icon_trash")
    .button("BACK", "textures/ui/arrow_left")

  form.show(admin).then(response => {
    if (response.canceled) {
      showPlayerHomeDetails(admin, targetPlayer, allHomes)
      return
    }

    switch (response.selection) {
      case 0:
        const coords = home.Pos.split(" ")
        if (coords.length === 3) {
          admin.runCommand(`execute in ${home.Dimension} run tp @s ${coords[0]} ${coords[1]} ${coords[2]}`)
          admin.runCommand(`titleraw @s actionbar {"rawtext":[{"text":"§a✔ Teleported to ${home.Name}"}]}`)
          admin.runCommand("playsound random.levelup @s")
        }
        break
      case 1:
        deletePlayerHome(admin, targetPlayer, home, allHomes)
        break
      case 2:
        showPlayerHomeDetails(admin, targetPlayer, allHomes)
        break
    }
  })
}

function deletePlayerHome(admin, targetPlayer, home, allHomes) {
  const form = new ActionFormData()
    .title("§cDELETE HOME")
    .body(`§e⚠ CONFIRM DELETION\n\n§fAre you sure you want to delete:\n§e${home.Name}\n\n§fPlayer: §e${targetPlayer.name}\n\n§cThis action cannot be undone!`)
    .button("§c✘ DELETE", "textures/ui/icon_trash")
    .button("§aCANCEL", "textures/ui/cancel")

  form.show(admin).then(response => {
    if (response.canceled || response.selection !== 0) {
      showHomeActionMenu(admin, targetPlayer, home, allHomes)
      return
    }

    const tags = targetPlayer.getTags()
    const tagToRemove = tags.find(t => t.includes(`"UUID":"${home.UUID}"`))

    if (tagToRemove) {
      try {
        targetPlayer.removeTag(tagToRemove)

        const verifyTags = targetPlayer.getTags()
        const stillExists = verifyTags.find(t => t.includes(`"UUID":"${home.UUID}"`))
        if (stillExists) {
          admin.sendMessage("§c⚠ Failed to delete home! Tag still exists.")
          showPlayerHomeDetails(admin, targetPlayer, allHomes)
          return
        }

        admin.runCommand(`titleraw @s actionbar {"rawtext":[{"text":"§a✔ Home '${home.Name}' deleted!"}]}`)
        admin.runCommand("playsound random.break @s")

        if (targetPlayer.isValid && targetPlayer.isValid()) {
          targetPlayer.sendMessage(`§c⚠ Your home '${home.Name}' has been deleted by an admin.`)
        }

        try {
          if (typeof invalidateHomeCache === 'function') {
            invalidateHomeCache(targetPlayer)
          }
        } catch (e) {
          console.warn("Failed to invalidate home cache:", e)
        }
        
        const updatedHomes = getPlayerHomes(targetPlayer)
        if (updatedHomes.length > 0) {
          showPlayerHomeDetails(admin, targetPlayer, updatedHomes)
        } else {
          showPlayerHomeList(admin)
        }
      } catch (error) {
        // Silent fail - home already deleted successfully
        const updatedHomes = getPlayerHomes(targetPlayer)
        if (updatedHomes.length > 0) {
          showPlayerHomeDetails(admin, targetPlayer, updatedHomes)
        } else {
          showPlayerHomeList(admin)
        }
      }
    } else {
      admin.sendMessage("§c⚠ Home tag not found! The home may have already been deleted.")
      const updatedHomes = getPlayerHomes(targetPlayer)
      if (updatedHomes.length > 0) {
        showPlayerHomeDetails(admin, targetPlayer, updatedHomes)
      } else {
        showPlayerHomeList(admin)
      }
    }
  })
}

function configureTransferMoney(player) {
  const form = new ModalFormData()
    .title("Transfer Money Configuration")
    .slider("§eMinimum Transfer Amount", 1000, 100000, {
      defaultValue: transferConfig.minTransfer,
      valueStep: 1000,
      tooltip: "Minimum amount that can be transferred",
    })
    .slider("§eMaximum Transfer Amount", 10000, 10000000, {
      defaultValue: transferConfig.maxTransfer,
      valueStep: 10000,
      tooltip: "Maximum amount that can be transferred",
    })
    .toggle("§eEnable Transfer System", {
      defaultValue: transferConfig.enabled,
      tooltip: "Enable or disable money transfers",
    })

  form.show(player).then(async response => {
    if (response.canceled) {
      showAdvancedConfig(player)
      return
    }

    const [minTransfer, maxTransfer, enabled] = response.formValues
    transferConfig.minTransfer = minTransfer
    transferConfig.maxTransfer = maxTransfer
    transferConfig.enabled = enabled

    try {
      await world.setDynamicProperty("transferConfig", JSON.stringify(transferConfig))
      player.runCommand(`titleraw @s actionbar ${messages.configSaved}`)
      player.runCommand("playsound random.levelup @s")
      new ActionFormData()
        .title("Transfer Configuration Saved")
        .body("§eTRANSFER MONEY SETTINGS UPDATED:\n" + `§8▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n\n` + `§fMinimum Transfer: §a$${metricNumbers(minTransfer)}\n` + `§fMaximum Transfer: §a$${metricNumbers(maxTransfer)}\n` + `§fTransfer System: ${enabled ? "§aEnabled" : "§cDisabled"}\n\n` + `§8▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` + "§7Changes will take effect immediately.")
        .button("BACK TO CONFIG\n§8» §fReturn to settings", "textures/ui/arrow_left")
        .show(player)
        .then(() => showAdvancedConfig(player))
    } catch (error) {
      console.warn("Failed to save transfer config:", error)
      player.runCommand(`titleraw @s actionbar ${messages.error}`)
      player.runCommand("playsound note.bass @s")
    }
  })
}

function configureButtonTextures(player) {
  const form = new ActionFormData().title("BUTTON TEXTURES").body("§eCUSTOMIZE BUTTON ICONS\n§fSelect a feature to change its icon:")

  const categories = {
    TELEPORT: ["teleport", "randomTeleport", "warp", "pwarp", "setHome"],
    ECONOMY: ["transferMoney", "bank", "shop", "playerShop", "barter"],
    SOCIAL: ["clan", "reportPlayer", "emote"],
    UTILITY: ["claimLand", "backpack", "battlepass", "language"],
  }

  for (const [category, features] of Object.entries(categories)) {
    form.button(`${category} BUTTONS\n§8Configure ${category.toLowerCase()} feature icons`, "textures/ui/icon_setting")
  }

  form.button("§cRESET ALL TEXTURES\n§8Restore default icons", "textures/ui/icon_trash")
  form.button("BACK", "textures/ui/arrow_left")

  form.show(player).then(response => {
    if (response.canceled) {
      showMainMenu(player)
      return
    }

    const categoryList = Object.keys(categories)
    if (response.selection < categoryList.length) {
      const selectedCategory = categoryList[response.selection]
      showCategoryTextures(player, selectedCategory, categories[selectedCategory])
    } else if (response.selection === categoryList.length) {
      resetButtonTextures(player)
    } else {
      showMainMenu(player)
    }
  })
}

function showCategoryTextures(player, category, features) {
  const form = new ActionFormData().title(`§e${category} TEXTURES`).body(`§e${category} BUTTON ICONS\n§fSelect a feature to change its icon:`)

  for (const feature of features) {
    form.button(`${feature}\n§7Current: ${buttonTextures[feature]}`, buttonTextures[feature])
  }

  form.button("BACK", "textures/ui/arrow_left")

  form.show(player).then(response => {
    if (response.canceled) {
      configureButtonTextures(player)
      return
    }

    if (response.selection < features.length) {
      const feature = features[response.selection]
      showTextureInput(player, feature, category, features)
    } else {
      configureButtonTextures(player)
    }
  })
}

function showTextureInput(player, feature, category, features) {
  const form = new ModalFormData()
    .title(`EDIT ${feature.toUpperCase()}`)
    .toggle("§eUse Custom Path", {
      defaultValue: textureSettings.useCustomPath[feature] || false,
      tooltip: "Use custom texture path instead of preset",
    })
    .dropdown("§eSelect from Presets", iconSuggestions, {
      defaultValue: iconSuggestions.indexOf(buttonTextures[feature]) || 0,
      tooltip: "Choose from predefined textures",
    })
    .textField("§eCustom Texture Path", "textures/ui/...", {
      defaultValue: buttonTextures[feature],
      placeholder: "Enter custom texture path",
    })

  form.show(player).then(async response => {
    if (response.canceled) {
      showCategoryTextures(player, category, features)
      return
    }

    const [useCustom, suggestionIndex, customPath] = response.formValues
    textureSettings.useCustomPath[feature] = useCustom
    let newTexturePath

    if (useCustom) {
      if (!customPath) {
        player.runCommand(`titleraw @s actionbar ${messages.error}`)
        return
      }
      newTexturePath = customPath
    } else {
      newTexturePath = iconSuggestions[suggestionIndex]
    }

    buttonTextures[feature] = newTexturePath
    try {
      await saveButtonTextures()
      player.runCommand(`titleraw @s actionbar ${messages.configSaved}`)
      player.runCommand("playsound random.levelup @s")
      showCategoryTextures(player, category, features)
    } catch (error) {
      console.warn("Failed to save button textures:", error)
      player.runCommand(`titleraw @s actionbar ${messages.error}`)
      player.runCommand("playsound note.bass @s")
    }
  })
}

function resetButtonTextures(player) {
  const form = new ActionFormData().title("RESET TEXTURES").body("§e⚠ RESET ALL BUTTON TEXTURES\n\n§fAre you sure you want to reset all button textures to default?\n§cThis action cannot be undone!").button("§c✘ RESET ALL\n§8Click to confirm", "textures/ui/icon_trash").button("BACK", "textures/ui/arrow_left")

  form.show(player).then(response => {
    if (response.canceled || response.selection !== 0) {
      showMainMenu(player)
    } else {
      Object.assign(buttonTextures, defaultIcons)
      saveButtonTextures()
      showMainMenu(player)
    }
  })
}

function loadButtonTextures() {
  try {
    const saved = world.getDynamicProperty("buttonTextures")
    const savedSettings = world.getDynamicProperty("textureSettings")

    if (!saved) {
      Object.assign(buttonTextures, defaultIcons)
      saveButtonTextures()
      return
    }

    if (savedSettings) {
      Object.assign(textureSettings, JSON.parse(savedSettings))
    }

    const savedTextures = JSON.parse(saved)
    Object.assign(buttonTextures, defaultIcons)

    for (const [feature, texture] of Object.entries(savedTextures)) {
      if (buttonTextures.hasOwnProperty(feature)) {
        buttonTextures[feature] = texture
      }
    }

    for (const feature in buttonTextures) {
      if (!buttonTextures[feature]) {
        buttonTextures[feature] = defaultIcons[feature]
      }
    }

    saveButtonTextures()
  } catch (error) {
    console.warn("Failed to load button textures:", error)
    Object.assign(buttonTextures, defaultIcons)
    saveButtonTextures()
  }
}

async function saveButtonTextures() {
  try {
    const texturesData = {}
    for (const [feature, texture] of Object.entries(buttonTextures)) {
      if (texture !== defaultIcons[feature]) {
        texturesData[feature] = texture
      }
    }
    await world.setDynamicProperty("buttonTextures", JSON.stringify(texturesData))
    await world.setDynamicProperty("textureSettings", JSON.stringify(textureSettings))
    return true
  } catch (error) {
    console.warn("Failed to save button textures:", error)
    return false
  }
}

async function saveFeatureSettings() {
  try {
    await world.setDynamicProperty("memberFeatureStatus", JSON.stringify(featureStatus))
  } catch (error) {
    console.warn("Failed to save feature settings:", error)
  }
}

function loadFeatureSettings() {
  try {
    const saved = world.getDynamicProperty("memberFeatureStatus")
    if (saved) {
      const savedFeatures = JSON.parse(saved)
      const features = Object.entries(savedFeatures)
      for (let i = 0; i < features.length; i++) {
        const [feature, status] = features[i]
        if (feature in featureStatus) {
          featureStatus[feature] = status
        }
      }
    }
  } catch (error) {
    console.warn("Failed to load feature settings:", error)
  }
}

function loadClanConfig() {
  try {
    const saved = world.getDynamicProperty("clanConfig")
    if (saved) Object.assign(clanConfig, JSON.parse(saved))
  } catch (error) {
    console.warn("Failed to load clan config:", error)
  }
}

function loadRTPConfig() {
  try {
    const saved = world.getDynamicProperty("rtpConfig")
    if (saved) Object.assign(rtpConfig, JSON.parse(saved))
  } catch (error) {
    console.warn("Failed to load RTP config:", error)
  }
}

function loadHomeConfig() {
  try {
    const saved = world.getDynamicProperty("homeConfig")
    if (saved) Object.assign(homeConfig, JSON.parse(saved))
  } catch (error) {
    console.warn("Failed to load home config:", error)
  }
}

function loadTransferConfig() {
  try {
    const saved = world.getDynamicProperty("transferConfig")
    if (saved) Object.assign(transferConfig, JSON.parse(saved))
  } catch (error) {
    console.warn("Failed to load transfer config:", error)
  }
}

system.runTimeout(() => {
  try {
    loadFeatureSettings()
    loadRTPConfig()
    loadClanConfig()
    loadHomeConfig()
    loadTransferConfig()
    loadButtonTextures()
  } catch (error) {
    console.warn("Error loading configurations:", error)
  }
}, 20)

function configureLandSystem(player) {
  AdminLandConfig(player)
}

function configureCustomShop(player) {
  showShopConfigMenu(player, p => showAdvancedConfig(p))
}

export { buttonTextures }
