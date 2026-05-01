import { world, system, BlockPermutation } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

// ==========================================
// 1. CONFIG & DATA
// ==========================================
const DATA_KEY = "admud_master_data";
const RTP_MIN_DIST = 1000; 
const RTP_MAX_DIST = 5000; 
const HEAL_RADIUS = 2; 

const INTERACTIVE_BLOCKS = ["minecraft:chest", "minecraft:ender_chest", "minecraft:barrel", "minecraft:trapped_chest", "minecraft:wooden_door", "minecraft:iron_door", "minecraft:trapdoor", "minecraft:lever", "minecraft:button", "minecraft:crafting_table", "minecraft:anvil", "minecraft:furnace", "minecraft:bed", "minecraft:gate", "minecraft:fence_gate", "minecraft:brewing_stand", "minecraft:hopper", "minecraft:dropper", "minecraft:dispenser", "minecraft:lectern"];

// DAFTAR LENGKAP MOB VANILLA AGAR TIDAK MENGHAPUS CUSTOM NPC
const BANNED_MOBS = [
    "minecraft:zombie", "minecraft:skeleton", "minecraft:creeper", "minecraft:spider", 
    "minecraft:ender_man", "minecraft:enderman", "minecraft:witch", "minecraft:phantom", 
    "minecraft:pillager", "minecraft:ravager", "minecraft:iron_golem", "minecraft:villager", 
    "minecraft:zombie_villager", "minecraft:wandering_trader", "minecraft:trader_llama", 
    "minecraft:llama", "minecraft:cat", "minecraft:ocelot", "minecraft:cow", "minecraft:sheep", 
    "minecraft:chicken", "minecraft:pig", "minecraft:horse", "minecraft:squid", 
    "minecraft:drowned", "minecraft:husk", "minecraft:stray", "minecraft:fox",
    "minecraft:bat", "minecraft:blaze", "minecraft:cave_spider", "minecraft:elder_guardian",
    "minecraft:ghast", "minecraft:guardian", "minecraft:magma_cube", "minecraft:shulker",
    "minecraft:silverfish", "minecraft:slime", "minecraft:wither_skeleton", "minecraft:zombified_piglin",
    "minecraft:piglin", "minecraft:piglin_brute", "minecraft:hoglin", "minecraft:zoglin",
    "minecraft:strider", "minecraft:vex", "minecraft:vindicator", "minecraft:evoker",
    "minecraft:warden", "minecraft:wither", "minecraft:bee", "minecraft:dolphin",
    "minecraft:donkey", "minecraft:frog", "minecraft:glow_squid", "minecraft:goat",
    "minecraft:mooshroom", "minecraft:mule", "minecraft:panda", "minecraft:parrot",
    "minecraft:polar_bear", "minecraft:rabbit", "minecraft:salmon", "minecraft:cod",
    "minecraft:pufferfish", "minecraft:tropical_fish", "minecraft:turtle", "minecraft:wolf",
    "minecraft:axolotl", "minecraft:camel", "minecraft:sniffer", "minecraft:tadpole",
    "minecraft:allay", "minecraft:breeze", "minecraft:bogged", "minecraft:armadillo",
    "minecraft:creaking", "minecraft:endermite", "minecraft:snow_golem"
];

// ==========================================
// DATA PERTANIAN UNTUK ANTI-TRAMPLE
// ==========================================
const CROP_DATA = {
    "minecraft:wheat": { state: "growth", maxVal: 7 },
    "minecraft:carrots": { state: "growth", maxVal: 7 },
    "minecraft:potatoes": { state: "growth", maxVal: 7 },
    "minecraft:beetroot": { state: "growth", maxVal: 7 },
    "minecraft:nether_wart": { state: "age", maxVal: 3 },
    "minecraft:melon_stem": { state: "growth", maxVal: 7 },
    "minecraft:pumpkin_stem": { state: "growth", maxVal: 7 },
    "minecraft:pitcher_crop": { state: "growth", maxVal: 4 },
    "minecraft:torchflower_crop": { state: "growth", maxVal: 2 }
};

const cropCache = new Map();

// ==========================================
// 2. SAFE WRAPPERS (ANTI-ERROR SYSTEM)
// ==========================================
function getPlayersSafe() {
    try { if (typeof world.getPlayers === 'function') return Array.from(world.getPlayers()); } catch(e) {}
    try { if (typeof world.getAllPlayers === 'function') return Array.from(world.getAllPlayers()); } catch(e) {}
    return [];
}

function isValidEntity(entity) {
    if (!entity) return false;
    if (typeof entity.isValid === 'function') return entity.isValid();
    try { const id = entity.typeId; return true; } catch(e) { return false; }
}

function removeEntitySafe(entity) {
    try {
        if (typeof entity.remove === 'function') { entity.remove(); return; }
        if (typeof entity.triggerEvent === 'function') { entity.triggerEvent("minecraft:despawn"); return; }
        if (typeof entity.kill === 'function') { entity.kill(); }
    } catch(e) {}
}

