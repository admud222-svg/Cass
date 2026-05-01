import { world, system } from "@minecraft/server";
import { getPlayerRank } from "./plugin/ranks/rank.js";
import { getPlayerTotalClaimedBlocks, fetchAllLandData } from "./plugin/land/claimland.js"; 
import { getConfig } from "./config.js"; 
import { currentClearLagTimer } from "./system/clear_lag/clearlag.js";
import { getPlayerClan } from "./plugin/clans/clan_db.js"; // <--- FIX 1: IMPORT DATABASE CLAN

// =========================================
// AUTO-CREATE SCOREBOARD OBJECTIVES
// =========================================
const REQUIRED_SCOREBOARDS = ["money", "coin", "shards", "kill", "death", "time_played", "bank_saldo", "jobs_level", "afk_time", "daily_streak", "dungeon_kill", "jump"];

system.run(() => {
    for (const obj of REQUIRED_SCOREBOARDS) {
        try {
            if (!world.scoreboard.getObjective(obj)) {
                world.scoreboard.addObjective(obj, obj);
            }
        } catch (e) {
            console.warn(`[Admud System] Gagal memuat scoreboard otomatis: ${obj}`);
        }
    }
});

function getScore(player, objectiveId) {
    try {
        const obj = world.scoreboard.getObjective(objectiveId);
        if (!obj) return 0;
        return obj.getScore(player) || obj.getScore(player.scoreboardIdentity) || 0;
    } catch {
        return 0;
    }
}

function formatMetric(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + "B";
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + "M";
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + "K";
    return num.toString();
}

