import { world, ActionFormData, ModalFormData } from "../core.js";
import { showMainMenu } from "../kiwora";
import {
  itemBlock,
  itemBlockColor,
  itemLog,
  itemFurniture,
  itemGlass,
  itemSword,
  itemAxe,
  itemPickaxe,
  itemShovel,
  itemHelmet,
  itemChestplate,
  itemLeggings,
  itemBoots,
  itemFarm,
  itemFood,
  itemOres,
  itemSpawner,
  itemEnchantedBook,
} from "../menu_member/configshop";

let shopMenuReturnCallback = null;

const DB_PREFIX = {
  CATEGORY: "kategori_db_kt",
  ITEM: "item_db_kt",
};
const MAX_ITEMS_PER_DB = 50;
const MAX_CATEGORIES_PER_DB = 6;
const MAX_DB_SIZE = 32767;

// Shop Settings - Currency Configuration
const SHOP_SETTINGS_PROPERTY = "shop_settings_config";

const DEFAULT_SHOP_SETTINGS = {
  currency: "money", // Scoreboard objective name for currency
  currencySymbol: "$",
  currencyName: "Money",
};

let shopSettings = { ...DEFAULT_SHOP_SETTINGS };

function loadShopSettings() {
  try {
    const saved = world.getDynamicProperty(SHOP_SETTINGS_PROPERTY);
    if (saved) {
      const parsed = JSON.parse(saved);
      shopSettings = { ...DEFAULT_SHOP_SETTINGS, ...parsed };
    }
  } catch (e) {
    console.warn("[Shop Settings] Error loading settings:", e);
    shopSettings = { ...DEFAULT_SHOP_SETTINGS };
  }
  return shopSettings;
}

function saveShopSettings() {
  try {
    world.setDynamicProperty(SHOP_SETTINGS_PROPERTY, JSON.stringify(shopSettings));
    return true;
  } catch (e) {
    console.warn("[Shop Settings] Error saving settings:", e);
    return false;
  }
}

export function getShopCurrency() {
  loadShopSettings();
  return shopSettings.currency || "money";
}

export function getShopCurrencySymbol() {
  loadShopSettings();
  return shopSettings.currencySymbol || "$";
}

export function getShopCurrencyName() {
  loadShopSettings();
  return shopSettings.currencyName || "Money";
}

const DEFAULT_SHOP_CONFIG = {
  categories: [
    {
      id: "blocks",
      name: "§l§0(§1§lBLOCKS§l§0)",
      icon: "textures/blocks/cobblestone.png",
      enabled: true,
    },
    {
      id: "wool",
      name: "§l§0(§2§lWOOL BLOCKS§l§0)",
      icon: "textures/blocks/wool_colored_white.png",
      enabled: true,
    },
    {
      id: "wood",
      name: "§l§0(§3§lWOOD§l§0)",
      icon: "textures/blocks/log_oak.png",
      enabled: true,
    },
    {
      id: "furniture",
      name: "§l§0(§4§lFURNITURE§l§0)",
      icon: "textures/blocks/crafting_table_front.png",
      enabled: true,
    },
    {
      id: "glass",
      name: "§l§0(§6§lGLASS§l§0)",
      icon: "textures/blocks/glass_black.png",
      enabled: true,
    },
    {
      id: "tools",
      name: "§l§0(§8§lTOOLS§l§0)",
      icon: "textures/items/diamond_sword.png",
      enabled: true,
    },
    {
      id: "helmet",
      name: "§l§0(§a§lHELMET§l§0)",
      icon: "textures/items/diamond_helmet.png",
      enabled: true,
    },
    {
      id: "chestplate",
      name: "§l§0(§a§lCHESTPLATE§l§0)",
      icon: "textures/items/diamond_chestplate.png",
      enabled: true,
    },
    {
      id: "leggings",
      name: "§l§0(§a§lLEGGINGS§l§0)",
      icon: "textures/items/diamond_leggings.png",
      enabled: true,
    },
    {
      id: "boots",
      name: "§l§0(§a§lBOOTS§l§0)",
      icon: "textures/items/diamond_boots.png",
      enabled: true,
    },
    {
      id: "farming",
      name: "§l§0(§b§lFARMING§l§0)",
      icon: "textures/items/carrot.png",
      enabled: true,
    },
    {
      id: "food",
      name: "§l§0(§e§lFOOD§l§0)",
      icon: "textures/items/beef_cooked.png",
      enabled: true,
    },
    {
      id: "ores",
      name: "§l§0(§f§lORES§l§0)",
      icon: "textures/items/diamond.png",
      enabled: true,
    },
    {
      id: "spawner",
      name: "§l§0(§g§lSPAWNER§l§0)",
      icon: "textures/blocks/mob_spawner.png",
      enabled: true,
    },
    {
      id: "enchanted_books",
      name: "§l§0(§d§lENCHANTED BOOKS§l§0)",
      icon: "textures/items/book_enchanted.png",
      enabled: true,
    },
  ],
  items: {
    blocks: itemBlock,
    wool: itemBlockColor,
    wood: itemLog,
    furniture: itemFurniture,
    glass: itemGlass,
    tools: [...itemSword, ...itemAxe, ...itemPickaxe, ...itemShovel],
    helmet: itemHelmet,
    chestplate: itemChestplate,
    leggings: itemLeggings,
    boots: itemBoots,
    farming: itemFarm,
    food: itemFood,
    ores: itemOres,
    spawner: itemSpawner,
    enchanted_books: itemEnchantedBook,
  },
};

let shopConfig = { ...DEFAULT_SHOP_CONFIG };
let dbMeta = {
  categoryDBs: [],
  itemDBs: {},
  categoryCount: 0,
  itemCounts: {},
};

function cleanInvalidDBEntries() {
  try {
    console.log("[Shop Config] Cleaning invalid DB entries...");

    for (const dbName of [...dbMeta.categoryDBs]) {
      try {
        const data = world.getDynamicProperty(dbName);
        if (!data) continue;

        JSON.parse(data);
      } catch (e) {
        console.warn(`[Shop Config] Invalid data in ${dbName}, resetting...`);
        world.setDynamicProperty(dbName, "[]");
      }
    }

    for (const categoryId in dbMeta.itemDBs) {
      for (const dbName of [...dbMeta.itemDBs[categoryId]]) {
        try {
          const data = world.getDynamicProperty(dbName);
          if (!data) continue;

          JSON.parse(data);
        } catch (e) {
          console.warn(`[Shop Config] Invalid data in ${dbName}, resetting...`);
          world.setDynamicProperty(dbName, "[]");
        }
      }
    }

    console.log("[Shop Config] DB cleaning completed");
    return true;
  } catch (e) {
    console.error("[Shop Config] Error during DB cleaning:", e);
    return false;
  }
}

