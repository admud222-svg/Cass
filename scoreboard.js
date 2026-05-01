import { world, system } from "@minecraft/server";
import { getConfig } from "./config.js";
import { resolvePlaceholders } from "./placeholder.js";
import { getBankBalance } from "./plugin/bank/bank_db.js"; 
import { getPlayerParkour, getParkourWins } from "./system/parkour/parkour_db.js";

// ==========================================
// KAMUS GLYPH CUSTOM (A-Z, Angka, Simbol)
// ==========================================
const GLYPH_MAP = {
    "merah": { chars: "", nums: "", syms: {"!":"","?":"","(":"",")":"","/":"",".":"","-":"","_":""} },
    "emas": { chars: "", nums: "", syms: {"!":"","?":"","(":"",")":"","/":"",".":"","-":"","_":""} },
    "hijau_tua": { chars: "" },
    "kuning": { chars: "", nums: "", syms: {"!":"","?":"","(":"",")":"","/":"",".":"","-":"","_":""} },
    "hijau_muda": { chars: "" },
    "cyan_gelap": { chars: "" },
    "cyan_muda": { chars: "" },
    "biru": { chars: "" },
    "abu_abu": { chars: "" },
    "pink": { chars: "" },
    "putih_besar": { chars: "" },
    "putih_kecil": { chars: "" },
    "orangeemas_kecil": { chars: "" }
};

// Fungsi Mengubah Teks Biasa jadi Full Glyph
function textToGlyph(text, styleKey) {
    if (!text || !GLYPH_MAP[styleKey]) return text;
    let result = "";
    let upperText = text.toUpperCase();
    let map = GLYPH_MAP[styleKey];
    for (let i = 0; i < upperText.length; i++) {
        let char = upperText[i];
        let code = char.charCodeAt(0);
        if (code >= 65 && code <= 90) { 
            result += map.chars[code - 65] || char;
        } else if (code >= 48 && code <= 57 && map.nums) { 
            result += map.nums[code - 48] || char;
        } else if (map.syms && map.syms[char]) { 
            result += map.syms[char];
        } else {
            result += text[i];
        }
    }
    return result;
}

// Mesin Animasi Custom Glyph
function applyGlyphAnimation(rawText, animType, tick) {
    if (!rawText) return "";
    let cleanText = rawText.replace(/§[0-9a-fk-or]/g, "").replace(/ [0-9a-fk-or]/g, "");

    // 1. Animasi Mengetik
    if (animType === "glyph_typing") {
        let speed = Math.floor(tick / 2); 
        let length = speed % (cleanText.length + 10);
        if (length > cleanText.length) length = cleanText.length;
        return textToGlyph(cleanText.substring(0, length), "emas");
        
    // 2. Animasi Rainbow (Warna Campur Bergantian)
    } else if (animType === "glyph_rainbow") {
        let result = "";
        let speed = Math.floor(tick / 6); 
        let colorCycle = ["merah", "emas", "kuning", "hijau_muda", "cyan_muda", "biru", "pink"];
        for (let i = 0; i < cleanText.length; i++) {
            if (cleanText[i] === " ") { result += " "; continue; }
            let colorIdx = (speed + i) % colorCycle.length;
            result += textToGlyph(cleanText[i], colorCycle[colorIdx]);
        }
        return result;
        
    // 3. Animasi Shine (Kombinasi 2 Warna Full Glyph)
    } else if (animType.startsWith("glyph_shine_")) {
        let baseColor = "abu_abu";
        let shineColor = "putih_besar";
        
        if (animType === "glyph_shine_hijau") { baseColor = "hijau_tua"; shineColor = "hijau_muda"; }
        else if (animType === "glyph_shine_cyan") { baseColor = "cyan_gelap"; shineColor = "cyan_muda"; }
        else if (animType === "glyph_shine_emas") { baseColor = "kuning"; shineColor = "emas"; }
        else if (animType === "glyph_shine_merah") { baseColor = "merah"; shineColor = "orange"; }
        else if (animType === "glyph_shine_biru") { baseColor = "biru"; shineColor = "cyan_muda"; }
        else if (animType === "glyph_shine_emas_kecil") { baseColor = "putih_kecil"; shineColor = "orangeemas_kecil"; }

        let result = "";
        let speed = Math.floor(tick / 2); 
        let shinePos = speed % (cleanText.length + 10); 
        
        for (let i = 0; i < cleanText.length; i++) {
            if (cleanText[i] === " ") { result += " "; continue; }
            
            if (i === shinePos || i === shinePos - 1 || i === shinePos + 1) {
                result += textToGlyph(cleanText[i], shineColor); 
            } else {
                result += textToGlyph(cleanText[i], baseColor); 
            }
        }
        return result;

    // 4. Animasi Wave (Gelombang Kombinasi 2 Warna)
    } else if (animType.startsWith("glyph_wave_")) {
        let c1 = "abu_abu", c2 = "putih_kecil";
        
        if (animType === "glyph_wave_hijau") { c1 = "hijau_tua"; c2 = "hijau_muda"; }
        else if (animType === "glyph_wave_cyan") { c1 = "cyan_gelap"; c2 = "cyan_muda"; }
        else if (animType === "glyph_wave_emas") { c1 = "kuning"; c2 = "emas"; }
        else if (animType === "glyph_wave_emas_kecil") { c1 = "putih_kecil"; c2 = "orangeemas_kecil"; }

        let result = "";
        let speed = Math.floor(tick / 3); 
        for (let i = 0; i < cleanText.length; i++) {
            if (cleanText[i] === " ") { result += " "; continue; }
            let waveIdx = (speed + i) % 2;
            result += textToGlyph(cleanText[i], waveIdx === 0 ? c1 : c2);
        }
        return result;
        
    // 5. Statis (Full Glyph tanpa gerak/animasi)
    } else if (animType.startsWith("glyph_statis_")) {
        let styleKey = animType.replace("glyph_statis_", "");
        return textToGlyph(cleanText, styleKey);
    }
    
    return rawText;
}

