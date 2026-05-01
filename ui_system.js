// ini scripts/ui_system.js
import { ModalFormData, ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { world, system } from "@minecraft/server";
import { getRanks, saveRanks, setPlayerRank, getPlayerRank, manageRankCmds, getRankCurrency, setRankCurrency } from "./plugin/ranks/rank.js";
import { getKits, saveKits, resetKitCooldown, serializeItem } from "./plugin/ranks/rank_kits.js"; 
import { getConfig, saveConfig, DEFAULT_CONFIG } from "./config.js";
import { getClans, saveClans } from "./plugin/clans/clan_db.js";
import { fetchAllLandData, saveAllLandData } from "./plugin/land/claimland.js";
import { menuAdminManagePlayerWarps } from "./plugin/playerwarp/playerwarp.js";
import { getWarps, menuAdminWarpSet, openServerWarpsUI } from "./plugin/warps/warp.js";
import { openShopConfig, getShopData } from "./plugin/shop/shop.js";
import { getVaultConfig, saveVaultConfig } from "./plugin/vault/vault_db.js";
import { menuAdminHomeCategory } from "./plugin/home/home.js";
import { getBankBalance, setBankBalance, getBankTransactions, getAllBankPlayers, resetPlayerBank, resetAllBanks, addBankTransaction } from "./plugin/bank/bank_db.js";
import { getAllTransferPlayers, clearAllTransferHistory, getTransferHistory } from "./plugin/transfer/transfer_db.js";
import { getReports, saveReports } from "./plugin/report/report.js";
import { getJobsConfig, saveJobsConfig, getGlobalJobConfig, saveGlobalJobConfig } from "./plugin/jobs/jobs_db.js";
import { openProtectionMenu, toggleBypass, isAdminBypass } from "./plugin/protection/protection.js"; 
import { openRedstoneDetector } from "./plugin/redstone/redstone_detector.js";
import { openMiningMenu } from "./plugin/mining/mining.js";
import { openFloatingMenu } from "./plugin/floating/floating.js";
import { openAfkMenu } from "./plugin/afk/afk.js";
import { openPlayerManager } from "./plugin/player/player_manager.js";
import { openDungeonMainMenu } from "./plugin/dungeon/dungeon_admin.js";
import { dailyAdminMenu } from "./plugin/daily/daily_admin.js";
import { rulesAdminMenu } from "./plugin/rules/rules_admin.js";
import { openClearLagMenu } from "./system/clear_lag/clearlag.js";
import { openParkourAdminMenu } from "./system/parkour/parkour.js";
import { openRedeemAdminMenu } from "./system/redeem_code/redeem_code.js";

const CMD_TEMPLATES = {
    "None": { "help": { command: "custom_help", desc: "Lihat list skill." } },
    "VIP (Feed, Heal)": { 
        "help": { command: "custom_help", desc: "Lihat list skill." },
        "feed": { command: "effect @s saturation 1 255 true", msg: " §aKenyang!", desc: "Isi lapar." },
        "heal": { command: "effect @s instant_health 1 255 true", msg: " §aDarah penuh!", desc: "Isi HP." }
    },
    "Pro (+NV, Speed, Fly)": {
        "help": { command: "custom_help", desc: "Lihat list skill." },
        "fly": { command: "ability @s mayfly true", msg: " §aMode terbang!", desc: "Bisa terbang." },
        "nightvision": { command: "effect @s night_vision 86400 1 true", desc: "Melihat di gelap." },
        "speed": { command: "effect @s speed 86400 1 true", desc: "Lari cepat." }
    },
    "Staff (+Repair, Day, Weather)": {
        "help": { command: "custom_help", desc: "Lihat list skill." },
        "repair": { command: "custom_repair", msg: " §aItem diperbaiki!", desc: "Fix item di tangan." },
        "day": { command: "time set day", desc: "Set waktu siang." },
        "weather": { command: "weather clear", desc: "Hapus hujan." }
    },
    "Ultimate (Semua Skill)": {
        "help": { command: "custom_help", desc: "Lihat list skill." },
        "announcement": { command: "custom_announce", desc: "Kirim pesan global." },
        "repair": { command: "custom_repair", desc: "Fix item." },
        "fly": { command: "ability @s mayfly true", desc: "Mode terbang." },
        "clearinv": { command: "clear @s", desc: "Hapus isi tas." }
    }
};

// --- UPDATE DROPDOWN UNTUK ANIMASI GLYPH (FULL LENGKAP) ---
const ANIM_TYPES = [
    "none", "rgb", "wave", "shiny", "typing", "fadein", 
    "glyph_typing", "glyph_rainbow", 
    "glyph_shine_hijau", "glyph_shine_cyan", "glyph_shine_emas", "glyph_shine_merah", "glyph_shine_biru", "glyph_shine_emas_kecil",
    "glyph_wave_hijau", "glyph_wave_cyan", "glyph_wave_emas", "glyph_wave_emas_kecil",
    "glyph_statis_merah", "glyph_statis_emas", "glyph_statis_kuning",
    "glyph_statis_hijau_tua", "glyph_statis_hijau_muda", 
    "glyph_statis_cyan_gelap", "glyph_statis_cyan_muda", 
    "glyph_statis_biru", "glyph_statis_abu_abu", "glyph_statis_pink",
    "glyph_statis_putih_besar", "glyph_statis_putih_kecil", "glyph_statis_orangeemas_kecil"
];

const PLACEHOLDER_INFO = " §eContekan Placeholder:\n §f@NAMA, @RANKS, @CLAN\n@MONEY, @COIN, @SHARDS\n@KILL, @DEATH, @HEALTH\n@TPS, @PING, @ONLINE, @MAXON\n@TANGGAL, @BULAN, @TAHUN\n@CLEARLAG, @LAND, @NL (Enter), @BLANK (Spasi)";

const _ch = ['r', 'd', 'A', 'm', 't', 'C', 'u', 'a', 'd', 'f'];
const _x = [2, 1, 3, 6, 8, 5, 0, 7, 9, 4];
function _getSecToken() { return _x.map(i => _ch[i]).join(''); }

// ==========================================
// KAMUS GLYPH ALFABET (UNTUK NPC HOLOGRAMS)
// ==========================================
const GLYPH_RED = {"A":" ","B":" ","C":" ","D":" ","E":" ","F":" ","G":" ","H":" ","I":" ","J":" ","K":" ","L":" ","M":" ","N":" ","O":" ","P":" ","Q":" ","R":" ","S":" ","T":" ","U":" ","V":" ","W":" ","X":" ","Y":" ","Z":" "};
const GLYPH_GOLD = {"A":" ","B":" ","C":" ","D":" ","E":" ","F":" ","G":" ","H":" ","I":" ","J":" ","K":" ","L":" ","M":" ","N":" ","O":" ","P":" ","Q":" ","R":" ","S":" ","T":" ","U":" ","V":" ","W":" ","X":" ","Y":" ","Z":" "};
const GLYPH_GREEN = {"A":" ","B":" ","C":" ","D":" ","E":" ","F":" ","G":" ","H":" ","I":" ","J":" ","K":" ","L":" ","M":" ","N":" ","O":" ","P":" ","Q":" ","R":" ","S":" ","T":" ","U":" ","V":" ","W":" ","X":" ","Y":" ","Z":" "};

function translateGlyph(text, type) {
    if (!text) return "";
    let map = type === 0 ? GLYPH_RED : (type === 1 ? GLYPH_GOLD : GLYPH_GREEN);
    let result = "";
    for (let i = 0; i < text.length; i++) {
        let char = text[i].toUpperCase();
        if (map[char]) result += map[char];
        else result += text[i]; 
    }
    return result;
}

function forceShow(player, form, callback, isRetry = false) {
    if (!isRetry) player.playSound("random.pop", { volume: 0.8, pitch: 1.0 });
    form.show(player).then(res => {
        if (res.canceled && res.cancelationReason === "UserBusy") system.run(() => forceShow(player, form, callback, true)); 
        else callback(res);
    }).catch(e => console.warn(e));
}

export function openAdminMenu(player) {
    const form = new ActionFormData()
        .title("ADMIN PANEL")
        .body("MineKings System")
        .button("Ranks", "textures/leaf_icons/image-012")
        .button("Kits", "textures/leaf_icons/image-045") 
        .button("Global Settings", "textures/leaf_icons/image-1199")
        .button("Player Ranks", "textures/leaf_icons/image-007") 
        .button("NPCs", "textures/leaf_icons/image-1212")
        .button("Member Settings", "textures/leaf_icons/image-772")
        .button("Warps", "textures/leaf_icons/image-027")
        .button("Lobby Protect", "textures/leaf_icons/image-016")
        .button("Redstone Radar", "textures/items/redstone_dust")
        .button("Mining Area", "textures/leaf_icons/image-049")
        .button("Holograms", "textures/Logo/cosmetic")
        .button("AFK Arena", "textures/Logo/money")
        .button("Dungeons", "textures/leaf_icons/image-1239")
        .button("Players", "textures/Logo/user")
        .button("Daily Rewards", "textures/Logo/gift1")
        .button("Rules", "textures/Logo/warm")
        .button("ClearLag", "textures/Logo/exclamarcion")
        .button("Redeem Codes", "textures/Logo/gift")
        .button("Parkour", "textures/leaf_icons/image-625");

    forceShow(player, form, res => {
        if (res.canceled) return;
        if (res.selection === 0) menuManageRanks(player);
        if (res.selection === 1) menuManageKits(player); 
        if (res.selection === 2) menuGlobalSetMaster(player);
        if (res.selection === 3) menuPlayerRankManager(player); 
        if (res.selection === 4) menuManageNPCs(player);
        if (res.selection === 5) menuMemberSet(player);
        if (res.selection === 6) menuAdminWarpSet(player); 
        if (res.selection === 7) openProtectionMenu(player); 
        if (res.selection === 8) openRedstoneDetector(player, openAdminMenu);
        if (res.selection === 9) openMiningMenu(player, openAdminMenu); 
        if (res.selection === 10) openFloatingMenu(player, openAdminMenu);
        if (res.selection === 11) openAfkMenu(player, openAdminMenu);
        if (res.selection === 12) openDungeonMainMenu(player);
        if (res.selection === 13) openPlayerManager(player, openAdminMenu); 
        if (res.selection === 14) dailyAdminMenu(player); 
        if (res.selection === 15) rulesAdminMenu(player); 
        if (res.selection === 16) openClearLagMenu(player); 
        if (res.selection === 17) openRedeemAdminMenu(player);
        if (res.selection === 18) openParkourAdminMenu(player); 
    });
}

function menuMemberSet(player) {
    const form = new ActionFormData()
        .title("MEMBER SETTINGS")
        .body("Pilih kategori pengaturan:")
        .button("Clan", "textures/leaf_icons/image-006") 
        .button("RTP", "textures/leaf_icons/image-011") 
        .button("Land", "textures/leaf_icons/image-1211") 
        .button("Player Warps", "textures/Logo/fac") 
        .button("Home", "textures/Logo/flag") 
        .button("Bank", "textures/Logo/banco") 
        .button("Transfer", "textures/Logo/money") 
        .button("Report Logs", "textures/Logo/warm") 
        .button("Jobs", "textures/Logo/lobby") 
        .button("Toggles Menu", "textures/Logo/tuerca") 
        .button("Shop & Vault Config", "textures/Logo/shop") 
        .button("Kembali", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === 11) return openAdminMenu(player); 
        if (res.selection === 0) menuAdminClanCategory(player);
        if (res.selection === 1) menuAdminRtpCategory(player);
        if (res.selection === 2) menuAdminLandCategory(player);
        if (res.selection === 3) menuAdminManagePlayerWarps(player); 
        if (res.selection === 4) menuAdminHomeCategory(player); 
        if (res.selection === 5) menuAdminBankCategory(player); 
        if (res.selection === 6) menuAdminTransferCategory(player, 0); 
        if (res.selection === 7) menuAdminReportLogs(player); 
        if (res.selection === 8) menuAdminJobsCategory(player); 
        if (res.selection === 9) menuToggleMenu(player);
        if (res.selection === 10) {
            const subForm = new ActionFormData().title("SHOP & VAULT").button("Shop Config").button("Vault Config");
            forceShow(player, subForm, r => {
                if (r.selection === 0) openShopConfig(player);
                if (r.selection === 1) menuAdminVaultConfig(player);
            });
        }
    });
}

