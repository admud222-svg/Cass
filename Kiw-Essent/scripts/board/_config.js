import { ScoreboardDB, ScoreboardLines, PlaceholderDB } from "./data.js";
import { system } from "../core.js";
import { globalCache } from "../lib/cache.js";

// ==========================================
// 1. JUDUL SERVER
// ==========================================
const SERVER_TITLE = "§l§bMINEKINGS";

// ==========================================
// 2. LOGIKA PING GENERATOR
// ==========================================
function getPing() {
  // Simulasi Ping (20ms - 45ms)
  return Math.floor(Math.random() * 25) + 20;
}

// ==========================================
// 3. DEFAULT LINES
// ==========================================
const DEFAULT_LINES = [
  "§8@DAY/@MONTH/@YEAR",
  "§l§r Rank : §f@RANK",
  "§l|§r Nama : §b@NAME",
  "§l|§r Clan : §c@CLAN",
  "§l|§r Uang : §e@CURRENCY@MONEY",
  "§l|§r Coin : §6@COIN",
  "§l|§r Land : §d@LAND",
  "§l|§r - Server Stats",
  "§l|§r Online : §f@ONLINE",
  "§l|§r Pings : §7@PING ms",
  "§l|§r Tps : §a@TPS",
  "@BLANK"
];

// ==========================================
// 4. CONFIG LISTENERS
// ==========================================
const configListeners = new Set();

function subscribeToConfig(listener) {
  configListeners.add(listener);
  return () => configListeners.delete(listener);
}

function notifyConfigChange() {
  const now = Date.now();
  globalCache.set("lastUpdate", now);
  // Hapus cache supaya template baru dimuat
  globalCache.delete("line_template"); 
  
  const listeners = Array.from(configListeners);
  for (const element of listeners) {
    element();
  }
}

// ==========================================
// 5. EXPORT BOARD (MODIFIED)
// ==========================================
const board = {
  get Title() {
    return SERVER_TITLE;
  },

  get Line() {
    const isEnabled = ScoreboardDB.get("ScoreboardDBConfig-enabled") ?? true;
    if (!isEnabled) return [];

    // [PENTING] Kita Cache "TEMPLATE"-nya saja, bukan hasil akhirnya
    let template = globalCache.get("line_template");

    if (!template) {
      // Kalau cache kosong, ambil dari DB atau Default
      let customLines = ScoreboardLines.get("lines");
      if (!customLines) {
        customLines = ScoreboardDB.get("ScoreboardDBConfig-lines");
      }
      template = customLines || DEFAULT_LINES;
      
      // Simpan template mentah ke cache
      globalCache.set("line_template", template);
    }

    // [PROCESSOR MANUAL DI SINI]
    // Kita "cegat" datanya sebelum dikirim ke Core system.
    // Kita ganti @PING secara manual di sini supaya selalu fresh.
    const currentPing = getPing().toString();
    const currentTPS = "20.0"; 

    // Map: Loop setiap baris dan ganti @PING dengan angka
    // Placeholder lain (@NAME, @MONEY) biarkan saja, biar Core yang urus.
    return template.map(line => {
        return line.replace("@PING", currentPing)
                   .replace("@TPS", currentTPS);
    });
  },
};

// Cleanup cache system
system.runInterval(() => {
  globalCache.cleanup();
}, 6000);

export { board, subscribeToConfig, notifyConfigChange, DEFAULT_LINES };