// Frame Timer Animasi
let animFrame = 0;
system.runInterval(() => { animFrame++; }, 2); 

// ==========================================
// AUTO-CREATE OBJECTIVES
// ==========================================
const TRACKED_OBJECTIVES = [
    "time_played", "coin", "bank_saldo", "money", 
    "kill", "death", "jump", "dungeon_kill", 
    "jobs_level", "afk_time", "daily_streak"
];
system.run(() => {
    for (const objId of TRACKED_OBJECTIVES) {
        if (!world.scoreboard.getObjective(objId)) {
            world.scoreboard.addObjective(objId, objId.toUpperCase());
        }
    }
});

// ==========================================
// HELPER: SAFE ADD SCORE (DIOPTIMASI - TANPA DELAY)
// ==========================================
export function safeAddScore(objId, player, amount) {
    try {
        const obj = world.scoreboard.getObjective(objId);
        if (obj) {
            let current = 0;
            try { current = obj.getScore(player) || obj.getScore(player.scoreboardIdentity) || 0; } catch(e){}
            obj.setScore(player, current + amount);
        }
    } catch(e) {}
}

export function safeSetScore(objId, player, value) {
    try {
        const obj = world.scoreboard.getObjective(objId);
        if (obj) obj.setScore(player, value);
    } catch(e) {}
}

// ==========================================
// FUNGSI FORMAT WAKTU
// ==========================================
function formatTime(ms) {
    if (!ms || ms <= 0) return "0.0s";
    let totalSeconds = ms / 1000;
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = (totalSeconds % 60).toFixed(1);
    let timeText = "";
    if (hours > 0) timeText += `${hours}h `;
    if (minutes > 0) timeText += `${minutes}m `;
    timeText += `${seconds}s`;
    return timeText.trim();
}