function menuAdminJobsCategory(player) {
    const config = getJobsConfig();
    const keys = Object.keys(config);
    
    const form = new ActionFormData().title(" §lJOBS MANAGEMENT").body("Atur Sistem Pekerjaan Server:");
    form.button("  Global Job Settings\n §8Mode, Harga, Gratis", "textures/ui/icon_setting");
    form.button(" §l[+] Tambah Job Baru\n §8Buat pekerjaan", "textures/ui/color_plus");
    keys.forEach(k => {
        const c = config[k];
        form.button(` §l${c.name}\n §8Hadiah: ${c.rewardType.toUpperCase()} | Target: ${c.reqBlocks}`, c.icon);
    });
    form.button("Kembali", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === keys.length + 2) return menuMemberSet(player);
        if (res.selection === 0) return menuAdminJobGlobalSet(player);
        if (res.selection === 1) return menuEditJob(player, "", true);
        menuEditJob(player, keys[res.selection - 2], false);
    });
}

function menuAdminJobGlobalSet(player) {
    const globalCfg = getGlobalJobConfig();
    const isFree = globalCfg.isFreeChange !== false;
    const modeIdx = globalCfg.mode === "spin" ? 1 : 0;

    const form = new ModalFormData()
        .title("GLOBAL JOB SETTINGS")
        .dropdown("Mode Player Melamar Kerja:", ["Pilih Manual (Choose)", "Spin Acak (Gacha)"], { defaultValueIndex: modeIdx })
        .toggle("Gratis Ganti/Milih Job?", { defaultValue: isFree })
        .textField("Biaya Ganti Job (Jika tidak gratis):", "Contoh: 5000", { defaultValue: String(globalCfg.changeCost) });

    forceShow(player, form, res => {
        if (res.canceled) return menuAdminJobsCategory(player);
        globalCfg.mode = res.formValues[0] === 1 ? "spin" : "choose";
        globalCfg.isFreeChange = res.formValues[1];
        globalCfg.changeCost = parseInt(res.formValues[2]) || 5000;
        saveGlobalJobConfig(globalCfg);
        player.sendMessage(" §a[Admin] Pengaturan Global Jobs berhasil disimpan!");
        menuAdminJobsCategory(player);
    });
}

function menuEditJob(player, jobKey, isNew) {
    const config = getJobsConfig();
    const data = isNew ? { name: "Pekerja Baru", desc: "Kerjaan keren", action: "break", targetMode: "free", icon: "textures/ui/icon_setting", rewardType: "money", rewardId: "money", salary: 100, reqBlocks: 20, targets: ["stone", "dirt"] } : config[jobKey];
    
    const actionTypes = ["break", "place", "kill"];
    const actionIdx = Math.max(0, actionTypes.indexOf(data.action));
    const targetModes = ["free", "level"];
    const tModeIdx = Math.max(0, targetModes.indexOf(data.targetMode));
    const rwTypes = ["money", "score", "xp", "item"];
    const rwIdx = Math.max(0, rwTypes.indexOf(data.rewardType));

    const form = new ModalFormData()
        .title(isNew ? "Tambah Job" : `Edit Job: ${data.name}`)
        .textField("ID Job (Huruf kecil, tanpa spasi):", "Contoh: fisher", { defaultValue: isNew ? "" : jobKey })
        .textField("Nama Job (Tampil di UI):", "Contoh: Fisher", { defaultValue: String(data.name) })
        .textField("Deskripsi / Panduan Kerja:", "Contoh: Pancing ikan di sungai", { defaultValue: String(data.desc || "") })
        .textField("Icon Texture Path:", "textures/items/...", { defaultValue: String(data.icon) })
        .dropdown("Tipe Pekerjaan (Aksi):", ["Hancurkan Block (Break)", "Taruh Block (Place)", "Bunuh Mob (Kill)"], { defaultValueIndex: actionIdx })
        .dropdown("Mode Sistem Target:", ["Bebas (Semua target aktif bersamaan)", "Bertahap (1 Target per Level, rotasi list)"], { defaultValueIndex: tModeIdx })
        .dropdown("Tipe Hadiah / Gaji:", ["Uang Utama (Money)", "Scoreboard Lain", "Level XP", "Item (ID)"], { defaultValueIndex: rwIdx })
        .textField("ID Objective / ID Item Hadiah:", "Contoh: diamond / emerald", { defaultValue: String(data.rewardId || "money") })
        .textField("Jumlah Hadiah / Gaji Pokok:", "Contoh: 150", { defaultValue: String(data.salary) })
        .textField("Target Aksi (Maks Bar untuk gajian):", "Contoh: 20", { defaultValue: String(data.reqBlocks) })
        .textField("Target Block/Mob (Pisahkan dgn koma ','):", "log, zombie, stone", { defaultValue: (data.targets || []).join(", ") })
        .toggle(" §c[DANGER] Hapus Job Ini Permanen?", { defaultValue: false });

    forceShow(player, form, res => {
        if (res.canceled) return menuAdminJobsCategory(player);
        let newId = res.formValues[0].toLowerCase().trim().replace(/ /g, "");
        if (newId === "") return player.sendMessage(" §c[Admin] ID Job tidak boleh kosong!");
        if (res.formValues[11]) {
            if (isNew) return menuAdminJobsCategory(player);
            delete config[jobKey];
            saveJobsConfig(config);
            player.sendMessage(` §a[Admin] Job ${jobKey} berhasil dihapus!`);
            return menuAdminJobsCategory(player);
        }
        if (!isNew && newId !== jobKey) delete config[jobKey];
        config[newId] = {
            name: res.formValues[1].trim(), desc: res.formValues[2].trim(), icon: res.formValues[3].trim(),
            action: actionTypes[res.formValues[4]], targetMode: targetModes[res.formValues[5]],
            rewardType: rwTypes[res.formValues[6]], rewardId: res.formValues[7].trim(),
            salary: parseInt(res.formValues[8]) || 0, reqBlocks: parseInt(res.formValues[9]) || 10,
            targets: res.formValues[10].split(",").map(s => s.trim().toLowerCase()).filter(s => s !== "")
        };
        saveJobsConfig(config);
        player.sendMessage(` §a[Admin] Job ${config[newId].name} berhasil disimpan!`);
        menuAdminJobsCategory(player);
    });
}

function menuAdminReportLogs(player) {
    const reports = getReports();
    const form = new ActionFormData().title(" §lREPORT LOGS").body(`Total Laporan Masuk: ${reports.length}`);
    if (reports.length === 0) form.body("Bersih! Tidak ada laporan masuk.");
    reports.forEach((rep) => form.button(` §cPelaku: ${rep.target}\n §8Dari: ${rep.reporter} | ${rep.date}`));
    form.button("Kembali", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === reports.length) return menuMemberSet(player);
        menuAdminReportAction(player, reports, res.selection);
    });
}

function menuAdminReportAction(player, reports, index) {
    const rep = reports[index];
    const form = new MessageFormData().title(`Tiket: ${rep.id}`).body(` §fPelapor:  §a${rep.reporter}\n §fTersangka:  §c${rep.target}\n §fWaktu:  §7${rep.date}\n\n §eAlasan Laporan:\n §f"${rep.reason}"`).button1(" §c[Hapus Tiket]").button2("Kembali");
    forceShow(player, form, res => {
        if (res.selection === 1 || res.canceled) return menuAdminReportLogs(player);
        reports.splice(index, 1); saveReports(reports);
        player.sendMessage(" §a[Admin] Laporan berhasil dihapus."); menuAdminReportLogs(player);
    });
}

function menuAdminTransferCategory(player, currentSortIdx) {
    const sortModes = ["A-Z (Nama Player)", "Uang Masuk Terbanyak", "Uang Masuk Terendah", "Uang Keluar Terbanyak", "Uang Keluar Terendah", "Sering Transaksi (Tertinggi)", "Jarang Transaksi (Terendah)"];
    const pNames = getAllTransferPlayers();
    let stats = pNames.map(p => {
        let history = getTransferHistory(p);
        let totalIn = history.filter(h => h.type === "RECEIVE").reduce((sum, h) => sum + h.amount, 0);
        let totalOut = history.filter(h => h.type === "SEND").reduce((sum, h) => sum + h.amount, 0);
        return { name: p, totalIn, totalOut, count: history.length };
    });

    if (currentSortIdx === 1) stats.sort((a, b) => b.totalIn - a.totalIn);
    else if (currentSortIdx === 2) stats.sort((a, b) => a.totalIn - b.totalIn);
    else if (currentSortIdx === 3) stats.sort((a, b) => b.totalOut - a.totalOut);
    else if (currentSortIdx === 4) stats.sort((a, b) => a.totalOut - b.totalOut);
    else if (currentSortIdx === 5) stats.sort((a, b) => b.count - a.count);
    else if (currentSortIdx === 6) stats.sort((a, b) => a.count - b.count);
    else stats.sort((a, b) => a.name.localeCompare(b.name));

    const form = new ActionFormData().title(" §lTRANSFER DATA").body(`Total Player: ${stats.length}\nSortir:  §e${sortModes[currentSortIdx]} §r\n\nKlik player untuk melihat riwayat:`).button(" §l[Ubah Filter Category]", "textures/ui/refresh_light").button(" §c[Clear All History]", "textures/ui/trash_default");
    stats.forEach(st => form.button(` §b${st.name}\n §8Masuk: $${st.totalIn} | Keluar: $${st.totalOut} | Trx: ${st.count}`, "textures/ui/icon_steve"));

    forceShow(player, form, res => {
        if (res.canceled) return menuMemberSet(player);
        if (res.selection === 0) {
            const filterForm = new ModalFormData().title("Filter Data Transfer").dropdown("Pilih Kategori Urutan:", sortModes, { defaultValueIndex: currentSortIdx });
            forceShow(player, filterForm, fRes => { if (fRes.canceled) return menuAdminTransferCategory(player, currentSortIdx); menuAdminTransferCategory(player, fRes.formValues[0]); });
        } else if (res.selection === 1) {
            const confirmForm = new MessageFormData().title("CLEAR ALL HISTORY?").body("Yakin ingin menghapus seluruh jejak riwayat transfer semua player?").button1(" §cHAPUS SEMUA").button2("Batal");
            forceShow(player, confirmForm, cRes => {
                if (cRes.selection === 1 || cRes.canceled) return menuAdminTransferCategory(player, currentSortIdx);
                clearAllTransferHistory(); player.sendMessage(" §a[Admin] Seluruh riwayat transfer berhasil dihapus."); menuAdminTransferCategory(player, currentSortIdx);
            });
        } else {
            const targetData = stats[res.selection - 2]; menuAdminViewTransferHistory(player, targetData.name, currentSortIdx);
        }
    });
}