function migrateFullDBs() {
  try {
    let didMigrate = false;

    for (const dbName of [...dbMeta.categoryDBs]) {
      const data = world.getDynamicProperty(dbName) || "[]";
      if (data.length > MAX_DB_SIZE * 0.8) {
        console.log(
          `[Shop Config] Category DB ${dbName} is nearly full, migrating...`,
        );

        let categories = [];
        try {
          categories = JSON.parse(data);
          if (!Array.isArray(categories)) categories = [categories];
        } catch (e) {
          console.error(`[Shop Config] Error parsing data from ${dbName}`, e);
          continue;
        }

        const halfPoint = Math.floor(categories.length / 2);
        const categoriesToMove = categories.splice(halfPoint);

        world.setDynamicProperty(dbName, JSON.stringify(categories));

        const newDBName = getNextCategoryDB();
        world.setDynamicProperty(newDBName, JSON.stringify(categoriesToMove));

        didMigrate = true;
      }
    }

    for (const categoryId in dbMeta.itemDBs) {
      for (const dbName of [...dbMeta.itemDBs[categoryId]]) {
        const data = world.getDynamicProperty(dbName) || "[]";
        if (data.length > MAX_DB_SIZE * 0.8) {
          console.log(
            `[Shop Config] Item DB ${dbName} is nearly full, migrating...`,
          );

          let items = [];
          try {
            items = JSON.parse(data);
            if (!Array.isArray(items)) items = [items];
          } catch (e) {
            console.error(`[Shop Config] Error parsing data from ${dbName}`, e);
            continue;
          }

          const halfPoint = Math.floor(items.length / 2);
          const itemsToMove = items.splice(halfPoint);

          world.setDynamicProperty(dbName, JSON.stringify(items));

          const newDBName = getNextItemDB(categoryId);
          world.setDynamicProperty(newDBName, JSON.stringify(itemsToMove));

          didMigrate = true;
        }
      }
    }

    if (didMigrate) {
      world.setDynamicProperty("shop_db_meta", JSON.stringify(dbMeta));
      console.log("[Shop Config] DB migration completed");
    }

    return didMigrate;
  } catch (e) {
    console.error("[Shop Config] Error during DB migration:", e);
    return false;
  }
}

function initDBRegistry() {
  try {
    const metaData = world.getDynamicProperty("shop_db_meta");
    if (metaData) {
      dbMeta = JSON.parse(metaData);

      cleanInvalidDBEntries();

      migrateFullDBs();
      return;
    }

    dbMeta = {
      categoryDBs: [`${DB_PREFIX.CATEGORY}_0`],
      itemDBs: {},
      categoryCount: 0,
      itemCounts: {},
    };

    try {
      if (typeof world.getDynamicPropertyRegistry === "function") {
        world
          .getDynamicPropertyRegistry()
          .defineString(`${DB_PREFIX.CATEGORY}_0`, 65536);
      } else {
        world.setDynamicProperty(`${DB_PREFIX.CATEGORY}_0`, "[]");
      }
    } catch (e) {
      world.setDynamicProperty(`${DB_PREFIX.CATEGORY}_0`, "[]");
    }

    world.setDynamicProperty("shop_db_meta", JSON.stringify(dbMeta));
    console.log("[Shop Config] DB registry initialized");
  } catch (e) {
    console.error("[Shop Config] Error initializing DB registry:", e);
  }
}

export { shopConfig, loadShopConfig, saveShopConfig, showShopConfigMenu };

function getNextCategoryDB() {
  const currentCount = dbMeta.categoryCount;
  const dbIndex = Math.floor(currentCount / MAX_CATEGORIES_PER_DB);
  const dbName = `${DB_PREFIX.CATEGORY}_${dbIndex}`;

  if (!dbMeta.categoryDBs.includes(dbName)) {
    try {
      try {
        if (typeof world.getDynamicPropertyRegistry === "function") {
          world.getDynamicPropertyRegistry().defineString(dbName, 65536);
        } else {
          if (world.getDynamicProperty(dbName) === undefined) {
            world.setDynamicProperty(dbName, "[]");
          }
        }
      } catch (e) {
        if (world.getDynamicProperty(dbName) === undefined) {
          world.setDynamicProperty(dbName, "[]");
        }
      }

      dbMeta.categoryDBs.push(dbName);
      world.setDynamicProperty("shop_db_meta", JSON.stringify(dbMeta));
      console.log(`[Shop Config] Created new category DB: ${dbName}`);
    } catch (e) {
      console.error(`[Shop Config] Error creating category DB ${dbName}:`, e);
    }
  }

  return dbName;
}

function getNextItemDB(categoryId) {
  if (!dbMeta.itemDBs[categoryId]) {
    dbMeta.itemDBs[categoryId] = [`${DB_PREFIX.ITEM}_${categoryId}_0`];
    dbMeta.itemCounts[categoryId] = 0;
  }

  const currentCount = dbMeta.itemCounts[categoryId] || 0;
  const dbIndex = Math.floor(currentCount / MAX_ITEMS_PER_DB);
  const dbName = `${DB_PREFIX.ITEM}_${categoryId}_${dbIndex}`;

  if (!dbMeta.itemDBs[categoryId].includes(dbName)) {
    try {
      try {
        if (typeof world.getDynamicPropertyRegistry === "function") {
          world.getDynamicPropertyRegistry().defineString(dbName, 65536);
        } else {
          if (world.getDynamicProperty(dbName) === undefined) {
            world.setDynamicProperty(dbName, "[]");
          }
        }
      } catch (e) {
        if (world.getDynamicProperty(dbName) === undefined) {
          world.setDynamicProperty(dbName, "[]");
        }
      }

      dbMeta.itemDBs[categoryId].push(dbName);
      world.setDynamicProperty("shop_db_meta", JSON.stringify(dbMeta));
      console.log(
        `[Shop Config] Created new item DB for ${categoryId}: ${dbName}`,
      );
    } catch (e) {
      console.error(`[Shop Config] Error creating item DB ${dbName}:`, e);
    }
  }

  return dbName;
}

function saveCategoryToDB(category) {
  try {
    const dbName = getNextCategoryDB();
    const currentData = world.getDynamicProperty(dbName) || "[]";
    let categories;

    try {
      categories = JSON.parse(currentData);
      if (!Array.isArray(categories)) categories = [];
    } catch (e) {
      categories = [];
    }

    const newCategory = JSON.parse(JSON.stringify(category));
    categories.push(newCategory);
    const newData = JSON.stringify(categories);

    if (newData.length > MAX_DB_SIZE * 0.8) {
      const newDBName = getNextCategoryDB();
      world.setDynamicProperty(newDBName, JSON.stringify([newCategory]));
    } else {
      world.setDynamicProperty(dbName, newData);
    }

    dbMeta.categoryCount++;
    world.setDynamicProperty("shop_db_meta", JSON.stringify(dbMeta));
    return true;
  } catch (e) {
    console.error("[Shop Config] Error saving category to DB:", e);
    return false;
  }
}

function saveItemToDB(categoryId, item) {
  try {
    const dbName = getNextItemDB(categoryId);
    const currentData = world.getDynamicProperty(dbName) || "[]";
    let items;

    try {
      items = JSON.parse(currentData);
      if (!Array.isArray(items)) items = [];
    } catch (e) {
      items = [];
    }

    const newItem = JSON.parse(JSON.stringify(item));
    items.push(newItem);
    const newData = JSON.stringify(items);

    if (newData.length > MAX_DB_SIZE * 0.8) {
      const newDBName = getNextItemDB(categoryId);
      world.setDynamicProperty(newDBName, JSON.stringify([newItem]));
    } else {
      world.setDynamicProperty(dbName, newData);
    }

    dbMeta.itemCounts[categoryId] = (dbMeta.itemCounts[categoryId] || 0) + 1;
    world.setDynamicProperty("shop_db_meta", JSON.stringify(dbMeta));
    return true;
  } catch (e) {
    console.error(
      `[Shop Config] Error saving item to DB for ${categoryId}:`,
      e,
    );
    return false;
  }
}

