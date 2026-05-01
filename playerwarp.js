import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { getConfig, saveConfig } from "../../config.js";
import { getPlayerRank, getRanks } from "../ranks/rank.js";

const PWARP_DB = "admud_pwarps";

// ==========================================
// DATABASE & UTILS
// ==========================================
export function getPWarps() {
    try {
        const data = world.getDynamicProperty(PWARP_DB);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        return {};
    }
}

export function savePWarps(data) {
    world.setDynamicProperty(PWARP_DB, JSON.stringify(data));
}

function metricNum(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toString();
}

function formatDim(dim) {
    if (dim.includes("nether")) return "§cNether";
    if (dim.includes("the_end")) return "§5The End";
    return "§aOverworld";
}

function getMoney(player) {
    try {
        const obj = world.scoreboard.getObjective("money");
        return obj ? (obj.getScore(player.scoreboardIdentity) || 0) : 0;
    } catch(e) { return 0; }
}

function removeMoney(player, amount) {
    try { 
        const obj = world.scoreboard.getObjective("money");
        if(obj) obj.setScore(player.scoreboardIdentity, getMoney(player) - amount);
    } catch(e){}
}

function addMoney(playerName, amount) {
    try { world.getDimension("overworld").runCommand(`scoreboard players add "${playerName}" money ${amount}`); } catch(e){}
}

// ==========================================
// MAIN UI: PLAYER WARP LIST & FILTERS
// ==========================================
export function openPlayerWarpMenu(player, filter = "all") {
    const warps = getPWarps();
    let warpIds = Object.keys(warps);
    
    if (filter === "free") warpIds = warpIds.filter(id => warps[id].isFree);
    if (filter === "paid") warpIds = warpIds.filter(id => !warps[id].isFree);

    const form = new ActionFormData().title("§l§bPLAYER WARPS§t§t§1");
    let filterText = filter === "all" ? "Semua Warp" : (filter === "free" ? "Hanya Gratis" : "Hanya Berbayar");
    
    form.button(`§l§e[ Manage My Warps ]\n§r§8Buat/Edit Warp Kamu`, "textures/ui/icon_setting");
    form.button(`§l§a[ Filter: ${filterText} ]\n§r§8Klik untuk ubah kategori`, "textures/ui/magnifyingGlass");

    if (warpIds.length === 0) {
        form.button("§cBelum ada warp di kategori ini.", "textures/ui/cancel");
    } else {
        for (const id of warpIds) {
            const w = warps[id];
            const priceStr = w.isFree ? "§aGRATIS" : `§e${metricNum(w.price)} ${w.currency === "money" ? "Money" : "XP"}`;
            form.button(`§l${w.name}\n§r§8${w.owner} | ${priceStr} | ${formatDim(w.dim)}`, "textures/ui/world_glyph");
        }
    }

    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 0) return menuMyWarps(player);
        if (res.selection === 1) return menuFilterPWarps(player);
        if (warpIds.length > 0 && res.selection >= 2) {
            menuWarpDetails(player, warpIds[res.selection - 2]);
        }
    });
}

export const openPlayerWarpUI = openPlayerWarpMenu;

function menuFilterPWarps(player) {
    new ActionFormData()
        .title("Pilih Kategori§t§t§1")
        .button("§lSemua Warp", "textures/ui/world_glyph")
        .button("§lHanya Gratis", "textures/ui/realms_green_check")
        .button("§lHanya Berbayar", "textures/ui/custom_currency")
        .show(player).then(res => {
            if (res.canceled) return openPlayerWarpMenu(player, "all");
            const filters = ["all", "free", "paid"];
            openPlayerWarpMenu(player, filters[res.selection]);
        });
}

// ==========================================
// MY WARPS (CREATE / EDIT)
// ==========================================
function menuMyWarps(player) {
    const warps = getPWarps();
    const myWarpIds = Object.keys(warps).filter(id => warps[id].owner === player.name);
    
    // MENGAMBIL LIMIT WARP LANGSUNG DARI SISTEM RANK!
    const rank = getPlayerRank(player);
    let limit = rank.warpLimit !== undefined ? rank.warpLimit : 1; 

    const form = new ActionFormData()
        .title("§l§dMY WARPS§t§t§1")
        .body(`Limit Pembuatan Warp Kamu: §e${myWarpIds.length} / ${limit}§r\n\nKelola warp milikmu di sini:`)
        .button("§l§2[+] Buat Warp di Sini", "textures/ui/color_plus");

    for (const id of myWarpIds) {
        form.button(`§l${warps[id].name}\n§r§8Klik untuk Edit/Hapus`, "textures/ui/pencil_edit_icon");
    }
    form.button("Kembali", "textures/ui/cancel");

    form.show(player).then(res => {
        if (res.canceled) return openPlayerWarpMenu(player, "all");
        if (res.selection === 0) {
            if (myWarpIds.length >= limit) return player.sendMessage("§cLimit pembuatan warp kamu sudah penuh! Naikkan rank untuk limit lebih banyak.");
            menuCreateEditPWarp(player, null);
        } else if (res.selection === myWarpIds.length + 1) {
            openPlayerWarpMenu(player, "all");
        } else {
            menuCreateEditPWarp(player, myWarpIds[res.selection - 1]);
        }
    });
}

