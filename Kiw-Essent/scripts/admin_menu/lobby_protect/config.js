import { world } from "../../core.js";

const KEYS = {
    CONFIG: "lobby_protection_config",
    REGIONS: "lobby_protected_regions",
    REGION_PREFIX: "lobby_region_"
};

const BASE_PROTECTION = {
    blockBreakProtection: true,
    blockPlaceProtection: true,
    interactionProtection: true,
    farmlandProtection: false,
    itemUseProtection: true,
    pvpProtection: true,
    mobSpawnProtection: true,
    explosionProtection: true,
    visualizeOnEnter: true,
    notifyOnEnter: true,
    playSounds: true,
    showParticles: true,
    fireProtection: true,
    antiFly: false,
    antiSpamEnabled: true,
    antiSpamCooldown: 2,
    adminBypassEnabled: true,
    adminTag: "admin",
    protectedDimensions: ["overworld", "nether"],
    excludedEntities: [
        "minecraft:player", "minecraft:npc", "minecraft:egg", "minecraft:item",
        "minecraft:arrow", "minecraft:experience_bottle", "minecraft:enderman",
        "minecraft:ender_dragon", "minecraft:end_crystal",
        "xp_orb", "minecraft:painting", "add:floating_text", "add:*"
    ],
    maxPlayersPerBatch: 20,
    regionCacheDuration: 2000,
    effectBatchSize: 20,
    particleBatchSize: 15,
    teleportBatchSize: 10,
    cleanupInterval: 500,
    messageBatchSize: 25,
    entitySpawnBatchSize: 30
};

const DEFAULTS = {
    main: Object.freeze({
        enabled: true,
        fireSpreadProtection: true,
        itemDropProtection: true,
        lobbyInventoryEnabled: false,
        maxPlayersPerBatch: 20,
        regionCacheDuration: 2000,
        effectBatchSize: 20,
        particleBatchSize: 15,
        teleportBatchSize: 10,
        cleanupInterval: 500,
        messageBatchSize: 25,
        entitySpawnBatchSize: 30,
        performanceMonitoring: true,
        highPlayerThreshold: 50,
        ...BASE_PROTECTION
    }),
    region: Object.freeze({
        ...BASE_PROTECTION,
        maxParticlesPerVisualization: 50,
        particleStep: 8,
        batchProcessingEnabled: true,
        maxPlayersPerBatch: 20,
        regionCacheDuration: 2000,
        effectBatchSize: 20,
        particleBatchSize: 15,
        teleportBatchSize: 10,
        cleanupInterval: 500,
        messageBatchSize: 25,
        entitySpawnBatchSize: 30,
        lobbyInventoryEnabled: false
    })
};

const parseJSON = (str, fallback) => {
    try { return JSON.parse(str) || fallback; }
    catch { return fallback; }
};

const saveConfig = (key, config) => {
    try {
        world.setDynamicProperty(key, JSON.stringify(config));
        return true;
    } catch { return false; }
};

const loadConfig = (key, defaults) => {
    const saved = world.getDynamicProperty(key);
    return saved ? { ...defaults, ...parseJSON(saved, {}) } : { ...defaults };
};

export const getLobbyConfig = () => loadConfig(KEYS.CONFIG, DEFAULTS.main);
export const saveLobbyConfig = (config) => saveConfig(KEYS.CONFIG, config);

export const getProtectedRegions = () => parseJSON(world.getDynamicProperty(KEYS.REGIONS), []);
export const saveProtectedRegions = (regions) => saveConfig(KEYS.REGIONS, regions);

export const getRegionConfig = (regionId) => {
    const key = `${KEYS.REGION_PREFIX}${regionId}_config`;
    return loadConfig(key, DEFAULTS.region);
};

export const saveRegionConfig = (regionId, config) => {
    const key = `${KEYS.REGION_PREFIX}${regionId}_config`;
    return saveConfig(key, config);
};

let regionCache = new Map();
let lastRegionCacheUpdate = 0;
const REGION_CACHE_DURATION = 2000;

