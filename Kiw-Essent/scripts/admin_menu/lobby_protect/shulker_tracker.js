import { world, system, ItemStack, ItemComponentTypes, EnchantmentTypes } from "@minecraft/server";

const SHULKER_CONFIG_KEY = "shulker_tracker:config";

const getShulkerConfig = () => {
    try {
        const raw = world.getDynamicProperty(SHULKER_CONFIG_KEY);
        return raw ? JSON.parse(raw) : { enabled: false };
    } catch { return { enabled: false }; }
};

export const saveShulkerConfig = (config) => {
    try { world.setDynamicProperty(SHULKER_CONFIG_KEY, JSON.stringify(config)); return true; } catch { return false; }
};

export const isShulkerTrackingEnabled = () => getShulkerConfig().enabled === true;
export { getShulkerConfig };

const PLAYER_SHULKER_KEY = "shulker:held_id";
const WORLD_SHULKER_PREFIX = "shulker_db:";

// Use world dynamic properties instead of entity (works globally)
export const saveShulkerToDB = (contents, player, existingId = null) => {
    if (!contents?.length) return null;
    const id = existingId || generateUUID();
    try {
        const json = JSON.stringify(contents);
        world.setDynamicProperty(WORLD_SHULKER_PREFIX + id, json);
        return id;
    } catch { return null; }
};

export const loadShulkerFromDB = (id, player) => {
    if (!id) return [];
    try {
        const raw = world.getDynamicProperty(WORLD_SHULKER_PREFIX + id);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
};

const generateUUID = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16); });

export const generateShulkerLore = (contents, dbId) => {
    const lore = ["§r§9Items"];
    for (const item of (contents || []).slice(0, 5)) { const name = item.name || item.typeId.replace("minecraft:", "").split("_").map(w => w[0].toUpperCase() + w.slice(1)).join(" "); lore.push(`§7${name} x${item.amount}`); }
    if (contents?.length > 5) lore.push(`§7§o...+${contents.length - 5} more`);
    lore.push(`§8ID:${dbId}`);
    return lore;
};

const isShulkerBox = id => id?.includes("shulker_box");
const getBlockKey = (loc, dimId) => `${Math.floor(loc.x)},${Math.floor(loc.y)},${Math.floor(loc.z)},${dimId}`;
const extractIdFromLore = lore => { if (!lore) return null; for (const l of lore) { const c = l.replace(/§./g, ""); if (c.startsWith("ID:")) return c.substring(3); } return null; };

const serializeItem = item => {
    if (!item) return null;
    const data = { typeId: item.typeId, amount: item.amount };
    if (item.nameTag) data.name = item.nameTag;
    const lore = item.getLore(); if (lore?.length) data.lore = lore;
    const dur = item.getComponent(ItemComponentTypes.Durability);
    if (dur?.maxDurability > 0) data.durability = { max: dur.maxDurability, damage: dur.damage };
    const enc = item.getComponent(ItemComponentTypes.Enchantable)?.getEnchantments();
    if (enc?.length) data.enchantments = enc.map(e => ({ id: e.type?.id || "unknown", level: e.level || 1 }));
    return data;
};

const applyItemData = (item, data) => {
    if (!data) return;
    if (data.name) item.nameTag = data.name;
    if (data.lore?.length) item.setLore(data.lore);
    if (data.durability) { const dur = item.getComponent(ItemComponentTypes.Durability); if (dur) try { dur.damage = Math.min(data.durability.damage, dur.maxDurability); } catch { } }
    if (data.enchantments?.length) { const enc = item.getComponent(ItemComponentTypes.Enchantable); if (enc?.addEnchantment) for (const e of data.enchantments) { try { const type = EnchantmentTypes.get(e.id); if (type) enc.addEnchantment({ type, level: e.level || 1 }); } catch { } } }
};

export const readShulkerBlockContents = block => {
    if (!block || !isShulkerBox(block.typeId)) return [];
    try {
        const container = block.getComponent("minecraft:inventory")?.container;
        if (!container) return [];
        const items = [];
        for (let i = 0; i < container.size; i++) { const item = container.getItem(i); if (item) items.push({ ...serializeItem(item), s: i }); }
        return items;
    } catch { return []; }
};

const readShulkerItemContents = (item, player) => {
    try {
        const dim = player.dimension, loc = player.location;
        const minH = dim.heightRange?.min ?? -64, maxH = dim.heightRange?.max ?? 320;
        let targetY = Math.floor(loc.y) + 5;
        if (targetY >= maxH) targetY = Math.floor(loc.y) - 5;
        if (targetY < minH) targetY = minH + 5;
        const block = dim.getBlock({ x: Math.floor(loc.x), y: targetY, z: Math.floor(loc.z) });
        if (!block) return [];
        const originalPerm = block.permutation, originalType = block.typeId;
        block.setType(item.typeId);
        const contents = readShulkerBlockContents(block);
        try { if (originalPerm) block.setPermutation(originalPerm); else block.setType(originalType || "minecraft:air"); } catch { block.setType("minecraft:air"); }
        return contents;
    } catch { return []; }
};

export const placedShulkerContents = new Map();
const pendingIdGeneration = new Map();