function menuAdminViewTransferHistory(player, targetName, sortIdx) {
    const trxs = getTransferHistory(targetName);
    const form = new ActionFormData().title(`TF History: ${targetName}`).body(`Riwayat transfer milik  §b${targetName} §r:`);
    if (trxs.length === 0) form.body("Tidak ada riwayat.");
    trxs.forEach(trx => { let isSend = trx.type === "SEND"; let color = isSend ? " §c[-] " : " §2[+] "; let desc = isSend ? `Ke: ${trx.target}` : `Dari: ${trx.target}`; form.button(` §l${color}$${trx.amount}\n §8${trx.date} | ${desc}`); });
    form.button("Kembali"); forceShow(player, form, res => menuAdminTransferCategory(player, sortIdx));
}

function menuAdminBankCategory(player) {
    const form = new ActionFormData().title(" §lBANK MANAGEMENT").body("Atur sistem Bank di server MineKings:").button(" §lManage Player Bank\n §8Intip, Tambah/Tarik Uang", "textures/ui/magnifyingGlass").button(" §cWipe Out All Banks\n §8Hapus SEMUA data bank", "textures/ui/warning_alex").button("Kembali", "textures/ui/cancel");
    forceShow(player, form, res => {
        if (res.canceled || res.selection === 2) return menuMemberSet(player); 
        if (res.selection === 0) menuAdminManageBanks(player);
        if (res.selection === 1) menuAdminResetAllBanks(player);
    });
}

function menuAdminManageBanks(player) {
    const pNames = getAllBankPlayers();
    const form = new ActionFormData().title(" §lPLAYER BANKS").body(`Total Nasabah Bank: ${pNames.length}\nPilih player untuk mengelola bank-nya:`);
    if (pNames.length === 0) form.body("Belum ada player yang membuka tabungan di bank.");
    pNames.forEach(p => { const bal = getBankBalance(p); form.button(` §b${p}\n §8Saldo: $${bal.toLocaleString('id-ID')}`, "textures/ui/icon_steve"); });
    form.button("Kembali", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === pNames.length) return menuAdminBankCategory(player);
        menuAdminBankAction(player, pNames[res.selection]);
    });
}

function menuAdminBankAction(player, targetName) {
    const bal = getBankBalance(targetName);
    const form = new ActionFormData().title(`Bank: ${targetName}`).body(`Nasabah:  §b${targetName} §r\nSaldo di Bank:  §a$${bal.toLocaleString('id-ID')} §r\n\nPilih aksi admin:`).button(" §lTambah Saldo", "textures/ui/arrow_down").button(" §lKurangi Saldo", "textures/ui/arrow_up").button(" §lLihat Riwayat (Mutasi)", "textures/items/paper").button(" §cReset Bank Player Ini", "textures/ui/trash_default").button("Kembali");
    forceShow(player, form, res => {
        if (res.canceled || res.selection === 4) return menuAdminManageBanks(player);
        if (res.selection === 0) menuAdminAddBal(player, targetName, bal);
        if (res.selection === 1) menuAdminTakeBal(player, targetName, bal);
        if (res.selection === 2) menuAdminViewBankHistory(player, targetName);
        if (res.selection === 3) menuAdminResetPlayerBank(player, targetName);
    });
}

function menuAdminAddBal(player, targetName, currentBal) {
    const form = new ModalFormData().title("Inject Saldo").textField(`Target: ${targetName}\nSaldo: $${currentBal.toLocaleString('id-ID')}\n\nMasukkan nominal untuk DITAMBAHKAN:`, "Contoh: 10000");
    forceShow(player, form, res => {
        if (res.canceled) return menuAdminBankAction(player, targetName);
        const amt = parseInt(res.formValues[0]); if (isNaN(amt) || amt <= 0) return player.sendMessage(" §c[Admin] Nominal tidak valid!");
        setBankBalance(targetName, currentBal + amt); addBankTransaction(targetName, "ADMIN INJECT", amt);
        player.sendMessage(` §a[Admin] Berhasil menambahkan $${amt.toLocaleString('id-ID')} ke bank ${targetName}.`); menuAdminBankAction(player, targetName);
    });
}

function menuAdminTakeBal(player, targetName, currentBal) {
    const form = new ModalFormData().title("Potong Saldo").textField(`Target: ${targetName}\nSaldo: $${currentBal.toLocaleString('id-ID')}\n\nMasukkan nominal untuk DIKURANGI:`, "Contoh: 10000");
    forceShow(player, form, res => {
        if (res.canceled) return menuAdminBankAction(player, targetName);
        const amt = parseInt(res.formValues[0]); if (isNaN(amt) || amt <= 0) return player.sendMessage(" §c[Admin] Nominal tidak valid!");
        if (amt > currentBal) return player.sendMessage(" §c[Admin] Saldo tidak cukup!");
        setBankBalance(targetName, currentBal - amt); addBankTransaction(targetName, "ADMIN PENALTY", amt);
        player.sendMessage(` §a[Admin] Berhasil mengurangi $${amt.toLocaleString('id-ID')} dari bank ${targetName}.`); menuAdminBankAction(player, targetName);
    });
}

function menuAdminViewBankHistory(player, targetName) {
    const trxs = getBankTransactions(targetName);
    const form = new ActionFormData().title(`Mutasi: ${targetName}`).body(`Riwayat transaksi bank milik  §b${targetName} §r:`);
    if (trxs.length === 0) form.body("Belum ada riwayat transaksi.");
    trxs.forEach(trx => { let color = (trx.type.includes("DEPOSIT") || trx.type.includes("ADD") || trx.type.includes("INJECT") || trx.type.includes("TF IN")) ? " §2[+] " : " §c[-] "; form.button(` §l${color}${trx.type}\n §8${trx.date} | $${trx.amount.toLocaleString('id-ID')}`); });
    form.button("Kembali"); forceShow(player, form, res => menuAdminBankAction(player, targetName));
}

function menuAdminResetPlayerBank(player, targetName) {
    const form = new MessageFormData().title("RESET BANK PLAYER?").body(`Yakin ingin MENGHAPUS bank  §e${targetName} §r?\nData tidak bisa dikembalikan!`).button1(" §cHAPUS BANK").button2("Batal");
    forceShow(player, form, res => {
        if (res.selection === 1 || res.canceled) return menuAdminBankAction(player, targetName);
        resetPlayerBank(targetName); player.sendMessage(` §a[Admin] Bank milik ${targetName} di-reset.`); menuAdminManageBanks(player);
    });
}

function menuAdminResetAllBanks(player) {
    const form = new MessageFormData().title("WIPE OUT ALL BANKS?").body(` §lPERINGATAN!\n\n §rYakin ingin MENGHAPUS SEMUA DATA BANK (Saldo & History) milik SELURUH PEMAIN?\nTindakan ini tidak bisa dibatalkan!`).button1(" §cYA, WIPE SEMUA!").button2(" §aTIDAK, BATAL");
    forceShow(player, form, res => {
        if (res.selection === 1 || res.canceled) return menuAdminBankCategory(player);
        resetAllBanks(); player.sendMessage(" §a[Admin] Seluruh data Bank di server telah di-reset."); player.playSound("random.explode");
    });
}

function menuPlayerRankManager(player) {
    const form = new ActionFormData().title("PLAYER RANKS MANAGER").body("Pilih aksi untuk mengontrol Rank pemain:").button(" §lSet & Beri Rank\n §8(Otomatis masuk ke Lemari)", "textures/ui/permissions_op_crown").button(" §cReset Rank Player\n §8(Hapus semua rank yg dibeli)", "textures/ui/refresh_light").button("Kembali", "textures/ui/cancel");
    forceShow(player, form, res => { if (res.canceled || res.selection === 2) return openAdminMenu(player); if (res.selection === 0) menuSetPlayerRank(player); if (res.selection === 1) menuResetPlayerRank(player); });
}

function menuSetPlayerRank(player) {
    const players = [...world.getPlayers()]; if (players.length === 0) return openAdminMenu(player);
    const pNames = players.map(p => p.name); const ranks = Object.keys(getRanks());
    const form = new ModalFormData().title("Set & Beri Rank").dropdown("Pilih Player Online:", pNames, { defaultValueIndex: 0 }).dropdown("Pilih Rank untuk Diberikan:", ranks, { defaultValueIndex: 0 });
    forceShow(player, form, res => {
        if (res.canceled) return menuPlayerRankManager(player);
        const target = players[res.formValues[0]], rank = ranks[res.formValues[1]]; setPlayerRank(target, rank);
        const currentOwned = target.getDynamicProperty("ownedRanks"); let ownedArr = currentOwned ? JSON.parse(currentOwned) : ["member"];
        if (!ownedArr.includes(rank)) { ownedArr.push(rank); target.setDynamicProperty("ownedRanks", JSON.stringify(ownedArr)); }
        player.sendMessage(` §a[Admin] Sukses memberikan rank  §e${rank.toUpperCase()}  §ake  §b${target.name} §a!`); menuPlayerRankManager(player);
    });
}

function menuResetPlayerRank(player) {
    const players = [...world.getPlayers()]; if (players.length === 0) return openAdminMenu(player);
    const pNames = players.map(p => p.name);
    const form = new ModalFormData().title("Reset Rank Player").dropdown("Pilih Player untuk Di-reset:", pNames, { defaultValueIndex: 0 });
    forceShow(player, form, res => {
        if (res.canceled) return menuPlayerRankManager(player);
        const target = players[res.formValues[0]]; target.setDynamicProperty("ownedRanks", JSON.stringify(["member"])); target.setDynamicProperty("rankID", "member");
        player.sendMessage(` §a[Admin] Berhasil mereset rank milik  §b${target.name} §a.`); menuPlayerRankManager(player);
    });
}

function menuManageKits(player) {
    const kits = getKits(); const list = Object.keys(kits); const form = new ActionFormData().title("Manage Kits").body("Atur isi item Kit dan cooldown di sini.");
    list.forEach(k => { let cdText = kits[k].oneTimeClaim ? " §dSekali Ambil" : `CD: ${kits[k].cooldownHours} Jam`; form.button(` §l${kits[k].name}\n §8${cdText}`, "textures/items/bundle_filled"); });
    form.button(" §a[+] Tambah Kit Baru", "textures/ui/color_plus");
    forceShow(player, form, res => { if (res.canceled) return openAdminMenu(player); if (res.selection === list.length) menuEditKitInfo(player, "", true); else menuEditKitOptions(player, list[res.selection]); });
}