// ==========================================
// 3. HELPER FUNCTIONS & API
// ==========================================
export function getMasterData() {
    try {
        const raw = world.getDynamicProperty(DATA_KEY);
        if (!raw) return { areas: [], globalLobby: null };
        const data = JSON.parse(raw);
        data.areas = data.areas.map(a => {
            if (a.flags.portal === undefined) a.flags.portal = false;
            if (a.flags.explosions === undefined) a.flags.explosions = false;
            if (a.flags.break === undefined) a.flags.break = a.flags.build; 
            if (a.flags.liquids === undefined) a.flags.liquids = false; 
            if (a.flags.damage === undefined) a.flags.damage = false; 
            if (a.flags.fire === undefined) a.flags.fire = false; 
            if (a.flags.crops === undefined) a.flags.crops = true; 
            if (a.flags.hunger === undefined) a.flags.hunger = false; 
            return a;
        });
        return data;
    } catch (e) { return { areas: [], globalLobby: null }; }
}

export function saveMasterData(data) {
    try { world.setDynamicProperty(DATA_KEY, JSON.stringify(data)); } catch (e) {}
}

export function isAdminBypass(p) {
    return p.getDynamicProperty("admud:bypass_mode") === true;
}

export function toggleBypass(p) {
    const current = isAdminBypass(p);
    p.setDynamicProperty("admud:bypass_mode", !current);
    p.sendMessage(`§e[!] Mode Bypass: ${!current ? "§aAKTIF" : "§cMATI"}`);
    p.playSound("random.orb");
}

export function setGlobalLobby(p) {
    const data = getMasterData();
    const loc = { x: Math.floor(p.location.x), y: Math.floor(p.location.y), z: Math.floor(p.location.z) };
    saveMasterData({ areas: data.areas, globalLobby: loc });
    p.sendMessage("§a[!] Lobby Utama Diperbarui di posisi ini!");
}

function getAreaAt(loc) {
    if (!loc) return null;
    const data = getMasterData();
    const x = Math.floor(loc.x);
    const y = Math.floor(loc.y);
    const z = Math.floor(loc.z);
    let bestArea = null;
    let smallestVolume = Infinity;

    for (const a of data.areas) {
        if (!a.enabled || !a.min || !a.max) continue;
        if (x >= a.min.x && x <= a.max.x && y >= a.min.y && y <= a.max.y && z >= a.min.z && z <= a.max.z) {
            const vol = (a.max.x - a.min.x + 1) * (a.max.y - a.min.y + 1) * (a.max.z - a.min.z + 1);
            if (vol < smallestVolume) {
                smallestVolume = vol;
                bestArea = a;
            }
        }
    }
    return bestArea;
}

function instantHealArea(dimension, centerLoc) {
    const cx = Math.floor(centerLoc.x);
    const cy = Math.floor(centerLoc.y);
    const cz = Math.floor(centerLoc.z);
    const snapshot = [];
    
    for (let x = -HEAL_RADIUS; x <= HEAL_RADIUS; x++) {
        for (let y = -HEAL_RADIUS; y <= HEAL_RADIUS; y++) {
            for (let z = -HEAL_RADIUS; z <= HEAL_RADIUS; z++) {
                try {
                    const block = dimension.getBlock({ x: cx + x, y: cy + y, z: cz + z });
                    if (block) {
                        snapshot.push({
                            loc: { x: cx + x, y: cy + y, z: cz + z },
                            perm: typeof block.getPermutation === 'function' ? block.getPermutation() : block.permutation, 
                            type: block.typeId
                        });
                    }
                } catch (e) {}
            }
        }
    }

    system.runTimeout(() => {
        for (const record of snapshot) {
            try {
                const currentBlock = dimension.getBlock(record.loc);
                if (currentBlock && (currentBlock.typeId === "minecraft:air" || currentBlock.typeId !== record.type)) {
                    if (typeof currentBlock.setPermutation === 'function') currentBlock.setPermutation(record.perm);
                }
            } catch (e) {}
        }
    }, 5); 
}

// ==========================================
// 4. UI SYSTEMS
// ==========================================
export function openProtectionMenu(player) {
    const data = getMasterData();
    const isBypass = isAdminBypass(player);
    const bypassStatus = isBypass ? "§a[AKTIF]" : "§c[MATI]";

    const form = new ActionFormData()
        .title("§l§eZONE MANAGER")
        .button("§l§a[+] BUAT AREA BARU", "textures/ui/color_plus")
        .button(`§lAdmin Bypass: ${bypassStatus}\n§r§8(Abaikan Aturan Zona)`, "textures/ui/op");

    data.areas.forEach(a => form.button(`§l${a.name}\n${a.enabled ? "§aAKTIF" : "§cOFF"}`, a.enabled ? "textures/ui/realms_green_check" : "textures/ui/realms_red_x"));
    form.button("§c[ RESET SEMUA DATA ]", "textures/ui/trash_default");

    form.show(player).then(res => {
        if (res.canceled) return;
        if (res.selection === 0) createNewArea(player);
        else if (res.selection === 1) {
            toggleBypass(player);
            system.run(() => openProtectionMenu(player));
        }
        else if (res.selection === data.areas.length + 2) { 
            saveMasterData({ areas: [], globalLobby: data.globalLobby }); 
            player.sendMessage("§cSemua Zona dihapus."); 
        }
        else {
            openAreaEditMenu(player, data.areas[res.selection - 2]);
        }
    });
}

