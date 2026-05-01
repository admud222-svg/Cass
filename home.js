import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { system, world } from "@minecraft/server";
import { getPlayerHomes, savePlayerHomes, getPlayerHomeLimit, getHomeConfig, saveHomeConfig, getAllHomeKeys } from "./home_db.js";
import { getRanks } from "../ranks/rank.js"; 

const DIMS = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
const DIM_NAMES = ["Overworld", "Nether", "The End"];

function forceShow(player, form, callback, isRetry = false) {
    if (!isRetry) player.playSound("random.pop", { volume: 0.8, pitch: 1.0 });
    form.show(player).then(res => {
        if (res.canceled && res.cancelationReason === "UserBusy") {
            system.run(() => forceShow(player, form, callback, true)); 
        } else {
            callback(res);
        }
    }).catch(e => console.warn(e));
}

// ==========================================
// [PLAYER] MENU UTAMA HOME
// ==========================================
export function openHomeMenu(player) {
    const homes = getPlayerHomes(player.name);
    const limit = getPlayerHomeLimit(player);

    const form = new ActionFormData()
        .title("§lHOME SYSTEM")
        .body(`Halo §b${player.name}§r!\nLimit Home Kamu: §e${homes.length} / ${limit}§r\nPilih aksi di bawah ini:`)
        .button("§lAdd Home\n§r§8Set lokasi rumahmu", "textures/ui/color_plus")
        .button("§lList Home\n§r§8TP ke rumahmu", "textures/ui/send_icon")
        .button("§lDelete Home\n§r§8Hapus rumah yang ada", "textures/ui/trash_default");

    forceShow(player, form, res => {
        if (res.canceled) return;
        if (res.selection === 0) menuAddHome(player, homes, limit);
        if (res.selection === 1) menuListHome(player, homes);
        if (res.selection === 2) menuDeleteHome(player, homes);
    });
}

// ==========================================
// [PLAYER] ADD HOME
// ==========================================
function menuAddHome(player, homes, limit) {
    if (homes.length >= limit) {
        player.sendMessage(`§c[Home] Kamu sudah mencapai batas maksimal Home (${limit})! Upgrade Rank untuk menambah limit.`);
        player.playSound("note.bass");
        return openHomeMenu(player);
    }

    let currentDimIdx = Math.max(0, DIMS.indexOf(player.dimension.id));

    // FIX API BEDROCK: Menggunakan objek { defaultValueIndex: ... } pada dropdown
    const form = new ModalFormData()
        .title("Add New Home")
        .textField("Masukkan Nama Home:\n§8(Contoh: Rumah Utama, Base Tambang)", "Ketik di sini...")
        .dropdown("Pilih Dimensi:\n§8(Otomatis deteksi lokasimu saat ini)", DIM_NAMES, { defaultValueIndex: currentDimIdx });

    forceShow(player, form, res => {
        if (res.canceled) return openHomeMenu(player);
        const name = res.formValues[0].trim();
        const dimId = DIMS[res.formValues[1]];

        if (name === "") return player.sendMessage("§c[Home] Nama Home tidak boleh kosong!");
        if (homes.find(h => h.name.toLowerCase() === name.toLowerCase())) {
            return player.sendMessage("§c[Home] Nama Home sudah ada! Gunakan nama lain.");
        }

        const loc = player.location;
        homes.push({
            name: name,
            x: Math.floor(loc.x),
            y: Math.floor(loc.y),
            z: Math.floor(loc.z),
            dim: dimId
        });

        savePlayerHomes(player.name, homes);
        player.sendMessage(`§a[Home] Berhasil menyimpan Home §e${name} §adi dimensi §b${DIM_NAMES[res.formValues[1]]}§a!`);
        player.playSound("random.levelup");
        openHomeMenu(player);
    });
}

