import { world } from "@minecraft/server";

// Mengubah DB KEY agar config otomatis ter-reset ke template baru yang lebih simple
const DB_KEY = "admud_config_v23";

/* ==========================================
   DAFTAR PLACEHOLDER UNTUK SCOREBOARD/NAMETAG:
   @NAMA      - Menampilkan nama player
   @RANKS     - Menampilkan Rank player
   @CLAN      - Menampilkan Clan player
   @MONEY     - Menampilkan Uang
   @COIN      - Menampilkan Koin
   @SHARDS    - Menampilkan Shards
   @KILL      - Menampilkan jumlah Kill
   @DEATH     - Menampilkan jumlah Death
   @PINGms    - Menampilkan Fake Ping (ms)
   @TPS       - Menampilkan Tick Per Second
   @ONLINE    - Menampilkan jumlah player online
   @MAXON     - Menampilkan batas maksimal player
   @HEALTH    - Menampilkan HP / Darah player
   @CLEARLAG  - Menampilkan timer hitung mundur ClearLag
   @LAND      - Menampilkan info tanah/owner Land Claim
   @TANGGAL   - Menampilkan Tanggal
   @BULAN     - Menampilkan Bulan
   @TAHUN     - Menampilkan Tahun
========================================== */

export const DEFAULT_CONFIG = {
    sbLines: [
        { text: "§r§l§bSERVER MINEKINGS§r", anim: "shiny" }, 
        { text: "§r ", anim: "none" },
        { text: "§f| Profile (§e@NAMA§f)§r", anim: "none" },
        { text: "§f| RANK : §a@RANKS§r", anim: "none" },
        { text: "§f| MONEY : §a$@MONEY§r", anim: "none" },
        { text: "§f| COIN : §e@COIN§r", anim: "none" },
        { text: "§f| CLAN : §b@CLAN§r", anim: "none" },
        { text: "§r  ", anim: "none" },
        { text: "§fSERVER STATS (§a@ONLINE§f)§r", anim: "none" },
        { text: "§f| TPS: §a@TPS§r", anim: "none" },
        { text: "§f| PINGS : §a@PINGms§r", anim: "none" },
        { text: "§f| LAND : §a@LAND§r", anim: "none" },
        { text: "§r   ", anim: "none" }
    ],
    chatFormat: { text: "§r§8[@RANKS§8] §r@NAMA §8>> §r@MESSAGE", anim: "none" },
    nametagFormat: { text: "§r@RANKS @NL §r@NAMA @NL §c@HEALTH HP§r", anim: "none" },
    
    menuToggles: {
        clan: true,
        tpa: true,
        rtp: true,
        claimland: true,
        serverwarp: true,
        playerwarp: true
    },
    autoGiveMenu: true,
    memberConfig: {
        maxClanMembers: 15, 
        clanRenameCost: 50000, 
        clanRenameCooldown: 7 
    }
};

export function getConfig() {
    try {
        const data = world.getDynamicProperty(DB_KEY);
        let currentConfig = data ? JSON.parse(data) : DEFAULT_CONFIG;
        
        if (!currentConfig.menuToggles) {
            currentConfig.menuToggles = DEFAULT_CONFIG.menuToggles;
        }
        if (!currentConfig.memberConfig) {
            currentConfig.memberConfig = DEFAULT_CONFIG.memberConfig;
        }
        
        return currentConfig;
    } catch (e) {
        return DEFAULT_CONFIG;
    }
}

export function saveConfig(newConfig) {
    try {
        world.setDynamicProperty(DB_KEY, JSON.stringify(newConfig));
    } catch (e) {}
}