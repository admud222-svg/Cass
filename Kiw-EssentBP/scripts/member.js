import { system, world, ActionFormData } from "./core.js"
import { transferMoney } from "./plugins/tf-money/tf-money.js"
import { openBackpackMenu } from "./plugins/backpack/menu.js"
import { Bank } from "./plugins/bank/bank.js"
import { BarterMenu } from "./menu_member/barter.js"
import { showClanMenu } from "./plugins/clan/clan.js"
import { Shop } from "./menu_member/functions/shop/index.js"
import { LandMember } from "./menu_member/LandSystem/LandMember.js"
import { showPlayerShopMenu } from "./menu_member/player_shop.js"
import { ShowPlayerWarps } from "./menu_member/pwarp.js"
import { random_tp } from "./menu_member/random_teleport.js"
import { showReportPlayerMenu } from "./menu_member/reportplayer.js"
import { TeleportRequest } from "./menu_member/Request Teleport.js"
import { HomeSystem } from "./plugins/sethome/Set Home.js"
import { ShowAvailableWarps } from "./warp.js"
import { openBattlepass } from "./menu_member/battlepass.js"
import { getAllButtons } from "./admin_menu/custom_button/custom_database.js"
import { executeButtonCommand } from "./admin_menu/custom_button/custom_main.js"
import { buttonTextures } from "./menu_member/control_member/control.js"