function loadCategoriesFromDB() {
  const categories = [];
  try {
    for (const dbName of dbMeta.categoryDBs) {
      const data = world.getDynamicProperty(dbName);
      if (data) {
        try {
          const categoryData = JSON.parse(data);
          if (categoryData) {
            if (Array.isArray(categoryData)) {
              categories.push(...categoryData);
            } else {
              categories.push(categoryData);
            }
          }
        } catch (e) {
          console.warn(`[Shop or parsing category data from ${dbName}:`, e);
        }
      }
    }
    return categories.length > 0 ? categories : null;
  } catch (e) {
    console.error("[Shop Config] Error loading categories from DB:", e);
    return null;
  }
}

function loadItemsFromDB(categoryId) {
  const items = [];
  try {
    if (!dbMeta.itemDBs[categoryId]) return null;

    for (const dbName of dbMeta.itemDBs[categoryId]) {
      const data = world.getDynamicProperty(dbName);
      if (data) {
        try {
          const itemData = JSON.parse(data);
          if (itemData) {
            if (Array.isArray(itemData)) {
              items.push(...itemData);
            } else {
              items.push(itemData);
            }
          }
        } catch (e) {
          console.warn(
            `[Shop Config] Error parsing item data from ${dbName}:`,
            e,
          );
        }
      }
    }
    return items.length > 0 ? items : null;
  } catch (e) {
    console.error(
      `[Shop Config] Error loading items from DB for ${categoryId}:`,
      e,
    );
    return null;
  }
}

function loadShopConfig() {
  try {
    initDBRegistry();
    const categories = loadCategoriesFromDB();

    if (categories && categories.length > 0) {
      shopConfig.categories = categories;
      shopConfig.items = {};

      for (const category of categories) {
        const items = loadItemsFromDB(category.id);
        shopConfig.items[category.id] = items || [];
      }

      const oldConfig = world.getDynamicProperty("shopConfigData");
      if (oldConfig) {
        try {
          const parsed = JSON.parse(oldConfig);
          if (parsed?.categories?.length > 0) {
            const existingCategoryIds = shopConfig.categories.map((c) => c.id);
            const missingCategories = parsed.categories.filter(
              (c) => !existingCategoryIds.includes(c.id),
            );

            if (missingCategories.length > 0) {
              console.log(
                `[Shop Config] Found ${missingCategories.length} missing categories to migrate`,
              );
              for (const category of missingCategories) {
                shopConfig.categories.push(category);

                const items = parsed.items[category.id] || [];
                shopConfig.items[category.id] = items;

                saveCategoryToDB(category);
                for (const item of items) {
                  saveItemToDB(category.id, item);
                }
              }

              console.log(
                "[Shop Config] Migration completed, removing old property",
              );
              try {
                world.setDynamicProperty("shopConfigData", undefined);
              } catch {
                console.warn(
                  "[Shop Config] Could not delete old shopConfigData",
                );
              }
            }
          }
        } catch (e) {
          console.warn("[Shop Config] Error parsing old config:", e);
        }
      }

      for (const category of shopConfig.categories) {
        if (!shopConfig.items[category.id]) {
          shopConfig.items[category.id] = [];
        }
      }

      return true;
    }

    const saved = world.getDynamicProperty("shopConfigData");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          parsed?.categories?.length > 0 &&
          parsed?.items &&
          Object.keys(parsed.items).length > 0
        ) {
          shopConfig = parsed;

          migrateConfigToDB();
          return true;
        }
      } catch (e) {
        console.warn("[Shop Config] Error parsing shopConfigData:", e);
      }
    }
  } catch (e) {
    console.warn("Error loading shop config:", e);
  }

  shopConfig = JSON.parse(JSON.stringify(DEFAULT_SHOP_CONFIG));
  saveShopConfig();
  return false;
}

function migrateConfigToDB() {
  try {
    dbMeta = {
      categoryDBs: [`${DB_PREFIX.CATEGORY}_0`],
      itemDBs: {},
      categoryCount: 0,
      itemCounts: {},
    };

    try {
      world
        .getDynamicPropertyRegistry()
        .defineString(`${DB_PREFIX.CATEGORY}_0`, 65536);
    } catch (e) { }

    for (const category of shopConfig.categories) {
      saveCategoryToDB(category);

      const items = shopConfig.items[category.id] || [];
      for (const item of items) {
        saveItemToDB(category.id, item);
      }
    }

    console.log("[Shop Config] Migration to new DB format completed");
    return true;
  } catch (e) {
    console.error("[Shop Config] Error during migration:", e);
    return false;
  }
}

function saveShopConfig() {
  try {
    const currentDbMeta = JSON.parse(JSON.stringify(dbMeta));

    for (const dbName of currentDbMeta.categoryDBs || []) {
      world.setDynamicProperty(dbName, "[]");
    }

    for (const categoryId in currentDbMeta.itemDBs || {}) {
      for (const dbName of currentDbMeta.itemDBs[categoryId] || []) {
        world.setDynamicProperty(dbName, "[]");
      }
    }

    dbMeta = {
      categoryDBs: [`${DB_PREFIX.CATEGORY}_0`],
      itemDBs: {},
      categoryCount: 0,
      itemCounts: {},
    };

    try {
      if (typeof world.getDynamicPropertyRegistry === "function") {
        world
          .getDynamicPropertyRegistry()
          .defineString(`${DB_PREFIX.CATEGORY}_0`, 65536);
      }
    } catch (e) { }

    const batchSize = 5;

    for (let i = 0; i < shopConfig.categories.length; i += batchSize) {
      const batch = shopConfig.categories.slice(i, i + batchSize);
      for (const category of batch) {
        saveCategoryToDB(category);
      }
    }

    for (const category of shopConfig.categories) {
      const items = shopConfig.items[category.id] || [];
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        for (const item of batch) {
          saveItemToDB(category.id, item);
        }
      }
    }

    try {
      world.setDynamicProperty("shopConfigData", undefined);
    } catch (e) {
      console.warn("[Shop Config] Could not delete old shopConfigData:", e);
    }

    return true;
  } catch (e) {
    console.warn("Error saving shop config:", e);
    return false;
  }
}

