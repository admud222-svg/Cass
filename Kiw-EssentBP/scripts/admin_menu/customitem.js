import { world, system, ActionFormData, ModalFormData } from "../core.js"
import { showMainMenu } from "../kiwora.js"
const CONFIG = {
  default: {
    adminItem: "kwd:item01",
    memberItem: "kwd:member01",
    useCustomItems: false,
  },
  messages: {
    success: "§a✔ Settings saved successfully!",
    error: "§c⚠ Failed to save settings!",
    noAdminTag: "§c⚠ You need admin tag! Use: §f/tag @s add admin",
    noMemberTag: "§c⚠ You need member tag! Contact admin",
  },
  items: ["kwd:item01", "kwd:member01", "minecraft:compass", "minecraft:clock", "minecraft:nether_star", "minecraft:blaze_rod", "minecraft:stick", "minecraft:paper", "minecraft:diamond", "minecraft:emerald", "minecraft:gold_ingot", "minecraft:iron_ingot", "minecraft:book", "minecraft:feather", "minecraft:map", "minecraft:name_tag", "minecraft:ender_pearl", "minecraft:ender_eye", "minecraft:totem_of_undying", "minecraft:trident", "minecraft:shield", "minecraft:golden_apple"],
}
let config = null
const helpers = {
  hasTag: (player, tag) => player.getTags().includes(tag),
  getConfig: () => {
    if (config) return config
    try {
      const saved = world.getDynamicProperty("customItemConfig")
      config = saved ? { ...CONFIG.default, ...JSON.parse(saved) } : CONFIG.default
      return config
    } catch {
      return (config = CONFIG.default)
    }
  },
  saveConfig: newConfig => {
    try {
      world.setDynamicProperty("customItemConfig", JSON.stringify(newConfig))
      config = newConfig
      return true
    } catch {
      return false
    }
  },
  playSound: (player, sound, pitch = 1) => player.runCommand(`playsound ${sound} @s ~~~ 1 ${pitch}`),
}
export async function customitem(source) {
  if (!helpers.hasTag(source, "admin")) {
    source.sendMessage(CONFIG.messages.noAdminTag)
    helpers.playSound(source, "note.bass", 0.5)
    return
  }
  const currentConfig = helpers.getConfig()
  const form = new ActionFormData()
    .title("Custom Item Settings")
    .body(`Current: ${currentConfig.useCustomItems ? "§aEnabled" : "§cDisabled"}\nAdmin: ${currentConfig.adminItem}\nMember: ${currentConfig.memberItem}`)
    .button("Configure Items", "textures/ui/icon_setting")
    .button("Reset to Default", "textures/ui/refresh")
    .button("Back", "textures/ui/arrow_left")
  const response = await form.show(source)
  if (!response.canceled) {
    const actions = [() => showItemSettings(source), () => resetToDefault(source), () => showMainMenu(source)]
    actions[response.selection]?.()
  }
}
async function showItemSettings(source) {
  const currentConfig = helpers.getConfig()
  const form = new ModalFormData()
    .title("Item Settings")
    .toggle("§eEnable Custom Items", { defaultValue: currentConfig.useCustomItems })
    .dropdown("§eAdmin Item", CONFIG.items, { defaultValue: CONFIG.items.indexOf(currentConfig.adminItem) })
    .dropdown("§eMember Item", CONFIG.items, { defaultValue: CONFIG.items.indexOf(currentConfig.memberItem) })
  const response = await form.show(source)
  if (!response.canceled) {
    const [useCustomItems, adminItemIndex, memberItemIndex] = response.formValues
    const newConfig = {
      ...currentConfig,
      useCustomItems,
      adminItem: CONFIG.items[adminItemIndex],
      memberItem: CONFIG.items[memberItemIndex],
    }
    const success = helpers.saveConfig(newConfig)
    source.sendMessage(success ? CONFIG.messages.success : CONFIG.messages.error)
    helpers.playSound(source, success ? "random.levelup" : "note.bass", success ? 1 : 0.5)
  }
}
async function resetToDefault(source) {
  const form = new ActionFormData().title("Confirm Reset").body("§eReset to default settings?\n§c⚠ Cannot be undone!").button("§cReset", "textures/ui/refresh_light").button("Cancel", "textures/ui/arrow_left")
  const response = await form.show(source)
  if (!response.canceled && response.selection === 0) {
    const success = helpers.saveConfig(CONFIG.default)
    source.sendMessage(success ? "§a✔ Reset successful!" : CONFIG.messages.error)
    helpers.playSound(source, success ? "random.levelup" : "note.bass", success ? 1 : 0.5)
  }
}
system.runTimeout(() => helpers.getConfig(), 100)
export function getCustomItemConfig() {
  return {
    ...helpers.getConfig(),
    checkAccess: (player, itemType) => {
      if (itemType === "admin" && !helpers.hasTag(player, "admin")) {
        player.sendMessage(CONFIG.messages.noAdminTag)
        helpers.playSound(player, "note.bass", 0.5)
        return false
      }
      return true
    },
  }
}