import { registerCustomCommands } from "./plugins/custom-commands/custom.command.js"
import { showEmoteUI } from "./plugins/emote/emote.js"
import { Lang } from "./lib/Lang.js"
registerCustomCommands(system)
const featureStatus = {
  teleport: true,
  randomTeleport: true,
  warp: true,
  pwarp: true,
  setHome: true,
  transferMoney: true,
  bank: true,
  clan: true,
  shop: true,
  reportPlayer: true,
  claimLand: true,
  barter: true,
  backpack: true,
  playerShop: true,
  battlepass: true,

  emote: true,
  personalScoreboard: true,
  language: true,
}
function togglePersonalScoreboard(player) {
  const currentDisabled = player.getDynamicProperty("personal_scoreboard_disabled")
  const newDisabled = !currentDisabled
  player.setDynamicProperty("personal_scoreboard_disabled", newDisabled)
  const statusText = newDisabled ? Lang.t(player, "common.disabled") : Lang.t(player, "common.enabled")
  player.runCommand(`titleraw @s actionbar {"rawtext":[{"text":"§aScoreboard ${statusText}"}]}`)
}
function showLanguageMenu(player) {
  const currentLang = player.getTags().find(t => t.startsWith("lang:"))?.split(":")[1] || "en"
  const form = new ActionFormData()
    .title("§l§e" + Lang.t(player, "lang.menu.title"))
    .body("§7" + Lang.t(player, "lang.menu.body"))
    .button("§f§lEnglish" + (currentLang === "en" ? "\n§a✓ Current" : ""), "textures/ui/language_glyph")
    .button("§f§lBahasa Indonesia" + (currentLang === "id" ? "\n§a✓ Saat ini" : ""), "textures/ui/language_glyph")
    .button("§c" + Lang.t(player, "common.back"), "textures/ui/arrow_left")
  form.show(player).then(response => {
    if (response.canceled) return
    if (response.selection === 0) {
      Lang.set(player, "en")
      player.sendMessage("§aLanguage set to English!")
      player.runCommand("playsound random.levelup @s")
      showMemberMenu(player)
    } else if (response.selection === 1) {
      Lang.set(player, "id")
      player.sendMessage("§aBahasa diatur ke Indonesia!")
      player.runCommand("playsound random.levelup @s")
      showMemberMenu(player)
    } else if (response.selection === 2) {
      showMemberMenu(player)
    }
  })
}
system.runTimeout(() => {
  try {
    const savedStatus = world.getDynamicProperty("memberFeatureStatus")
    if (savedStatus) {
      const savedFeatures = JSON.parse(savedStatus)
      Object.assign(featureStatus, savedFeatures)
    }
    const customButtons = getAllButtons()
    for (const btn of customButtons) {
      const featureKey = `custom_${btn.name}`
      if (!(featureKey in featureStatus)) {
        featureStatus[featureKey] = true
        toggleFeature(featureKey, true)
      }
    }
  } catch (error) {
    console.warn("Unable to load feature settings - Using default configuration", error)
  }
}, 1)
const MENU_ITEMS = [
  { key: "member.menu.btn.request_teleport", icon: "textures/ui/conduit_power_effect", feature: "teleport", handler: TeleportRequest },
  { key: "member.menu.btn.random_teleport", icon: "textures/ui/broadcast_glyph_color", feature: "randomTeleport", handler: random_tp },
  { key: "member.menu.btn.warp", icon: "textures/ui/icon_recipe_construction", feature: "warp", handler: ShowAvailableWarps },
  { key: "member.menu.btn.player_warp", icon: "textures/ui/glyph_realms", feature: "pwarp", handler: ShowPlayerWarps },
  { key: "member.menu.btn.set_home", icon: "textures/ui/icon_bell", feature: "setHome", handler: HomeSystem },
  { key: "member.menu.btn.land_management", icon: "textures/ui/icon_map", feature: "claimLand", handler: LandMember },
  { key: "member.menu.btn.transfer_money", icon: "textures/ui/invite_base", feature: "transferMoney", handler: transferMoney },
  { key: "member.menu.btn.bank", icon: "textures/ui/icon_book_writable", feature: "bank", handler: Bank },
  { key: "member.menu.btn.clan", icon: "textures/ui/button_custom/clan", feature: "clan", handler: showClanMenu },
  { key: "member.menu.btn.shop", icon: "textures/ui/button_custom/shop", feature: "shop", handler: Shop },
  { key: "member.menu.btn.player_shop", icon: "textures/icon_custom/my_characters", feature: "playerShop", handler: showPlayerShopMenu },
  { key: "member.menu.btn.report_player", icon: "textures/items/trial_key", feature: "reportPlayer", handler: showReportPlayerMenu },
  { key: "member.menu.btn.barter", icon: "textures/ui/icon_book_writable", feature: "barter", handler: BarterMenu },
  { key: "member.menu.btn.backpack", icon: "textures/items/bundle", feature: "backpack", handler: openBackpackMenu },
  { key: "member.menu.btn.battlepass", icon: "textures/ui/icon_book_writable", feature: "battlepass", handler: openBattlepass },

  { key: "member.menu.btn.toggle_scoreboard", icon: "textures/items/sign", feature: "personalScoreboard", handler: togglePersonalScoreboard },
  { key: "member.menu.btn.emotes", icon: "textures/ui/button_custom/snow_angel", feature: "emote", handler: showEmoteUI },
  { key: "member.menu.btn.language", icon: "textures/ui/language_glyph", feature: "language", handler: showLanguageMenu },
]
const messages = (() => {
  const cache = new Map()
  const createMessage = (prefix, text) => {
    const key = `${prefix}:${text}`
    if (!cache.has(key)) {
      cache.set(key, JSON.stringify({ rawtext: [{ text: `${prefix} ${text}` }] }))
    }
    return cache.get(key)
  }
  return {
    error: text => createMessage("§cError:", text),
    success: text => createMessage("§aSuccess:", text),
    info: text => createMessage("Info:", text),
  }
})()
export function showMemberMenu(source, viewMode) {
  if (!viewMode) {
    viewMode = source.getDynamicProperty("kiw_member_view_mode") || "list"
  }
  const enabledMenuItems = MENU_ITEMS.filter(item => featureStatus[item.feature])
  const customButtons = getAllButtons()
  const titleKey = viewMode === "grid" ? "member.menu.grid_title" : "member.menu.title"
  const form = new ActionFormData().title(Lang.t(source, titleKey))
  for (const item of enabledMenuItems) {
    let name = Lang.t(source, item.key)
    if (item.feature === "personalScoreboard") {
      const isDisabled = source.getDynamicProperty("personal_scoreboard_disabled")
      name = isDisabled ? "§a" + Lang.t(source, "member.menu.btn.enable_scoreboard") : "§c" + Lang.t(source, "member.menu.btn.disable_scoreboard")
    }
    form.button(name, buttonTextures[item.feature] || item.icon)
  }
  for (const btn of customButtons) {
    const featureKey = `custom_${btn.name}`
    if (featureStatus[featureKey] !== false) {
      form.button(`${btn.name}\n${btn.description || Lang.t(source, "member.menu.custom_button")}`, btn.icon || "textures/ui/icon_book_writable")
    }
  }
  if (viewMode === "list") {
    form.button("§a§lGrid Mode")
    form.button(Lang.t(source, "member.menu.btn.exit"), "textures/ui/redX1")
  } else {
    form.button("§a§lList Mode")
  }
  form.show(source).then(result => {
    if (result.canceled) return
    const totalItems = enabledMenuItems.length + customButtons.length
    if (result.selection === totalItems) {
      const newMode = viewMode === "list" ? "grid" : "list"
      source.setDynamicProperty("kiw_member_view_mode", newMode)
      showMemberMenu(source, newMode)
      return
    }
    if (viewMode === "list" && result.selection === totalItems + 1) return
    if (result.selection < enabledMenuItems.length) {
        try {
          enabledMenuItems[result.selection].handler(source)
        } catch (e) {
          console.warn("Failed to handle menu selection - Please try again", e)
          source.runCommand(`titleraw @s actionbar ${messages.error("Something went wrong. Please try again")}`)
        }
      } else {
        const customIndex = result.selection - enabledMenuItems.length
        if (customIndex < customButtons.length) {
          executeButtonCommand(source, customButtons[customIndex])
        }
      }
    })
}
export const toggleFeature = (feature, status) => {
  if (feature in featureStatus) {
    featureStatus[feature] = !!status
    try {
      world.setDynamicProperty("memberFeatureStatus", JSON.stringify(featureStatus))
    } catch (e) {
      console.warn("Could not save feature settings - Changes may not persist", e)
    }
  }
}
export { featureStatus }
