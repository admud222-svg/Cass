import { system, world } from "../core.js";
import { board, subscribeToConfig } from "../board/_config.js";
import { ScoreboardDB, PlaceholderDB } from "../board/data.js";
import { getClan } from "../function/getClan.js";
import { getPlaceholder } from "../function/getPlaceholder.js";
import { getRank } from "../function/getRank.js";
import { getScore } from "../function/getScore.js";
import { metricNumbers } from "../lib/game.js";
import { getFullMoney, formatMoneyValue } from "../function/moneySystem.js";
import { getCurrency, getDefaultCurrency } from "../function/getCurrency.js";
import { clanDB } from "../function/getClan.js";
import { getBank } from "../plugins/bank/bank.js";

const UPDATE_INTERVAL = 20;
const OBJECTIVES = ["money", "death", "kill", "playtime", "online_time", "coin"];

const cache = {
  currency: "§6$",
  moneyObjective: "money",
  maxOnline: 30,
  timeEnabled: false,
  timezone: "UTC+7",
  placeholders: {},
  lastTpsUpdate: Date.now(),
  tps: 20
};

const activePlayers = new Set();

function setupScoreboards() {
  const sb = world.scoreboard;
  for (const obj of OBJECTIVES) {
    if (!sb.getObjective(obj)) {
      try { sb.addObjective(obj, obj); } catch (e) { /* Ignore if exists */ }
    }
  }
}

function refreshCache() {
  cache.currency = getDefaultCurrency() || ScoreboardDB.get("ScoreboardDBConfig-currency") || "§6$";
  cache.moneyObjective = ScoreboardDB.get("ScoreboardDBConfig-default-money") || "money";
  cache.maxOnline = ScoreboardDB.get("ScoreboardDBConfig-max-online") ?? 30;
  cache.timeEnabled = world.getDynamicProperty("time:enabled") ?? false;
  cache.timezone = world.getDynamicProperty("time:timezone") ?? "UTC+7";
  cache.placeholders = Object.fromEntries(PlaceholderDB.entries());
}

system.run(() => {
  setupScoreboards();
  refreshCache();
});

subscribeToConfig(refreshCache);

system.runInterval(() => {
  const now = Date.now();
  const diff = now - cache.lastTpsUpdate;
  if (diff > 0) {
    cache.tps = Math.min(20, (1000 / diff) * UPDATE_INTERVAL);
  }
  cache.lastTpsUpdate = now;

  const offsetMs = parseInt(cache.timezone.replace("UTC", "")) * 3_600_000;
  const date = new Date(now + offsetMs);
  const dateData = {
    HOUR: date.getHours().toString().padStart(2, "0"),
    MINUTE: date.getMinutes().toString().padStart(2, "0"),
    DAY: date.getDate().toString().padStart(2, "0"),
    MONTH: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()],
    YEAR: date.getFullYear().toString(),
    TPS: cache.tps.toFixed(1),
    ONLINE: world.getPlayers().length,
    MAXON: cache.maxOnline,
    TIMEZONE: cache.timezone,
    BLANK: " "
  };

  const sb = world.scoreboard;
  const playtimeObj = sb.getObjective("playtime");
  const onlineTimeObj = sb.getObjective("online_time");

  for (const player of world.getPlayers()) {
    try {
      if (playtimeObj) playtimeObj.addScore(player, 1);
      if (onlineTimeObj) onlineTimeObj.setScore(player, 1);
    } catch {}

    if (player.getDynamicProperty("personal_scoreboard_disabled")) {
      if (activePlayers.has(player.id)) {
        player.onScreenDisplay.setTitle("", { fadeInDuration: 0, stayDuration: 0, fadeOutDuration: 0 });
        activePlayers.delete(player.id);
      }
      continue;
    }
    activePlayers.add(player.id);

    const healthComponent = player.getComponent("minecraft:health");
    const health = healthComponent ? Math.ceil(healthComponent.currentValue) : 0;
    
    const placeholders = {
      ...cache.placeholders,
      ...dateData,
      NAME: player.name.length > 10 ? player.name.substring(0, 10) + ".." : player.name,
      CURRENCY: getCurrency(player) || cache.currency,
      MONEY: formatMoneyValue(getFullMoney(player)),
      BANK: metricNumbers(getBank(player)),
      COIN: formatMoneyValue(getScore(player, "coin") || 0),
      RANK: getRank(player),
      CLAN: getClan(player) || clanDB.get("ClanDBConfig-default") || "None",
      HEALTH: health,
      LEVEL: player.level,
      XP: player.getTotalXp(),
      KILL: getScore(player, "kill"),
      DEATH: getScore(player, "death"),
      DIMENSION: player.dimension.id.split(":")[1].replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
      X: Math.floor(player.location.x),
      Y: Math.floor(player.location.y),
      Z: Math.floor(player.location.z)
    };

     const text = getPlaceholder(board.Line.join("\n"), [placeholders]);
     player.onScreenDisplay.setTitle(text, {
       fadeInDuration: 0,
       stayDuration: 100,
       fadeOutDuration: 0,
    });
  }
}, UPDATE_INTERVAL);

world.afterEvents.entityDie.subscribe((event) => {
  const { deadEntity, damageSource } = event;
  
  if (deadEntity.typeId === "minecraft:player") {
    try {
      world.scoreboard.getObjective("death")?.addScore(deadEntity, 1);
    } catch {}

    if (damageSource?.damagingEntity?.typeId === "minecraft:player") {
      try {
        world.scoreboard.getObjective("kill")?.addScore(damageSource.damagingEntity, 1);
      } catch {}
    }
  }
});

export { };