function createNewArea(player) {
    new ModalFormData().title("Area Baru").textField("Nama Area", "Contoh: Hub").show(player).then(res => {
        if (res.canceled || !res.formValues[0]) return;
        const data = getMasterData();
        data.areas.push({ 
            id: Date.now().toString(), name: res.formValues[0], enabled: true, p1: null, p2: null, min: null, max: null, lobby: null, 
            flags: { build: false, break: false, interact: true, pvp: false, mobs: false, pearls: false, bows: false, fishing: false, fireworks: false, lock: true, portal: false, explosions: false, liquids: false, damage: false, fire: false, crops: true, hunger: false } 
        });
        saveMasterData(data); openProtectionMenu(player);
    });
}

function openAreaEditMenu(player, area) {
    const data = getMasterData();
    const current = data.areas.find(a => a.id === area.id);
    if (!current) return;
    new ActionFormData().title(`§l§dEDIT: ${current.name}`)
        .button("§lFLAGS (Rules)", "textures/ui/settings_glyph_24n")
        .button("§lSET SPAWN ARENA", "textures/ui/spawn_point_glyph")
        .button(`§lSET POS 1`, "textures/ui/copy")
        .button(`§lSET POS 2`, "textures/ui/copy")
        .button("§l§cHAPUS AREA", "textures/ui/trash_default")
        .show(player).then(res => {
            if (res.canceled) return;
            const p = { x: Math.floor(player.location.x), y: Math.floor(player.location.y), z: Math.floor(player.location.z) };
            if (res.selection === 0) openFlagsMenu(player, current);
            else if (res.selection === 1) { const d = getMasterData(); const idx = d.areas.findIndex(a => a.id === current.id); d.areas[idx].lobby = p; saveMasterData(d); player.sendMessage("§aSpawn Diset."); openAreaEditMenu(player, d.areas[idx]); }
            else if (res.selection === 2) { const d = getMasterData(); const idx = d.areas.findIndex(a => a.id === current.id); d.areas[idx].p1 = p; saveMasterData(d); openAreaEditMenu(player, d.areas[idx]); }
            else if (res.selection === 3) {
                const d = getMasterData(); const idx = d.areas.findIndex(a => a.id === current.id); if (!d.areas[idx].p1) return;
                const p1 = d.areas[idx].p1; d.areas[idx].p2 = p;
                d.areas[idx].min = { x: Math.min(p1.x, p.x), y: Math.min(p1.y, p.y), z: Math.min(p1.z, p.z) };
                d.areas[idx].max = { x: Math.max(p1.x, p.x), y: Math.max(p1.y, p.y), z: Math.max(p1.z, p.z) };
                saveMasterData(d); player.sendMessage("§eTersimpan!"); openAreaEditMenu(player, d.areas[idx]);
            } else if (res.selection === 4) { const d = getMasterData(); d.areas = d.areas.filter(a => a.id !== current.id); saveMasterData(d); openProtectionMenu(player); }
        });
}

function openFlagsMenu(player, area) {
    const f = area.flags;
    new ModalFormData().title("Flags Manager")
        .toggle("IZINKAN KELUAR ZONA", { defaultValue: !f.lock }) 
        .toggle("IZINKAN PORTAL (Nether/End)", { defaultValue: !!f.portal })
        .toggle("IZINKAN TARUH BLOK (Build)", { defaultValue: !!f.build })
        .toggle("IZINKAN HANCUR BLOK (Break)", { defaultValue: !!f.break })
        .toggle("IZINKAN INTERAKSI BLOK", { defaultValue: !!f.interact })
        .toggle("IZINKAN PVP (Pukul Player)", { defaultValue: !!f.pvp })
        .toggle("IZINKAN MOB SPAWN", { defaultValue: !!f.mobs })
        .toggle("IZINKAN PEARL/WIND", { defaultValue: !!f.pearls })
        .toggle("IZINKAN PANAH (Bow)", { defaultValue: !!f.bows })
        .toggle("IZINKAN FISHING", { defaultValue: !!f.fishing })
        .toggle("IZINKAN FIREWORKS", { defaultValue: !!f.fireworks })
        .toggle("IZINKAN LEDAKAN (Explosions)", { defaultValue: !!f.explosions })
        .toggle("IZINKAN CAIRAN (Water/Lava)", { defaultValue: !!f.liquids }) 
        .toggle("IZINKAN PLAYER DAMAGE (Fall, dll)", { defaultValue: !!f.damage }) 
        .toggle("IZINKAN API & PETIR", { defaultValue: !!f.fire }) 
        .toggle("IZINKAN INJAK TANAMAN", { defaultValue: !f.crops }) 
        .toggle("IZINKAN KELAPARAN (Hunger)", { defaultValue: !!f.hunger }) 
        .show(player).then(res => {
            if (res.canceled) return;
            const data = getMasterData(); const idx = data.areas.findIndex(a => a.id === area.id);
            if (idx !== -1) {
                data.areas[idx].flags = { 
                    lock: !res.formValues[0], 
                    portal: res.formValues[1], 
                    build: res.formValues[2], 
                    break: res.formValues[3], 
                    interact: res.formValues[4], 
                    pvp: res.formValues[5], 
                    mobs: res.formValues[6], 
                    pearls: res.formValues[7], 
                    bows: res.formValues[8], 
                    fishing: res.formValues[9], 
                    fireworks: res.formValues[10], 
                    explosions: res.formValues[11], 
                    liquids: res.formValues[12], 
                    damage: res.formValues[13], 
                    fire: res.formValues[14],
                    crops: !res.formValues[15],
                    hunger: res.formValues[16]
                };
                saveMasterData(data);
            }
            openAreaEditMenu(player, data.areas[idx]);
        });
}