// ==========================================
// [PLAYER] LIST HOME (TELEPORT)
// ==========================================
function menuListHome(player, homes) {
    if (homes.length === 0) {
        player.sendMessage("§c[Home] Kamu belum memiliki Home!");
        return openHomeMenu(player);
    }

    const form = new ActionFormData()
        .title("§lLIST HOME")
        .body("Klik Home untuk langsung Teleport:");

    homes.forEach(h => {
        let dimName = h.dim.replace("minecraft:", "").toUpperCase();
        form.button(`§l§2${h.name}\n§r§8${dimName} | X:${h.x} Y:${h.y} Z:${h.z}`, "textures/ui/send_icon");
    });

    form.button("Kembali", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === homes.length) return openHomeMenu(player);
        
        const target = homes[res.selection];
        const dim = world.getDimension(target.dim);
        
        player.teleport({ x: target.x, y: target.y, z: target.z }, { dimension: dim });
        player.sendMessage(`§a[Home] Teleportasi ke §e${target.name}§a...`);
        player.playSound("portal.travel");
    });
}

// ==========================================
// [PLAYER] DELETE HOME
// ==========================================
function menuDeleteHome(player, homes) {
    if (homes.length === 0) return openHomeMenu(player);

    const form = new ActionFormData()
        .title("§lDELETE HOME")
        .body("Pilih Home yang ingin kamu §cHAPUS PERMANEN§r:");

    homes.forEach(h => {
        form.button(`§l§c${h.name}\n§r§8Klik untuk menghapus`, "textures/ui/trash_default");
    });

    form.button("Kembali", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === homes.length) return openHomeMenu(player);
        
        const targetName = homes[res.selection].name;
        homes.splice(res.selection, 1);
        savePlayerHomes(player.name, homes);
        
        player.sendMessage(`§a[Home] Home §e${targetName} §aberhasil dihapus!`);
        player.playSound("random.break");
        openHomeMenu(player);
    });
}

// ==========================================
// ==========================================
// [ADMIN] MAIN MENU HOME
// ==========================================
// ==========================================
export function menuAdminHomeCategory(player) {
    const form = new ActionFormData()
        .title("§lHOME MANAGEMENT")
        .body("Atur limit Home Server dan pantau rumah pemain:")
        .button("§lConfig Limit Home\n§r§8Atur batas per Rank", "textures/ui/icon_setting")
        .button("§lManage Player Homes\n§r§8TP / Edit / Hapus rumah", "textures/ui/magnifyingGlass")
        .button("§cTutup", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === 2) return;
        if (res.selection === 0) menuConfigHomeLimit(player);
        if (res.selection === 1) menuManagePlayerHomes(player);
    });
}

// ==========================================
// [ADMIN] CONFIG LIMIT HOME
// ==========================================
function menuConfigHomeLimit(player) {
    const config = getHomeConfig();
    const ranks = getRanks();
    const rankIds = Object.keys(ranks);

    const form = new ModalFormData()
        .title("Home Limit Config")
        .textField("Default Max Home\n§8(Untuk member / rank yg tidak diatur di bawah):", "Contoh: 2", { defaultValue: String(config.defaultLimit || 2) });

    rankIds.forEach(id => {
        let currentLimit = config.rankLimits[id] !== undefined ? config.rankLimits[id] : "";
        form.textField(`Max Home untuk Rank: §e${id.toUpperCase()}§r\n§8(Kosongkan jika ikut Default)`, "Contoh: 5", { defaultValue: String(currentLimit) });
    });

    forceShow(player, form, res => {
        if (res.canceled) return menuAdminHomeCategory(player);
        
        config.defaultLimit = parseInt(res.formValues[0]) || 2;
        config.rankLimits = {};

        rankIds.forEach((id, index) => {
            const inputVal = res.formValues[index + 1].trim();
            if (inputVal !== "") {
                config.rankLimits[id] = parseInt(inputVal) || 0;
            }
        });

        saveHomeConfig(config);
        player.sendMessage("§a[Admin] Berhasil menyimpan konfigurasi Limit Home!");
        menuAdminHomeCategory(player);
    });
}