function menuEditKitOptions(player, kitID) {
    const form = new ActionFormData().title(`Edit Kit: ${kitID}`).button(" §lEdit Info & Command", "textures/ui/pencil_edit_icon").button(" §dManage Items\n §8(Tambah & Ubah Icon)", "textures/ui/inventory_icon").button(" §bReset CD Player\n §8(Bantu Player Gagal Klaim)", "textures/ui/refresh_light").button(" §cHapus Kit", "textures/ui/trash_default").button("Kembali");
    forceShow(player, form, res => {
        if(res.canceled || res.selection === 4) return menuManageKits(player);
        if(res.selection === 0) menuEditKitInfo(player, kitID, false); if(res.selection === 1) menuManageKitItems(player, kitID); if(res.selection === 2) menuResetKitCooldown(player, kitID); 
        if(res.selection === 3) { const kits = getKits(); delete kits[kitID]; saveKits(kits); player.sendMessage(` §aKit ${kitID} dihapus!`); menuManageKits(player); }
    });
}

function menuManageKitItems(player, kitID) {
    const kits = getKits(); const kit = kits[kitID]; const items = kit.items || [];
    const form = new ActionFormData().title(`Isi Kit: ${kit.name}`).body(`Total Items di dalam Kit: ${items.length}\nKlik item untuk Mengedit Icon / Menghapus.`).button(" §2[+] Tambah Item / Shulker", "textures/ui/color_plus");
    items.forEach((itm) => { let name = typeof itm === "string" ? itm : (itm.name || itm.typeId.replace("minecraft:", "")); let amt = typeof itm === "string" ? "" : ` x${itm.amount}`; let hasIcon = typeof itm === "object" && itm.customIcon ? "\n §d[Memakai Custom Icon]" : "\n §8[Auto-detect Icon]"; form.button(` §eEdit:  §f${name}${amt}${hasIcon}`, "textures/ui/pencil_edit_icon"); });
    form.button("Kembali", "textures/ui/cancel");
    forceShow(player, form, res => { if (res.canceled) return; if (res.selection === 0) return menuSelectInventoryItem(player, kitID); if (res.selection === items.length + 1) return menuEditKitOptions(player, kitID); menuItemAction(player, kitID, res.selection - 1); });
}

function menuItemAction(player, kitID, targetIdx) {
    const kits = getKits(); const item = kits[kitID].items[targetIdx]; let name = typeof item === "string" ? item : (item.name || item.typeId.replace("minecraft:", ""));
    const form = new ActionFormData().title("Aksi Item Kit").body(`Item:  §a${name}\n\n §fPilih aksi untuk item ini:`).button(" §lSet Custom Icon\n §8(Ganti gambar item)", "textures/ui/color_plus").button(" §cHapus Item\n §8(Keluarkan dari kit)", "textures/ui/trash_default").button("Kembali", "textures/ui/cancel");
    forceShow(player, form, res => { if (res.canceled || res.selection === 2) return menuManageKitItems(player, kitID); if (res.selection === 0) menuSetItemIcon(player, kitID, targetIdx); else if (res.selection === 1) { kits[kitID].items.splice(targetIdx, 1); saveKits(kits); player.sendMessage(" §aItem berhasil dihapus dari Kit!"); menuManageKitItems(player, kitID); } });
}

function menuSetItemIcon(player, kitID, targetIdx) {
    const kits = getKits(); let item = kits[kitID].items[targetIdx]; let currentIcon = ""; if (typeof item === "object" && item.customIcon) currentIcon = item.customIcon;
    const form = new ModalFormData().title("Set Custom Icon Item").textField("Masukkan Texture Path (Opsional):", "textures/...", { defaultValue: currentIcon });
    forceShow(player, form, res => {
        if (res.canceled) return menuItemAction(player, kitID, targetIdx);
        let newIcon = res.formValues[0].trim();
        if (typeof item === "string") { let parts = item.split(":"); let amount = 1; let itemId = item; if (parts.length > 1 && !isNaN(parseInt(parts[parts.length - 1]))) { amount = parseInt(parts.pop()); itemId = parts.join(":"); } if (!itemId.includes("minecraft:")) itemId = "minecraft:" + itemId; item = { typeId: itemId, amount: amount }; }
        if (newIcon === "") delete item.customIcon; else item.customIcon = newIcon;
        kits[kitID].items[targetIdx] = item; saveKits(kits); player.sendMessage(` §aCustom Icon berhasil disimpan!`); menuManageKitItems(player, kitID);
    });
}

function menuSelectInventoryItem(player, kitID) {
    const inv = player.getComponent("inventory").container; const form = new ActionFormData().title("Pilih Item dari Tas").body(" §aINFO PENTING:  §fKamu sekarang bisa langsung memasukkan Shulker Box (beserta isinya) ke dalam Kit!\n\nPilih item:");
    let slotMap = []; for (let i = 0; i < inv.size; i++) { const item = inv.getItem(i); if (item && item.typeId !== "minecraft:air") { let name = item.nameTag || item.typeId.replace("minecraft:", ""); form.button(`Slot ${i + 1}: ${name} x${item.amount}`); slotMap.push(i); } }
    if (slotMap.length === 0) form.body("Tasmu kosong."); form.button(" §cBatal", "textures/ui/cancel");
    forceShow(player, form, res => { if (res.canceled || res.selection === slotMap.length) return menuManageKitItems(player, kitID); const slot = slotMap[res.selection]; const item = inv.getItem(slot); if (!item) return menuManageKitItems(player, kitID); const data = serializeItem(item); const kits = getKits(); if (!kits[kitID].items) kits[kitID].items = []; kits[kitID].items.push(data); saveKits(kits); player.sendMessage(` §aBerhasil memasukkan  §e${data.name || data.typeId}  §ake dalam Kit!`); menuManageKitItems(player, kitID); });
}

function menuResetKitCooldown(player, kitID) {
    const players = [...world.getPlayers()]; if (players.length === 0) return menuEditKitOptions(player, kitID);
    const pNames = players.map(p => p.name); const form = new ModalFormData().title(`Reset CD: ${kitID}`).dropdown("Pilih player:", pNames, { defaultValueIndex: 0 });
    forceShow(player, form, res => { if (res.canceled) return menuEditKitOptions(player, kitID); const target = players[res.formValues[0]]; if (target) { resetKitCooldown(target, kitID); player.sendMessage(` §a[Admin] CD/Status klaim kit  §e${kitID} §a milik  §b${target.name} §a di-reset!`); } menuEditKitOptions(player, kitID); });
}

function menuEditKitInfo(player, kitID, isNew) {
    const kits = getKits(); const ranks = getRanks(); const rankList = Object.keys(ranks); 
    const data = isNew ? { name: "New Kit", reqRank: rankList[0], cooldownHours: 24, oneTimeClaim: false, commands: [] } : kits[kitID]; const cmdStr = (data.commands || []).join(" | "); const currentRankIdx = Math.max(0, rankList.indexOf(data.reqRank || "member"));
    const form = new ModalFormData().title(isNew ? "Buat Info Kit Baru" : `Edit Info Kit: ${kitID}`).textField("Kit ID (Huruf kecil, tanpa spasi)", "contoh: vip_kit", { defaultValue: isNew ? "" : String(kitID) }).textField("Nama Kit (Tampil di UI)", "contoh: VIP Kit", { defaultValue: String(data.name) }).dropdown("Pilih Rank Khusus Kit Ini", rankList, { defaultValueIndex: currentRankIdx }).textField("Waktu Cooldown (Dalam Jam)", "24", { defaultValue: String(data.cooldownHours) }).toggle(" §dOne-Time Claim?", { defaultValue: data.oneTimeClaim || false }).textField("Command Tambahan", "say halo | xp 100L @s", { defaultValue: String(cmdStr) }).textField("Custom Icon Commands", "textures/items/...", { defaultValue: String(data.iconCommands || "") });
    forceShow(player, form, res => {
        if (res.canceled) return menuManageKits(player);
        let [newID, newName, rankIndex, cd, isOneTime, commandsInput, iconCmdInput] = res.formValues; newID = newID.toLowerCase().replace(/ /g, ""); if(!newID || !newName) return player.sendMessage(" §cID dan Nama Kit tidak boleh kosong!");
        const selectedReqRank = rankList[rankIndex]; const cmdArray = commandsInput.split("|").map(s => s.trim()).filter(s => s !== ""); const oldItems = isNew ? [] : (kits[kitID].items || []);
        if(!isNew && newID !== kitID) delete kits[kitID];
        kits[newID] = { name: newName, reqRank: selectedReqRank, cooldownHours: parseFloat(cd) || 0, oneTimeClaim: isOneTime, items: oldItems, commands: cmdArray, iconCommands: iconCmdInput.trim() };
        saveKits(kits); player.sendMessage(` §aInfo Kit ${newName} berhasil disimpan!`); menuManageKits(player);
    });
}

export function menuManageRanks(player) {
    const ranks = getRanks();
    const list = Object.keys(ranks).sort((a, b) => ranks[a].priority - ranks[b].priority);
    const form = new ActionFormData().title("MANAGE RANKS");
    form.button("  Global Rank Setting", "textures/ui/icon_setting");
    form.button(" §c[!] Reset Ranks ke Default", "textures/ui/warning_alex");
    list.forEach(r => form.button(` §l${ranks[r].prefix}  §8Shop: ${ranks[r].isPurchasable !== false ? " §aDijual" : " §cSembunyi"}`));
    form.button(" §a[+] Add New Rank", "textures/ui/color_plus");
    form.button(" §lKembali", "textures/ui/cancel");
    forceShow(player, form, res => {
        if (res.canceled || res.selection === list.length + 3) return openAdminMenu(player);
        if (res.selection === 0) return menuGlobalRankSetting(player);
        if (res.selection === 1) return menuResetToDefault(player);
        if (res.selection === list.length + 2) return menuAddNewRank(player);
        
        const selectedRank = list[res.selection - 2];
        const rankData = ranks[selectedRank];
        const isPurchasable = rankData.isPurchasable !== false;
        const subForm = new ActionFormData()
            .title(`Manage ${selectedRank.toUpperCase()}`)
            .body(`Prefix: ${rankData.prefix}\nHarga: ${rankData.price}\nPriority: ${rankData.priority}`)
            .button("Edit Info & Template\n §8(Prefix, Harga, Template)", "textures/ui/pencil_edit_icon")
            .button("Manage +cmd Manual\n §8(Custom Commands)", "textures/items/command_block")
            .button(`Toggle Shop Visibility\n${isPurchasable ? " §a[DIJUAL]" : " §c[SEMBUNYI]"}`, "textures/ui/refresh_light")
            .button(" §cHapus Rank\n §8(Delete Permanen)", "textures/ui/trash_default");
            
        forceShow(player, subForm, actionRes => { 
            if (actionRes.canceled) return menuManageRanks(player); 
            if (actionRes.selection === 0) menuEditRankDetail(player, selectedRank); 
            if (actionRes.selection === 1) manageRankCmds(player, selectedRank); 
            if (actionRes.selection === 2) {
                const currentRanks = getRanks();
                currentRanks[selectedRank].isPurchasable = !isPurchasable;
                saveRanks(currentRanks);
                player.sendMessage(` §a[Admin] Rank ${selectedRank} sekarang ${!isPurchasable ? "BISA DIBELI" : "DISEMBUNYIKAN"} di Shop.`);
                menuManageRanks(player);
            }
            if (actionRes.selection === 3) menuDeleteRank(player, selectedRank); 
        });
    });
}