function drawZoneBorders(player) {
    const data = getMasterData();
    const pLoc = player.location;
    for (const area of data.areas) {
        if (!area.enabled || !area.min || !area.max) continue;
        const dist = Math.abs(area.min.x - pLoc.x);
        if (dist > 64) continue;
        const min = area.min;
        const max = { x: area.max.x + 1, y: area.max.y + 1, z: area.max.z + 1 };
        const particle = "minecraft:endrod"; 
        for (let x = min.x; x <= max.x; x += 2) {
            try { player.dimension.spawnParticle(particle, { x: x, y: min.y, z: min.z }); } catch(e){}
            try { player.dimension.spawnParticle(particle, { x: x, y: min.y, z: max.z }); } catch(e){}
            try { player.dimension.spawnParticle(particle, { x: x, y: max.y, z: min.z }); } catch(e){}
            try { player.dimension.spawnParticle(particle, { x: x, y: max.y, z: max.z }); } catch(e){}
        }
    }
}

// ==========================================
// 5. EVENT LISTENERS (ANTI DAMAGE, DLL)
// ==========================================
const safe = (event, cb) => { try { if (event) event.subscribe(cb); } catch(e) {} };

const damageCancelLogic = (e) => {
    const vic = e.hurtEntity || e.entity; 
    const att = e.damageSource ? e.damageSource.damagingEntity : null;

    if (vic && vic.typeId === "minecraft:player") {
        const a = getAreaAt(vic.location);
        if (a) {
            if (!a.flags.pvp && att && att.typeId === "minecraft:player") {
                if (!isAdminBypass(att)) {
                    e.cancel = true;
                    system.run(() => { try { att.onScreenDisplay.setActionBar("§c[!] Area Bebas PVP (Damai)!"); } catch(err){} });
                    return;
                }
            }
            if (!a.flags.damage) { e.cancel = true; }
        }
    }
};

safe(world.beforeEvents.entityDamage, damageCancelLogic);
safe(world.beforeEvents.entityHurt, damageCancelLogic);

safe(world.beforeEvents.playerChangeDimension, e => {
    if (isAdminBypass(e.player)) return;
    const a = getAreaAt(e.player.location);
    if (a && !a.flags.portal) { e.cancel = true; }
});

safe(world.beforeEvents.playerInteractWithBlock, e => {
    const p = e.player; if (isAdminBypass(p)) return;
    let faceX = 0, faceY = 0, faceZ = 0;
    if (e.blockFace === "Up") faceY = 1;
    if (e.blockFace === "Down") faceY = -1;
    if (e.blockFace === "North") faceZ = -1;
    if (e.blockFace === "South") faceZ = 1;
    if (e.blockFace === "West") faceX = -1;
    if (e.blockFace === "East") faceX = 1;

    const targetLoc = { x: e.block.location.x + faceX, y: e.block.location.y + faceY, z: e.block.location.z + faceZ };
    const a = getAreaAt(targetLoc) || getAreaAt(e.block.location);
    if (a) {
        const itemType = e.itemStack ? e.itemStack.typeId : "";
        if (itemType.includes("bucket")) {
            if (!a.flags.liquids || (!a.flags.build && itemType !== "minecraft:bucket")) {
                e.cancel = true; 
                system.run(() => { 
                    try { p.onScreenDisplay.setActionBar("§c[!] Area Anti-Cairan!"); } catch(err){}
                    try { 
                        const dim = p.dimension; const blk = dim.getBlock(targetLoc);
                        if (blk && (blk.typeId.includes("water") || blk.typeId.includes("lava") || blk.typeId === "minecraft:powder_snow")) blk.setType("minecraft:air");
                    } catch(err) {}
                });
                return;
            }
        }

        if (itemType.includes("flint_and_steel") || itemType.includes("fire_charge")) {
            if (!a.flags.fire) {
                e.cancel = true;
                system.run(() => { try { p.onScreenDisplay.setActionBar("§c[!] Area Anti-Api!"); } catch(err){} });
                return;
            }
        }

        const isInt = INTERACTIVE_BLOCKS.some(id => e.block.typeId.includes(id));
        const isInteractTool = itemType.includes("shovel") || itemType.includes("hoe") || itemType.includes("axe") || itemType.includes("bone_meal");
        
        if ((isInt || isInteractTool) && !a.flags.interact) { 
            e.cancel = true; 
            system.run(() => { try { p.onScreenDisplay.setActionBar("§c[!] Interaksi dilarang di area ini!"); } catch(err){} }); 
        }
    }
});

