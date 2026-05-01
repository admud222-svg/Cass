import { world, system, ItemStack } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const DB_KEY = "admud_afk_data";
const HOLO_ID = "add:floating_text";
const playerStates = new Map();

let cachedAfkData = null; // SISTEM MEMORI ANTI LAG

function getAfkData() {
    if (cachedAfkData) return cachedAfkData; // Ambil dari memori

    try {
        const raw = world.getDynamicProperty(DB_KEY);
        if (!raw) return defaultAfkData();
        const parsed = JSON.parse(raw);
        if (!parsed.rewards) parsed.rewards = [];
        if (!parsed.intervalSec) parsed.intervalSec = 60;
        
        // Auto-Fix untuk data Hologram baru
        if (parsed.holoLoc === undefined) parsed.holoLoc = null;
        if (parsed.holoDim === undefined) parsed.holoDim = "overworld";
        
        cachedAfkData = parsed; // Simpan ke memori
        return parsed;
    } catch (e) {
        return defaultAfkData();
    }
}

function saveAfkData(data) {
    cachedAfkData = data; // Update memori
    try { world.setDynamicProperty(DB_KEY, JSON.stringify(data)); } catch (e) {}
}

function defaultAfkData() {
    return {
        enabled: false, p1: null, p2: null, dim: "overworld",
        holoLoc: null, holoDim: "overworld", 
        intervalSec: 60, rewards: [] 
    };
}

function getPlayersSafe() {
    try { if (typeof world.getPlayers === 'function') return Array.from(world.getPlayers()); } catch(e) {}
    try { if (typeof world.getAllPlayers === 'function') return Array.from(world.getAllPlayers()); } catch(e) {}
    return [];
}