function menuCreateEditPWarp(player, warpId) {
    const warps = getPWarps();
    const isNew = !warpId;
    const data = isNew ? { name: "My Warp", desc: "Selamat datang di tempatku!", isFree: true, price: 1000, currency: "money" } : warps[warpId];
    const curIdx = data.currency === "xp" ? 1 : 0;

    const form = new ModalFormData()
        .title(isNew ? "Buat Warp Baru" : "Edit Warp")
        .textField("Nama Warp (Tampil di Menu):", "Maks 15 huruf", { defaultValue: String(data.name) })
        .textField("Deskripsi Singkat:", "Maks 50 huruf", { defaultValue: String(data.desc) })
        .toggle("Status: §aGRATIS §f(Matikan saklar jika ingin berbayar)", { defaultValue: data.isFree })
        .textField("Harga Tiket (Jika Berbayar):", "Contoh: 5000", { defaultValue: String(data.price) })
        .dropdown("Mata Uang Pembayaran:", ["Money (Uang)", "XP (Level)"], { defaultValueIndex: curIdx });

    if (!isNew) form.toggle("§l§cHAPUS WARP INI? (Permanen)§r", { defaultValue: false });

    form.show(player).then(res => {
        if (res.canceled) return menuMyWarps(player);
        if (!isNew && res.formValues[5]) {
            delete warps[warpId];
            savePWarps(warps);
            player.sendMessage("§aWarp berhasil dihapus.");
            return menuMyWarps(player);
        }

        const newName = res.formValues[0].substring(0, 15).trim();
        const newDesc = res.formValues[1].substring(0, 50).trim();
        const newIsFree = res.formValues[2];
        const newPrice = parseInt(res.formValues[3]) || 0;
        const newCur = res.formValues[4] === 1 ? "xp" : "money";

        if (!newName) return player.sendMessage("§cNama warp tidak boleh kosong!");

        const idToSave = isNew ? "pwarp_" + Date.now() : warpId;
        const loc = player.location;

        warps[idToSave] = {
            owner: player.name, name: newName, desc: newDesc, isFree: newIsFree,
            price: newPrice, currency: newCur,
            x: isNew ? Math.floor(loc.x) + 0.5 : data.x,
            y: isNew ? Math.floor(loc.y) : data.y,
            z: isNew ? Math.floor(loc.z) + 0.5 : data.z,
            dim: isNew ? player.dimension.id : data.dim
        };

        savePWarps(warps);
        player.sendMessage(isNew ? "§aWarp berhasil dibuat di titik kamu berdiri!" : "§aInfo warp berhasil diupdate!");
        menuMyWarps(player);
    });
}

// ==========================================
// WARP DETAILS & TELEPORT
// ==========================================
function menuWarpDetails(player, warpId) {
    const warps = getPWarps();
    const w = warps[warpId];
    if (!w) return player.sendMessage("§cWarp sudah tidak ada/dihapus pemiliknya.");

    const priceStr = w.isFree ? "§aGRATIS" : `§e${metricNum(w.price)} ${w.currency === "money" ? "Money" : "XP Levels"}`;
    const dimStr = formatDim(w.dim);

    const form = new ActionFormData()
        .title(`§l${w.name}§t§t§1`)
        .body(`§7Pemilik: §f${w.owner}\n§7Lokasi: ${dimStr}\n§7Biaya Masuk: ${priceStr}\n\n§eDeskripsi:\n§f"${w.desc}"`)
        .button("§l§2TELEPORT SEKARANG\n§r§8Bayar & Berangkat", "textures/ui/send_icon")
        .button("§cBatalkan", "textures/ui/cancel");

    form.show(player).then(res => {
        if (res.canceled || res.selection === 1) return openPlayerWarpMenu(player, "all");
        
        if (!w.isFree && w.owner !== player.name) {
            if (w.currency === "money") {
                const bal = getMoney(player);
                if (bal < w.price) return player.sendMessage(`§cKamu butuh ${w.price} Money untuk teleport ke sini!`);
                removeMoney(player, w.price);
                addMoney(w.owner, w.price); 
            } else if (w.currency === "xp") {
                if (player.level < w.price) return player.sendMessage(`§cKamu butuh ${w.price} XP Level untuk teleport ke sini!`);
                player.addLevels(-w.price);
                try { world.getDimension("overworld").runCommand(`xp ${w.price}L "${w.owner}"`); } catch(e){} 
            }
            player.sendMessage(`§aKamu membayar ${priceStr} kepada ${w.owner}.`);
        }

        executePwarpTeleport(player, w);
    });
}

function executePwarpTeleport(player, w) {
    player.addTag("loadchunck`" + JSON.stringify({ x: w.x, z: w.z }));
    player.sendMessage(`§a[Player Warp] §fMelesat ke tempat §e${w.owner}§f...`);
    try { player.addEffect("blindness", 30, { amplifier: 1, showParticles: false }); } catch(e){}
    
    system.runTimeout(() => {
        try {
            player.teleport({ x: w.x, y: w.y, z: w.z }, { dimension: world.getDimension(w.dim) });
            player.playSound("mob.endermen.portal", { volume: 1.0, pitch: 1.0 });
        } catch(e) {
            player.sendMessage("§c[Warp] Gagal teleport! Dimensi atau koordinat mungkin rusak.");
        }
    }, 10);
}