function forceResetShopConfig() {
  try {
    try {
      world.setDynamicProperty("shopConfigData", undefined);
    } catch (e) {
      console.warn("[Shop Config] Error clearing property:", e);
    }

    try {
      for (const dbName of dbMeta.categoryDBs || []) {
        world.setDynamicProperty(dbName, undefined);
      }

      for (const categoryId in dbMeta.itemDBs || {}) {
        for (const dbName of dbMeta.itemDBs[categoryId] || []) {
          world.setDynamicProperty(dbName, undefined);
        }
      }

      world.setDynamicProperty("shop_db_meta", undefined);
    } catch (e) {
      console.warn("[Shop Config] Error clearing DB properties:", e);
    }

    try {
      world.getDynamicPropertyRegistry().defineString("shopConfigData", 65536);
      console.warn(
        '[Shop Config] Dynamic property "shopConfigData" redefined.',
      );

      world.getDynamicPropertyRegistry().defineString("shop_db_meta", 65536);
      world
        .getDynamicPropertyRegistry()
        .defineString(`${DB_PREFIX.CATEGORY}_0`, 65536);
    } catch (e) { }

    shopConfig = JSON.parse(JSON.stringify(DEFAULT_SHOP_CONFIG));
    // Ensure all armor categories are properly initialized
    if (!shopConfig.items.helmet || !Array.isArray(shopConfig.items.helmet)) {
      shopConfig.items.helmet = [...itemHelmet];
    }
    if (
      !shopConfig.items.chestplate ||
      !Array.isArray(shopConfig.items.chestplate)
    ) {
      shopConfig.items.chestplate = [...itemChestplate];
    }
    if (
      !shopConfig.items.leggings ||
      !Array.isArray(shopConfig.items.leggings)
    ) {
      shopConfig.items.leggings = [...itemLeggings];
    }
    if (!shopConfig.items.boots || !Array.isArray(shopConfig.items.boots)) {
      shopConfig.items.boots = [...itemBoots];
    }

    initDBRegistry();

    // Reset last percentage to default
    try {
      world.setDynamicProperty("shop_last_percent", undefined);
    } catch (e) {
      console.warn("[Shop Config] Could not reset last percentage:", e);
    }

    if (!saveShopConfig()) {
      console.error("[Shop Config] Failed to save default config!");
      return false;
    }
    console.log("[Shop Config] Configuration reset successfully.");
    return true;
  } catch (e) {
    console.error("[Shop Config] Error during force reset:", e);
    return false;
  }
}

world.afterEvents.worldLoad.subscribe(() => {
  try {
    const metaData = world.getDynamicProperty("shop_db_meta");
    if (!metaData) {
      console.log("[Shop Config] No database metadata found, initializing...");
      initDBRegistry();
    } else {
      console.log(
        "[Shop Config] Database metadata found, loading configuration...",
      );
      loadShopConfig();
    }

    let configValid = false;

    try {
      if (
        shopConfig.categories &&
        shopConfig.categories.length > 0 &&
        shopConfig.items
      ) {
        configValid = true;
        for (const category of shopConfig.categories) {
          if (
            !shopConfig.items[category.id] ||
            !Array.isArray(shopConfig.items[category.id])
          ) {
            shopConfig.items[category.id] = JSON.parse(
              JSON.stringify(DEFAULT_SHOP_CONFIG.items[category.id] || []),
            );
          }
        }

        // Ensure backward compatibility for old armor category
        if (shopConfig.items.armor && Array.isArray(shopConfig.items.armor)) {
          // Migrate old armor items to new categories if they don't exist
          if (!shopConfig.items.helmet) shopConfig.items.helmet = [];
          if (!shopConfig.items.chestplate) shopConfig.items.chestplate = [];
          if (!shopConfig.items.leggings) shopConfig.items.leggings = [];
          if (!shopConfig.items.boots) shopConfig.items.boots = [];

          // Remove old armor category
          delete shopConfig.items.armor;

          // Remove old armor category from categories list
          shopConfig.categories = shopConfig.categories.filter(
            (cat) => cat.id !== "armor",
          );
        }
      }
    } catch (e) {
      console.error("[Shop Config] Error validating configuration:", e);
      configValid = false;
    }

    if (!configValid) {
      console.warn(
        "[Shop Config] Invalid configuration, resetting to defaults",
      );
      shopConfig = JSON.parse(JSON.stringify(DEFAULT_SHOP_CONFIG));
      saveShopConfig();
    }

    migrateFullDBs();
  } catch (e) {
    console.error("[Shop Config] Error during initialization:", e);
    shopConfig = JSON.parse(JSON.stringify(DEFAULT_SHOP_CONFIG));
    saveShopConfig();
  }
});

async function showShopConfigMenu(player, returnCallback) {
  shopMenuReturnCallback = returnCallback || null;
  loadShopSettings();
  const form = new ActionFormData()
    .title("Shop Configuration")
    .body(`§7Customize shop categories and items\n§7Current Currency: §e${shopSettings.currencyName} §7(${shopSettings.currency})`)
    .button(
      "§lManage Categories\n§r§8Add/edit categories",
      "textures/ui/bookshelf_flat",
    )
    .button("§lManage Items\n§r§8Add/edit items", "textures/ui/bookshelf_flat")
    .button(
      "§lPrice Adjustment\n§r§8Adjust prices by %",
      "textures/ui/trade_icon",
    )
    .button(
      "§lCurrency Settings\n§r§8Change shop currency",
      "textures/ui/trade_icon",
    )
    .button(
      "§lDB Info\n§r§8View database usage",
      "textures/ui/book_metatag_default",
    )
    .button(
      "§lImport Default Config\n§r§8Reset to default",
      "textures/ui/refresh",
    )
    .button("§lBack\n§r§8Return to menu", "textures/ui/arrow_left");
  const response = await form.show(player);
  if (response.canceled) {
    if (typeof shopMenuReturnCallback === "function") {
      shopMenuReturnCallback(player);
    }
    return;
  }
  switch (response.selection) {
    case 0:
      await showCategoriesMenu(player);
      break;
    case 1:
      await showCategorySelector(player);
      break;
    case 2:
      await showPriceAdjustmentMenu(player);
      break;
    case 3:
      await showCurrencySettings(player);
      break;
    case 4:
      await showDBInfo(player);
      break;
    case 5:
      await showResetOptionsMenu(player);
      break;
    case 6:
      if (typeof shopMenuReturnCallback === "function") {
        shopMenuReturnCallback(player);
      } else {
        showMainMenu(player);
      }
      break;
  }
}

async function showCurrencySettings(player) {
  loadShopSettings();

  const form = new ActionFormData()
    .title("Currency Settings")
    .body(
      `§e=== CURRENT CURRENCY SETTINGS ===\n\n` +
      `§7Objective Name: §a${shopSettings.currency}\n` +
      `§7Currency Symbol: §a${shopSettings.currencySymbol}\n` +
      `§7Currency Name: §a${shopSettings.currencyName}\n\n` +
      `§6Note: §fThis uses scoreboard objectives.\n` +
      `§fMake sure the objective exists before using it.`
    )
    .button("§lChange Currency Objective\n§r§8Select scoreboard", "textures/ui/trade_icon")
    .button("§lChange Symbol & Name\n§r§8Customize display", "textures/ui/book_edit_default")
    .button("§lReset to Default\n§r§8Use 'money' objective", "textures/ui/refresh")
    .button("§lBack\n§r§8Return to config", "textures/ui/arrow_left");

  const response = await form.show(player);
  if (response.canceled || response.selection === 3) {
    return showShopConfigMenu(player, shopMenuReturnCallback);
  }

  switch (response.selection) {
    case 0:
      await showCurrencyObjectiveSelector(player);
      break;
    case 1:
      await showCurrencyCustomize(player);
      break;
    case 2:
      shopSettings = { ...DEFAULT_SHOP_SETTINGS };
      if (saveShopSettings()) {
        player.sendMessage("§a[Shop] Currency reset to default (money)");
        player.playSound("random.click");
      }
      await showCurrencySettings(player);
      break;
  }
}