function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h} Jam ${m} Menit ${s} Detik`;
    if (m > 0) return `${m} Menit ${s} Detik`;
    return `${s} Detik`;
}

function getRandomReward(rewards) {
    if (!rewards || rewards.length === 0) return null;
    const totalWeight = rewards.reduce((sum, r) => sum + r.chance, 0);
    let random = Math.random() * totalWeight;
    for (const r of rewards) {
        if (random < r.chance) return r;
        random -= r.chance;
    }
    return rewards[0];
}

// ==========================================
// 1. SISTEM HOLOGRAM INFORMASI AFK (2 ENTITAS TERPISAH)
// ==========================================
system.runInterval(() => {
    const data = getAfkData();
    if (data.holoLoc && data.holoDim) {
        try {
            const dim = world.getDimension(data.holoDim);
            
            // [FIX ANTI DUPLIKAT 1]: Pengecekan Chunk
            // Jika chunk belum ter-load (misal saat player baru login/mendekat), getBlock akan error.
            // Kita batalkan eksekusi untuk mencegah spawn entitas baru sebelum yang lama ter-render.
            try {
                dim.getBlock(data.holoLoc);
            } catch(e) {
                return; // Chunk belum siap, hentikan
            }

            // Cari semua hologram di radius 3 blok
            const holos = dim.getEntities({ location: data.holoLoc, maxDistance: 3, type: HOLO_ID });
            
            // Pisahkan pencarian Entity Title dan Entity Info menjadi array
            const titleHolos = holos.filter(h => h.getDynamicProperty("is_afk_title") === true);
            const infoHolos = holos.filter(h => h.getDynamicProperty("is_afk_info") === true);

            let titleHolo = titleHolos[0];
            let infoHolo = infoHolos[0];

            // [FIX ANTI DUPLIKAT 2]: Auto-Cleaner
            // Jika terdeteksi ada lebih dari 1 entitas (menumpuk/duplikat), bunuh sisanya
            if (titleHolos.length > 1) {
                for (let i = 1; i < titleHolos.length; i++) {
                    try { titleHolos[i].remove(); } catch(e){}
                }
            }
            if (infoHolos.length > 1) {
                for (let i = 1; i < infoHolos.length; i++) {
                    try { infoHolos[i].remove(); } catch(e){}
                }
            }

            // ===========================================
            // ATUR POSISI KETINGGIAN DI SINI (Y Axis)
            // ===========================================
            // Title dinaikkan 0.7 blok agar proporsional
            const titleLoc = { x: data.holoLoc.x, y: data.holoLoc.y + 0.7, z: data.holoLoc.z };
            // Info tetap di posisi asli
            const infoLoc = { x: data.holoLoc.x, y: data.holoLoc.y, z: data.holoLoc.z };

            // 1. Tangani Entitas Title
            if (!titleHolo) {
                titleHolo = dim.spawnEntity(HOLO_ID, titleLoc);
                titleHolo.setDynamicProperty("is_afk_title", true);
                titleHolo.setDynamicProperty("is_child", true);
            } else {
                try { titleHolo.teleport(titleLoc, { dimension: dim }); } catch(e){}
            }

            // 2. Tangani Entitas Info Penjelasan
            if (!infoHolo) {
                infoHolo = dim.spawnEntity(HOLO_ID, infoLoc);
                infoHolo.setDynamicProperty("is_afk_info", true);
                infoHolo.setDynamicProperty("is_child", true); 
            } else {
                try { infoHolo.teleport(infoLoc, { dimension: dim }); } catch(e){}
            }

            const sortedRewards = [...data.rewards].sort((a, b) => b.chance - a.chance);

            // SET TEKS UNTUK TITLE (Entitas 1)
            const titleGlyph = "   "; 
            titleHolo.nameTag = `§f${titleGlyph}§r`; 
            
            // SET TEKS UNTUK INFO (Entitas 2)
            let textInfo = `§fAFK Selama §e${data.intervalSec} Detik§f Untuk Dapat Hadiah\n\n`;
            textInfo += `§aList Hadiah Yang Mungkin Kamu Bisa Dapatkan:\n`;
            
            if (sortedRewards.length === 0) {
                textInfo += `§c(Belum ada hadiah, lapor ke Admin!)`;
            } else {
                sortedRewards.forEach(r => {
                    textInfo += `§8- §f${r.name} §e(${r.chance}%) \n`;
                });
            }

            infoHolo.nameTag = textInfo;

        } catch(e) {}
    }
}, 100);

// ==========================================
// 2. SISTEM AFK REWARD & GACHA SPINNER
// ==========================================
system.runInterval(() => {
    const data = getAfkData();
    if (!data.enabled || !data.p1 || !data.p2) return;
    
    const minX = Math.min(data.p1.x, data.p2.x), minY = Math.min(data.p1.y, data.p2.y), minZ = Math.min(data.p1.z, data.p2.z);
    const maxX = Math.max(data.p1.x, data.p2.x), maxY = Math.max(data.p1.y, data.p2.y), maxZ = Math.max(data.p1.z, data.p2.z);

    const players = getPlayersSafe();

    for (const p of players) {
        if (p.dimension.id !== data.dim) {
            playerStates.delete(p.name); continue;
        }

        const loc = p.location;
        const isInside = (loc.x >= minX && loc.x <= maxX && loc.y >= minY && loc.y <= maxY && loc.z >= minZ && loc.z <= maxZ);

        if (isInside) {
            if (!playerStates.has(p.name)) {
                playerStates.set(p.name, { ticks: 0, totalSec: 0, timeLeft: data.intervalSec, state: "counting", spinTicks: 0, wonReward: null });
            }

            const state = playerStates.get(p.name);
            state.ticks++;

            if (state.ticks % 5 === 0) {
                state.totalSec++;
                if (state.state === "counting") state.timeLeft--;
            }

            let actionText = `§bAFK TIMER: §e${state.timeLeft} Detik\n`;

            if (state.state === "counting") {
                actionText += `§dREWARD: §7???\n`;
                if (state.timeLeft <= 0) {
                    if (!data.rewards || data.rewards.length === 0) {
                        state.timeLeft = data.intervalSec; 
                    } else {
                        state.state = "spinning";
                        state.spinTicks = 15; 
                        state.wonReward = getRandomReward(data.rewards);
                    }
                }
            } 
            else if (state.state === "spinning") {
                state.spinTicks--;
                let randomHiasan = data.rewards[Math.floor(Math.random() * data.rewards.length)];
                actionText += `§dREWARD: §e> §f${randomHiasan.name} §e<\n`;

                if (state.spinTicks <= 0) {
                    state.state = "won";
                    state.spinTicks = 10; 
                    
                    try {
                        const rw = state.wonReward;
                        if (rw.type === "money") {
                            p.runCommandAsync(`scoreboard players add @s money ${rw.value}`);
                        } else if (rw.type === "command") {
                            let cmd = rw.value.replace(/@p/g, `"${p.name}"`).replace(/@s/g, `"${p.name}"`);
                            p.dimension.runCommandAsync(cmd);
                        } else if (rw.type === "item") {
                            let item = new ItemStack(rw.itemData.typeId, rw.itemData.amount);
                            if (rw.itemData.nameTag) item.nameTag = rw.itemData.nameTag;
                            if (rw.itemData.lore && rw.itemData.lore.length > 0) item.setLore(rw.itemData.lore);
                            p.getComponent("inventory").container.addItem(item);
                        }
                        p.sendMessage(`§a[AFK Arena] §fSelamat! Kamu mendapatkan §e${rw.name}§f!`);
                        p.playSound("random.levelup");
                    } catch(e) { p.sendMessage("§c[AFK Arena] Gagal memberikan hadiah."); }
                }
            }
            else if (state.state === "won") {
                state.spinTicks--;
                actionText += `§dREWARD: §a[ §f${state.wonReward.name} §a]\n`;
                if (state.spinTicks <= 0) {
                    state.state = "counting";
                    state.timeLeft = data.intervalSec;
                }
            }

            actionText += `§aAFK TIME: §f${formatTime(state.totalSec)}`;
            try { p.onScreenDisplay.setActionBar(actionText); } catch(e){}

        } else {
            if (playerStates.has(p.name)) {
                playerStates.delete(p.name);
                try { p.onScreenDisplay.setActionBar(` `); } catch(e){}
            }
        }
    }
}, 4);

// ==========================================
// 3. UI ADMIN (MENU UTAMA AFK)
// ==========================================
export function openAfkMenu(player, backCallback) {
    const data = getAfkData();
    const form = new ActionFormData().title("§lAFK ARENA SETTINGS");
        
    form.button(`Status: ${data.enabled ? "§aAKTIF" : "§cMATI"}\n§r§8Klik untuk ubah`); 
    form.button(`Set Pos 1\n§r§8${data.p1 ? `(${Math.floor(data.p1.x)}, ${Math.floor(data.p1.y)}, ${Math.floor(data.p1.z)})` : "Belum di-set"}`); 
    form.button(`Set Pos 2\n§r§8${data.p2 ? `(${Math.floor(data.p2.x)}, ${Math.floor(data.p2.y)}, ${Math.floor(data.p2.z)})` : "Belum di-set"}`); 
    const holoText = data.holoLoc ? `Tersimpan di X:${Math.floor(data.holoLoc.x)}` : "Belum di-set";
    form.button(`Set Posisi Hologram Info\n§r§8${holoText}`); 
    form.button(`Atur Hadiah Gacha (Rewards)\n§r§8Tersedia ${data.rewards.length} Hadiah`); 
    form.button(`Atur Timer Reset\n§r§8Setiap ${data.intervalSec} Detik`); 
    form.button("Kembali"); 
    
    form.show(player).then(res => {
        if (res.canceled) return; 
        
        const sel = res.selection;
        if (sel === 0) {
            if (!data.p1 || !data.p2) return player.sendMessage("§cSet Pos 1 dan Pos 2 terlebih dahulu!"), system.run(() => openAfkMenu(player, backCallback));
            data.enabled = !data.enabled;
            saveAfkData(data);
            player.sendMessage("§a[Admin] Status AFK Arena: " + (data.enabled ? "AKTIF" : "MATI"));
            system.run(() => openAfkMenu(player, backCallback));
        }
        else if (sel === 1) {
            data.p1 = { x: player.location.x, y: player.location.y, z: player.location.z };
            data.dim = player.dimension.id;
            saveAfkData(data); player.sendMessage("§a[Admin] Pos 1 AFK Arena berhasil di-set!");
            system.run(() => openAfkMenu(player, backCallback));
        }
        else if (sel === 2) {
            data.p2 = { x: player.location.x, y: player.location.y, z: player.location.z };
            data.dim = player.dimension.id;
            saveAfkData(data); player.sendMessage("§a[Admin] Pos 2 AFK Arena berhasil di-set!");
            system.run(() => openAfkMenu(player, backCallback));
        }
        else if (sel === 3) {
            if (data.holoLoc && data.holoDim) {
                // Menghapus SEMUA entitas AFK lama (Title & Info) saat posisi digeser
                try {
                    const oldDim = world.getDimension(data.holoDim);
                    const oldHolos = oldDim.getEntities({ location: data.holoLoc, maxDistance: 3, type: HOLO_ID });
                    oldHolos.forEach(h => { 
                        if (h.getDynamicProperty("is_afk_info") || h.getDynamicProperty("is_afk_title")) h.remove(); 
                    });
                } catch(e) {}
            }
            data.holoLoc = { x: player.location.x, y: player.location.y, z: player.location.z };
            data.holoDim = player.dimension.id;
            saveAfkData(data);
            player.sendMessage("§a[Admin] Posisi Hologram AFK berhasil di-set di lokasimu saat ini!");
            system.run(() => openAfkMenu(player, backCallback));
        }
        else if (sel === 4) system.run(() => openRewardManager(player, backCallback));
        else if (sel === 5) {
            new ModalFormData().title("Atur Timer AFK")
                .textField("Waktu menghitung mundur (Detik):", "Contoh: 60", { defaultValue: data.intervalSec.toString() })
                .show(player).then(r => {
                    if(r.canceled) return system.run(() => openAfkMenu(player, backCallback));
                    const sec = parseInt(r.formValues[0]);
                    if(!isNaN(sec) && sec >= 5) {
                        data.intervalSec = sec; saveAfkData(data);
                        player.sendMessage(`§a[Admin] AFK Timer di-set menjadi ${sec} detik.`);
                    }
                    system.run(() => openAfkMenu(player, backCallback));
                });
        }
        else if (sel === 6) { if (backCallback) system.run(() => backCallback(player)); }
    });
}

function openRewardManager(player, backCallback) {
    const data = getAfkData();
    const form = new ActionFormData().title("§lREWARDS MANAGER")
        .body(`Total Peluang: §a${data.rewards.reduce((s, r) => s + r.chance, 0)}%`)
        .button("§l[+] Tambah Reward Uang", "textures/ui/color_plus")
        .button("§l[+] Tambah Reward Command", "textures/ui/color_plus")
        .button("§l[+] Tambah Reward Item", "textures/ui/color_plus")
        .button(`§l📝 Kelola Hadiah\n§r§8Edit/Hapus (${data.rewards.length} Hadiah)`, "textures/ui/pencil_edit_icon")
        .button("Kembali", "textures/ui/cancel");

    form.show(player).then(res => {
        if (res.canceled) return;
        
        if (res.selection === 0) {
            new ModalFormData().title("Tambah Uang")
                .textField("Nama Hadiah (Muncul di layar):", "Contoh: Uang Jajan $500")
                .textField("Jumlah Uang (Money):", "Contoh: 500")
                .textField("Peluang Mendapatkan (Chance %):", "Contoh: 50")
                .show(player).then(r => {
                    if (r.canceled) return system.run(() => openRewardManager(player, backCallback));
                    const name = r.formValues[0], val = parseInt(r.formValues[1]), chance = parseFloat(r.formValues[2]);
                    if (name && !isNaN(val) && !isNaN(chance)) {
                        data.rewards.push({ id: Date.now().toString(), type: "money", name, value: val, chance });
                        saveAfkData(data); player.sendMessage("§aReward Uang ditambahkan!");
                    }
                    system.run(() => openRewardManager(player, backCallback));
                });
        }
        else if (res.selection === 1) { 
            new ModalFormData().title("Tambah Command")
                .textField("Nama Hadiah (Muncul di layar):", "Contoh: Pangkat VIP")
                .textField("Command (Gunakan @s untuk target):", "Contoh: tag @s add vip")
                .textField("Peluang Mendapatkan (Chance %):", "Contoh: 5")
                .show(player).then(r => {
                    if (r.canceled) return system.run(() => openRewardManager(player, backCallback));
                    const name = r.formValues[0], val = r.formValues[1], chance = parseFloat(r.formValues[2]);
                    if (name && val && !isNaN(chance)) {
                        data.rewards.push({ id: Date.now().toString(), type: "command", name, value: val, chance });
                        saveAfkData(data); player.sendMessage("§aReward Command ditambahkan!");
                    }
                    system.run(() => openRewardManager(player, backCallback));
                });
        }
        else if (res.selection === 2) { 
            const inv = player.getComponent("inventory").container;
            const validItems = [];
            for (let i = 0; i < inv.size; i++) {
                const item = inv.getItem(i);
                if (item) validItems.push({ slot: i, item: item });
            }

            if (validItems.length === 0) return player.sendMessage("§cInventory-mu kosong! Bawa item di tasmu untuk di-import."), system.run(() => openRewardManager(player, backCallback));

            const options = validItems.map(x => `Slot ${x.slot}: ${x.item.typeId.replace("minecraft:", "")} (x${x.item.amount})`);

            new ModalFormData().title("Import Item Reward")
                .dropdown("Pilih Item dari Tas Kamu:", options)
                .textField("Nama Hadiah (Muncul di layar):", "Contoh: Pedang Dewa")
                .textField("Peluang Mendapatkan (Chance %):", "Contoh: 20")
                .show(player).then(r => {
                    if (r.canceled) return system.run(() => openRewardManager(player, backCallback));
                    const selectedData = validItems[r.formValues[0]], name = r.formValues[1], chance = parseFloat(r.formValues[2]);

                    if (name && !isNaN(chance) && selectedData) {
                        const itm = selectedData.item;
                        const itemData = { typeId: itm.typeId, amount: itm.amount, nameTag: itm.nameTag, lore: itm.getLore() };
                        data.rewards.push({ id: Date.now().toString(), type: "item", name, itemData, chance });
                        saveAfkData(data); player.sendMessage("§aReward Item di-import!");
                    }
                    system.run(() => openRewardManager(player, backCallback));
                });
        }
        else if (res.selection === 3) {
            system.run(() => openRewardList(player, backCallback));
        }
        else if (res.selection === 4) {
            system.run(() => openAfkMenu(player, backCallback));
        }
    });
}

function openRewardList(player, backCallback) {
    const data = getAfkData();
    const form = new ActionFormData().title("§lDAFTAR HADIAH");
    
    if (data.rewards.length === 0) {
        form.body("Belum ada hadiah yang ditambahkan.");
    } else {
        form.body("Klik hadiah di bawah untuk mengedit atau menghapusnya:");
        data.rewards.forEach(r => {
            let tipeStr = r.type === "money" ? "Uang" : (r.type === "command" ? "Command" : "Item");
            form.button(`§l${r.name}\n§r§8Tipe: ${tipeStr} | Chance: ${r.chance}%`, "textures/ui/inventory_icon");
        });
    }
    
    form.button("Kembali", "textures/ui/cancel");

    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === data.rewards.length) return system.run(() => openRewardManager(player, backCallback));
        
        system.run(() => openEditReward(player, res.selection, backCallback));
    });
}

function openEditReward(player, index, backCallback) {
    const data = getAfkData();
    const reward = data.rewards[index];
    if (!reward) return system.run(() => openRewardList(player, backCallback));

    const form = new ModalFormData().title("§lEDIT REWARD");
    
    if (reward.type === "money") {
        form.textField("Nama Hadiah:", "Contoh: Uang Jajan", { defaultValue: reward.name })
            .textField("Jumlah Uang (Money):", "Contoh: 500", { defaultValue: reward.value.toString() })
            .textField("Peluang (Chance %):", "Contoh: 50", { defaultValue: reward.chance.toString() })
            .toggle("§l§cHAPUS HADIAH INI?", { defaultValue: false });
    } else if (reward.type === "command") {
        form.textField("Nama Hadiah:", "Contoh: Pangkat VIP", { defaultValue: reward.name })
            .textField("Command (@s target):", "Contoh: tag @s add vip", { defaultValue: reward.value })
            .textField("Peluang (Chance %):", "Contoh: 5", { defaultValue: reward.chance.toString() })
            .toggle("§l§cHAPUS HADIAH INI?", { defaultValue: false });
    } else if (reward.type === "item") {
        form.textField("Nama Hadiah:", "Contoh: Pedang Dewa", { defaultValue: reward.name })
            .textField("Peluang (Chance %):", "Contoh: 20", { defaultValue: reward.chance.toString() })
            .toggle("§l§cHAPUS HADIAH INI?", { defaultValue: false });
    }

    form.show(player).then(res => {
        if (res.canceled) return system.run(() => openRewardList(player, backCallback));
        
        const isItem = reward.type === "item";
        const deleteToggleIndex = isItem ? 2 : 3;
        
        if (res.formValues[deleteToggleIndex]) {
            data.rewards.splice(index, 1);
            saveAfkData(data);
            player.sendMessage("§a[Admin] Hadiah berhasil dihapus!");
            return system.run(() => openRewardList(player, backCallback));
        }

        reward.name = res.formValues[0];
        if (isItem) {
            reward.chance = parseFloat(res.formValues[1]) || 0;
        } else {
            if (reward.type === "money") reward.value = parseInt(res.formValues[1]) || 0;
            else reward.value = res.formValues[1];
            
            reward.chance = parseFloat(res.formValues[2]) || 0;
        }

        saveAfkData(data);
        player.sendMessage("§a[Admin] Hadiah berhasil diupdate!");
        system.run(() => openRewardList(player, backCallback));
    });
}