safe(world.beforeEvents.itemUseOn, e => {
    const p = e.source; if (isAdminBypass(p)) return;
    let faceX = 0, faceY = 0, faceZ = 0;
    if (e.blockFace === "Up") faceY = 1;
    if (e.blockFace === "Down") faceY = -1;
    if (e.blockFace === "North") faceZ = -1;
    if (e.blockFace === "South") faceZ = 1;
    if (e.blockFace === "West") faceX = -1;
    if (e.blockFace === "East") faceX = 1;

    const targetLoc = { x: e.block.location.x + faceX, y: e.block.location.y + faceY, z: e.block.location.z + faceZ };
    const a = getAreaAt(targetLoc) || getAreaAt(e.block.location);
    if (a) {
        const itemType = e.itemStack ? e.itemStack.typeId : "";
        if (itemType.includes("bucket")) {
            if (!a.flags.liquids || (!a.flags.build && itemType !== "minecraft:bucket")) {
                e.cancel = true; 
                system.run(() => { 
                    try { p.onScreenDisplay.setActionBar("§c[!] Area Anti-Cairan!"); } catch(err){}
                    try { 
                        const dim = p.dimension; const blk = dim.getBlock(targetLoc);
                        if (blk && (blk.typeId.includes("water") || blk.typeId.includes("lava") || blk.typeId === "minecraft:powder_snow")) blk.setType("minecraft:air");
                    } catch(err) {}
                });
                return;
            }
        }

        if (itemType.includes("flint_and_steel") || itemType.includes("fire_charge")) {
            if (!a.flags.fire) {
                e.cancel = true;
                system.run(() => { try { p.onScreenDisplay.setActionBar("§c[!] Area Anti-Api!"); } catch(err){} });
                return;
            }
        }
        
        // Cek Interaksi Menggunakan Item (Shovel, Hoe, Axe, Bone Meal)
        const isInteractTool = itemType.includes("shovel") || itemType.includes("hoe") || itemType.includes("axe") || itemType.includes("bone_meal");
        if (isInteractTool && !a.flags.interact) {
            e.cancel = true;
            system.run(() => { try { p.onScreenDisplay.setActionBar("§c[!] Interaksi dilarang di area ini!"); } catch(err){} });
            return;
        }

        if (!a.flags.mobs && itemType.includes("spawn_egg")) { e.cancel = true; return; }
        
        const buildItems = ["bone_meal"];
        if (!a.flags.build && buildItems.some(id => itemType.includes(id))) { e.cancel = true; return; }
    }
});

safe(world.beforeEvents.itemUse, e => {
    const p = e.source; if (e.itemStack && e.itemStack.typeId === "minecraft:diamond" && p.hasTag("admin")) return;
    if (isAdminBypass(p)) return;
    const a = getAreaAt(p.location);
    if (a) {
        const id = e.itemStack ? e.itemStack.typeId : ""; const f = a.flags;
        if (id.includes("bucket")) {
            if (!f.liquids || (!f.build && id !== "minecraft:bucket")) {
                e.cancel = true; 
                system.run(() => { try { p.onScreenDisplay.setActionBar("§c[!] Area Anti-Cairan!"); } catch(err){} });
                return;
            }
        }

        if (id.includes("flint_and_steel") || id.includes("fire_charge")) {
            if (!f.fire) {
                e.cancel = true; 
                system.run(() => { try { p.onScreenDisplay.setActionBar("§c[!] Area Anti-Api!"); } catch(err){} });
                return;
            }
        }

        if (f.lock && id.includes("chorus_fruit")) {
            e.cancel = true; 
            system.run(() => { 
                try { p.onScreenDisplay.setActionBar("§c[!] Forcefield: Usaha teleport ditolak!"); } catch(err){} 
                try { p.playSound("item.shield.block"); } catch(err){} 
            });
            return;
        }

        if (((id.includes("pearl") || id.includes("wind_charge")) && !f.pearls) || (id.includes("firework") && !f.fireworks) || ((id.includes("bow") || id.includes("crossbow")) && !f.bows) || (id.includes("fishing_rod") && !f.fishing)) {
            e.cancel = true; 
            system.run(() => { try { p.onScreenDisplay.setActionBar("§c[!] Item dilarang disini!"); } catch(err){} });
        }
    }
});

safe(world.beforeEvents.explosion, e => {
    let allowedBlocks = [];
    const impacted = typeof e.getImpactedBlocks === 'function' ? e.getImpactedBlocks() : (e.impactedBlocks || []);
    for (const block of impacted) {
        const a = getAreaAt(block.location);
        if (a && !a.flags.explosions) continue; 
        allowedBlocks.push(block);
    }
    if (typeof e.setImpactedBlocks === 'function') e.setImpactedBlocks(allowedBlocks);
});