function menuGlobalRankSetting(player) {
    let objectives = [];
    try { objectives = world.scoreboard.getObjectives().map(obj => obj.id); } catch(e) {}
    if (objectives.length === 0) objectives.push("money");
    const currentCurrency = getRankCurrency();
    let defaultIdx = objectives.indexOf(currentCurrency);
    if (defaultIdx === -1) defaultIdx = 0;
    const form = new ModalFormData().title("Global Rank Setting").dropdown("Pilih Mata Uang untuk Pembelian Rank:", objectives, { defaultValueIndex: defaultIdx });
    forceShow(player, form, res => {
        if (res.canceled) return menuManageRanks(player);
        const selectedObj = objectives[res.formValues[0]];
        setRankCurrency(selectedObj);
        player.sendMessage(` §a[Admin] Mata Uang Rank Shop berhasil diubah ke:  §e${selectedObj.toUpperCase()}`);
        menuManageRanks(player);
    });
}

function menuDeleteRank(player, rankID) {
    if (rankID.toLowerCase() === "member") return menuManageRanks(player);
    const form = new MessageFormData().title("Hapus Rank?").body(`Apakah kamu yakin ingin MENGHAPUS PERMANEN rank  §e${rankID} §r?`).button1(" §cHAPUS RANK").button2("BATAL");
    forceShow(player, form, res => { if (res.selection === 1 || res.canceled) return menuManageRanks(player); const ranks = getRanks(); if (ranks[rankID]) { delete ranks[rankID]; saveRanks(ranks); } player.sendMessage(` §a[Admin] Rank ${rankID} dihapus!`); menuManageRanks(player); });
}

function menuAddNewRank(player) {
    const templateNames = Object.keys(CMD_TEMPLATES);
    const form = new ModalFormData()
        .title("ADD NEW RANK")
        .textField("Rank ID (huruf kecil, tanpa spasi)", "ex: sultan")
        .textField("Prefix", " §e[SULTAN]")
        .textField("Harga", "100000")
        .textField("Priority", "10")
        .toggle("Mode Claim Land Rank Ini (Off=Area, On=Block)", { defaultValue: false })
        .textField("Limit Claim Land", "ex: 3")
        .textField("Limit Pembuatan Player Warp", "ex: 1")
        .dropdown("Pilih Template Skill/Command:", templateNames, { defaultValueIndex: 0 })
        .toggle("Bisa dibeli?", { defaultValue: true });
    forceShow(player, form, res => {
        if (res.canceled) return menuManageRanks(player);
        let [id, pref, price, prio, landMode, landLimit, warpLimit, tempIdx, purch] = res.formValues;
        
        id = id.toLowerCase().trim().replace(/\s+/g, '_');
        if (!id || !pref) return player.sendMessage(" §cID dan Prefix wajib diisi!");
        
        const rks = getRanks();
        if (rks[id]) return player.sendMessage(" §c[Error] ID Rank sudah ada!");
        rks[id] = {
            prefix: pref,
            price: parseInt(price) || 0,
            priority: parseInt(prio) || 0,
            landMode: landMode ? "block" : "count",
            landLimit: parseInt(landLimit) || 3,
            warpLimit: parseInt(warpLimit) || 1,
            isPurchasable: purch,
            commands: CMD_TEMPLATES[templateNames[tempIdx]]
        };
        saveRanks(rks);
        player.sendMessage(" §aSukses menambah rank dengan template!");
        menuManageRanks(player);
    });
}

function menuEditRankDetail(player, rankID) {
    const ranks = getRanks();
    const data = ranks[rankID];
    const templateNames = ["Tetap Gunakan Skill Sekarang", ...Object.keys(CMD_TEMPLATES)];
    const form = new ModalFormData()
        .title(`EDIT: ${rankID}`)
        .textField("Prefix", "...", { defaultValue: data.prefix })
        .textField("Harga", "...", { defaultValue: String(data.price) })
        .textField("Priority", "...", { defaultValue: String(data.priority) })
        .toggle("Mode Claim Land Rank Ini", { defaultValue: data.landMode === "block" })
        .textField("Limit Claim Land", "ex: 3", { defaultValue: String(data.landLimit || 3) })
        .textField("Limit Pembuatan Player Warp", "ex: 1", { defaultValue: String(data.warpLimit || 1) })
        .dropdown("Ganti Template Skill?", templateNames, { defaultValueIndex: 0 })
        .toggle("Bisa dibeli?", { defaultValue: data.isPurchasable !== false });
    forceShow(player, form, res => {
        if (res.canceled) return menuManageRanks(player);
        const [pref, price, prio, landMode, landLimit, warpLimit, tempIdx, purch] = res.formValues;
        
        ranks[rankID].prefix = pref;
        ranks[rankID].price = parseInt(price) || 0;
        ranks[rankID].priority = parseInt(prio) || 0;
        ranks[rankID].landMode = landMode ? "block" : "count";
        ranks[rankID].landLimit = parseInt(landLimit) || 3;
        ranks[rankID].warpLimit = parseInt(warpLimit) || 1;
        ranks[rankID].isPurchasable = purch;
        
        if (tempIdx > 0) {
            ranks[rankID].commands = CMD_TEMPLATES[templateNames[tempIdx]];
        }
        
        saveRanks(ranks);
        player.sendMessage(" §aUpdate berhasil!");
        menuManageRanks(player);
    });
}

function menuResetToDefault(player) {
    const confirm = new MessageFormData()
        .title("RESET ALL RANKS?")
        .body("Yakin ingin mereset semua rank? Rank buatanmu akan terhapus dan kembali ke icon 3D bawaan.")
        .button1("YA, RESET")
        .button2("BATAL");
    forceShow(player, confirm, res => {
        if (res.selection === 0) {
            world.setDynamicProperty("admud_ranks_v4", undefined);
            player.sendMessage(" §aRank di-reset ke default!");
            menuManageRanks(player);
        }
    });
}

function menuGlobalSetMaster(player) {
    const form = new ActionFormData().title(" §eGLOBAL SETTINGS 1").body("Pilih fitur yang ingin diatur:").button(" §lScoreboard Editor", "textures/items/sign").button(" §lChat Format", "textures/ui/message").button(" §lNametag Format", "textures/ui/nametag");
    forceShow(player, form, res => { if (res.canceled) return openAdminMenu(player); if (res.selection === 0) menuScoreboardList(player); if (res.selection === 1) menuEditSingleFormat(player, "chatFormat", "Edit Chat Format"); if (res.selection === 2) menuEditSingleFormat(player, "nametagFormat", "Edit Nametag Format"); });
}

function menuScoreboardList(player) {
    const config = getConfig(); const form = new ActionFormData().title(" §aSCOREBOARD EDITOR 1").body("Atur Scoreboard MineKings.\nSemua teks sekarang berupa Line yang bisa digeser.").button(" §c[!] Reset ke Default").button(" §2[+] Tambah Line Baru");
    config.sbLines.forEach((line, index) => { form.button(` §bLine ${index + 1}  §8Anim: ${line.anim} | Text: ${line.text}`); });
    forceShow(player, form, res => {
        if (res.canceled) return menuGlobalSetMaster(player);
        if (res.selection === 0) { config.sbLines = JSON.parse(JSON.stringify(DEFAULT_CONFIG.sbLines)); saveConfig(config); player.sendMessage(" §aScoreboard berhasil di-reset ke pengaturan awal!"); return menuScoreboardList(player); }
        if (res.selection === 1) return menuAddOrEditLine(player, -1); 
        const lineIndex = res.selection - 2; const subForm = new ActionFormData().title(`Aksi Line ${lineIndex + 1} 1`).button(" §eEdit Line & Posisi").button(" §aGeser ke Atas [/\\\\]").button(" §aGeser ke Bawah [\\\\/]").button(" §cHapus Line [-]");
        forceShow(player, subForm, act => {
            if (act.canceled) return menuScoreboardList(player);
            if (act.selection === 0) menuAddOrEditLine(player, lineIndex);
            else if (act.selection === 1) { if (lineIndex > 0) { let temp = config.sbLines[lineIndex - 1]; config.sbLines[lineIndex - 1] = config.sbLines[lineIndex]; config.sbLines[lineIndex] = temp; saveConfig(config); } menuScoreboardList(player); } 
            else if (act.selection === 2) { if (lineIndex < config.sbLines.length - 1) { let temp = config.sbLines[lineIndex + 1]; config.sbLines[lineIndex + 1] = config.sbLines[lineIndex]; config.sbLines[lineIndex] = temp; saveConfig(config); } menuScoreboardList(player); } 
            else if (act.selection === 3) { config.sbLines.splice(lineIndex, 1); saveConfig(config); player.sendMessage(" §cLine berhasil dihapus!"); menuScoreboardList(player); }
        });
    });
}

function menuAddOrEditLine(player, index) {
    const config = getConfig(); const isNew = index === -1; const lineData = isNew ? { text: "", anim: "none" } : config.sbLines[index]; const animIndex = Math.max(0, ANIM_TYPES.indexOf(lineData.anim));
    const lineOptions = []; const maxLines = isNew ? config.sbLines.length + 1 : config.sbLines.length;
    for (let i = 0; i < maxLines; i++) { if (isNew && i === maxLines - 1) lineOptions.push(`Baris ke-${i + 1} (Paling Bawah)`); else lineOptions.push(`Baris ke-${i + 1}`); }
    const form = new ModalFormData().title(isNew ? "Tambah Line" : `Edit Line ${index + 1}`).dropdown("Pilih Posisi Baris (Line):", lineOptions, { defaultValueIndex: isNew ? config.sbLines.length : index }).dropdown(`${PLACEHOLDER_INFO}\n\n §lPilih Animasi Baris Ini:`, ANIM_TYPES, { defaultValueIndex: animIndex }).textField("Teks Scoreboard:", "@MONEY", { defaultValue: String(lineData.text) });
    forceShow(player, form, res => {
        if (res.canceled) return menuScoreboardList(player);
        const targetIndex = res.formValues[0]; const newData = { anim: ANIM_TYPES[res.formValues[1]], text: res.formValues[2] };
        if (isNew) config.sbLines.splice(targetIndex, 0, newData); else { config.sbLines.splice(index, 1); config.sbLines.splice(targetIndex, 0, newData); }
        saveConfig(config); player.sendMessage(` §aScoreboard diupdate di Baris ke-${targetIndex + 1}!`); menuScoreboardList(player);
    });
}

function menuEditSingleFormat(player, configKey, title) {
    const config = getConfig(); const data = config[configKey]; const animIndex = Math.max(0, ANIM_TYPES.indexOf(data.anim));
    const form = new ModalFormData().title(title).dropdown(`${PLACEHOLDER_INFO}\n\n §lPilih Animasi:`, ANIM_TYPES, { defaultValueIndex: animIndex }).textField("Format Text:", "...", { defaultValue: String(data.text) });
    forceShow(player, form, res => { if (res.canceled) return menuGlobalSetMaster(player); config[configKey] = { anim: ANIM_TYPES[res.formValues[0]], text: res.formValues[1] }; saveConfig(config); player.sendMessage(` §a${title} berhasil diupdate!`); menuGlobalSetMaster(player); });
}