// ==========================================
// FUNGSI UPDATE SCOREBOARD LAYAR (UI)
// ==========================================
export function updateScoreboardTitle(player) {
    if (player.hasTag("setting_hide_sb")) {
        player.onScreenDisplay.setTitle(" ");
        return; 
    }

    // --- RENDERER PARKOUR (KODE ASLI UTUH) ---
    if (player.hasTag("in_parkour")) {
        let text = " §ePARKOUR RACE §r \n§r \n";
        const pkPlayers = world.getPlayers({ tags: ["in_parkour"] });
        const allPkData = [];
        
        for(const p of pkPlayers) {
            const data = getPlayerParkour(p.name);
            if(data && data.active) {
                let timeMs = (data.hasMoved && data.startTime) ? (Date.now() - data.startTime) : 0;
                allPkData.push({ name: p.name, time: timeMs, cp: data.cpIndex + 1 });
            }
        }
        
        allPkData.sort((a,b) => b.cp - a.cp || a.time - b.time);
        if(allPkData.length > 0) {
            for(let i=0; i<Math.min(3, allPkData.length); i++) {
                const d = allPkData[i];
                const timeStr = formatTime(d.time);
                const shortName = d.name.length > 6 ? d.name.substring(0,6) : d.name;
                text += ` §b${i+1}. §f${shortName} §eC${d.cp} §7${timeStr} \n`;
            }
        } else {
            text += " §c- Kosong - \n";
        }
        
        text += `§r \n §aYour Stats:§r \n`;
        const myData = getPlayerParkour(player.name);
        
        if (myData && myData.active) {
            let myTimeMs = (myData.hasMoved && myData.startTime) ? (Date.now() - myData.startTime) : 0;
            text += ` §fTime: §e${formatTime(myTimeMs)} \n`;
            text += ` §fCP: §e${myData.cpIndex + 1} \n`;
        } else if (player.hasTag("pk_finished")) {
            text += ` §fStatus: §aFINISH \n`;
            text += ` §7Ketik +restart \n`;
        } else {
            text += ` §fStatus: §cStandby \n`;
        }
        
        const wins = getParkourWins(player.name) || 0;
        text += ` §fWins: §6${wins} \n§r `;
        
        // MENGIRIM UI PARKOUR + SUBTITLE PARKOUR MODE
        player.onScreenDisplay.setTitle(text, { stayDuration: 9999, fadeInDuration: 0, fadeOutDuration: 0, subtitle: "§e- Parkour Mode -" });
        return;
    }

    // --- RENDERER SCOREBOARD NORMAL (+ ANIMASI GLYPH) ---
    const config = getConfig();
    
    // 1. Eksekusi Judul
    let titleObj = config.sbTitle || {text: "§r", anim: "none"};
    let finalTitle = resolvePlaceholders(titleObj, player);
    if (titleObj.anim && titleObj.anim.startsWith("glyph_")) {
        finalTitle = applyGlyphAnimation(finalTitle, titleObj.anim, animFrame);
    }

    // 2. Eksekusi Baris Scoreboard
    let lines = config.sbLines.map(lineData => {
        let text = resolvePlaceholders(lineData, player);
        if (lineData.anim && lineData.anim.startsWith("glyph_")) {
            return applyGlyphAnimation(text, lineData.anim, animFrame);
        }
        return text;
    });

    let finalText = finalTitle + "\n\n" + lines.join("\n");

    // 3. Eksekusi Teks IP & Port untuk Kotak Bawah (Subtitle)
    let rawSubtitle = config.ipPortText || "§bIP: §fplay.minekings.com        §bPort: §f19132";
    let subtitleText = resolvePlaceholders({ text: rawSubtitle, anim: "none" }, player);

    // 4. Kirim menggunakan API OnScreenDisplay
    player.onScreenDisplay.setTitle(finalText, { stayDuration: 9999, fadeInDuration: 0, fadeOutDuration: 0, subtitle: subtitleText });
}

// ==========================================
// ENGINE 1: TRACKER KILL & DEATH (HANYA PLAYER)
// ==========================================
world.afterEvents.entityDie.subscribe((event) => {
    const { deadEntity, damageSource } = event;
    const killer = damageSource?.damagingEntity;

    if (deadEntity.typeId === "minecraft:player") {
        safeAddScore("death", deadEntity, 1);
        if (killer && killer.typeId === "minecraft:player" && killer.name !== deadEntity.name) {
            safeAddScore("kill", killer, 1); 
        }
    } else {
        if (killer && killer.typeId === "minecraft:player") {
            if (deadEntity.hasTag("boss") || deadEntity.hasTag("dungeon_boss")) {
                safeAddScore("dungeon_kill", killer, 1);
            }
        }
    }
});

// ==========================================
// ENGINE 2: TRACKER LOMPATAN
// ==========================================
const playerYVels = {};
system.runInterval(() => {
    for (const p of world.getPlayers()) {
        try {
            const velY = p.getVelocity().y;
            const lastVelY = playerYVels[p.name] || 0;
            if (lastVelY <= 0 && velY > 0.3 && velY < 0.5) {
                safeAddScore("jump", p, 1);
            }
            playerYVels[p.name] = velY;
        } catch(e) {}
    }
}, 2);

// ==========================================
// ENGINE 3: TRACKER TIME PLAYED & UI REFRESH
// ==========================================
system.runInterval(() => {
    for (const p of world.getPlayers()) {
        safeAddScore("time_played", p, 1);
        updateScoreboardTitle(p);
    }
}, 20);