// Track held shulker and auto-generate ID if missing
system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        try {
            const inv = player.getComponent(ItemComponentTypes.Inventory)?.container;
            const slotIndex = player.selectedSlotIndex;
            const item = inv?.getItem(slotIndex);
            const currentStored = player.getDynamicProperty(PLAYER_SHULKER_KEY);

            if (item && isShulkerBox(item.typeId)) {
                const lore = item.getLore();
                const existingId = extractIdFromLore(lore);

                if (existingId) {
                    if (currentStored !== existingId) player.setDynamicProperty(PLAYER_SHULKER_KEY, existingId);
                } else if (isShulkerTrackingEnabled()) {
                    const playerKey = player.id + ":" + slotIndex;
                    if (!pendingIdGeneration.has(playerKey)) pendingIdGeneration.set(playerKey, { player, slotIndex, timestamp: Date.now() });
                    if (currentStored) player.setDynamicProperty(PLAYER_SHULKER_KEY, undefined);
                } else {
                    if (currentStored) player.setDynamicProperty(PLAYER_SHULKER_KEY, undefined);
                }
            } else {
                if (currentStored) player.setDynamicProperty(PLAYER_SHULKER_KEY, undefined);
            }
        } catch { }
    }
}, 10);

// Process pending ID generation
system.runInterval(() => {
    for (const [key, data] of pendingIdGeneration.entries()) {
        try {
            const { player, slotIndex, timestamp } = data;
            if (Date.now() - timestamp < 500) continue;

            const inv = player.getComponent(ItemComponentTypes.Inventory)?.container;
            const item = inv?.getItem(slotIndex);

            if (!item || !isShulkerBox(item.typeId)) { pendingIdGeneration.delete(key); continue; }
            if (!isShulkerTrackingEnabled()) { pendingIdGeneration.delete(key); continue; }

            const existingId = extractIdFromLore(item.getLore());
            if (existingId) { pendingIdGeneration.delete(key); continue; }

            const contents = readShulkerItemContents(item, player);

            if (contents?.length) {
                const newId = saveShulkerToDB(contents, player);
                if (newId) {
                    const newItem = new ItemStack(item.typeId, item.amount);
                    if (item.nameTag) newItem.nameTag = item.nameTag;
                    const enc = item.getComponent(ItemComponentTypes.Enchantable)?.getEnchantments();
                    if (enc?.length) { const e = newItem.getComponent(ItemComponentTypes.Enchantable); if (e) for (const en of enc) { try { const type = EnchantmentTypes.get(en.type.id); if (type) e.addEnchantment({ type, level: en.level }); } catch { } } }
                    newItem.setLore(generateShulkerLore(contents, newId));
                    inv.setItem(slotIndex, newItem);
                    player.setDynamicProperty(PLAYER_SHULKER_KEY, newId);
                }
            }

            pendingIdGeneration.delete(key);
        } catch { pendingIdGeneration.delete(key); }
    }
}, 20);

world.afterEvents.playerPlaceBlock.subscribe(e => {
    if (!isShulkerBox(e.block.typeId)) return;
    system.run(() => {
        const key = getBlockKey(e.block.location, e.block.dimension.id);
        const dbId = e.player.getDynamicProperty(PLAYER_SHULKER_KEY);
        if (dbId) {
            e.player.setDynamicProperty(PLAYER_SHULKER_KEY, undefined);
            const contents = loadShulkerFromDB(dbId, e.player);
            if (contents?.length) { const container = e.block.getComponent("minecraft:inventory")?.container; if (container) for (const entry of contents) { try { const item = new ItemStack(entry.typeId, entry.amount); applyItemData(item, entry); if (typeof entry.s === "number" && entry.s >= 0 && entry.s < container.size) container.setItem(entry.s, item); } catch { } } }
        }
        placedShulkerContents.set(key, { contents: readShulkerBlockContents(e.block), typeId: e.block.typeId, originalId: dbId, lastUpdate: Date.now() });
    });
});

world.beforeEvents.playerBreakBlock.subscribe(e => {
    const block = e.block;
    if (!isShulkerBox(block.typeId)) return;

    const contents = readShulkerBlockContents(block);
    if (!contents.length) return;

    const key = getBlockKey(block.location, block.dimension.id);
    const cached = placedShulkerContents.get(key);
    const existingId = cached?.originalId || null;

    if (!isShulkerTrackingEnabled()) return;
    const dbId = saveShulkerToDB(contents, e.player, existingId);

    if (dbId) {
        placedShulkerContents.set(key, { contents, typeId: block.typeId, broken: true, originalId: dbId, lastUpdate: Date.now() });
        e.cancel = true;
        system.run(() => {
            try {
                let item = new ItemStack(block.typeId, 1);
                block.setType("minecraft:air");
                item.setLore(generateShulkerLore(contents, dbId));
                e.player.dimension.spawnItem(item, { x: block.location.x + 0.5, y: block.location.y + 0.5, z: block.location.z + 0.5 });
                e.player.runCommand("playsound random.break @a[r=10]");
            } catch { }
        });
    }
});

system.runInterval(() => { const now = Date.now(); for (const [k, v] of placedShulkerContents.entries()) if (now - v.lastUpdate > 3600000) placedShulkerContents.delete(k); }, 6000);