// ===== INI DIA FITUR BLOCK BREAK/PLACE YANG KEMBALI! =====
safe(world.beforeEvents.playerBreakBlock, e => {
    if (isAdminBypass(e.player)) return;
    const a = getAreaAt(e.block.location);
    if (a && !a.flags.break) { 
        e.cancel = true; 
        instantHealArea(e.player.dimension, e.block.location);
        system.run(() => { 
            try { e.player.onScreenDisplay.setActionBar("§c[!] Dilarang menghancurkan blok!"); } catch(err){}
            try { e.player.dimension.spawnParticle("minecraft:basic_smoke_particle", e.block.location); } catch(err){}
        }); 
    }
});

safe(world.beforeEvents.playerPlaceBlock, e => {
    if (isAdminBypass(e.player)) return;
    const a = getAreaAt(e.block.location);
    if (a && !a.flags.build) { 
        e.cancel = true; 
        system.run(() => { 
            try { e.player.onScreenDisplay.setActionBar("§c[!] Dilarang menaruh blok!"); } catch(err){}
            try { e.player.dimension.spawnParticle("minecraft:basic_smoke_particle", e.block.location); } catch(err){}
        }); 
    }
});

// ==========================================
// [LOGIKA BARU] MEMBATALKAN DROP ITEM & AUTO REPLANT SESUAI UMUR ASLI
// ==========================================
world.afterEvents.playerBreakBlock.subscribe((e) => {
    const blockId = e.brokenBlockPermutation.type.id;
    if (CROP_DATA[blockId]) {
        const a = getAreaAt(e.block.location);
        if (a && a.flags.crops) { 
            const stateProp = e.brokenBlockPermutation.getState(CROP_DATA[blockId].state);
            const growthLvl = typeof stateProp === "number" ? stateProp : 0;
            
            system.run(() => {
                const dim = e.dimension;
                const loc = e.block.location;
                
                const droppedItems = dim.getEntities({ location: loc, maxDistance: 2, type: "minecraft:item" });
                for (const item of droppedItems) {
                    try { item.remove(); } catch(err) {}
                }
                
                const floorBlock = dim.getBlock({ x: loc.x, y: loc.y - 1, z: loc.z });
                if (floorBlock && floorBlock.typeId === "minecraft:dirt") floorBlock.setType("minecraft:farmland");
                
                const currentBlock = dim.getBlock(loc);
                if (currentBlock && currentBlock.typeId === "minecraft:air") {
                    try {
                        const newPerm = BlockPermutation.resolve(blockId, { [CROP_DATA[blockId].state]: growthLvl });
                        currentBlock.setPermutation(newPerm);
                        dim.runCommandAsync(`playsound use.crop @a[x=${loc.x},y=${loc.y},z=${loc.z},r=5] ~ ~ ~ 1 1`);
                        try { e.player.onScreenDisplay.setActionBar("§a[!] Tanaman dilindungi (Auto Replant)!"); } catch(err){}
                    } catch(err) {
                        currentBlock.setType(blockId);
                    }
                }
            });
        }
    }
});

