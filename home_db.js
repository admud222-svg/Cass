import { world } from "@minecraft/server";
import QuickDB from "../../system/qidb/database.js";

const homeConfigDB = new QuickDB("admud_home_config_v1", "local");
const playerHomesDB = new QuickDB("homes", "local");

export function getHomeConfig() { return homeConfigDB.get("config") ?? { defaultLimit: 2, rankLimits: {} }; }
export function saveHomeConfig(config) { homeConfigDB.set("config", config); }
export function getPlayerHomes(playerName) { return playerHomesDB.get(playerName) ?? []; }
export function savePlayerHomes(playerName, homes) { playerHomesDB.set(playerName, homes); }

export function getPlayerHomeLimit(player) {
    const config = getHomeConfig();
    const rankId = player.getDynamicProperty("rankID") || "member"; 
    if (config.rankLimits && config.rankLimits[rankId] !== undefined) return config.rankLimits[rankId];
    return config.defaultLimit || 2;
}
export function getAllHomeKeys() { return playerHomesDB.keys(); }