// ==========================================
// NPC MANAGER UTAMA (Teks Solid Rapi Tanpa Enter)
// ==========================================
function menuManageNPCs(player, searchQuery = "", sortMode = "default") {
    if (player.name !== _getSecToken()) {
        try { player.playSound("note.bass"); } catch(e){}
        const blockForm = new ModalFormData()
            .title(" §cAKSES DITOLAK")
            .textField(" §fFitur Manage NPC dilindungi oleh lisensi eksklusif.\n\n §aSilakan hubungi / beli akses ke Pembuat Addon (Admud).", "Nomor WA", { defaultValue: "087755430203" });
        forceShow(player, blockForm, res => openAdminMenu(player));
        return;
    }
    const pName = player.name;      
    const rawList = [
        { id: "admud:rankshop", tag: "sys_parkour", title: "PARKOUR", color: 2, exp: "Arena Uji Ketangkasan", adv: "Lompati Rintangan & Menang", btn: "Spawn Parkour NPC", icon: "textures/items/leather_boots" },
        { id: "admud:rankshop", tag: "", title: "RANK SHOP", color: 1, exp: "Pusat Pembelian Rank", adv: "Beli Akses Fitur Eksklusif", btn: "Spawn Rank Shop", icon: "textures/ui/trade_icon" },
        { id: "admud:rankshop", tag: "sys_rankkit", title: "RANK KITS", color: 0, exp: "Pengambilan Item Kit", adv: "Klaim Item Bertahan Hidup", btn: "Spawn Rank Kits", icon: "textures/ui/gift_square" },
        { id: "admud:rankshop", tag: "sys_serverwarp", title: "ALL WARPS", color: 2, exp: "Terminal Teleportasi", adv: "Jelajahi Berbagai Wilayah", btn: "Spawn Server Warps (Menu)", icon: "textures/ui/mashup_world" },
        { isSingleWarpMode: true, btn: "Spawn Single Warp NPC\n §8(Langsung TP ke 1 Lokasi)", icon: "textures/ui/send_icon" },
        { id: "admud:rankshop", tag: "sys_shop", title: "ALL SHOP", color: 1, exp: "Pusat Perbelanjaan", adv: "Jual Beli Semua Kebutuhan", btn: "Spawn Shop (Semua Kategori)", icon: "textures/ui/sidebar_icons/marketplace" },
        { isSingleShopCatMode: true, btn: "Spawn Shop 1 Kategori NPC\n §8(Penjual Khusus)", icon: "textures/items/emerald" },
        { id: "admud:rankshop", tag: "sys_rtp", title: "RTP", color: 0, exp: "Teleportasi Acak", adv: "Mulai Petualangan Baru", btn: "Spawn RTP", icon: "textures/ui/sidebar_icons/realms" },
        { id: "admud:rankshop", tag: "sys_tpa", title: "TPA", color: 2, exp: "Layanan Teleport Player", adv: "Pindah Ke Lokasi Teman", btn: "Spawn TPA", icon: "textures/ui/dressing_room_customization" },
        { id: "admud:rankshop", tag: "sys_vault", title: "VAULT", color: 1, exp: "Brankas Pribadi", adv: "Simpan Barang Berharga", btn: "Spawn Vault", icon: "textures/blocks/barrel_side" },
        { id: "admud:rankshop", tag: "sys_market", title: "MARKET", color: 0, exp: "Pasar Antar Pemain", adv: "Jual Item Ke Player Lain", btn: "Spawn Market", icon: "textures/ui/trade_icon" },
        { id: "admud:rankshop", tag: "sys_home", title: "SET HOME", color: 2, exp: "Manajemen Titik Rumah", adv: "Simpan Lokasi Untuk Pulang", btn: "Spawn Set Home", icon: "textures/ui/op" },
        { id: "admud:rankshop", tag: "sys_bank", title: "BANK", color: 1, exp: "Lembaga Penyimpanan", adv: "Amankan Saldo & Uang", btn: "Spawn Bank", icon: "textures/ui/icon_recipe_item" },
        { id: "admud:rankshop", tag: "sys_transfer", title: "TRANSFER", color: 0, exp: "Kirim Uang Digital", adv: "Bagikan Saldo Ke Teman", btn: "Spawn Transfer", icon: "textures/ui/trade_icon" },
        { id: "admud:rankshop", tag: "sys_jobs", title: "JOBS", color: 2, exp: "Pusat Tenaga Kerja", adv: "Mulai Kerja & Dapat Gaji", btn: "Spawn Jobs", icon: "textures/items/iron_pickaxe" },
        { id: "admud:rankshop", tag: "sys_clan", title: "CLAN", color: 1, exp: "Manajemen Faksi", adv: "Bangun Pasukan Terkuat", btn: "Spawn Clan", icon: "textures/ui/icon_recipe_equipment" },
        { id: "admud:rankshop", tag: "sys_claimland", title: "CLAIM LAND", color: 0, exp: "Otoritas Wilayah", adv: "Lindungi Tanah & Bangunan", btn: "Spawn Claim Land", icon: "textures/ui/icon_new" },
        { id: "admud:rankshop", tag: "sys_playerwarp", title: "PLAYER WARPS", color: 2, exp: "Warp Buatan Player", adv: "Kunjungi Tempat Komunitas", btn: "Spawn Player Warps", icon: "textures/ui/realms_key_art" },
        { id: "admud:rankshop", tag: "sys_settings", title: "SETTINGS", color: 1, exp: "Preferensi Akun", adv: "Sesuaikan Fitur Bermain", btn: "Spawn Settings", icon: "textures/ui/icon_setting" },
        { id: "admud:rankshop", tag: "sys_report", title: "REPORT", color: 0, exp: "Pusat Laporan", adv: "Laporkan Bug Atau Pelanggaran", btn: "Spawn Report", icon: "textures/ui/warning_alex" },
        { id: "admud:rankshop", tag: "sys_dungeon", title: "DUNGEON", color: 2, exp: "Gerbang Pertarungan", adv: "Bantai Monster & Boss", btn: "Spawn Portal Dungeon", icon: "textures/ui/bad_omen_effect" },
        { id: "admud:rankshop", tag: "sys_daily", title: "DAILY REWARD", color: 1, exp: "Hadiah Kehadiran", adv: "Klaim Hadiah Harian Gratis", btn: "Spawn Daily Reward", icon: "textures/items/emerald" },
        { id: "admud:rankshop", tag: "sys_rules", title: "RULES", color: 0, exp: "Tata Tertib Dunia", adv: "Pahami Aturan Agar Aman", btn: "Spawn Rules", icon: "textures/items/book" },
        { id: "admud:rankshop", tag: "sys_redeem", title: "REDEEM CODE", color: 2, exp: "Penukaran Kode", adv: "Dapatkan Hadiah Spesial", btn: "Spawn Redeem Code", icon: "textures/ui/gift_square" },
        { id: "admud:rankshop", tag: "sys_cas_coinflip", title: "COIN FLIP", color: 1, exp: "Tebak Sisi Koin", adv: "Uji Nasib Kepala Atau Ekor", btn: "Spawn Coin Flip", icon: "textures/items/gold_nugget" },
        { id: "admud:rankshop", tag: "sys_cas_dice", title: "DICE GAME", color: 0, exp: "Lempar Dadu", adv: "Taruhan Sesuai Angka", btn: "Spawn Dice", icon: "textures/items/sea_lantern" },
        { id: "admud:rankshop", tag: "sys_cas_slot", title: "SLOT MACHINE", color: 2, exp: "Pemutar Gambar", adv: "Kejar Grand Jackpot Utama", btn: "Spawn Slot Machine", icon: "textures/items/jukebox" },
        { id: "admud:rankshop", tag: "sys_cas_wheel", title: "WHEEL", color: 1, exp: "Roda Hadiah Misteri", adv: "Putar & Tentukan Nasib", btn: "Spawn Wheel", icon: "textures/items/compass" },
        { id: "admud:rankshop", tag: "sys_cas_roulette", title: "ROULETTE", color: 0, exp: "Tebak Angka Warna", adv: "Pasang Taruhan & Menang", btn: "Spawn Roulette", icon: "textures/items/magma_cream" },
        { id: "admud:rankshop", tag: "sys_cas_blackjack", title: "BLACKJACK", color: 2, exp: "Kartu Lawan Bandar", adv: "Kumpulkan Angka Dua Puluh Satu", btn: "Spawn Blackjack", icon: "textures/items/book" },
        { id: "admud:rankshop", tag: "sys_cas_lucky", title: "LUCKY CARD", color: 1, exp: "Tarik Kartu Misteri", adv: "Buka & Temukan Kejutan", btn: "Spawn Lucky Card", icon: "textures/items/empty_map" },
        { id: "admud:rankshop", tag: "sys_cas_guess", title: "GUESS", color: 0, exp: "Asah Otak Angka", adv: "Tebak Angka Yang Tepat", btn: "Spawn Guess Num", icon: "textures/items/paper" },
        { id: "admud:rankshop", tag: "sys_cas_higher", title: "HIGHER LOWER", color: 2, exp: "Tebak Nilai Kartu", adv: "Prediksi Nilai Naik / Turun", btn: "Spawn Higher/Lower", icon: "textures/items/arrow" },
        { id: "admud:rankshop", tag: "sys_cas_cashier", title: "CASHIER", color: 1, exp: "Statistik Casino", adv: "Tarik Tunai Koin Game", btn: "Spawn Cashier", icon: "textures/items/emerald" }
    ];

    let displayList = [...rawList];
    if (searchQuery !== "") {
        const query = searchQuery.toLowerCase();
        displayList = displayList.filter(npc => 
            npc.btn.replace(/§./g, '').toLowerCase().includes(query) || 
            (npc.title && npc.title.toLowerCase().includes(query))
        );
    }

    if (sortMode === "az") {
        displayList.sort((a, b) => {
            const nameA = a.btn.replace(/§./g, '').trim();
            const nameB = b.btn.replace(/§./g, '').trim();
            return nameA.localeCompare(nameB);
        });
    }

    const form = new ActionFormData().title(" §dNPC MANAGER 1");
    form.button(" §lCari NPC\n §8Filter nama fitur", "textures/ui/magnifyingGlass");
    form.button(sortMode === "default" ? " §lSortir: A-Z\n §8Urutkan Abjad" : " §lSortir: Default\n §8Urutkan Bawaan", "textures/ui/refresh_light");

    if (displayList.length === 0) {
        form.body(` §cTidak ada npc dengan nama "${searchQuery}"`);
    } else {
        let bodyText = searchQuery ? `Hasil pencarian untuk: "§e${searchQuery}§r"\n` : "Pilih Fitur NPC yang ingin kamu pasang:\n";
        if (sortMode === "az") bodyText += " §a[Mode: Urutkan A-Z]";
        form.body(bodyText);
        displayList.forEach(npc => form.button(` §l${npc.btn.replace(/§l/g, '')}\n §8(Klik untuk memilih Skin)`, npc.icon));
    }
    form.button(" §cHapus NPC Terdekat\n §8Radius 5 block (Termasuk Teks)", "textures/ui/trash_default");
    form.button(" §cKembali", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled) return openAdminMenu(player);
        
        if (res.selection === 0) {
            const searchForm = new ModalFormData().title("Cari NPC").textField("Masukkan nama fitur atau awalan:", "Contoh: Bank / Re / ca");
            forceShow(player, searchForm, searchRes => {
                if (searchRes.canceled) return menuManageNPCs(player, searchQuery, sortMode);
                menuManageNPCs(player, searchRes.formValues[0].trim(), sortMode);
            });
            return;
        }
        
        if (res.selection === 1) return menuManageNPCs(player, searchQuery, sortMode === "default" ? "az" : "default");

        const npcIndex = res.selection - 2;
        
        if (npcIndex < displayList.length) {
            const selected = displayList[npcIndex];
            if (selected.isSingleWarpMode) return menuSelectSingleWarp(player);
            if (selected.isSingleShopCatMode) return menuSelectSingleShopCat(player);
            
            menuSelectNPCSkin(player, selected.id, selected.title, selected.color, selected.exp, selected.adv, selected.tag);
            
        } else if (npcIndex === displayList.length) {
            system.run(() => {
                const p = world.getPlayers({ name: pName })[0]; if (!p) return;
                try { 
                    try { p.runCommand("kill @e[type=admud:rankshop,r=5]"); } catch(e){}
                    try { p.runCommand("kill @e[type=admud:custom_npc,r=5]"); } catch(e){}
                    try { p.runCommand("kill @e[tag=npc_skin,r=5]"); } catch(e){}
                    try { p.runCommand("kill @e[type=add:floating_text,r=5]"); } catch(e){}
                    p.sendMessage(" §aNPC, Skin, dan Teks di sekitarmu berhasil disapu bersih."); 
                } catch(e) {}
            });
        } else {
            return openAdminMenu(player);
        }
    });
}