async function showCurrencyObjectiveSelector(player) {
  // Get all available scoreboard objectives
  const objectives = world.scoreboard.getObjectives();

  if (objectives.length === 0) {
    const form = new ActionFormData()
      .title("No Objectives Found")
      .body("§cNo scoreboard objectives found.\n\n§7Create one using:\n§e/scoreboard objectives add <name> dummy")
      .button("§lBack", "textures/ui/arrow_left");

    await form.show(player);
    return showCurrencySettings(player);
  }

  const form = new ActionFormData()
    .title("Select Currency Objective")
    .body(`§7Select which scoreboard objective to use as currency.\n§7Current: §a${shopSettings.currency}`);

  for (const obj of objectives) {
    const isActive = obj.id === shopSettings.currency;
    form.button(`${isActive ? "§a✓ " : "§f"}${obj.id}${isActive ? " §7(Current)" : ""}`, "textures/ui/trade_icon");
  }

  form.button("§lBack\n§r§8Return", "textures/ui/arrow_left");

  const response = await form.show(player);
  if (response.canceled || response.selection === objectives.length) {
    return showCurrencySettings(player);
  }

  const selected = objectives[response.selection];
  shopSettings.currency = selected.id;

  // Auto-set name based on objective id
  const capitalizedName = selected.id.charAt(0).toUpperCase() + selected.id.slice(1);
  shopSettings.currencyName = capitalizedName;

  if (saveShopSettings()) {
    player.sendMessage(`§a[Shop] Currency changed to: §e${selected.id}`);
    player.playSound("random.click");
  } else {
    player.sendMessage("§c[Shop] Failed to save currency settings");
  }

  await showCurrencySettings(player);
}

async function showCurrencyCustomize(player) {
  loadShopSettings();

  const form = new ModalFormData()
    .title("Customize Currency Display")
    .textField(
      "§7Currency Symbol (e.g., $, Rp, ¥)",
      "Enter symbol...",
      { defaultValue: shopSettings.currencySymbol }
    )
    .textField(
      "§7Currency Name (e.g., Money, Coins, Gold)",
      "Enter name...",
      { defaultValue: shopSettings.currencyName }
    );

  const response = await form.show(player);
  if (response.canceled) {
    return showCurrencySettings(player);
  }

  const [symbol, name] = response.formValues;

  if (symbol && symbol.trim()) {
    shopSettings.currencySymbol = symbol.trim();
  }
  if (name && name.trim()) {
    shopSettings.currencyName = name.trim();
  }

  if (saveShopSettings()) {
    player.sendMessage(`§a[Shop] Currency display updated!`);
    player.sendMessage(`§7Symbol: §e${shopSettings.currencySymbol} §7| Name: §e${shopSettings.currencyName}`);
    player.playSound("random.click");
  } else {
    player.sendMessage("§c[Shop] Failed to save settings");
  }

  await showCurrencySettings(player);
}

async function showPriceAdjustmentMenu(player) {
  const form = new ActionFormData()
    .title("Price Adjustment")
    .body("§7Adjust item prices by percentage")
    .button(
      "§l§aIncrease All Prices\n§r§8Increase by %",
      "textures/ui/color_plus",
    )
    .button(
      "§l§cDecrease All Prices\n§r§8Decrease by %",
      "textures/ui/minus",
    )
    .button(
      "§l§eAdjust Category\n§r§8Adjust specific category",
      "textures/ui/bookshelf_flat",
    )
    .button("§lBack\n§r§8Return to config menu", "textures/ui/arrow_left");

  const response = await form.show(player);
  if (response.canceled || response.selection === 3) {
    return showShopConfigMenu(player, shopMenuReturnCallback);
  }

  switch (response.selection) {
    case 0:
      await showPercentageInput(player, "increase", null);
      break;
    case 1:
      await showPercentageInput(player, "decrease", null);
      break;
    case 2:
      await showCategoryForPriceAdjust(player);
      break;
  }
}

async function showCategoryForPriceAdjust(player) {
  const form = new ActionFormData()
    .title("Select Category")
    .body("§7Select a category to adjust prices");

  for (const category of shopConfig.categories) {
    const itemCount = (shopConfig.items[category.id] || []).length;
    form.button(`§l${category.name}\n§r§8${itemCount} items`, category.icon);
  }

  form.button("§lBack\n§r§8Return to price menu", "textures/ui/arrow_left");
  const response = await form.show(player);
  if (response.canceled || response.selection === shopConfig.categories.length) {
    return showPriceAdjustmentMenu(player);
  }

  const categoryId = shopConfig.categories[response.selection].id;
  await showCategoryPriceOptions(player, categoryId);
}

async function showCategoryPriceOptions(player, categoryId) {
  const category = shopConfig.categories.find((c) => c.id === categoryId);
  const form = new ActionFormData()
    .title(`Adjust: ${category.name}`)
    .body("§7Choose adjustment type")
    .button(
      "§l§aIncrease Prices\n§r§8Increase by %",
      "textures/ui/color_plus",
    )
    .button(
      "§l§cDecrease Prices\n§r§8Decrease by %",
      "textures/ui/color_minus",
    )
    .button("§lBack\n§r§8Return to categories", "textures/ui/arrow_left");

  const response = await form.show(player);
  if (response.canceled || response.selection === 2) {
    return showCategoryForPriceAdjust(player);
  }

  const mode = response.selection === 0 ? "increase" : "decrease";
  await showPercentageInput(player, mode, categoryId);
}

function getLastPercentage() {
  try {
    const saved = world.getDynamicProperty("shop_last_percent");
    return saved ? parseInt(saved) : 10;
  } catch {
    return 10;
  }
}

function saveLastPercentage(value) {
  try {
    world.setDynamicProperty("shop_last_percent", String(value));
  } catch (e) {
    console.warn("[Shop Config] Could not save last percentage:", e);
  }
}

async function showPercentageInput(player, mode, categoryId) {
  const isIncrease = mode === "increase";
  const targetText = categoryId
    ? shopConfig.categories.find((c) => c.id === categoryId)?.name || categoryId
    : "All Categories";

  const lastPercent = getLastPercentage();

  const form = new ModalFormData()
    .title(isIncrease ? "Increase Prices" : "Decrease Prices")
    .slider(
      `§l${isIncrease ? "§aIncrease" : "§cDecrease"} Percentage\n§r§8Target: ${targetText}`,
      1,
      100,
      { step: 1, defaultValue: lastPercent },
    )
    .toggle("§lAdjust Buy Price", { defaultValue: true })
    .toggle("§lAdjust Sell Price", { defaultValue: true });

  const response = await form.show(player);
  if (response.canceled) {
    return categoryId
      ? showCategoryPriceOptions(player, categoryId)
      : showPriceAdjustmentMenu(player);
  }

  const [percentage, adjustBuy, adjustSell] = response.formValues;

  // Save last used percentage
  saveLastPercentage(percentage);

  if (!adjustBuy && !adjustSell) {
    player.sendMessage("§c[Shop Config] Select at least one price type!");
    return showPercentageInput(player, mode, categoryId);
  }

  const result = applyPriceAdjustment(
    mode,
    percentage,
    categoryId,
    adjustBuy,
    adjustSell,
  );

  if (result.success) {
    const symbol = isIncrease ? "+" : "-";
    player.sendMessage(
      `§a[Shop Config] Prices adjusted! ${symbol}${percentage}% applied to ${result.itemCount} items.`,
    );
  } else {
    player.sendMessage(`§c[Shop Config] Failed to adjust prices: ${result.error}`);
  }

  showPriceAdjustmentMenu(player);
}

