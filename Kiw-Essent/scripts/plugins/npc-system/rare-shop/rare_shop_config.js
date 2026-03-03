import { world } from "@minecraft/server";

const DEFAULT_CONFIG = {
    rarities: {
        "COMMON": { color: "§f", display: "Common", value: 1 },
        "UNCOMMON": { color: "§a", display: "Uncommon", value: 2 },
        "RARE": { color: "§b", display: "Rare", value: 3 },
        "EPIC": { color: "§5", display: "Epic", value: 4 },
        "LEGENDARY": { color: "§6", display: "Legendary", value: 5 },
        "MYTHIC": { color: "§d", display: "Mythic", value: 6 }
    },
    items: [
        {
            id: "minecraft:elytra",
            name: "Ancient Wings",
            price: 100000,
            rarity: "LEGENDARY",
            texture: "textures/items/elytra",
            description: "Wings found in the End Cities.",
            amount: 1
        },
        {
            id: "minecraft:nether_star",
            name: "Star of the Void",
            price: 500000,
            rarity: "MYTHIC",
            texture: "textures/items/nether_star",
            description: "A powerful star dropped by the Wither.",
            amount: 1
        }
    ]
};

export const RareShopConfig = {
    get: () => {
        try {
            const data = world.getDynamicProperty("rare_shop_config");
            return data ? JSON.parse(data) : DEFAULT_CONFIG;
        } catch (e) {
            console.warn("Failed to load rare shop config:", e);
            return DEFAULT_CONFIG;
        }
    },
    save: (config) => {
        try {
            world.setDynamicProperty("rare_shop_config", JSON.stringify(config));
            return true;
        } catch (e) {
            console.warn("Failed to save rare shop config:", e);
            return false;
        }
    }
};