function formatClaimMetric(num) {
    if (num === "∞" || num === -1) return "∞"; 
    let val = Number(num);
    if (isNaN(val)) return num; 
    if (val >= 1000000000) return (val / 1000000000).toFixed(1).replace(/\.0$/, '') + "B";
    if (val >= 1000000) return (val / 1000000).toFixed(1).replace(/\.0$/, '') + "M";
    if (val >= 10000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + "K";
    return val.toString(); 
}

function getCurrentLandOwner(player) {
    const db = fetchAllLandData();
    const loc = player.location;
    const dim = player.dimension.id;
    for (const id in db) {
        const l = db[id];
        if (dim === l.dim && loc.x >= l.min.x && loc.x <= l.max.x && loc.z >= l.min.z && loc.z <= l.max.z) {
            return l.owner;
        }
    }
    return "§7Unclaimed";
}

let lastTickTime = Date.now();
let realTPS = "20.0";
const playerPings = new Map(); // Penyimpanan cache fake ping tiap player

// INTERVAL 1: KALKULASI TPS SERVER (Tiap 1 Detik)
system.runInterval(() => {
    const now = Date.now();
    const diff = now - lastTickTime; 
    let calcTps = (20 / diff) * 1000;
    if (calcTps > 20) calcTps = 20.0; 
    realTPS = calcTps.toFixed(1);
    lastTickTime = now;
}, 20);

// INTERVAL 2: MESIN FAKE PING REALISTIS (Tiap 2 Detik)
system.runInterval(() => {
    try {
        const currentTps = parseFloat(realTPS);
        for (const p of world.getPlayers()) {
            const pName = p.name;
            let currentPing = playerPings.get(pName);
            
            if (!currentPing) {
                currentPing = Math.floor(Math.random() * 30) + 20; 
            } else {
                currentPing += Math.floor(Math.random() * 11) - 5; 
                
                if (currentTps < 15.0) {
                    currentPing += Math.floor(Math.random() * 40) + 30;
                } else if (Math.random() < 0.05) {
                    currentPing += Math.floor(Math.random() * 100) + 50;
                } else {
                    if (currentPing > 60) currentPing -= Math.floor(Math.random() * 20) + 10;
                }
                
                if (currentPing < 12) currentPing = Math.floor(Math.random() * 10) + 12; 
                if (currentPing > 999) currentPing = 999;
            }
            playerPings.set(pName, currentPing);
        }
    } catch (e) {}
}, 40); 

// =========================================
// MESIN ANIMASI
// =========================================
function applyAnimation(text, anim, tick) {
    if (!text || anim === "none") return "§r" + text + "§r";
    let isBold = text.includes("§l") ? "§l" : "";
    const isItalic = text.includes("§o") ? "§o" : "";
    
    if (anim === "shiny") {
        isBold = ""; 
    }
    const format = isBold + isItalic;
    const colorMatches = text.match(/§[0-9a-f]/g);
    const baseColor = colorMatches ? colorMatches[colorMatches.length - 1] : "§f";

    let cleanText = text.replace(/§[0-9a-fk-or]/g, ""); 
    if (cleanText.length === 0) return "§r" + text + "§r";

    let res = "";
    const speed = Math.floor(tick / 3);

    switch (anim) {
        case "rgb":
            const rgb = ["§c", "§6", "§e", "§a", "§b", "§9", "§d"];
            for (let i = 0; i < cleanText.length; i++) {
                res += rgb[(i + speed) % rgb.length] + format + cleanText[i];
            }
            break;
        case "wave":
            const wave = ["§f", "§b", "§3", "§1", "§3", "§b"];
            for (let i = 0; i < cleanText.length; i++) {
                res += wave[(i + speed) % wave.length] + format + cleanText[i];
            }
            break;
        case "shiny":
            let shinePos = (speed % (cleanText.length + 10)) - 5;
            let peakColor = "§f"; 
            let edgeColor = "§8"; 
            if (baseColor === "§f") {
                peakColor = "§0"; 
                edgeColor = "§8"; 
            }

            for (let i = 0; i < cleanText.length; i++) {
                if (Math.abs(i - shinePos) === 0) {
                    res += peakColor + format + cleanText[i]; 
                } else if (Math.abs(i - shinePos) === 1) {
                    res += edgeColor + format + cleanText[i]; 
                } else {
                    res += baseColor + format + cleanText[i]; 
                }
            }
            break;
        case "typing":
            let showLen = speed % (cleanText.length + 20);
            if (showLen > cleanText.length) showLen = cleanText.length;
            res = baseColor + format + cleanText.substring(0, showLen);
            break;
        case "fadein":
            const fade = ["§8", "§7", "§f", "§7", "§8"];
            let fadeStage = speed % fade.length;
            res = fade[fadeStage] + format + cleanText;
            break;
        default:
            return "§r" + text + "§r";
    }
    return "§r" + res + "§r";
}

// =========================================
// RESOLVER UTAMA
// =========================================
export function resolvePlaceholders(textObj, player, isChatMsg = "") {
    if (!textObj || !textObj.text) return "";
    const rank = getPlayerRank(player);
    const hp = player.getComponent("minecraft:health")?.currentValue || 20;
    const date = new Date();

    const claimMode = rank.landMode || "count"; 
    const claimLimit = rank.landLimit !== undefined ? rank.landLimit : 3;
    let currentClaim = 0;

    if (claimMode === "block") {
        currentClaim = getPlayerTotalClaimedBlocks(player.name);
    } else {
        const db = fetchAllLandData();
        for (const id in db) {
            if (db[id].owner === player.name) {
                currentClaim++;
            }
        }
    }

    const limitDisplay = claimLimit === -1 ? "∞" : claimLimit; 
    const currentLandOwner = getCurrentLandOwner(player); 

    let pingVal = playerPings.get(player.name) || (Math.floor(Math.random() * 30) + 20);
    let pingColor = "§a"; 
    if (pingVal >= 150) pingColor = "§c"; 
    else if (pingVal >= 80) pingColor = "§e"; 
    
    let displayPing = `${pingColor}${pingVal}§r`;

    // FIX 2: AMBIL DATA CLAN DARI DATABASE YANG BENAR
    const myClan = getPlayerClan(player);
    const displayClan = myClan !== "" ? `§b${myClan}` : "§cNone";

    let processed = textObj.text
        .replace(/@NAMA/g, player.name)
        .replace(/@RANKS/g, rank.prefix)
        .replace(/@CLAN/g, displayClan) // <--- FIX 3: Ganti teks di Papan Skor
        .replace(/@HEALTH/g, Math.round(hp))
        .replace(/@MONEY/g, formatMetric(getScore(player, "money"))) 
        .replace(/@COIN/g, formatMetric(getScore(player, "coin")))
        .replace(/@SHARDS/g, formatMetric(getScore(player, "shards")))
        .replace(/@KILL/g, formatMetric(getScore(player, "kill")))
        .replace(/@DEATH/g, formatMetric(getScore(player, "death")))
        .replace(/@CLAIM/g, formatClaimMetric(currentClaim))
        .replace(/@LIMIT/g, formatClaimMetric(limitDisplay))
        .replace(/@LAND/g, currentLandOwner) 
        .replace(/@CLEARLAG/g, currentClearLagTimer + "s")
        .replace(/@TPS/g, realTPS) 
        .replace(/@PING/g, displayPing) 
        .replace(/@ONLINE/g, world.getPlayers().length)
        .replace(/@MAXON/g, "30") 
        .replace(/@TANGGAL/g, date.getDate())
        .replace(/@BULAN/g, date.getMonth() + 1)
        .replace(/@TAHUN/g, date.getFullYear())
        .replace(/@MESSAGE/g, isChatMsg)
        .replace(/@NL/g, "\n")
        .replace(/@BLANK/g, " "); 

    const currentTick = system.currentTick; 
    return applyAnimation(processed, textObj.anim, currentTick);
}