function applyPriceAdjustment(mode, percentage, categoryId, adjustBuy, adjustSell) {
  try {
    const multiplier = mode === "increase"
      ? 1 + percentage / 100
      : 1 - percentage / 100;

    let itemCount = 0;
    const categoriesToAdjust = categoryId
      ? [categoryId]
      : Object.keys(shopConfig.items);

    console.log(`[Shop Config] Adjusting prices: ${mode} ${percentage}% for ${categoriesToAdjust.length} categories`);

    for (const catId of categoriesToAdjust) {
      const items = shopConfig.items[catId] || [];
      for (const item of items) {
        if (adjustBuy && typeof item.cost === "number") {
          const oldCost = item.cost;
          item.cost = Math.max(1, Math.round(item.cost * multiplier));
          console.log(`[Shop Config] ${item.name}: cost ${oldCost} -> ${item.cost}`);
        }
        if (adjustSell && typeof item.sell === "number") {
          const oldSell = item.sell;
          item.sell = Math.max(0, Math.round(item.sell * multiplier));
          console.log(`[Shop Config] ${item.name}: sell ${oldSell} -> ${item.sell}`);
        }
        itemCount++;
      }
    }

    const saved = saveShopConfig();
    console.log(`[Shop Config] Save result: ${saved}, items adjusted: ${itemCount}`);

    if (!saved) {
      return { success: false, error: "Failed to save configuration" };
    }

    return { success: true, itemCount };
  } catch (e) {
    console.error("[Shop Config] Error applying price adjustment:", e);
    return { success: false, error: e.message };
  }
}

async function showCategoriesMenu(player) {
  const form = new ActionFormData()
    .title("Manage Categories")
    .body("§7Select a category to edit or create new");
  for (const category of shopConfig.categories) {
    const status = category.enabled !== false ? "§aEnabled" : "§cDisabled";
    form.button(`§l${category.name}\n§r§8${status}`, category.icon);
  }
  form
    .button("§l§2Add New Category\n§r§8Create new", "textures/ui/color_plus")
    .button("§lBack\n§r§8Return to config menu", "textures/ui/arrow_left");
  const response = await form.show(player);
  if (response.canceled) {
    showShopConfigMenu(player, shopMenuReturnCallback);
    return;
  }
  const categoriesCount = shopConfig.categories.length;
  if (response.selection < categoriesCount) {
    await editCategory(player, response.selection);
  } else if (response.selection === categoriesCount) {
    await createCategory(player);
  } else {
    showShopConfigMenu(player, shopMenuReturnCallback);
  }
}

async function createCategory(player) {
  const form = new ModalFormData()
    .title("Create New Category")
    .textField(
      "§lCategory ID\n§r§8Unique identifier (no spaces)",
      "Example: custom_blocks",
      { placeholder: "Enter category ID", defaultValue: "custom_blocks" },
    )
    .textField(
      "§lDisplay Name\n§r§8Name with formatting",
      "§l§0(§d§lCUSTOM§l§0)",
      {
        placeholder: "Enter display name",
        defaultValue: "§l§0(§d§lCUSTOM§l§0)",
      },
    )
    .textField("§lIcon Path\n§r§8Texture path", "textures/blocks/custom.png", {
      placeholder: "Enter icon texture path",
      defaultValue: "textures/blocks/custom.png",
    });
  const response = await form.show(player);
  if (response.canceled) return showCategoriesMenu(player);
  const [id, name, icon] = response.formValues;
  if (!id || !name || !icon) {
    player.sendMessage("§c[Shop Config] All fields required!");
    return createCategory(player);
  }
  if (shopConfig.categories.some((cat) => cat.id === id)) {
    player.sendMessage("§c[Shop Config] Category ID already exists!");
    return createCategory(player);
  }

  const newCategory = { id, name, icon, enabled: true };
  shopConfig.categories.push(newCategory);
  shopConfig.items[id] = [];

  saveCategoryToDB(newCategory);

  saveShopConfig();
  player.sendMessage("§a[Shop Config] Category created!");
  showCategoriesMenu(player);
}

async function editCategory(player, index) {
  const category = shopConfig.categories[index];
  const form = new ModalFormData()
    .title("Edit Category")
    .textField("§lCategory ID\n§r§8Unique identifier", category.id, {
      placeholder: "Enter category ID",
      defaultValue: category.id,
    })
    .textField("§lDisplay Name\n§r§8Name with formatting", category.name, {
      placeholder: "Enter display name",
      defaultValue: category.name,
    })
    .textField("§lIcon Path\n§r§8Texture path", category.icon, {
      placeholder: "Enter icon texture path",
      defaultValue: category.icon,
    })
    .toggle("§lEnable Category", { defaultValue: category.enabled !== false })
    .toggle("§cDelete Category", { defaultValue: false });
  const response = await form.show(player);
  if (response.canceled) return showCategoriesMenu(player);
  const [id, name, icon, enabled, shouldDelete] = response.formValues;
  if (shouldDelete) {
    const oldId = category.id;
    shopConfig.categories.splice(index, 1);
    delete shopConfig.items[oldId];

    try {
      if (dbMeta.itemDBs[oldId]) {
        for (const dbName of dbMeta.itemDBs[oldId]) {
          world.setDynamicProperty(dbName, undefined);
        }
        delete dbMeta.itemDBs[oldId];
        delete dbMeta.itemCounts[oldId];
        world.setDynamicProperty("shop_db_meta", JSON.stringify(dbMeta));
      }
    } catch (e) {
      console.error(`[Shop Config] Error deleting DB for ${oldId}:`, e);
    }

    saveShopConfig();
    player.sendMessage("§a[Shop Config] Category deleted!");
  } else {
    if (!id || !name || !icon) {
      player.sendMessage("§c[Shop Config] All fields required!");
      return editCategory(player, index);
    }
    if (
      id !== category.id &&
      shopConfig.categories.some((cat) => cat.id === id)
    ) {
      player.sendMessage("§c[Shop Config] Category ID already exists!");
      return editCategory(player, index);
    }
    const oldId = category.id;
    category.id = id;
    category.name = name;
    category.icon = icon;
    category.enabled = enabled;
    if (id !== oldId) {
      shopConfig.items[id] = shopConfig.items[oldId] || [];
      delete shopConfig.items[oldId];

      if (dbMeta.itemDBs[oldId]) {
        dbMeta.itemDBs[id] = dbMeta.itemDBs[oldId];
        dbMeta.itemCounts[id] = dbMeta.itemCounts[oldId];
        delete dbMeta.itemDBs[oldId];
        delete dbMeta.itemCounts[oldId];
        world.setDynamicProperty("shop_db_meta", JSON.stringify(dbMeta));
      }
    }
    saveShopConfig();
    player.sendMessage("§a[Shop Config] Category updated!");
  }
  showCategoriesMenu(player);
}