// ==========================================
// [ADMIN] MANAGE PLAYER HOMES
// ==========================================
function menuManagePlayerHomes(player) {
    const keys = getAllHomeKeys();
    const playerNames = keys.map(k => k.replace("homes_", ""));

    const form = new ActionFormData()
        .title("MANAGE HOMES")
        .body(`Total Player yang memiliki Home: ${playerNames.length}\nPilih player untuk melihat daftarnya:`);

    if (playerNames.length === 0) form.body("Belum ada satupun player yang membuat Home.");

    playerNames.forEach(pName => {
        const homes = getPlayerHomes(pName);
        form.button(`§l§b${pName}\n§r§8Total Home: ${homes.length}`, "textures/ui/icon_steve");
    });

    form.button("Kembali", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === playerNames.length) return menuAdminHomeCategory(player);
        menuPlayerHomeList(player, playerNames[res.selection]);
    });
}

function menuPlayerHomeList(player, targetPlayerName) {
    const homes = getPlayerHomes(targetPlayerName);

    const form = new ActionFormData()
        .title(`Homes: ${targetPlayerName}`)
        .body("Pilih Home untuk di-Manage:");

    homes.forEach(h => {
        form.button(`§l${h.name}\n§r§8Dim: ${h.dim.replace("minecraft:", "")} | [X:${h.x} Y:${h.y} Z:${h.z}]`, "textures/ui/icon_map");
    });

    form.button("Kembali", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === homes.length) return menuManagePlayerHomes(player);
        menuHomeAction(player, targetPlayerName, homes, res.selection);
    });
}

function menuHomeAction(player, targetPlayerName, homes, homeIndex) {
    const h = homes[homeIndex];

    const form = new ActionFormData()
        .title(`Aksi: ${h.name}`)
        .body(`Pemilik: §b${targetPlayerName}§r\nNama: §e${h.name}§r\nDimensi: §f${h.dim}§r\nKoordinat: §fX:${h.x} Y:${h.y} Z:${h.z}§r\n\nPilih Aksi:`)
        .button("§l§2Teleport ke Sini", "textures/ui/send_icon")
        .button("§l§eEdit Nama / Kordinat", "textures/ui/pencil_edit_icon")
        .button("§l§cHapus Paksa Home", "textures/ui/trash_default")
        .button("Kembali", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === 3) return menuPlayerHomeList(player, targetPlayerName);

        if (res.selection === 0) {
            const dim = world.getDimension(h.dim);
            player.teleport({ x: h.x, y: h.y, z: h.z }, { dimension: dim });
            player.sendMessage(`§a[Admin] Teleportasi ke Home milik ${targetPlayerName}...`);
        }
        else if (res.selection === 1) {
            menuEditPlayerHome(player, targetPlayerName, homes, homeIndex);
        }
        else if (res.selection === 2) {
            homes.splice(homeIndex, 1);
            savePlayerHomes(targetPlayerName, homes);
            player.sendMessage(`§a[Admin] Berhasil menghapus paksa Home ${h.name} milik ${targetPlayerName}!`);
            menuPlayerHomeList(player, targetPlayerName);
        }
    });
}

function menuEditPlayerHome(player, targetPlayerName, homes, homeIndex) {
    const h = homes[homeIndex];
    const dims = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];
    let dimIdx = Math.max(0, dims.indexOf(h.dim));

    const form = new ModalFormData()
        .title(`Edit: ${h.name}`)
        .textField("Nama Home:", "Contoh: Base", { defaultValue: String(h.name) })
        .dropdown("Dimensi:", ["Overworld", "Nether", "The End"], { defaultValueIndex: dimIdx })
        .textField("Kordinat X:", "X", { defaultValue: String(h.x) })
        .textField("Kordinat Y:", "Y", { defaultValue: String(h.y) })
        .textField("Kordinat Z:", "Z", { defaultValue: String(h.z) });

    forceShow(player, form, res => {
        if (res.canceled) return menuHomeAction(player, targetPlayerName, homes, homeIndex);
        
        homes[homeIndex] = {
            name: res.formValues[0].trim() || h.name,
            dim: dims[res.formValues[1]],
            x: parseInt(res.formValues[2]) || h.x,
            y: parseInt(res.formValues[3]) || h.y,
            z: parseInt(res.formValues[4]) || h.z
        };

        savePlayerHomes(targetPlayerName, homes);
        player.sendMessage(`§a[Admin] Berhasil mengedit data Home milik ${targetPlayerName}!`);
        menuPlayerHomeList(player, targetPlayerName);
    });
}