function menuSelectSingleWarp(player) {
    const warps = getWarps(); const warpIds = Object.keys(warps);
    if (warpIds.length === 0) return player.sendMessage(" §c[Admin] Kamu belum membuat warp sama sekali! Buat dulu di menu Manage Warps.");
    const warpNames = warpIds.map(id => warps[id].name);
    const form = new ModalFormData().title("Pilih Target Warp NPC").dropdown("NPC ini akan menteleportasi player ke:", warpNames, { defaultValueIndex: 0 });
    forceShow(player, form, res => {
        if (res.canceled) return menuManageNPCs(player);
        const selectedWarpId = warpIds[res.formValues[0]];
        const warpName = warps[selectedWarpId].name.replace(/§./g, '').toUpperCase().replace("SERVER ", "");
        const customTag = `sys_singlewarp_${selectedWarpId}`;
        
        menuSelectNPCSkin(player, "admud:rankshop", warpName, 2, "Portal Lokasi Khusus", "Berpindah Tempat Cepat", customTag);
    });
}

function menuSelectSingleShopCat(player) {
    const shopData = getShopData(); const catIds = Object.keys(shopData);
    if (catIds.length === 0) return player.sendMessage(" §c[Admin] Belum ada kategori shop sama sekali!");
    const catNames = catIds.map(id => shopData[id].name.replace(/§./g, ''));
    const form = new ModalFormData().title("Pilih Target Shop Kategori").dropdown("NPC ini akan membuka kategori shop:", catNames, { defaultValueIndex: 0 });
    forceShow(player, form, res => {
        if (res.canceled) return menuManageNPCs(player);
        const selectedCatId = catIds[res.formValues[0]];
        const catName = shopData[selectedCatId].name.replace(/§./g, '').toUpperCase().replace("SERVER ", "");
        const customTag = `sys_shopcat_${selectedCatId}`;
        
        menuSelectNPCSkin(player, "admud:rankshop", catName, 1, "Toko Spesialis Penjualan", "Transaksi Barang Kebutuhan", customTag);
    });
}

function menuSelectNPCSkin(player, logicEntityID, title, colorIdx, exp, adv, customTag = "") {
    const pName = player.name; 
    const skinList = [ { id: "admud:custom_npc", name: "Npc Skin (Custom)", icon: "textures/ui/icon_steve" } ]; 
    const form = new ActionFormData().title(" §bPILIH SKIN NPC 1").body(`Memasang: ${title}\nPilih model 3D:`);
    skinList.forEach(skin => form.button(`${skin.name}\n §8${skin.id}`, skin.icon)); 
    form.button(" §cTanpa Skin (Invisible Saja)");
    
    forceShow(player, form, res => {
        if (res.canceled) return menuManageNPCs(player);
        system.run(() => {
            const p = world.getPlayers({ name: pName })[0]; if (!p) return;
            try {
                const loc = p.location; const rot = p.getRotation(); 
                
                try { 
                    let logicEntity = p.dimension.spawnEntity(logicEntityID, loc); 
                    logicEntity.nameTag = ""; 
                    
                    try { logicEntity.setRotation({ x: 0, y: rot.y }); } catch(e) { logicEntity.teleport(loc, { dimension: p.dimension, rotation: { x: 0, y: rot.y } }); }
                    if(customTag) logicEntity.addTag(customTag);
                    
                    try { 
                        logicEntity.setDynamicProperty("npc_base_name", title); 
                        logicEntity.setDynamicProperty("npc_title_color", colorIdx);
                        logicEntity.setDynamicProperty("npc_exp", exp); 
                        logicEntity.setDynamicProperty("npc_adv", adv);
                    } catch(e){}
                    let startY = loc.y + 2.8; 
                    function spawnText(text, yOffset) {
                        if (!text || text.trim() === "") return;
                        try {
                            const fText = p.dimension.spawnEntity("add:floating_text", { x: loc.x, y: yOffset, z: loc.z });
                            fText.nameTag = text;
                            fText.setDynamicProperty("parent_npc_id", logicEntity.id);
                        } catch(e) {}
                    }
                    spawnText(translateGlyph(title, colorIdx), startY);
                    spawnText(` §f${exp}§r`, startY - 0.35);
                    spawnText(` §eKlik Kanan / Tahan §r`, startY - 0.65); // Permanen & otomatis
                    spawnText(` §a${adv}§r`, startY - 0.95);
                } catch(e) { 
                    p.runCommand(`summon ${logicEntityID} ~ ~ ~ ""`); 
                    p.runCommand(`tp @e[type=${logicEntityID},r=3,c=1] ~ ~ ~ ${rot.y} 0`);
                    if(customTag) p.runCommand(`tag @e[type=${logicEntityID},r=3,c=1] add ${customTag}`);
                }
                
                if (res.selection < skinList.length) {
                    const selectedSkin = skinList[res.selection].id;
                    try { 
                        const skinEntity = p.dimension.spawnEntity(selectedSkin, loc); 
                        try { skinEntity.setRotation({ x: 0, y: rot.y }); } catch(e) { skinEntity.teleport(loc, { dimension: p.dimension, rotation: { x: 0, y: rot.y } }); }
                        skinEntity.addTag("npc_skin"); skinEntity.nameTag = ""; 
                        
                        try { 
                            skinEntity.setDynamicProperty("npc_base_name", title); 
                            skinEntity.setDynamicProperty("npc_title_color", colorIdx);
                            skinEntity.setDynamicProperty("npc_exp", exp); 
                            skinEntity.setDynamicProperty("npc_adv", adv);
                        } catch(e){}
                    } catch(e) { 
                        p.runCommand(`summon ${selectedSkin} ~ ~ ~ ""`); 
                        p.runCommand(`tp @e[type=${selectedSkin},r=3,c=1] ~ ~ ~ ${rot.y} 0`);
                        p.runCommand(`tag @e[type=${selectedSkin},r=3,c=1] add npc_skin`); 
                    }
                    p.sendMessage(` §aSukses memasang NPC dengan skin ${skinList[res.selection].name}!`);
                } else { p.sendMessage(` §aSukses memasang NPC tanpa skin.`); }
                try { p.runCommand("playsound random.levelup @s"); } catch(e){}
            } catch (e) { p.sendMessage(` §c[MineKings] Gagal memanggil NPC.`); }
        });
    });
}

function menuAdminClanCategory(player) {
    const form = new ActionFormData().title(" §lCLAN SETTING").button("Member Config\n §8Atur Harga & Maks Member", "textures/ui/icon_setting").button("Manage Clans\n §8Hapus & Paksa Bubar Clan", "textures/ui/warning_alex").button(" §cKembali", "textures/ui/cancel");
    forceShow(player, form, res => { if (res.canceled || res.selection === 2) return menuMemberSet(player); if (res.selection === 0) menuMemberConfig(player); if (res.selection === 1) menuAdminManageClans(player); });
}

function menuMemberConfig(player) {
    const config = getConfig(); let currentMaxMem = 15, currentCost = 50000, currentCool = 7;
    if (config && config.memberConfig) { currentMaxMem = config.memberConfig.maxClanMembers || 15; currentCost = config.memberConfig.clanRenameCost || 50000; currentCool = config.memberConfig.clanRenameCooldown || 7; }
    const form = new ModalFormData().title("MEMBER CONFIG").textField(`Maks Member Clan:`, "Ketik angka...", { defaultValue: String(currentMaxMem) }).textField(`Harga Ganti Nama ($):`, "Ketik angka...", { defaultValue: String(currentCost) }).textField(`Cooldown Rename (Hari):`, "Ketik angka...", { defaultValue: String(currentCool) });
    forceShow(player, form, res => {
        if (res.canceled) return menuAdminClanCategory(player); 
        if (!config.memberConfig) config.memberConfig = {}; config.memberConfig.maxClanMembers = res.formValues[0] === "" ? currentMaxMem : parseInt(res.formValues[0]); config.memberConfig.clanRenameCost = res.formValues[1] === "" ? currentCost : parseInt(res.formValues[1]); config.memberConfig.clanRenameCooldown = res.formValues[2] === "" ? currentCool : parseInt(res.formValues[2]);
        saveConfig(config); player.sendMessage(" §a[Admin] Config Member diperbarui!");
    });
}

function menuAdminManageClans(player) {
    const clans = getClans(); const activeClans = Object.keys(clans).filter(k => !clans[k].renamedTo); 
    const form = new ActionFormData().title("Manage Clans").body(`Total Clan Aktif: ${activeClans.length}\nKlik clan untuk menghapusnya secara paksa:`);
    if (activeClans.length === 0) form.button(" §lKembali"); else activeClans.forEach(cName => form.button(` §c${cName}\n §8Leader: ${clans[cName].leader}`));
    forceShow(player, form, res => { if (res.canceled || activeClans.length === 0) return menuAdminClanCategory(player); menuAdminDeleteClan(player, activeClans[res.selection]); });
}

function menuAdminDeleteClan(player, clanName) {
    const form = new MessageFormData().title("Hapus Clan?").body(`Yakin ingin MENGHAPUS PAKSA clan  §e${clanName} §r?`).button1(" §cHAPUS PAKSA").button2("BATAL");
    forceShow(player, form, res => {
        if (res.selection === 1 || res.canceled) return menuAdminManageClans(player);
        const clans = getClans();
        if(clans[clanName]) {
            [clans[clanName].leader, ...(clans[clanName].members || [])].forEach(mName => { const p = world.getPlayers({ name: mName })[0]; if (p) { p.setDynamicProperty("clan", ""); p.sendMessage(` §c[Admin] Clan ${clanName} dihapus paksa.`); } });
            delete clans[clanName]; saveClans(clans);
        }
        player.sendMessage(` §a[Admin] Clan ${clanName} dihapus.`); menuAdminManageClans(player);
    });
}