async function showCategorySelector(player) {
  const form = new ActionFormData()
    .title("Select Category")
    .body("§7Select a category to manage items");

  for (const category of shopConfig.categories) {
    form.button(`§l${category.name}\n§r§8Manage items`, category.icon);
  }

  form.button("§lBack\n§r§8Return to config menu", "textures/ui/arrow_left");
  const response = await form.show(player);
  if (response.canceled) {
    showShopConfigMenu(player, shopMenuReturnCallback);
    return;
  }
  if (response.selection < shopConfig.categories.length) {
    await showItemsMenu(player, shopConfig.categories[response.selection].id);
  } else {
    showShopConfigMenu(player, shopMenuReturnCallback);
  }
}

async function showItemsMenu(player, categoryId) {
  const category = shopConfig.categories.find((cat) => cat.id === categoryId);
  const items = shopConfig.items[categoryId] || [];
  const form = new ActionFormData()
    .title(`Items`)
    .body(`§7Manage items (${items.length} items)`);

  for (const item of items) {
    form.button(
      `§l${item.name}\n§r§8Buy: §g${item.cost} §r§8Sell: §g${item.sell}`,
      item.textures,
    );
  }

  form
    .button("§l§2Add New Item\n§r§8Create new", "textures/ui/color_plus")
    .button("§lBack\n§r§8Return to categories", "textures/ui/arrow_left");
  const response = await form.show(player);
  if (response.canceled) {
    showCategorySelector(player);
    return;
  }
  if (response.selection < items.length) {
    await editItem(player, categoryId, response.selection);
  } else if (response.selection === items.length) {
    await createItem(player, categoryId);
  } else {
    showCategorySelector(player);
  }
}

async function createItem(player, categoryId) {
  const form = new ModalFormData()
    .title("Create New Item")
    .textField("§lItem Name\n§r§8Display name", "Diamond Sword", {
      placeholder: "Enter item name",
      defaultValue: "Diamond Sword",
    })
    .textField("§lItem ID\n§r§8Minecraft item ID", "diamond_sword", {
      placeholder: "Enter Minecraft item ID",
      defaultValue: "diamond_sword",
    })
    .textField(
      "§lTexture Path\n§r§8Icon for shop",
      "textures/items/diamond_sword.png",
      {
        placeholder: "Enter texture path",
        defaultValue: "textures/items/diamond_sword.png",
      },
    )
    .textField("§lBuy Price", "1000", {
      placeholder: "Enter buy price",
      defaultValue: "1000",
    })
    .textField("§lSell Price", "500", {
      placeholder: "Enter sell price",
      defaultValue: "500",
    })
    .textField("§lData Value\n§r§8Item data/damage", "0", {
      placeholder: "Enter data value (0-15)",
      defaultValue: "0",
    })
    .toggle("§lCannot Be Sold\n§r§8Prevent selling", { defaultValue: false })
    .textField("§lEnchantments\n§r§8Format: id:lvl,id:lvl", "sharpness:5", {
      placeholder: "e.g. sharpness:5,unbreaking:3",
      defaultValue: "",
    });
  const response = await form.show(player);
  if (response.canceled) return showItemsMenu(player, categoryId);
  const [name, item, textures, costText, sellText, dataText, notsold, enchantments] =
    response.formValues;
  if (!name || !item || !textures) {
    player.sendMessage("§c[Shop Config] Name, Item ID, Texture required!");
    return createItem(player, categoryId);
  }

  const cost = parseInt(costText) || 1;
  const sell = parseInt(sellText) || 0;
  const data = parseInt(dataText) || 0;

  const newItem = {
    name,
    item,
    textures,
    cost,
    sell,
    data,
    ...(notsold && { notsold: true }),
    ...(enchantments && { enchantments }),
  };

  shopConfig.items[categoryId].push(newItem);

  saveItemToDB(categoryId, newItem);

  saveShopConfig();
  player.sendMessage("§a[Shop Config] Item created!");
  showItemsMenu(player, categoryId);
}

async function editItem(player, categoryId, index) {
  const item = shopConfig.items[categoryId][index];
  const form = new ModalFormData()
    .title("Edit Item")
    .textField("§lItem Name\n§r§8Display name", item.name, {
      placeholder: "Enter item name",
      defaultValue: item.name,
    })
    .textField("§lItem ID\n§r§8Minecraft item ID", item.item, {
      placeholder: "Enter Minecraft item ID",
      defaultValue: item.item,
    })
    .textField("§lTexture Path\n§r§8Icon for shop", item.textures, {
      placeholder: "Enter texture path",
      defaultValue: item.textures,
    })
    .textField("§lBuy Price", item.cost.toString(), {
      placeholder: "Enter buy price",
      defaultValue: item.cost.toString(),
    })
    .textField("§lSell Price", item.sell.toString(), {
      placeholder: "Enter sell price",
      defaultValue: item.sell.toString(),
    })
    .textField(
      "§lData Value\n§r§8Item data/damage",
      (item.data || 0).toString(),
      {
        placeholder: "Enter data value (0-15)",
        defaultValue: (item.data || 0).toString(),
      },
    )
    .toggle("§lCannot Be Sold\n§r§8Prevent selling", {
      defaultValue: item.notsold || false,
    })
    .textField("§lEnchantments\n§r§8Format: id:lvl,id:lvl", item.enchantments || "", {
      placeholder: "e.g. sharpness:5,unbreaking:3",
      defaultValue: item.enchantments || "",
    })
    .toggle("§cDelete Item", { defaultValue: false });
  const response = await form.show(player);
  if (response.canceled) return showItemsMenu(player, categoryId);
  const [
    name,
    itemId,
    textures,
    costText,
    sellText,
    dataText,
    notsold,
    enchantments,
    shouldDelete,
  ] = response.formValues;
  if (shouldDelete) {
    shopConfig.items[categoryId].splice(index, 1);
    if (dbMeta.itemCounts[categoryId] && dbMeta.itemCounts[categoryId] > 0) {
      dbMeta.itemCounts[categoryId]--;
      world.setDynamicProperty("shop_db_meta", JSON.stringify(dbMeta));
    }

    saveShopConfig();
    player.sendMessage("§a[Shop Config] Item deleted!");
  } else {
    if (!name || !itemId || !textures) {
      player.sendMessage("§c[Shop Config] Name, Item ID, Texture required!");
      return editItem(player, categoryId, index);
    }

    const cost = parseInt(costText) || 1;
    const sell = parseInt(sellText) || 0;
    const data = parseInt(dataText) || 0;

    Object.assign(item, { name, item: itemId, textures, cost, sell, data });
    notsold ? (item.notsold = true) : delete item.notsold;
    enchantments ? (item.enchantments = enchantments) : delete item.enchantments;
    saveShopConfig();
    player.sendMessage("§a[Shop Config] Item updated!");
  }
  showItemsMenu(player, categoryId);
}