// ==========================================
// ADMIN UI: MANAGE LIST PLAYER WARPS
// ==========================================
export function menuAdminManagePlayerWarps(admin) {
    const warps = getPWarps();
    const warpIds = Object.keys(warps);
    
    // Cari semua nama owner yang unik (tidak dobel)
    const owners = [...new Set(warpIds.map(id => warps[id].owner))];

    const form = new ActionFormData()
        .title("§l§dMANAGE P-WARPS")
        .body(`Total Player dengan Warp: §e${owners.length}§r\nPilih Player untuk melihat dan mengelola warp mereka:`);

    if (owners.length === 0) {
        form.button("§cBelum ada player yang membuat warp", "textures/ui/cancel");
    } else {
        for (const owner of owners) {
            const ownerWarpsCount = warpIds.filter(id => warps[id].owner === owner).length;
            form.button(`§l${owner}\n§r§8Total Warp: ${ownerWarpsCount}`, "textures/ui/icon_steve");
        }
    }
    form.button("Kembali", "textures/ui/cancel");

    form.show(admin).then(res => {
        if (res.canceled) return;
        if (owners.length === 0 || res.selection === owners.length) {
            import("../../ui_system.js").then(m => m.openAdminMenu(admin));
            return;
        }
        menuAdminPlayerWarpList(admin, owners[res.selection]);
    });
}

function menuAdminPlayerWarpList(admin, targetOwner) {
    const warps = getPWarps();
    const warpIds = Object.keys(warps).filter(id => warps[id].owner === targetOwner);

    const form = new ActionFormData()
        .title(`§l§bWARP: ${targetOwner}`)
        .body(`Total Warp milik §e${targetOwner}§f: ${warpIds.length}\nPilih warp untuk dikelola:`);

    if (warpIds.length === 0) {
         form.button("Kembali", "textures/ui/cancel");
    } else {
         for (const id of warpIds) {
            const w = warps[id];
            form.button(`§l${w.name}\n§r§8${formatDim(w.dim)}`, "textures/ui/world_glyph");
        }
        form.button("Kembali", "textures/ui/cancel");
    }

    form.show(admin).then(res => {
        if (res.canceled || res.selection === warpIds.length || warpIds.length === 0) return menuAdminManagePlayerWarps(admin);
        menuAdminPlayerWarpAction(admin, warpIds[res.selection]);
    });
}

function menuAdminPlayerWarpAction(admin, warpId) {
    const warps = getPWarps();
    const w = warps[warpId];
    if (!w) return admin.sendMessage("§cWarp sudah tidak ada!");

    const priceStr = w.isFree ? "§aGRATIS" : `§e${metricNum(w.price)} ${w.currency === "money" ? "Money" : "XP"}`;
    
    const form = new ActionFormData()
        .title(`§l§cAksi: ${w.name}`)
        .body(`§eOwner: §f${w.owner}\n§eDimensi: §f${w.dim}\n§eStatus: §f${priceStr}\n§eKordinat: §fX:${w.x} Y:${w.y} Z:${w.z}\n§eDeskripsi: §f"${w.desc}"\n\nPilih aksi admin:`)
        .button("§l§2Teleport ke Warp\n§r§8Periksa lokasi", "textures/ui/send_icon")
        .button("§l§cHapus Paksa Warp\n§r§8Hapus dari server", "textures/ui/trash_default")
        .button("Kembali", "textures/ui/cancel");

    form.show(admin).then(res => {
        if (res.canceled || res.selection === 2) return menuAdminPlayerWarpList(admin, w.owner);
        
        if (res.selection === 0) {
            admin.teleport({ x: w.x, y: w.y, z: w.z }, { dimension: world.getDimension(w.dim) });
            admin.addTag("loadchunck`" + JSON.stringify({ x: w.x, z: w.z }));
            admin.sendMessage(`§a[Admin] Teleportasi ke warp §e${w.name}§a milik §b${w.owner}§a...`);
        } 
        else if (res.selection === 1) {
            const confirmForm = new ActionFormData()
                .title("§l§cHAPUS WARP?")
                .body(`Yakin ingin MENGHAPUS PAKSA warp §e${w.name}§r milik §b${w.owner}§r?`)
                .button("§l§cHAPUS PAKSA", "textures/ui/trash_default")
                .button("BATAL", "textures/ui/cancel");
                
            confirmForm.show(admin).then(cRes => {
                if (cRes.canceled || cRes.selection === 1) return menuAdminPlayerWarpAction(admin, warpId);
                
                const db = getPWarps();
                delete db[warpId];
                savePWarps(db);
                admin.sendMessage(`§a[Admin] Warp ${w.name} milik ${w.owner} berhasil dihapus.`);
                menuAdminPlayerWarpList(admin, w.owner);
            });
        }
    });
}