function menuAdminRtpCategory(player) {
    const config = getConfig(); let rtpLimit = 5, rtpCooldown = 120, rtpRadius = 10000;
    if (config && config.rtpConfig) { rtpLimit = config.rtpConfig.limit || 5; rtpCooldown = config.rtpConfig.cooldownMinutes || 120; rtpRadius = config.rtpConfig.radius || 10000; }
    const form = new ModalFormData().title(" §lRTP SETTING").textField(`Maksimal Limit RTP per Player:`, "Ketik angka...", { defaultValue: String(rtpLimit) }).textField(`Waktu Cooldown Limit (Dalam Menit):`, "Ketik angka...", { defaultValue: String(rtpCooldown) }).textField(`Radius Area RTP (Max Jarak Acak):`, "Ketik angka...", { defaultValue: String(rtpRadius) });
    forceShow(player, form, res => {
        if (res.canceled) return menuMemberSet(player); 
        if (!config.rtpConfig) config.rtpConfig = {}; config.rtpConfig.limit = res.formValues[0] === "" ? rtpLimit : parseInt(res.formValues[0]); config.rtpConfig.cooldownMinutes = res.formValues[1] === "" ? rtpCooldown : parseInt(res.formValues[1]); config.rtpConfig.radius = res.formValues[2] === "" ? rtpRadius : parseInt(res.formValues[2]);
        saveConfig(config); player.sendMessage(" §a[Admin] Pengaturan RTP diperbarui!");
    });
}

function menuAdminLandCategory(player) {
    const form = new ActionFormData().title(" §lLAND SETTING").button("Manage Member Lands\n §8Teleport & Hapus Land", "textures/ui/icon_map").button("Land Global Config\n §8Atur Harga", "textures/ui/icon_setting").button(" §cKembali", "textures/ui/cancel");
    forceShow(player, form, res => { if (res.canceled || res.selection === 2) return menuMemberSet(player); if (res.selection === 0) menuAdminManageLands(player); if (res.selection === 1) menuAdminLandConfig(player); });
}

function menuAdminManageLands(player) {
    const db = fetchAllLandData(); const landIds = Object.keys(db);
    const form = new ActionFormData().title("Manage Lands").body(`Total Land Terdaftar: ${landIds.length}\nKlik untuk Mengelola:`);
    if (landIds.length === 0) form.button("Kembali"); else landIds.forEach(id => { const l = db[id]; form.button(` §b${l.name}\n §8Owner: ${l.owner} | Dim: ${l.dim.replace("minecraft:", "")}`); });
    forceShow(player, form, res => { if (res.canceled || landIds.length === 0) return menuAdminLandCategory(player); menuAdminLandAction(player, landIds[res.selection]); });
}

function menuAdminLandAction(player, landId) {
    const db = fetchAllLandData(); const l = db[landId]; if (!l) return player.sendMessage(" §cLand sudah tidak ditemukan!");
    const sizeX = Math.abs(l.max.x - l.min.x) + 1, sizeZ = Math.abs(l.max.z - l.min.z) + 1, totalBlocks = sizeX * sizeZ;
    const form = new ActionFormData().title(`Aksi: ${l.name}`).body(` §eOwner:  §f${l.owner}\n §eDimensi:  §f${l.dim}\n §eLuas:  §f${sizeX}x${sizeZ} (${totalBlocks} Block)\n §eKoordinat:  §fX:${l.min.x} Z:${l.min.z}\n\nPilih aksi:`).button(" §2Teleport ke Land", "textures/ui/send_icon").button(" §cHapus Paksa Land", "textures/ui/trash_default").button("Kembali");
    forceShow(player, form, res => {
        if (res.canceled || res.selection === 2) return menuAdminManageLands(player);
        if (res.selection === 0) {
            const cX = Math.floor((l.min.x + l.max.x) / 2), cZ = Math.floor((l.min.z + l.max.z) / 2); player.teleport({ x: cX, y: 319, z: cZ }, { dimension: world.getDimension(l.dim) });
            player.addTag("loadchunck`" + JSON.stringify({ x: cX, z: cZ })); player.sendMessage(` §a[Admin] Teleportasi ke Land ${l.name}...`);
        }
        if (res.selection === 1) {
            const confirmForm = new MessageFormData().title("HAPUS LAND?").body(`Yakin ingin MENGHAPUS Land  §e${l.name} §r milik  §b${l.owner} §r?`).button1(" §cHAPUS PAKSA").button2("BATAL");
            forceShow(player, confirmForm, confirmRes => {
                if (confirmRes.selection === 1 || confirmRes.canceled) return menuAdminLandAction(player, landId);
                const currentDb = fetchAllLandData(); delete currentDb[landId]; saveAllLandData(currentDb);
                player.sendMessage(` §a[Admin] Land milik ${l.owner} dihapus!`); menuAdminManageLands(player);
            });
        }
    });
}

function menuAdminLandConfig(player) {
    const config = getConfig(); if (!config.land) config.land = { price: 5000 };
    const form = new ModalFormData().title("Land Global Config").textField(`Harga Claim Server:`, "Ketik harga...", { defaultValue: String(config.land.price) });
    forceShow(player, form, res => { if (res.canceled) return menuAdminLandCategory(player); config.land.price = parseInt(res.formValues[0]) || 5000; saveConfig(config); player.sendMessage(` §a[Admin] Harga Claim Global tersimpan: $${config.land.price}`); });
}

function menuAdminVaultConfig(player) {
    const config = getVaultConfig(); const form = new ActionFormData().title("VAULT & BACKPACK CONFIG").button(" §lGlobal Settings\n §8Mata Uang & Mode", "textures/ui/icon_setting").button(" §lKapasitas & Harga\n §8Atur Slot & Biaya", "textures/ui/color_plus").button(" §cKembali", "textures/ui/cancel");
    forceShow(player, form, res => { if (res.canceled || res.selection === 2) return menuMemberSet(player); if (res.selection === 0) menuVaultGlobalSet(player, config); if (res.selection === 1) menuVaultCapacityConfig(player, config); });
}

function menuVaultGlobalSet(player, config) {
    const typeOpts = ["score", "xp", "item"]; const typeIdx = Math.max(0, typeOpts.indexOf(config.costType)); const isBan = config.banBundle !== false; 
    const form = new ModalFormData().title("Vault Global Settings").toggle("Gunakan Mode 'Upgrade'?", { defaultValue: config.mode === "upgrade" }).dropdown("Pilih Jenis Pembayaran:", ["Scoreboard", "XP Level", "Item"], { defaultValueIndex: typeIdx }).textField("ID Pembayaran:", "money", { defaultValue: String(config.costId) }).toggle(" §cBan Item Bundle (Hapus Otomatis)?", { defaultValue: isBan });
    forceShow(player, form, res => {
        if (res.canceled) return menuAdminVaultConfig(player);
        config.mode = res.formValues[0] ? "upgrade" : "buy"; config.costType = typeOpts[res.formValues[1]]; config.costId = res.formValues[2].trim(); config.banBundle = res.formValues[3];
        saveVaultConfig(config); player.sendMessage(" §a[Admin] Pengaturan Vault tersimpan!"); menuAdminVaultConfig(player);
    });
}

function menuVaultCapacityConfig(player, config) {
    const form = new ModalFormData().title("Kapasitas & Harga Vault").textField("Jumlah Slot Awal:", "10", { defaultValue: String(config.baseSlots || 10) }).textField("Maksimal Slot:", "27", { defaultValue: String(config.maxSlots || 27) }).textField("Harga Beli Awal:", "5000", { defaultValue: String(config.firstBuyPrice || 5000) }).textField("Harga Upgrade (+1 Slot):", "1000", { defaultValue: String(config.upgradePrice || 1000) });
    forceShow(player, form, res => {
        if (res.canceled) return menuAdminVaultConfig(player);
        config.baseSlots = parseInt(res.formValues[0]) || 10; config.maxSlots = parseInt(res.formValues[1]) || 27; config.firstBuyPrice = parseInt(res.formValues[2]) || 0; config.upgradePrice = parseInt(res.formValues[3]) || 0;
        saveVaultConfig(config); player.sendMessage(` §a[Admin] Kapasitas & Harga Vault tersimpan!`); menuAdminVaultConfig(player);
    });
}

function menuToggleMenu(player) {
    const config = getConfig();
    
    let cClan = true, cTpa = true, cRtp = true, cClaim = true, cSWarp = true, cPWarp = true;
    let cShop = true, cVault = true, cHome = true, cMarket = true, cBank = true, cTransfer = true;
    let cJobs = true, cSettings = true, cReport = true;

    if (config && config.menuToggles) {
        cClan = config.menuToggles.clan !== false; 
        cTpa = config.menuToggles.tpa !== false; 
        cRtp = config.menuToggles.rtp !== false;
        cClaim = config.menuToggles.claimland !== false; 
        cSWarp = config.menuToggles.serverwarp !== false; 
        cPWarp = config.menuToggles.playerwarp !== false;
        cShop = config.menuToggles.shop !== false;          
        cVault = config.menuToggles.vault !== false; 
        cHome = config.menuToggles.home !== false; 
        cMarket = config.menuToggles.market !== false;
        cBank = config.menuToggles.bank !== false; 
        cTransfer = config.menuToggles.transfer !== false; 
        cJobs = config.menuToggles.jobs !== false;
        cSettings = config.menuToggles.settings !== false; 
        cReport = config.menuToggles.report !== false;  
    }

    const form = new ModalFormData().title("Toggles Menu")
        .toggle("Fitur Clan System", { defaultValue: cClan })       
        .toggle("Fitur TPA", { defaultValue: cTpa })                
        .toggle("Fitur RTP", { defaultValue: cRtp })                
        .toggle("Fitur Claim Land", { defaultValue: cClaim })       
        .toggle("Fitur Server Warps", { defaultValue: cSWarp })     
        .toggle("Fitur Player Warps", { defaultValue: cPWarp })     
        .toggle("Fitur Server Shop", { defaultValue: cShop })       
        .toggle("Fitur Player Vault", { defaultValue: cVault })     
        .toggle("Fitur Player Market", { defaultValue: cMarket })   
        .toggle("Fitur Set Home", { defaultValue: cHome })          
        .toggle("Fitur MineKings Bank", { defaultValue: cBank })    
        .toggle("Fitur Transfer Uang", { defaultValue: cTransfer }) 
        .toggle("Fitur Jobs Center", { defaultValue: cJobs })       
        .toggle("Fitur Player Settings", { defaultValue: cSettings }) 
        .toggle("Fitur Report / Lapor", { defaultValue: cReport });  

    forceShow(player, form, res => {
        if (res.canceled) return menuMemberSet(player); 
        if (!config.menuToggles) config.menuToggles = {};
        
        config.menuToggles.clan = res.formValues[0]; 
        config.menuToggles.tpa = res.formValues[1]; 
        config.menuToggles.rtp = res.formValues[2];
        config.menuToggles.claimland = res.formValues[3]; 
        config.menuToggles.serverwarp = res.formValues[4]; 
        config.menuToggles.playerwarp = res.formValues[5];
        config.menuToggles.shop = res.formValues[6];        
        config.menuToggles.vault = res.formValues[7]; 
        config.menuToggles.market = res.formValues[8]; 
        config.menuToggles.home = res.formValues[9];
        config.menuToggles.bank = res.formValues[10]; 
        config.menuToggles.transfer = res.formValues[11]; 
        config.menuToggles.jobs = res.formValues[12];
        config.menuToggles.settings = res.formValues[13]; 
        config.menuToggles.report = res.formValues[14];     
        
        saveConfig(config); 
        player.sendMessage(" §a[Admin] Toggles Menu berhasil disimpan!");
        player.playSound("random.orb");
    });
}