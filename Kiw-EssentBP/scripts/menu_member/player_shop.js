import { system, world, ItemStack, EnchantmentType } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { showMemberMenu } from "../member";
import { getScore, setScore } from "../lib/game.js";
import {
  getFullMoney,
  setMoney,
  addMoney,
  removeMoney,
  getFormattedMoney,
} from "../function/moneySystem.js";
import { applyItemProperties } from "./barter.js";
import { Database } from "../function/Database.js";
import { Lang } from "../lib/Lang.js";
const offlineMoneyDB = new Database("offline_money");
const marketListings = new Map();
let lastListingId = 0;
let hasInitialized = false;
let isDataLoaded = false;
let lastSaveTime = 0;
const SAVE_INTERVAL = 30000;
const CACHE_DURATION = 5000;
const playerCache = new Map();
const playerCacheTimeout = new Map();
const uiCache = new Map();
const UI_CACHE_DURATION = 1000;
const BANNED_ITEMS = [
  "minecraft:potion",
  "minecraft:splash_potion",
  "minecraft:lingering_potion",
  "minecraft:enchanted_book",
];
function getPlayerMoney(player) {
  return getFullMoney(player);
}
const itemVerificationCache = new Map();
const VERIFICATION_CACHE_DURATION = 2000;
function getItemDurability(item) {
  if (!item) return null;
  const durabilityComponent = item.getComponent("minecraft:durability");
  if (!durabilityComponent) return null;
  if (
    typeof durabilityComponent.maxDurability !== "number" ||
    typeof durabilityComponent.damage !== "number"
  ) {
    return null;
  }
  const maxDurability = durabilityComponent.maxDurability;
  const currentDamage = durabilityComponent.damage;
  const remainingDurability = maxDurability - currentDamage;
  const durabilityPercentage = Math.floor(
    (remainingDurability / maxDurability) * 100,
  );
  if (
    currentDamage < 0 ||
    currentDamage > maxDurability ||
    maxDurability <= 0
  ) {
    return null;
  }
  return {
    maxDurability,
    currentDamage,
    remainingDurability,
    durabilityPercentage,
  };
}
function getItemEnchantments(item) {
  if (!item) return [];
  const enchantments = [];
  try {
    const enchantComp = item.getComponent("enchantable");
    if (enchantComp) {
      try {
        const enchants = enchantComp.getEnchantments();
        if (enchants && Array.isArray(enchants)) {
          for (const enchant of enchants) {
            if (enchant && enchant.type && enchant.type.id) {
              enchantments.push({
                id: enchant.type.id,
                level: enchant.level || 1,
              });
            }
          }
        }
      } catch (enchError) {}
    }
  } catch (error) {}
  return enchantments;
}
function getItemCustomName(item) {
  if (!item) return "";
  let customName = "";
  try {
    if (item.nameTag && item.nameTag.length > 0) {
      customName = item.nameTag;
    } else {
      try {
        const nameComp = item.getComponent("minecraft:custom_name");
        if (nameComp && nameComp.name && nameComp.name.length > 0) {
          customName = nameComp.name;
        }
      } catch {}
    }
  } catch {}
  return customName;
}
async function verifyItemInInventory(
  player,
  typeId,
  amount,
  data = 0,
  durabilityData = null,
) {
  const cacheKey = `${player.name}-${typeId}-${amount}-${data}-${durabilityData ? JSON.stringify(durabilityData) : "noDurability"}`;
  const now = Date.now();
  const cachedResult = itemVerificationCache.get(cacheKey);
  if (
    cachedResult &&
    now - cachedResult.timestamp < VERIFICATION_CACHE_DURATION
  ) {
    return cachedResult.result;
  }
  try {
    if (durabilityData) {
      const inventory = player.getComponent("inventory").container;
      let foundAmount = 0;
      for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item || item.typeId !== typeId) continue;
        const itemDurability = getItemDurability(item);
        if (
          itemDurability &&
          itemDurability.currentDamage === durabilityData.currentDamage
        ) {
          foundAmount += item.amount;
          if (foundAmount >= amount) {
            itemVerificationCache.set(cacheKey, {
              result: true,
              timestamp: now,
            });
            return true;
          }
        }
      }
      itemVerificationCache.set(cacheKey, { result: false, timestamp: now });
      return false;
    }
    const itemName = typeId.replace("minecraft:", "");
    let testCommand;
    if (itemName === "potion") {
      testCommand = `testfor @s[hasitem={item=${itemName},quantity=${amount}}]`;
    } else {
      testCommand = `testfor @s[hasitem={item=${itemName},quantity=${amount}${data !== 0 ? `,data=${data}` : ""}}]`;
    }
    try {
      await player.runCommand(testCommand);
      itemVerificationCache.set(cacheKey, { result: true, timestamp: now });
      return true;
    } catch {
      itemVerificationCache.set(cacheKey, { result: false, timestamp: now });
      return false;
    }
  } catch {
    return false;
  }
}
let lastItemRemoval = new Map();
const ITEM_REMOVAL_INTERVAL = 500;
async function removeItemFromInventory(
  player,
  typeId,
  amount,
  data = 0,
  durabilityData = null,
) {
  const now = Date.now();
  const lastRemoval = lastItemRemoval.get(player.name) || 0;
  if (now - lastRemoval < ITEM_REMOVAL_INTERVAL) {
    return false;
  }
  try {
    if (durabilityData || typeId.includes(":")) {
      const inventory = player.getComponent("inventory").container;
      let remainingToRemove = amount;
      for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item || item.typeId !== typeId) continue;
        if (durabilityData && item.getComponent("minecraft:durability")) {
          const itemDurability = getItemDurability(item);
          if (
            !itemDurability ||
            itemDurability.currentDamage !== durabilityData.currentDamage
          )
            continue;
        }
        const amountToRemove = Math.min(remainingToRemove, item.amount);
        if (amountToRemove === item.amount) {
          inventory.setItem(i, undefined);
        } else {
          item.amount -= amountToRemove;
          inventory.setItem(i, item);
        }
        remainingToRemove -= amountToRemove;
        if (remainingToRemove <= 0) break;
      }
      if (remainingToRemove > 0) {
        return false;
      }
      lastItemRemoval.set(player.name, now);
      clearPlayerCache(player.name);
      return true;
    }
    const itemName = typeId.replace("minecraft:", "");
    let clearCommand;
    if (itemName === "potion") {
      clearCommand = `clear @s ${itemName} 0 ${amount}`;
    } else {
      clearCommand = `clear @s ${itemName} ${data} ${amount}`;
    }
    try {
      await player.runCommand(clearCommand);
      lastItemRemoval.set(player.name, now);
      clearPlayerCache(player.name);
      return true;
    } catch {
      const inventory = player.getComponent("inventory").container;
      let remainingToRemove = amount;
      for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (!item || item.typeId !== typeId) continue;
        const amountToRemove = Math.min(remainingToRemove, item.amount);
        if (amountToRemove === item.amount) {
          inventory.setItem(i, undefined);
        } else {
          item.amount -= amountToRemove;
          inventory.setItem(i, item);
        }
        remainingToRemove -= amountToRemove;
        if (remainingToRemove <= 0) break;
      }
      if (remainingToRemove > 0) {
        return false;
      }
      lastItemRemoval.set(player.name, now);
      clearPlayerCache(player.name);
      return true;
    }
  } catch {
    return false;
  }
}
let lastItemGive = new Map();
const ITEM_GIVE_INTERVAL = 500;
async function giveItemToPlayer(
  player,
  typeId,
  amount,
  data = 0,
  silent = false,
  durabilityData = null,
  enchantments = [],
  name = "",
  lore = [],
) {
  const now = Date.now();
  const lastGive = lastItemGive.get(player.name) || 0;
  if (now - lastGive < ITEM_GIVE_INTERVAL) {
    return false;
  }
  try {
    const feedbackStatus = silent ? await getFeedbackStatus(player) : null;
    if (silent) {
      await player.runCommand("gamerule sendcommandfeedback false");
    }
    let success = false;
    let itemGiven = false;
    try {
      try {
        applyItemProperties(
          player,
          typeId,
          amount,
          data,
          enchantments,
          name,
          lore,
          durabilityData,
        );
        itemGiven = true;
      } catch (applyError) {}
      if (!itemGiven) {
        const itemId = typeId.replace("minecraft:", "");
        const dataValue =
          data !== undefined && data !== null
            ? data
            : durabilityData && durabilityData.currentDamage !== undefined
              ? durabilityData.currentDamage
              : 0;
        await player.runCommand(`give @s ${itemId} ${amount} ${dataValue}`);
        itemGiven = true;
        if (name && name.length > 0) {
          try {
            const inventory = player.getComponent("inventory").container;
            for (let i = 0; i < inventory.size; i++) {
              const item = inventory.getItem(i);
              if (item && item.typeId === typeId && item.amount === amount) {
                try {
                  item.nameTag = name;
                  inventory.setItem(i, item);
                  break;
                } catch (nameError) {}
              }
            }
          } catch (invError) {}
        }
      }
      try {
        const container = player.getComponent("inventory").container;
        let foundItem = false;
        for (let i = 0; i < container.size; i++) {
          const item = container.getItem(i);
          if (item && item.typeId === typeId) {
            foundItem = true;
            break;
          }
        }
        success = foundItem;
      } catch (verifyError) {
        success = itemGiven;
      }
    } catch (giveError) {
      success = false;
    }
    if (silent && feedbackStatus !== null) {
      await player.runCommand(`gamerule sendcommandfeedback ${feedbackStatus}`);
    }
    lastItemGive.set(player.name, now);
    clearPlayerCache(player.name);
    return itemGiven || success;
  } catch (error) {
    if (silent) {
      try {
        await player.runCommand("gamerule sendcommandfeedback true");
      } catch {}
    }
    return false;
  }
}
async function getFeedbackStatus(player) {
  try {
    return true;
  } catch {
    return true;
  }
}
function saveMarketListings(force = false) {
  const now = Date.now();
  if (!force && now - lastSaveTime < SAVE_INTERVAL) {
    return;
  }
  try {
    const listingsArray = Array.from(marketListings.values());
    world.setDynamicProperty("marketListings", JSON.stringify(listingsArray));
    world.setDynamicProperty("lastListingId", lastListingId);
    lastSaveTime = now;
  } catch {}
}
function loadMarketListings() {
  if (isDataLoaded) return;
  try {
    const listingsJson = world.getDynamicProperty("marketListings");
    const savedLastId = world.getDynamicProperty("lastListingId");
    if (listingsJson) {
      const listingsArray = JSON.parse(listingsJson);
      marketListings.clear();
      listingsArray.forEach((listing) => {
        marketListings.set(listing.id, listing);
      });
    }
    if (savedLastId !== undefined) {
      lastListingId = savedLastId;
    }
    isDataLoaded = true;
  } catch {}
}
async function getPlayerData(player) {
  try {
    const now = Date.now();
    const cachedData = playerCache.get(player.name);
    const cacheTimeout = playerCacheTimeout.get(player.name);
    if (cachedData && cacheTimeout && now < cacheTimeout) {
      return cachedData;
    }
    const money = getPlayerMoney(player);
    const inventory = await getPlayerInventory(player);
    const data = {
      money: money,
      inventory: inventory,
    };
    playerCache.set(player.name, data);
    playerCacheTimeout.set(player.name, now + CACHE_DURATION);
    return data;
  } catch {
    return {
      money: 0,
      inventory: [],
    };
  }
}
function clearPlayerCache(playerName) {
  playerCache.delete(playerName);
  playerCacheTimeout.delete(playerName);
}
system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id === "kiwora:PlayerShop") {
    const player = event.sourceEntity;
    if (player) {
      if (!hasInitialized) {
        try {
          loadMarketListings();
          hasInitialized = true;
        } catch {}
      }
      clearPlayerCache(player.name);
      showPlayerShopMenu(player);
    }
  }
});
world.afterEvents.worldLoad.subscribe(() => {
  try {
    loadMarketListings();
  } catch {}
});
function isItemBanned(typeId) {
  return BANNED_ITEMS.includes(typeId);
}
class MarketListing {
  constructor(
    seller,
    itemTypeId,
    itemAmount,
    itemData,
    price,
    durabilityData = null,
    enchantments = [],
    name = "",
    lore = [],
  ) {
    this.id = ++lastListingId;
    this.seller = seller;
    this.sellerName = seller.name;
    this.itemTypeId = itemTypeId;
    this.itemAmount = itemAmount;
    this.itemData = itemData || 0;
    this.price = price;
    this.timestamp = Date.now();
    this.durabilityData = durabilityData;
    this.enchantments = enchantments;
    this.name = name;
    this.lore = lore;
  }
}
function getCachedUI(key, generator) {
  const now = Date.now();
  const cached = uiCache.get(key);
  if (cached && now - cached.timestamp < UI_CACHE_DURATION) {
    return cached.element;
  }
  const element = generator();
  uiCache.set(key, { element, timestamp: now });
  return element;
}
export function showPlayerShopMenu(player) {
  const form = getCachedUI("playerShopMenu", () => {
    return new ActionFormData()
      .title(Lang.t(player, "player.shop.title"))
      .body(Lang.t(player, "player.shop.body"))
      .button(Lang.t(player, "player.shop.btn.browse"), "textures/icon_custom/my_content")
      .button(Lang.t(player, "player.shop.btn.sell"), "textures/ui/icon_book_writable")
      .button(Lang.t(player, "player.shop.btn.my_listings"), "textures/ui/inventory_icon")
      .button(Lang.t(player, "common.back"), "textures/ui/arrow_left");
  });
  form.show(player).then((response) => {
    if (!response.canceled) {
      try {
        switch (response.selection) {
          case 0:
            showMarketplace(player).catch(() => {
              player.runCommand(
                `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.err.open_market")}"}]}`,
              );
            });
            break;
          case 1:
            showSellItemMenu(player).catch(() => {
              player.runCommand(
                `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.err.open_sell")}"}]}`,
              );
            });
            break;
          case 2:
            showMyListingsMenu(player).catch(() => {
              player.runCommand(
                `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.err.open_listings")}"}]}`,
              );
            });
            break;
          case 3:
            showMemberMenu(player);
            break;
        }
      } catch {
        player.runCommand(
          `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.err.general")}"}]}`,
        );
      }
    }
  });
}
async function getPlayerInventory(player) {
  const inventory = [];
  try {
    const container = player.getComponent("inventory").container;
    for (let i = 0; i < container.size; i++) {
      const item = container.getItem(i);
      if (item) {
        const durabilityInfo = getItemDurability(item);
        const enchantments = getItemEnchantments(item);
        const customName = getItemCustomName(item);
        let lore = [];
        try {
          if (item.getLore && typeof item.getLore === "function") {
            lore = item.getLore();
          }
        } catch {}
        inventory.push({
          typeId: item.typeId,
          amount: item.amount,
          data: item.data,
          slot: i,
          durability: durabilityInfo,
          enchantments: enchantments,
          name: customName,
          lore: lore,
        });
      }
    }
  } catch (error) {}
  return inventory;
}
async function showSellItemMenu(player) {
  try {
    const playerData = await getPlayerData(player);
    if (!playerData || !playerData.inventory) {
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.sell.err.load_inv")}"}]}`,
      );
      system.runTimeout(() => showPlayerShopMenu(player), 20);
      return;
    }
    const inventory = playerData.inventory;
    if (inventory.length === 0) {
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.sell.err.empty_inv")}"}]}`,
      );
      system.runTimeout(() => showPlayerShopMenu(player), 20);
      return;
    }
    const sellableItems = inventory.filter(
      (item) => !isItemBanned(item.typeId),
    );
    if (sellableItems.length === 0) {
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.sell.err.no_sellable")}"}]}`,
      );
      system.runTimeout(() => showPlayerShopMenu(player), 20);
      return;
    }
    await showSelectItemMenu(player, sellableItems);
  } catch {
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.err.open_sell")}"}]}`,
    );
    system.runTimeout(() => showPlayerShopMenu(player), 20);
  }
}
async function showSelectItemMenu(player, sellableItems) {
  try {
    const form = new ActionFormData()
      .title(Lang.t(player, "player.shop.sell.title"))
      .body(Lang.t(player, "player.shop.sell.body"));
    const displayItems = sellableItems.slice(0, 14);
    displayItems.forEach((item) => {
      const itemName = formatItemName(item);
      const itemId = item.typeId.replace("minecraft:", "");
      const texturePath = getItemTexturePath(itemId);
      form.button(`${itemName} (x${item.amount})`, texturePath);
    });
    if (sellableItems.length > 14) {
      form.button("Next Page", "textures/ui/arrow_right");
    }
    form.button(Lang.t(player, "common.back"), "textures/ui/arrow_left");
    form.show(player).then(async (response) => {
      if (response.canceled) {
        showPlayerShopMenu(player);
        return;
      }
      const selection = response.selection;
      if (selection === displayItems.length) {
        showPlayerShopMenu(player);
        return;
      }
      if (
        selection ===
        displayItems.length + (sellableItems.length > 14 ? 1 : 0)
      ) {
        showPlayerShopMenu(player);
        return;
      }
      if (selection < displayItems.length) {
        const selectedItem = displayItems[selection];
        showSetPriceAndQuantityMenu(player, selectedItem);
      }
    });
  } catch {
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.sell.err.select")}"}]}`,
    );
    system.runTimeout(() => showPlayerShopMenu(player), 20);
  }
}
function getItemTexturePath(itemId) {
  return "textures/blocks/chest_front";
}
async function showSetPriceAndQuantityMenu(player, selectedItem) {
  const maxQuantity = selectedItem.amount;
  const form = new ModalFormData()
    .title(Lang.t(player, "player.shop.price.title"))
    .slider(Lang.t(player, "player.shop.price.quantity"), 1, maxQuantity, {
      defaultValue: Math.min(maxQuantity, 64),
      valueStep: 1,
      tooltip: "§bSelect how many items to sell",
    })
    .textField(Lang.t(player, "player.shop.price.price"), Lang.t(player, "player.shop.price.placeholder"), {
      defaultValue: "",
      placeholder: Lang.t(player, "player.shop.price.placeholder"),
      tooltip: "§bSet the selling price",
    });
  form.show(player).then(async (response) => {
    if (response.canceled) {
      getPlayerInventory(player).then((inventory) => {
        const filteredItems = inventory.filter(
          (item) => !isItemBanned(item.typeId),
        );
        showSelectItemMenu(player, filteredItems);
      });
      return;
    }
    const [amount, priceText] = response.formValues;
    const price = parseInt(priceText);
    if (isNaN(price) || price <= 0) {
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.price.err.invalid")}"}]}`,
      );
      system.runTimeout(
        () => showSetPriceAndQuantityMenu(player, selectedItem),
        20,
      );
      return;
    }
    const currentInventory = await getPlayerInventory(player);
    const currentItem = currentInventory.find(
      (item) =>
        item.typeId === selectedItem.typeId &&
        item.data === selectedItem.data &&
        ((!selectedItem.durability && !item.durability) ||
          (selectedItem.durability &&
            item.durability &&
            selectedItem.durability.currentDamage ===
              item.durability.currentDamage)),
    );
    if (!currentItem) {
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.price.err.not_found")}"}]}`,
      );
      system.runTimeout(() => showPlayerShopMenu(player), 20);
      return;
    }
    if (amount > currentItem.amount) {
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.price.err.not_enough", currentItem.amount)}"}]}`,
      );
      getPlayerInventory(player).then((inventory) => {
        const filteredItems = inventory.filter(
          (item) => !isItemBanned(item.typeId),
        );
        system.runTimeout(() => showSelectItemMenu(player, filteredItems), 20);
      });
      return;
    }
    if (
      !(await verifyItemInInventory(
        player,
        selectedItem.typeId,
        amount,
        selectedItem.data || 0,
        selectedItem.durability,
      ))
    ) {
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.price.err.not_found")}"}]}`,
      );
      system.runTimeout(() => showPlayerShopMenu(player), 20);
      return;
    }
    try {
      const success = await removeItemFromInventory(
        player,
        selectedItem.typeId,
        amount,
        selectedItem.data || 0,
        selectedItem.durability,
      );
      if (!success) {
        player.runCommand(
          `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.price.err.remove")}"}]}`,
        );
        system.runTimeout(() => showPlayerShopMenu(player), 20);
        return;
      }
      const listing = new MarketListing(
        player,
        selectedItem.typeId,
        amount,
        selectedItem.data || 0,
        price,
        selectedItem.durability,
        selectedItem.enchantments || [],
        selectedItem.name || "",
        selectedItem.lore || [],
      );
      marketListings.set(listing.id, listing);
      saveMarketListings(true);
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.list.success", listing.id)}"}]}`,
      );
      player.runCommand(`playsound random.levelup @s`);
      for (const onlinePlayer of world.getPlayers()) {
        if (onlinePlayer.name !== player.name) {
          onlinePlayer.runCommand(
            `tellraw @s {"rawtext":[{"text":"${Lang.t(onlinePlayer, "player.shop.list.broadcast", player.name, formatItemName(selectedItem), amount, price)}"}]}`,
          );
        }
      }
      showPlayerShopMenu(player);
    } catch (error) {
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"§c✘ Error when selling: ${error.message}"}]}`,
      );
      system.runTimeout(() => showPlayerShopMenu(player), 20);
    }
  });
}
async function showMarketplace(player) {
  try {
    if (!isDataLoaded) {
      try {
        loadMarketListings();
      } catch {}
    }
    const playerData = await getPlayerData(player);
    const money = playerData?.money || 0;
    const validListings = Array.from(marketListings.values())
      .filter((listing) => listing.sellerName !== player.name)
      .sort((a, b) => b.timestamp - a.timestamp);
    if (validListings.length === 0) {
      const form = getCachedUI("emptyMarketplace", () => {
        return new ActionFormData()
          .title(Lang.t(player, "player.shop.market.title"))
          .body(Lang.t(player, "player.shop.market.empty"))
          .button(`§a${Lang.t(player, "common.back")}`, "textures/ui/arrow_left");
      });
      form.show(player).then(() => {
        showPlayerShopMenu(player);
      });
      return;
    }
    const form = new ActionFormData()
      .title(Lang.t(player, "player.shop.market.title"))
      .body(Lang.t(player, "player.shop.market.body", validListings.length, money));
    validListings.forEach((listing) => {
      const itemName = formatItemName({
        typeId: listing.itemTypeId,
        data: listing.itemData,
        durability: listing.durabilityData,
      });
      const itemId = listing.itemTypeId.replace("minecraft:", "");
      const texturePath = getItemTexturePath(itemId);
      form.button(
        `§b${itemName} §r§f(x${listing.itemAmount})\n§a${Lang.t(player, "player.shop.price.price")}: ${listing.price} §d| ${listing.sellerName}`,
        texturePath,
      );
    });
    form.button(`§a${Lang.t(player, "common.back")}`, "textures/ui/arrow_left");
    form.show(player).then((response) => {
      if (response.canceled) {
        showPlayerShopMenu(player);
        return;
      }
      if (response.selection < validListings.length) {
        showBuyConfirmation(player, validListings[response.selection]);
      } else {
        showPlayerShopMenu(player);
      }
    });
  } catch {
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.market.err")}"}]}`,
    );
    system.runTimeout(() => showPlayerShopMenu(player), 20);
  }
}
async function showBuyConfirmation(player, listing) {
  try {
    if (listing.sellerName === player.name) {
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.buy.err.own_item")}"}]}`,
      );
      system.runTimeout(() => showMarketplace(player), 20);
      return;
    }
    const playerData = await getPlayerData(player);
    const money = playerData?.money || 0;
    const itemName = formatItemName({
      typeId: listing.itemTypeId,
      data: listing.itemData,
      durability: listing.durabilityData,
      enchantments: listing.enchantments,
    });
    let enchantmentText = "";
    if (listing.enchantments && listing.enchantments.length > 0) {
      enchantmentText = Lang.t(player, "player.shop.buy.enchantments");
      listing.enchantments.forEach((ench) => {
        enchantmentText += Lang.t(player, "player.shop.buy.enchantment", ench.id.replace("minecraft:", ""), ench.level);
      });
    }
    const form = getCachedUI(`buyConfirmation-${listing.id}`, () => {
      const balanceStatus = money < listing.price
        ? "§c✘ " + Lang.t(player, "player.shop.buy.err.no_money", listing.price)
        : "§a✓ " + Lang.t(player, "player.shop.buy.success", itemName, listing.itemAmount);
      return new ActionFormData()
        .title(Lang.t(player, "player.shop.buy.title"))
        .body(Lang.t(player, "player.shop.buy.body", itemName, listing.itemAmount, listing.price, listing.sellerName, enchantmentText, money, balanceStatus))
        .button("§a" + Lang.t(player, "player.shop.buy.title"), "textures/ui/confirm")
        .button("§c" + Lang.t(player, "common.close"), "textures/ui/cancel");
    });
    form.show(player).then((response) => {
      if (response.canceled || response.selection === 1) {
        showMarketplace(player);
        return;
      }
      if (response.selection === 0) {
        buyItem(player, listing);
      }
    });
  } catch {
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.buy.err.confirm")}"}]}`,
    );
    system.runTimeout(() => showMarketplace(player), 20);
  }
}
function saveOfflineTransaction(
  sellerName,
  amount,
  buyerName,
  itemTypeId,
  itemAmount,
  itemData,
) {
  try {
    const amountStr = String(amount);
    console.warn(
      `[MARKET DEBUG] Saving offline transaction for ${sellerName}: ${amountStr} Money from ${buyerName}`,
    );
    let offlineTransactions = offlineMoneyDB.get("transactions", {});
    if (!offlineTransactions[sellerName]) {
      offlineTransactions[sellerName] = {
        pendingMoney: 0,
        transactions: [],
      };
    }
    const currentPending =
      Number(offlineTransactions[sellerName].pendingMoney) || 0;
    const amountToAdd = Number(amount) || 0;
    offlineTransactions[sellerName].pendingMoney = currentPending + amountToAdd;
    offlineTransactions[sellerName].transactions.push({
      buyerName: buyerName,
      amount: amountToAdd,
      itemTypeId: itemTypeId,
      itemAmount: itemAmount,
      itemData: itemData,
      timestamp: Date.now(),
    });
    if (offlineTransactions[sellerName].transactions.length > 20) {
      offlineTransactions[sellerName].transactions =
        offlineTransactions[sellerName].transactions.slice(-20);
    }
    offlineMoneyDB.set("transactions", offlineTransactions);
    savePendingNotification(
      sellerName,
      buyerName,
      amount,
      itemTypeId,
      itemAmount,
      itemData,
    );
    return true;
  } catch (error) {
    console.warn("Error saving offline transaction:", error);
    return false;
  }
}
function savePendingNotification(
  sellerName,
  buyerName,
  amount,
  itemTypeId,
  itemAmount,
  itemData,
) {
  try {
    return true;
  } catch (error) {
    console.warn("Error saving notification:", error);
    return false;
  }
}
function checkOfflineTransactions(player) {
  try {
    if (!player || typeof player !== "object") return false;
    let playerName;
    try {
      playerName = player.name;
    } catch {
      return false;
    }
    if (!playerName || typeof playerName !== "string") return false;
    const offlineTransactions = offlineMoneyDB.get("transactions", {});
    if (
      offlineTransactions[playerName] &&
      offlineTransactions[playerName].pendingMoney > 0
    ) {
      const pendingData = offlineTransactions[playerName];
      const pendingAmount = pendingData.pendingMoney;
      const transactions = pendingData.transactions || [];
      const amountStr = String(pendingAmount);
      console.warn(
        `[MARKET DEBUG] Processing offline money for ${playerName}: ${amountStr}`,
      );
      try {
        try {
          if (!player.name) return false;
        } catch {
          return false;
        }
        const amountToAdd = BigInt(amountStr);
        const success = addMoney(player, amountToAdd);
        if (success) {
          delete offlineTransactions[playerName];
          offlineMoneyDB.set("transactions", offlineTransactions);
          try {
            player.runCommand(
              `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.offline.received", amountStr)}"}]}`,
            );
            player.runCommand(`playsound random.levelup @s`);
          } catch {}
          if (transactions.length > 0) {
            system.runTimeout(() => {
              try {
                if (!player.name) return;
                player.runCommand(
                  `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.offline.details")}"}]}`,
                );
                for (let i = 0; i < Math.min(transactions.length, 5); i++) {
                  const tx = transactions[i];
                  const itemName = formatItemName({
                    typeId: tx.itemTypeId,
                    data: tx.itemData,
                  });
                  system.runTimeout(
                    () => {
                      try {
                        if (!player.name) return;
                        player.runCommand(
                          `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.offline.transaction", tx.buyerName, itemName, tx.itemAmount, tx.amount)}"}]}`,
                        );
                      } catch {}
                    },
                    20 * (i + 1),
                  );
                }
                if (transactions.length > 5) {
                  system.runTimeout(() => {
                    try {
                      if (!player.name) return;
                      player.runCommand(
                        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.offline.more", transactions.length - 5)}"}]}`,
                      );
                    } catch {}
                  }, 20 * 6);
                }
              } catch {}
            }, 40);
          }
          return true;
        } else {
          console.warn(`[MARKET] Failed to add offline money to ${playerName}`);
          return false;
        }
      } catch (conversionError) {
        console.warn(
          `[MARKET] Error converting money amount for ${playerName}:`,
          conversionError,
        );
        try {
          try {
            if (!player.name) return false;
          } catch {
            return false;
          }
          const numericAmount = Number(pendingAmount);
          if (!isNaN(numericAmount) && numericAmount > 0) {
            const success = addMoney(player, numericAmount);
            if (success) {
              delete offlineTransactions[playerName];
              offlineMoneyDB.set("transactions", offlineTransactions);
              try {
                player.runCommand(
                  `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.offline.received", numericAmount)}"}]}`,
                );
                player.runCommand(`playsound random.levelup @s`);
              } catch {}
              return true;
            }
          }
        } catch (fallbackError) {
          console.warn(
            `[MARKET] Fallback error for ${playerName}:`,
            fallbackError,
          );
        }
        return false;
      }
    }
    return false;
  } catch (error) {
    console.warn("Error checking offline transactions:", error);
    return false;
  }
}
function showPendingNotifications(player) {
  try {
    return false;
  } catch (error) {
    console.warn("Error showing notifications:", error);
    return false;
  }
}
world.afterEvents.playerSpawn.subscribe((event) => {
  const player = event.player;
  if (!player) return;
  system.runTimeout(() => {
    try {
      if (!player || typeof player !== "object") return;
      try {
        if (!player.name) return;
      } catch {
        return;
      }
      checkOfflineTransactions(player);
      showPendingNotifications(player);
    } catch {}
  }, 60);
});
async function buyItem(player, listing) {
  if (!marketListings.has(listing.id)) {
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.buy.err.not_available")}"}]}`,
    );
    system.runTimeout(() => showMarketplace(player), 20);
    return;
  }
  if (listing.sellerName === player.name) {
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.buy.err.own_item")}"}]}`,
    );
    system.runTimeout(() => showMarketplace(player), 20);
    return;
  }
  const seller = world.getPlayers({ name: listing.sellerName })[0];
  const playerMoney = getPlayerMoney(player);
  const price = listing.price;
  let priceBigInt;
  try {
    priceBigInt = BigInt(price);
  } catch (error) {
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"§c✘ Invalid price format. Please report this to an admin."}]}`,
    );
    system.runTimeout(() => showMarketplace(player), 20);
    return;
  }
  if (playerMoney < priceBigInt) {
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.buy.err.no_money", price)}"}]}`,
    );
    system.runTimeout(() => showMarketplace(player), 20);
    return;
  }
  try {
    const success = await giveItemToPlayer(
      player,
      listing.itemTypeId,
      listing.itemAmount,
      listing.itemData,
      true,
      listing.durabilityData,
      listing.enchantments,
      listing.name,
      listing.lore,
    );
    let itemFound = false;
    try {
      const container = player.getComponent("inventory").container;
      for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item && item.typeId === listing.itemTypeId) {
          itemFound = true;
          break;
        }
      }
    } catch (invError) {}
    if (!success && !itemFound) {
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.buy.err.give_item")}"}]}`,
      );
      system.runTimeout(() => showMarketplace(player), 20);
      return;
    }
    const moneyRemoveSuccess = removeMoney(player, price);
    if (!moneyRemoveSuccess) {
      try {
        removeItemFromInventory(
          player,
          listing.itemTypeId,
          listing.itemAmount,
          listing.itemData,
          listing.durabilityData,
        );
      } catch {}
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.buy.err.payment")}"}]}`,
      );
      system.runTimeout(() => showMarketplace(player), 20);
      return;
    }
    let paymentSuccess = true;
    if (seller) {
      try {
        const priceNumber = Number(price);
        const addMoneySuccess = addMoney(seller, priceNumber);
        if (addMoneySuccess) {
          seller.runCommand(
            `tellraw @s {"rawtext":[{"text":"${Lang.t(seller, "player.shop.seller.msg", player.name, formatItemName({ typeId: listing.itemTypeId, data: listing.itemData }), listing.itemAmount, price)}"}]}`,
          );
          seller.runCommand(`playsound random.orb @s`);
        } else {
          console.warn(
            `[MARKET] Failed to add money to online seller ${seller.name}`,
          );
          paymentSuccess = false;
        }
      } catch (moneyError) {
        console.warn(
          `[MARKET] Error adding money to online seller:`,
          moneyError,
        );
        paymentSuccess = false;
      }
    } else {
      try {
        paymentSuccess = saveOfflineTransaction(
          listing.sellerName,
          price,
          player.name,
          listing.itemTypeId,
          listing.itemAmount,
          listing.itemData,
        );
        if (!paymentSuccess) {
          console.warn(
            `[MARKET] Failed to save offline transaction for ${listing.sellerName}`,
          );
        }
      } catch (offlineError) {
        console.warn(
          `[MARKET] Error saving offline transaction:`,
          offlineError,
        );
        paymentSuccess = false;
      }
    }
    if (!paymentSuccess) {
      addMoney(player, price);
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.buy.err.payment_seller")}"}]}`,
      );
      system.runTimeout(() => showMarketplace(player), 20);
      return;
    }
    marketListings.delete(listing.id);
    saveMarketListings(true);
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.buy.success", formatItemName({ typeId: listing.itemTypeId, data: listing.itemData }), listing.itemAmount)}"}]}`,
    );
    player.runCommand(`playsound random.levelup @s`);
    showPlayerShopMenu(player);
  } catch (error) {
    try {
      addMoney(player, price);
      marketListings.set(listing.id, listing);
      saveMarketListings(true);
    } catch {}
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.buy.err.general", error.message)}"}]}`,
    );
    system.runTimeout(() => showMarketplace(player), 20);
  }
}
async function showMyListingsMenu(player) {
  try {
    if (!isDataLoaded) {
      try {
        loadMarketListings();
      } catch {}
    }
    const myListings = Array.from(marketListings.values())
      .filter((listing) => listing.sellerName === player.name)
      .sort((a, b) => b.timestamp - a.timestamp);
    if (myListings.length === 0) {
      const form = getCachedUI("emptyMyListings", () => {
        return new ActionFormData()
          .title(Lang.t(player, "player.shop.my_listings.title"))
          .body(Lang.t(player, "player.shop.my_listings.empty"))
          .button(`§a${Lang.t(player, "common.back")}`, "textures/ui/arrow_left");
      });
      form.show(player).then(() => {
        showPlayerShopMenu(player);
      });
      return;
    }
    const form = new ActionFormData()
      .title(Lang.t(player, "player.shop.my_listings.title"))
      .body(Lang.t(player, "player.shop.my_listings.body", myListings.length));
    myListings.forEach((listing) => {
      const itemName = formatItemName({
        typeId: listing.itemTypeId,
        data: listing.itemData,
        durability: listing.durabilityData,
      });
      const itemId = listing.itemTypeId.replace("minecraft:", "");
      const texturePath = getItemTexturePath(itemId);
      form.button(
        `§b${itemName} §r§f(x${listing.itemAmount})\n§a${Lang.t(player, "player.shop.price.price")}: ${listing.price} §d| ID: #${listing.id}`,
        texturePath,
      );
    });
    form.button(`§a${Lang.t(player, "common.back")}`, "textures/ui/arrow_left");
    form.show(player).then((response) => {
      if (response.canceled) {
        showPlayerShopMenu(player);
        return;
      }
      if (response.selection < myListings.length) {
        showListingManagement(player, myListings[response.selection]);
      } else {
        showPlayerShopMenu(player);
      }
    });
  } catch {
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.my_listings.err")}"}]}`,
    );
    system.runTimeout(() => showPlayerShopMenu(player), 20);
  }
}
async function showListingManagement(player, listing) {
  try {
    const itemName = formatItemName({
      typeId: listing.itemTypeId,
      data: listing.itemData,
      durability: listing.durabilityData,
    });
    const form = getCachedUI(`listingManagement-${listing.id}`, () => {
      return new ActionFormData()
        .title(Lang.t(player, "player.shop.manage.title"))
        .body(Lang.t(player, "player.shop.manage.body", itemName, listing.itemAmount, listing.price, listing.id))
        .button(Lang.t(player, "player.shop.manage.btn.cancel"), "textures/ui/cancel")
        .button(Lang.t(player, "player.shop.manage.btn.modify"), "textures/ui/pencil_edit_icon")
        .button(`§a${Lang.t(player, "common.back")}`, "textures/ui/arrow_left");
    });
    form.show(player).then(async (response) => {
      if (response.canceled) {
        showMyListingsMenu(player).catch(() => {});
        return;
      }
      if (response.selection === 0) {
        cancelAndRetrieveItem(player, listing).catch(() => {});
      } else if (response.selection === 1) {
        showModifyPriceMenu(player, listing);
      } else {
        showMyListingsMenu(player).catch(() => {});
      }
    });
  } catch {
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.manage.err")}"}]}`,
    );
    system.runTimeout(() => showMyListingsMenu(player), 20);
  }
}
async function cancelAndRetrieveItem(player, listing) {
  try {
    if (!marketListings.has(listing.id)) {
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.cancel.err.not_found")}"}]}`,
      );
      system.runTimeout(() => showMyListingsMenu(player), 20);
      return;
    }
    const success = await giveItemToPlayer(
      player,
      listing.itemTypeId,
      listing.itemAmount,
      listing.itemData,
      true,
      listing.durabilityData,
      listing.enchantments,
      listing.name,
      listing.lore,
    );
    if (!success) {
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.cancel.err.return")}"}]}`,
      );
      system.runTimeout(() => showMyListingsMenu(player), 20);
      return;
    }
    marketListings.delete(listing.id);
    saveMarketListings(true);
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.cancel.success")}"}]}`,
    );
    player.runCommand(`playsound random.pop @s`);
    showMyListingsMenu(player);
  } catch (error) {
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.cancel.err.general", error.message)}"}]}`,
    );
    system.runTimeout(() => showMyListingsMenu(player), 20);
  }
}
async function showModifyPriceMenu(player, listing) {
  try {
    const form = new ModalFormData()
      .title(Lang.t(player, "player.shop.modify.title"))
      .textField(
        Lang.t(player, "player.shop.modify.label"),
        Lang.t(player, "player.shop.modify.placeholder"),
        {
          defaultValue: String(listing.price),
          placeholder: Lang.t(player, "player.shop.modify.placeholder"),
          tooltip: "§bEnter the new price for this item",
        },
      );
    form.show(player).then((response) => {
      if (response.canceled) {
        showListingManagement(player, listing).catch(() => {});
        return;
      }
      const [newPriceText] = response.formValues;
      const newPrice = parseInt(newPriceText);
      if (isNaN(newPrice) || newPrice <= 0) {
        player.runCommand(
          `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.modify.err.invalid")}"}]}`,
        );
        system.runTimeout(() => showListingManagement(player, listing), 20);
        return;
      }
      listing.price = newPrice;
      saveMarketListings(true);
      player.runCommand(
        `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.modify.success")}"}]}`,
      );
      player.runCommand(`playsound random.orb @s`);
      showListingManagement(player, listing).catch(() => {});
    });
  } catch {
    player.runCommand(
      `tellraw @s {"rawtext":[{"text":"${Lang.t(player, "player.shop.modify.err")}"}]}`,
    );
    system.runTimeout(() => showMyListingsMenu(player), 20);
  }
}
function formatItemName(item) {
  let name = "";
  if (item.name && item.name.length > 0) {
    name = item.name;
  } else {
    name = item.typeId
      .replace("minecraft:", "")
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }
  if (item.durability) {
    const durabilityPercent =
      item.durability.durabilityPercentage ||
      Math.floor(
        (item.durability.remainingDurability / item.durability.maxDurability) *
          100,
      );
    let durabilityColor = "§a";
    if (durabilityPercent < 30) durabilityColor = "§c";
    else if (durabilityPercent < 70) durabilityColor = "§e";
    name += ` ${durabilityColor}[${durabilityPercent}%]§r`;
  }
  if (item.enchantments && item.enchantments.length > 0) {
    name += ` §b✨`;
  }
  return name;
}