async function showResetOptionsMenu(player) {
  const form = new ActionFormData()
    .title("Reset Options")
    .body("§7Choose what you want to reset:")
    .button(
      "§l§cReset Categories Only\n§r§8Reset categories to default, keep custom items",
      "textures/ui/book_metatag_default",
    )
    .button(
      "§l§6Reset Items Only\n§r§8Reset all items to default, keep custom categories",
      "textures/ui/bookshelf_flat",
    )
    .button(
      "§l§4Reset Everything\n§r§8Reset both categories and items to default",
      "textures/ui/realms_red_x",
    )
    .button("§lCancel\n§r§8Return to menu", "textures/ui/arrow_left");

  const response = await form.show(player);
  if (response.canceled || response.selection === 3) {
    return showShopConfigMenu(player, shopMenuReturnCallback);
  }

  switch (response.selection) {
    case 0:
      await confirmResetCategories(player);
      break;
    case 1:
      await confirmResetItems(player);
      break;
    case 2:
      await confirmResetEverything(player);
      break;
  }
}

async function confirmResetCategories(player) {
  const form = new ActionFormData()
    .title("Reset Categories")
    .body(
      "§c§lWarning!§r\nThis will reset all categories to default.\nCustom categories will be lost, but custom items will be preserved.\n\nContinue?",
    )
    .button("§l§cReset Categories\n§r§8Confirm", "textures/ui/realms_red_x")
    .button("§lCancel\n§r§8Return to options", "textures/ui/arrow_left");

  const response = await form.show(player);
  if (response.canceled || response.selection === 1) {
    return showResetOptionsMenu(player);
  }

  if (response.selection === 0) {
    if (resetCategories()) {
      player.sendMessage(
        "§a[Shop Config] Categories reset to default successfully!",
      );
    } else {
      player.sendMessage("§c[Shop Config] Failed to reset categories!");
    }
  }
  showShopConfigMenu(player, shopMenuReturnCallback);
}

async function confirmResetItems(player) {
  const form = new ActionFormData()
    .title("Reset Items")
    .body(
      "§c§lWarning!§r\nThis will reset all items in all categories to default.\nCustom items will be lost, but custom categories will be preserved.\n\nContinue?",
    )
    .button("§l§6Reset Items\n§r§8Confirm", "textures/ui/realms_red_x")
    .button("§lCancel\n§r§8Return to options", "textures/ui/arrow_left");

  const response = await form.show(player);
  if (response.canceled || response.selection === 1) {
    return showResetOptionsMenu(player);
  }

  if (response.selection === 0) {
    if (resetItems()) {
      player.sendMessage(
        "§a[Shop Config] Items reset to default successfully!",
      );
    } else {
      player.sendMessage("§c[Shop Config] Failed to reset items!");
    }
  }
  showShopConfigMenu(player, shopMenuReturnCallback);
}

async function confirmResetEverything(player) {
  const form = new ActionFormData()
    .title("Reset Everything")
    .body(
      "§c§lWarning!§r\nThis will reset the entire shop configuration to default.\nAll custom categories and items will be lost.\n\nContinue?",
    )
    .button("§l§4Reset Everything\n§r§8Confirm", "textures/ui/realms_red_x")
    .button("§lCancel\n§r§8Return to options", "textures/ui/arrow_left");

  const response = await form.show(player);
  if (response.canceled || response.selection === 1) {
    return showResetOptionsMenu(player);
  }

  if (response.selection === 0) {
    if (forceResetShopConfig()) {
      player.sendMessage(
        "§a[Shop Config] Configuration reset to default successfully!",
      );
    } else {
      player.sendMessage("§c[Shop Config] Failed to reset configuration!");
    }
  }
  showShopConfigMenu(player, shopMenuReturnCallback);
}

function resetCategories() {
  try {
    // Backup current items
    const currentItems = JSON.parse(JSON.stringify(shopConfig.items));

    // Reset categories to default
    shopConfig.categories = JSON.parse(
      JSON.stringify(DEFAULT_SHOP_CONFIG.categories),
    );

    // Clear category databases
    for (const dbName of dbMeta.categoryDBs || []) {
      world.setDynamicProperty(dbName, "[]");
    }

    // Reset category database metadata
    dbMeta.categoryDBs = [`${DB_PREFIX.CATEGORY}_0`];
    dbMeta.categoryCount = 0;

    // Preserve items for categories that still exist in default config
    shopConfig.items = {};
    for (const category of shopConfig.categories) {
      if (currentItems[category.id]) {
        shopConfig.items[category.id] = currentItems[category.id];
      } else {
        shopConfig.items[category.id] = JSON.parse(
          JSON.stringify(DEFAULT_SHOP_CONFIG.items[category.id] || []),
        );
      }
    }

    // Save the updated configuration
    if (saveShopConfig()) {
      console.log("[Shop Config] Categories reset successfully");
      return true;
    }
    return false;
  } catch (e) {
    console.error("[Shop Config] Error resetting categories:", e);
    return false;
  }
}

function resetItems() {
  try {
    // Keep current categories but reset all items to default
    for (const category of shopConfig.categories) {
      if (DEFAULT_SHOP_CONFIG.items[category.id]) {
        shopConfig.items[category.id] = JSON.parse(
          JSON.stringify(DEFAULT_SHOP_CONFIG.items[category.id]),
        );
      } else {
        // For custom categories, clear items
        shopConfig.items[category.id] = [];
      }
    }

    // Clear item databases
    for (const categoryId in dbMeta.itemDBs || {}) {
      for (const dbName of dbMeta.itemDBs[categoryId] || []) {
        world.setDynamicProperty(dbName, "[]");
      }
    }

    // Reset item database metadata
    dbMeta.itemDBs = {};
    dbMeta.itemCounts = {};

    // Save the updated configuration
    if (saveShopConfig()) {
      console.log("[Shop Config] Items reset successfully");
      return true;
    }
    return false;
  } catch (e) {
    console.error("[Shop Config] Error resetting items:", e);
    return false;
  }
}

async function showDBInfo(player) {
  const totalCategories = shopConfig.categories.length;
  let totalItems = 0;
  for (const catId in shopConfig.items) {
    totalItems += shopConfig.items[catId].length;
  }

  const categoryDBCount = dbMeta.categoryDBs.length;
  let itemDBCount = 0;
  for (const catId in dbMeta.itemDBs) {
    itemDBCount += dbMeta.itemDBs[catId].length;
  }

  let infoText = `§7§lDatabase Usage Info\n\n`;
  infoText += `§fTotal Categories: §a${totalCategories}\n`;
  infoText += `§fTotal Items: §a${totalItems}\n\n`;
  infoText += `§fCategory DB Count: §a${categoryDBCount}\n`;
  infoText += `§fItem DB Count: §a${itemDBCount}\n\n`;
  infoText += `§fCategory DBs:\n`;

  for (const dbName of dbMeta.categoryDBs) {
    infoText += `§8- §f${dbName}\n`;
  }

  infoText += `\n§fItem DBs:\n`;
  for (const catId in dbMeta.itemDBs) {
    const catName =
      shopConfig.categories.find((c) => c.id === catId)?.name || catId;
    infoText += `§8- §f${catName}: §a${dbMeta.itemDBs[catId].length} §fdatabases\n`;
  }

  const form = new ActionFormData()
    .title("Database Info")
    .body(infoText)
    .button("§lBack\n§r§8Return to config menu", "textures/ui/arrow_left");

  const response = await form.show(player);
  showShopConfigMenu(player, shopMenuReturnCallback);
}
