import QuickDB from "../../system/qidb/database.js";

const clanDB = new QuickDB("admud_clans_v3", "local");
const playerClanDB = new QuickDB("player_clans", "local");
const clanInvitesDB = new QuickDB("clan_invites", "local");

export function getClans() { return clanDB.get("data") ?? {}; }
export function saveClans(clans) { clanDB.set("data", clans); }

export function getPlayerClan(player) {
    let clanName = playerClanDB.get(player.name) || "";
    if (clanName === "") return "";
    let cleanName = clanName.replace(/§[0-9a-fk-or]/g, ""); 
    let clans = getClans();

    while (clans[cleanName] && clans[cleanName].renamedTo) {
        cleanName = clans[cleanName].renamedTo;
        playerClanDB.set(player.name, `§b${cleanName}`); 
    }

    if (!clans[cleanName]) { playerClanDB.delete(player.name); return ""; }
    return cleanName;
}

export function getPlayerInvites(player) { return clanInvitesDB.get(player.name) ?? []; }
export function savePlayerInvites(player, invites) { clanInvitesDB.set(player.name, invites); }
export function setPlayerClan(player, clanName) {
    if (clanName) playerClanDB.set(player.name, clanName);
    else playerClanDB.delete(player.name);
}