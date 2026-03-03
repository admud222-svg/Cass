import { ActionFormData, ModalFormData, MessageFormData, world, system } from "../../core";
import { Database } from "../../function/Database";
const CONFIG = {
  TAG: { ADMIN: "admin" },
  DB: { ENABLED: "enabled", KICK_MSG: "kickMessage", PLAYERS_LIST: "playersList" },
  MSG: {
    NO_PERM: "§cYou don't have permission to access whitelist management!",
    ALREADY_WHITELISTED: "§c{player} is already whitelisted!",
    ADDED: "§a{player} has been added to the whitelist!",
    REMOVED: "§a{player} has been removed from the whitelist!",
    TOGGLED: "§aWhitelist has been {status}!",
    KICK_MSG_UPDATED: "§aKick message has been updated!",
    EMPTY_NAME: "§cPlease enter a valid player name!",
    EMPTY_MSG: "§cPlease enter a valid kick message!",
    NO_PLAYERS: "§cNo players are currently whitelisted!",
    NO_WHITELISTED: "No players whitelisted"
  },
  UI: {
    MAIN_TITLE: "Whitelist Management",
    ADD_TITLE: "Add Player to Whitelist",
    REMOVE_TITLE: "Remove Player from Whitelist",
    VIEW_TITLE: "Whitelisted Players",
    KICK_MSG_TITLE: "Set Kick Message",
    BTN_ADD: "Add Player",
    BTN_REMOVE: "Remove Player",
    BTN_VIEW: "View Whitelist",
    BTN_CLOSE: "Close",
    BTN_BACK: "Back",
    BTN_SET_MSG: "Set Kick Message"
  },
  ICON: {
    ADD: "textures/ui/color_plus",
    REMOVE: "textures/ui/redX1",
    VIEW: "textures/ui/book_metatag_default",
    TOGGLE: "textures/ui/toggle_off",
    MSG: "textures/ui/chat_send",
    CANCEL: "textures/ui/cancel"
  },
  KICK: {
    DEFAULT_MSG: "You are not whitelisted on this server!",
    DELAY: 20
  }
};
const db = new Database("whitelist");
const cache = { players: null, kickMsg: null };
class WhitelistManager {
  static isAdmin = (p) => p.hasTag(CONFIG.TAG.ADMIN);
  static _normalize(name) {
    return name?.toLowerCase().trim() || "";
  }
  static _getPlayers() {
    if (cache.players) return cache.players;
    const players = db.get(CONFIG.DB.PLAYERS_LIST, []);
    if (!Array.isArray(players)) {
      const migrated = Array.from(db.keys())
        .filter(k => k.startsWith("players.") && db.get(k))
        .map(k => this._normalize(k.replace("players.", "")))
        .filter(Boolean);
      db.set(CONFIG.DB.PLAYERS_LIST, [...new Set(migrated)]);
      cache.players = new Set(migrated);
      return cache.players;
    }
    cache.players = new Set(players);
    return cache.players;
  }
  static _savePlayers(players) {
    db.set(CONFIG.DB.PLAYERS_LIST, Array.from(players));
    cache.players = players;
  }
  static isEnabled() {
    return db.get(CONFIG.DB.ENABLED, false);
  }
  static getKickMessage() {
    return cache.kickMsg ??= db.get(CONFIG.DB.KICK_MSG, CONFIG.KICK.DEFAULT_MSG);
  }
  static isWhitelisted(name) {
    return this._getPlayers().has(this._normalize(name));
  }
  static addPlayer(name) {
    const normalized = this._normalize(name);
    if (!normalized) return false;
    const players = this._getPlayers();
    if (players.has(normalized)) return false;
    players.add(normalized);
    this._savePlayers(players);
    return true;
  }
  static removePlayer(name) {
    const normalized = this._normalize(name);
    if (!normalized) return false;
    const players = this._getPlayers();
    if (!players.has(normalized)) return false;
    players.delete(normalized);
    this._savePlayers(players);
    return true;
  }
  static getWhitelistedPlayers() {
    return Array.from(this._getPlayers()).sort();
  }
  static toggleWhitelist() {
    const currentStatus = db.get(CONFIG.DB.ENABLED, false);
    const newStatus = !currentStatus;
    db.set(CONFIG.DB.ENABLED, newStatus);
    return newStatus;
  }
  static setKickMessage(msg) {
    db.set(CONFIG.DB.KICK_MSG, msg);
    cache.kickMsg = msg;
    return true;
  }
}
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn || !WhitelistManager.isEnabled() || WhitelistManager.isWhitelisted(player.name)) return;
  system.runTimeout(() => {
    try {
      const name = player.name.includes(' ') ? `"${player.name}"` : player.name;
      world.getDimension("overworld").runCommand(`kick ${name} ${WhitelistManager.getKickMessage()}`);
    } catch (e) {
    }
  }, CONFIG.KICK.DELAY);
});
function showWhitelistMenu(player) {
  if (!player) return;
  if (!WhitelistManager.isAdmin(player)) return player.sendMessage(CONFIG.MSG.NO_PERM);
  const enabled = WhitelistManager.isEnabled();
  const total = WhitelistManager.getWhitelistedPlayers().length;
  new ActionFormData()
    .title(CONFIG.UI.MAIN_TITLE)
    .body(`§eStatus: ${enabled ? "§aEnabled" : "§cDisabled"}\n§eWhitelisted Players: §b${total}`)
    .button(CONFIG.UI.BTN_ADD, CONFIG.ICON.ADD)
    .button(CONFIG.UI.BTN_REMOVE, CONFIG.ICON.REMOVE)
    .button(CONFIG.UI.BTN_VIEW, CONFIG.ICON.VIEW)
    .button(enabled ? "§cDisable Whitelist" : "§aEnable Whitelist", CONFIG.ICON.TOGGLE)
    .button(CONFIG.UI.BTN_SET_MSG, CONFIG.ICON.MSG)
    .button(CONFIG.UI.BTN_CLOSE, CONFIG.ICON.CANCEL)
    .show(player)
    .then(res => {
      if (res.canceled) return;
      [
        showAddPlayerForm,
        showRemovePlayerForm,
        showWhitelistView,
        () => {
          player.sendMessage(CONFIG.MSG.TOGGLED.replace("{status}", WhitelistManager.toggleWhitelist() ? "enabled" : "disabled"));
          showWhitelistMenu(player);
        },
        showKickMessageForm,
        () => { }
      ][res.selection]?.(player);
    })
    .catch(() => { });
}
function showAddPlayerForm(player) {
  new ModalFormData()
    .title(CONFIG.UI.ADD_TITLE)
    .textField("§ePlayer Name:", "Enter player name...")
    .show(player)
    .then(res => {
      if (res.canceled) return showWhitelistMenu(player);
      const name = res.formValues[0]?.trim();
      if (!name) return player.sendMessage(CONFIG.MSG.EMPTY_NAME) || showAddPlayerForm(player);
      if (WhitelistManager.isWhitelisted(name)) {
        player.sendMessage(CONFIG.MSG.ALREADY_WHITELISTED.replace("{player}", name));
      } else if (WhitelistManager.addPlayer(name)) {
        player.sendMessage(CONFIG.MSG.ADDED.replace("{player}", name));
      }
      showWhitelistMenu(player);
    })
    .catch(() => { });
}
function showRemovePlayerForm(player) {
  const players = WhitelistManager.getWhitelistedPlayers();
  if (!players.length) return player.sendMessage(CONFIG.MSG.NO_PLAYERS) || showWhitelistMenu(player);
  new ModalFormData()
    .title(CONFIG.UI.REMOVE_TITLE)
    .dropdown("§eSelect Player:", players, { defaultValue: 0 })
    .show(player)
    .then(res => {
      if (res.canceled) return showWhitelistMenu(player);
      const selected = players[res.formValues[0]];
      if (WhitelistManager.removePlayer(selected)) {
        player.sendMessage(CONFIG.MSG.REMOVED.replace("{player}", selected));
      }
      showWhitelistMenu(player);
    })
    .catch(() => { });
}
function showWhitelistView(player) {
  const players = WhitelistManager.getWhitelistedPlayers();
  const list = players.length ? players.map(n => `§a• §f${n}`).join("\n") : CONFIG.MSG.NO_WHITELISTED;
  new MessageFormData()
    .title(CONFIG.UI.VIEW_TITLE)
    .body(`§eTotal: §b${players.length} §eplayers\n\n${list}`)
    .button1(CONFIG.UI.BTN_BACK)
    .button2(CONFIG.UI.BTN_CLOSE)
    .show(player)
    .then(res => { if (res.selection === 0) showWhitelistMenu(player); })
    .catch(() => { });
}
function showKickMessageForm(player) {
  new ModalFormData()
    .title(CONFIG.UI.KICK_MSG_TITLE)
    .textField("§eKick Message:", "Enter kick message...", { defaultValue: WhitelistManager.getKickMessage() })
    .show(player)
    .then(res => {
      if (res.canceled) return showWhitelistMenu(player);
      const msg = res.formValues[0]?.trim();
      if (!msg) return player.sendMessage(CONFIG.MSG.EMPTY_MSG) || showKickMessageForm(player);
      WhitelistManager.setKickMessage(msg);
      player.sendMessage(CONFIG.MSG.KICK_MSG_UPDATED);
      showWhitelistMenu(player);
    })
    .catch(() => { });
}
export { showWhitelistMenu, WhitelistManager };