export const isInProtectedRegion = (position, dimensionId = null) => {
    const now = Date.now();

    if (now - lastRegionCacheUpdate > REGION_CACHE_DURATION) {
        regionCache.clear();
        const regions = getProtectedRegions();
        regions.forEach(region => {
            const key = `${region.pos1.x},${region.pos1.y},${region.pos1.z},${region.pos2.x},${region.pos2.y},${region.pos2.z}`;
            regionCache.set(key, region);
        });
        lastRegionCacheUpdate = now;
    }

    // Extract dimension name if full ID provided (e.g., "minecraft:the_end" -> "the_end")
    const dimName = dimensionId ? dimensionId.split(":")[1] || dimensionId : null;

    for (const [key, region] of regionCache) {
        const [x1, y1, z1, x2, y2, z2] = key.split(',').map(Number);

        if (position.x < x1 || position.x > x2 ||
            position.y < y1 || position.y > y2 ||
            position.z < z1 || position.z > z2) {
            continue;
        }

        // If dimension is provided, check if this dimension is protected for this region
        if (dimName) {
            const regionConf = getRegionConfig(region.id);
            const protectedDims = regionConf.protectedDimensions || ["overworld", "nether"];
            if (!protectedDims.includes(dimName)) {
                continue; // This dimension is not protected for this region
            }
        }

        return region;
    }

    const regions = getProtectedRegions();
    for (let i = 0; i < regions.length; i++) {
        const r = regions[i];
        if (position.x >= r.pos1.x && position.x <= r.pos2.x &&
            position.y >= r.pos1.y && position.y <= r.pos2.y &&
            position.z >= r.pos1.z && position.z <= r.pos2.z) {

            // If dimension is provided, check if this dimension is protected for this region
            if (dimName) {
                const regionConf = getRegionConfig(r.id);
                const protectedDims = regionConf.protectedDimensions || ["overworld", "nether"];
                if (!protectedDims.includes(dimName)) {
                    continue; // This dimension is not protected for this region
                }
            }

            const key = `${r.pos1.x},${r.pos1.y},${r.pos1.z},${r.pos2.x},${r.pos2.y},${r.pos2.z}`;
            regionCache.set(key, r);
            return r;
        }
    }
    return null;
};

export const isEntityExcluded = (entityTypeId, regionId = null) => {
    const config = regionId ? getRegionConfig(regionId) : getLobbyConfig();
    if (!config.excludedEntities) return false;

    if (config.excludedEntities.includes(entityTypeId)) return true;

    return config.excludedEntities.some(excludedType => {
        if (excludedType.includes('*')) {
            const regex = new RegExp(excludedType.replace(/\*/g, '.*'));
            return regex.test(entityTypeId);
        }
        return entityTypeId.includes(excludedType) ||
            entityTypeId.split(':')[1]?.includes(excludedType.split(':')[1] || excludedType);
    });
};

export const isValidEntityTypeId = (entityTypeId) =>
    typeof entityTypeId === 'string' && /^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$|^[a-zA-Z0-9_]+$/.test(entityTypeId);

export const getSuggestedEntityExclusions = () => [
    'minecraft:player', 'minecraft:npc', 'minecraft:villager', 'minecraft:item',
    'minecraft:experience_orb', 'minecraft:arrow', 'minecraft:egg', 'minecraft:enderman',
    'minecraft:ender_dragon', 'minecraft:end_crystal',
    'minecraft:painting', 'minecraft:*projectile*', 'minecraft:*particle*', 'custom:*', 'addon:*',
    '*item*', '*projectile*', '*particle*', 'minecraft:boat', 'minecraft:minecart',
    'minecraft:armor_stand', 'minecraft:item_frame', 'minecraft:glow_item_frame',
    'add:floating_text', 'add:*'
];

export const defaultLobbyConfig = DEFAULTS.main;

export const getPerformanceStats = () => {
    const players = world.getPlayers();
    const regions = getProtectedRegions();
    const playerCount = players.length;

    return {
        playerCount,
        regionCount: regions.length,
        isHighLoad: playerCount > 50,
        recommendedBatchSize: playerCount > 100 ? 25 : playerCount > 50 ? 20 : 15,
        recommendedCacheDuration: playerCount > 100 ? 3000 : 2000,
        performanceLevel: playerCount > 100 ? 'HIGH' : playerCount > 50 ? 'MEDIUM' : 'LOW',
        estimatedCapacity: playerCount > 100 ? '100-200 players' : playerCount > 50 ? '50-100 players' : '20-50 players'
    };
};