world.afterEvents.entitySpawn.subscribe((e) => {
    if (e.entity.typeId === "minecraft:item") {
        const a = getAreaAt(e.entity.location);
        if (a && a.flags.crops) {
            system.run(() => {
                try {
                    const itemComp = e.entity.getComponent("item");
                    if (itemComp && itemComp.itemStack) {
                        const id = itemComp.itemStack.typeId;
                        if (id.includes("seeds") || id.includes("wheat") || id.includes("carrot") || id.includes("potato") || id.includes("beetroot") || id.includes("nether_wart")) {
                            const loc = e.entity.location;
                            const dim = e.entity.dimension;
                            
                            e.entity.remove(); 
                            
                            const cropLoc = { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
                            const airBlock = dim.getBlock(cropLoc);
                            
                            if (airBlock && airBlock.typeId === "minecraft:air") {
                                const floorBlock = dim.getBlock({ x: cropLoc.x, y: cropLoc.y - 1, z: cropLoc.z });
                                
                                if (floorBlock && (floorBlock.typeId === "minecraft:farmland" || floorBlock.typeId === "minecraft:dirt")) {
                                    floorBlock.setType("minecraft:farmland"); 
                                    
                                    const cacheKey = `${cropLoc.x}_${cropLoc.y}_${cropLoc.z}_${dim.id}`;
                                    const cachedData = cropCache.get(cacheKey);

                                    if (cachedData) {
                                        const newPerm = BlockPermutation.resolve(cachedData.id, { [cachedData.stateName]: cachedData.val });
                                        airBlock.setPermutation(newPerm);
                                        cropCache.delete(cacheKey); 
                                    } else {
                                        let cropToPlant = "";
                                        let stateName = "growth";
                                        if (id.includes("wheat")) { cropToPlant = "minecraft:wheat"; }
                                        else if (id.includes("carrot")) { cropToPlant = "minecraft:carrots"; }
                                        else if (id.includes("potato")) { cropToPlant = "minecraft:potatoes"; }
                                        else if (id.includes("beetroot")) { cropToPlant = "minecraft:beetroot"; }
                                        else if (id.includes("nether_wart")) { cropToPlant = "minecraft:nether_wart"; stateName = "age"; floorBlock.setType("minecraft:soul_sand"); }
                                        else if (id.includes("melon")) { cropToPlant = "minecraft:melon_stem"; }
                                        else if (id.includes("pumpkin")) { cropToPlant = "minecraft:pumpkin_stem"; }
                                        
                                        if (cropToPlant !== "") {
                                            const newPerm = BlockPermutation.resolve(cropToPlant, { [stateName]: 0 }); 
                                            airBlock.setPermutation(newPerm);
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch(err) {}
            });
        }
    }
});

// ==========================================
// 6. MAIN LOOP (BOUNCING FORCEFIELD & CLEANERS)
// ==========================================
system.runInterval(() => {
    try {
        const overworld = world.getDimension("overworld");
        const currentTick = system.currentTick;
        const data = getMasterData();
        
        const dimensions = ["overworld", "nether", "the_end"];
        for (const dimName of dimensions) {
            try {
                const dim = world.getDimension(dimName);
                const pearls = dim.getEntities({ type: "minecraft:ender_pearl" });
                for (const pearl of pearls) {
                    if (!isValidEntity(pearl)) continue;
                    if (!pearl.hasTag("pearl_checked")) { pearl.addTag("pearl_checked"); continue; }
                    const proj = pearl.getComponent("minecraft:projectile");
                    if (proj && proj.owner && proj.owner.typeId === "minecraft:player") {
                        const owner = proj.owner;
                        const ownerArea = getAreaAt(owner.location);
                        if (ownerArea && ownerArea.flags.lock) {
                            const loc = pearl.location;
                            const a = ownerArea;
                            const m = 1.0; 
                            const isInside = (loc.x >= a.min.x - m && loc.x <= a.max.x + m && loc.y >= a.min.y - m && loc.y <= a.max.y + m && loc.z >= a.min.z - m && loc.z <= a.max.z + m);
                            if (!isInside) {
                                removeEntitySafe(pearl); 
                                try { owner.onScreenDisplay.setActionBar("§c[!] Forcefield: Ender Pearl menabrak batas zona!"); owner.playSound("random.break"); owner.runCommandAsync("give @s ender_pearl 1"); } catch(e) {}
                            }
                        }
                    }
                }
            } catch(e) {}
        }
        
        const players = getPlayersSafe();
        for (const player of players) {
            if (!isValidEntity(player)) continue;
            if (isAdminBypass(player) && currentTick % 10 === 0) drawZoneBorders(player);

            const area = getAreaAt(player.location);
            let lastZoneId;
            try { lastZoneId = player.getDynamicProperty("admud:last_zone"); } catch(e){}

            // ========================================================
            // [LOGIKA ANTI KELAPARAN (HUNGER)] Berjalan tiap 1 detik
            // ========================================================
            if (area && !area.flags.hunger && currentTick % 20 === 0) {
                try {
                    player.addEffect("saturation", 40, { amplifier: 10, showParticles: false });
                } catch(e) {}
            }

            if (area && area.flags.crops && currentTick % 5 === 0) {
                const px = Math.floor(player.location.x);
                const py = Math.floor(player.location.y);
                const pz = Math.floor(player.location.z);
                const dim = player.dimension;
                
                const blocksToCheck = [
                    dim.getBlock({ x: px, y: py, z: pz }),
                    dim.getBlock({ x: px, y: py - 1, z: pz })
                ];

                blocksToCheck.forEach(b => {
                    if (b && CROP_DATA[b.typeId]) {
                        const stateVal = b.permutation.getState(CROP_DATA[b.typeId].state);
                        cropCache.set(`${b.location.x}_${b.location.y}_${b.location.z}_${dim.id}`, {
                            id: b.typeId,
                            stateName: CROP_DATA[b.typeId].state,
                            val: typeof stateVal === "number" ? stateVal : 0,
                            time: Date.now()
                        });
                    }
                });
            }

            if (currentTick % 5 === 0) {
                const px = Math.floor(player.location.x);
                const py = Math.floor(player.location.y);
                const pz = Math.floor(player.location.z);
                const dim = player.dimension;
                const r = 15; 

                for (const a of data.areas) {
                    if (!a.enabled || !a.min || !a.max) continue;
                    if (px >= a.min.x - 22 && px <= a.max.x + 22 && py >= a.min.y - 22 && py <= a.max.y + 22 && pz >= a.min.z - 22 && pz <= a.max.z + 22) {
                        const x1 = Math.max(px - r, a.min.x); const y1 = Math.max(Math.max(py - r, a.min.y), -64); const z1 = Math.max(pz - r, a.min.z);
                        const x2 = Math.min(px + r, a.max.x); const y2 = Math.min(Math.min(py + r, a.max.y), 319); const z2 = Math.min(pz + r, a.max.z);

                        if (x1 <= x2 && y1 <= y2 && z1 <= z2) {
                            if (!a.flags.fire) { try { dim.runCommandAsync(`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} air replace fire`); } catch(e){} }
                            if (!a.flags.liquids) {
                                try { dim.runCommandAsync(`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} air replace lava`); } catch(e){}
                                try { dim.runCommandAsync(`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} air replace water`); } catch(e){}
                                try { dim.runCommandAsync(`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} air replace flowing_lava`); } catch(e){}
                                try { dim.runCommandAsync(`fill ${x1} ${y1} ${z1} ${x2} ${y2} ${z2} air replace flowing_water`); } catch(e){}
                            }
                        }
                    }
                }
            }

            if (area) {
                try {
                    player.setDynamicProperty("admud:last_zone", area.id);
                    player.setDynamicProperty("admud:last_loc_x", player.location.x);
                    player.setDynamicProperty("admud:last_loc_y", player.location.y);
                    player.setDynamicProperty("admud:last_loc_z", player.location.z);
                } catch(e){}

                if (!area.flags.portal && !isAdminBypass(player)) {
                    try {
                        const block = player.dimension.getBlock(player.location);
                        if (block && (block.typeId === "minecraft:portal" || block.typeId === "minecraft:end_portal")) {
                            if (area.lobby) player.teleport(area.lobby, { dimension: overworld });
                            else {
                                if (data.globalLobby) player.teleport(data.globalLobby, { dimension: overworld });
                                else player.teleport({ x: player.location.x + 3, y: player.location.y, z: player.location.z + 3 }, { dimension: overworld });
                            }
                            try { player.onScreenDisplay.setActionBar("§c[!] PORTAL DIKUNCI ADMIN!"); } catch(e){}
                        }
                    } catch(e) {}
                }

                try {
                    const entities = player.dimension.getEntities({ location: player.location, maxDistance: 80 });
                    for (const ent of entities) {
                        if (!isValidEntity(ent)) continue;
                        const t = ent.typeId;
                        if (t === "minecraft:lightning_bolt") { if (!area.flags.fire) { removeEntitySafe(ent); continue; } }
                        const isProjectile = t.includes("pearl") || t.includes("arrow") || t.includes("firework") || t.includes("wind_charge") || t.includes("snowball");
                        if (isProjectile) {
                            let r = false;
                            if (t.includes("firework") && !area.flags.fireworks) r = true;
                            if (t.includes("arrow") && !area.flags.bows) r = true;
                            if ((t.includes("pearl") || t.includes("wind_charge")) && !area.flags.pearls) r = true;
                            if (r) removeEntitySafe(ent);
                            continue;
                        }
                        if (!area.flags.mobs && (BANNED_MOBS.includes(t) || t.includes("trader"))) { removeEntitySafe(ent); continue; }
                    }
                } catch(e) {}
            } 
            else if (lastZoneId) {
                const lastArea = data.areas.find(z => z.id === lastZoneId);
                if (lastArea) {
                    if (isAdminBypass(player)) {
                        try { player.setDynamicProperty("admud:last_zone", undefined); player.onScreenDisplay.setActionBar("§e[!] Keluar Zona (Bypass ON)"); } catch(e){}
                    } 
                    else if (lastArea.flags.lock) { 
                        let lx = player.location.x; let ly = player.location.y; let lz = player.location.z;
                        try {
                            lx = player.getDynamicProperty("admud:last_loc_x") || player.location.x;
                            ly = player.getDynamicProperty("admud:last_loc_y") || player.location.y;
                            lz = player.getDynamicProperty("admud:last_loc_z") || player.location.z;
                        } catch(e){}
                        const dx = player.location.x - lx; const dy = player.location.y - ly; const dz = player.location.z - lz;
                        const distMoved = Math.sqrt(dx*dx + dy*dy + dz*dz);

                        if (distMoved > 8) {
                            try { player.setDynamicProperty("admud:last_zone", undefined); } catch(e){}
                        } else {
                            try {
                                const cX = (lastArea.min.x + lastArea.max.x) / 2; const cZ = (lastArea.min.z + lastArea.max.z) / 2;
                                let dirX = cX - player.location.x; let dirZ = cZ - player.location.z;
                                const distToCenter = Math.sqrt(dirX*dirX + dirZ*dirZ);
                                
                                if (distMoved > 2.5) { player.teleport({ x: lx, y: ly, z: lz }, { dimension: player.dimension }); } 
                                else {
                                    if (distToCenter > 0) { dirX /= distToCenter; dirZ /= distToCenter; }
                                    player.applyKnockback(dirX, dirZ, 1.5, 0.4);
                                }
                                player.playSound("item.shield.block");
                                player.onScreenDisplay.setActionBar("§c[!] Forcefield: Kamu tidak bisa keluar!");
                            } catch(e){}
                        }
                    } else {
                        try { player.setDynamicProperty("admud:last_zone", undefined); } catch(e){}
                    }
                }
            }
        }

        if (currentTick % 20 === 0) {
            const nowTime = Date.now();
            for (const [key, value] of cropCache.entries()) {
                if (nowTime - value.time > 2000) {
                    cropCache.delete(key);
                }
            }
        }

    } catch(err) {}
}, 1);

system.runInterval(() => {
    try {
        const players = getPlayersSafe();
        if (players.length === 0) return;

        const dim = world.getDimension("overworld");
        for (const mobType of BANNED_MOBS) {
            try {
                const mobs = dim.getEntities({ type: mobType });
                for (const mob of mobs) {
                    if (!isValidEntity(mob)) continue;
                    const area = getAreaAt(mob.location);
                    if (area && !area.flags.mobs) removeEntitySafe(mob);
                }
            } catch(e) {}
        }
    } catch(err) {}
}, 60);