import { world, system, ItemStack, EnchantmentType } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { ForceOpen, metricNumbers } from "../../../lib/game.js";
import { shopConfig, loadShopConfig, getShopCurrency, getShopCurrencySymbol, getShopCurrencyName } from "../../../admin_menu/shopConfig.js";
import {
  getFullMoney,
  addMoney,
  removeMoney,
  formatMoneyValue,
} from "../../../function/moneySystem.js";
import { getEconomyBenefits } from "../../../plugins/ranks/rank_benefits.js";
function getShopBalance(player) {
  const currency = getShopCurrency();
  if (currency === "money") {
    return getFullMoney(player);
  }
  try {
    const objective = world.scoreboard.getObjective(currency);
    if (!objective) {
      console.warn(`[Shop] Currency objective "${currency}" not found`);
      return BigInt(0);
    }
    const score = objective.getScore(player.scoreboardIdentity) || 0;
    return BigInt(Math.max(score, 0));
  } catch (e) {
    console.warn(`[Shop] Error getting balance for currency ${currency}:`, e);
    return BigInt(0);
  }
}
function addShopBalance(player, amount) {
  const currency = getShopCurrency();
  if (currency === "money") {
    return addMoney(player, amount);
  }
  try {
    const objective = world.scoreboard.getObjective(currency) ??
      world.scoreboard.addObjective(currency, currency);
    const currentScore = objective.getScore(player.scoreboardIdentity) || 0;
    const newScore = currentScore + Number(amount);
    system.run(() => {
      objective.setScore(player, newScore);
    });
    return true;
  } catch (e) {
    console.warn(`[Shop] Error adding balance for currency ${currency}:`, e);
    return false;
  }
}
function removeShopBalance(player, amount) {
  const currency = getShopCurrency();
  if (currency === "money") {
    return removeMoney(player, amount);
  }
  try {
    const objective = world.scoreboard.getObjective(currency);
    if (!objective) {
      console.warn(`[Shop] Currency objective "${currency}" not found`);
      return false;
    }
    const currentScore = objective.getScore(player.scoreboardIdentity) || 0;
    const newScore = currentScore - Number(amount);
    if (newScore < 0) return false;
    system.run(() => {
      objective.setScore(player, newScore);
    });
    return true;
  } catch (e) {
    console.warn(`[Shop] Error removing balance for currency ${currency}:`, e);
    return false;
  }
}
function formatShopBalance(amount) {
  const currency = getShopCurrency();
  if (currency === "money") {
    return formatMoneyValue(amount);
  }
  return metricNumbers(amount.toString());
}
const pendingTransactions = new Map();
function processPendingTransactions() {
  if (pendingTransactions.size === 0) return;
  for (const [playerId, transactions] of pendingTransactions.entries()) {
    if (transactions.length === 0) {
      pendingTransactions.delete(playerId);
      continue;
    }
    const transaction = transactions.shift();
    transaction.execute();
    if (transactions.length === 0) {
      pendingTransactions.delete(playerId);
    }
  }
}
function queueTransaction(player, executeFunc, onComplete = null) {
  const playerId = player.id || player.name;
  if (!pendingTransactions.has(playerId)) {
    pendingTransactions.set(playerId, []);
  }
  pendingTransactions.get(playerId).push({
    execute: async () => {
      await executeFunc();
      if (onComplete) onComplete();
    },
  });
  if (pendingTransactions.get(playerId).length === 1) {
    processPendingTransactions();
  }
}
function runCommand(command) {
  try {
    return world.getDimension("overworld").runCommand(command);
  } catch (error) {
    console.warn("Command execution error:", command, error);
    throw error;
  }
}
export async function Shop(player) {
  loadShopConfig();
  const currencySymbol = getShopCurrencySymbol();
  const currencyName = getShopCurrencyName();
  const balance = getShopBalance(player);
  const form = new ActionFormData()
    .title(`SHOP UI`)
    .body(
      `§l§aUser Information \n§l§aName : §e${player.name} \n§l§aMy ${currencyName} : §e${currencySymbol}${formatShopBalance(balance)}`,
    );
  const displayedCategories = shopConfig.categories.filter(c => c.enabled !== false);
  for (const category of displayedCategories) {
    form.button(`${category.name}\n§r§oClick or tap`, category.icon);
  }
  form.button(
    "§l§0(§l§cCLOSE§l§0)\n§r§oClick to return",
    "textures/ui/arrow_left.png",
  );
  const result = await ForceOpen(player, form);
  if (result.canceled || result.selection === displayedCategories.length) {
    return;
  }
  if (result.selection < displayedCategories.length) {
    const selectedCategory = displayedCategories[result.selection];
    if (selectedCategory.id === "tools") {
      Tools(player);
    } else if (selectedCategory.id === "armor") {
      Armor(player);
    } else {
      buySell(
        player,
        shopConfig.items[selectedCategory.id],
        selectedCategory.name,
      );
    }
  }
}
function Tools(player) {
  loadShopConfig();
  const allTools = shopConfig.items.tools || [];
  const swords = allTools.filter(
    (item) => item.item && item.item.includes("sword"),
  );
  const axes = allTools.filter(
    (item) => item.item && item.item.includes("axe"),
  );
  const pickaxes = allTools.filter(
    (item) => item.item && item.item.includes("pickaxe"),
  );
  const shovels = allTools.filter(
    (item) => item.item && item.item.includes("shovel"),
  );
  const toolCategories = [
    {
      id: "sword",
      name: "§l§0(§8§lSWORD§l§0)",
      icon: "textures/items/diamond_sword.png",
      items: swords,
    },
    {
      id: "axe",
      name: "§l§0(§8§lAXE§l§0)",
      icon: "textures/items/diamond_axe.png",
      items: axes,
    },
    {
      id: "pickaxe",
      name: "§l§0(§8§lPICKAXE§l§0)",
      icon: "textures/items/diamond_pickaxe.png",
      items: pickaxes,
    },
    {
      id: "shovel",
      name: "§l§0(§8§lSHOVEL§l§0)",
      icon: "textures/items/diamond_shovel.png",
      items: shovels,
    },
  ];
  const gui = new ActionFormData()
    .title(`§6SHOP UI`)
    .body(`§7Tool Categories - Choose a tool type`);
  toolCategories.forEach((category) => {
    gui.button(`${category.name}\n§r§0Open`, category.icon);
  });
  gui.button("§l§cBack\n§r§oPress", "textures/ui/arrow_left.png");
  gui.show(player).then((result) => {
    if (result.canceled) {
      Shop(player);
      return;
    }
    if (result.selection < toolCategories.length) {
      const category = toolCategories[result.selection];
      buySell(player, category.items, category.name, true);
    } else {
      Shop(player);
    }
  });
}
function Armor(player) {
  loadShopConfig();
  const helmets = shopConfig.items.helmet || [];
  const chestplates = shopConfig.items.chestplate || [];
  const leggings = shopConfig.items.leggings || [];
  const boots = shopConfig.items.boots || [];
  const armorCategories = [
    {
      id: "helmet",
      name: "§l§0(§a§lHELMET§l§0)",
      icon: "textures/items/diamond_helmet.png",
      items: helmets,
    },
    {
      id: "chestplate",
      name: "§l§0(§a§lCHESTPLATE§l§0)",
      icon: "textures/items/diamond_chestplate.png",
      items: chestplates,
    },
    {
      id: "leggings",
      name: "§l§0(§a§lLEGGINGS§l§0)",
      icon: "textures/items/diamond_leggings.png",
      items: leggings,
    },
    {
      id: "boots",
      name: "§l§0(§a§lBOOTS§l§0)",
      icon: "textures/items/diamond_boots.png",
      items: boots,
    },
  ];
  const gui = new ActionFormData()
    .title(`§6SHOP UI`)
    .body(`§7Armor Categories - Choose armor type`);
  armorCategories.forEach((category) => {
    gui.button(`${category.name}\n§r§0Open`, category.icon);
  });
  gui.button("§l§cBack\n§r§oPress", "textures/ui/arrow_left.png");
  gui.show(player).then((result) => {
    if (result.canceled) {
      Shop(player);
      return;
    }
    if (result.selection < armorCategories.length) {
      const category = armorCategories[result.selection];
      buySell(player, category.items, category.name, false, true);
    } else {
      Shop(player);
    }
  });
}
function buySell(
  player,
  itemName,
  categoryName,
  fromTools = false,
  fromArmor = false,
) {
  if (!itemName || !Array.isArray(itemName) || itemName.length === 0) {
    const gui = new ActionFormData()
      .title(`Items`)
      .body("§cNo items found in this category.")
      .button("§l§cBack\n§r§oPress", "textures/ui/arrow_left.png");
    gui.show(player).then((result) => {
      if (fromTools) {
        Tools(player);
      } else if (fromArmor) {
        Armor(player);
      } else {
        Shop(player);
      }
    });
    return;
  }
  showItemsMenu(player, itemName, categoryName, fromTools, fromArmor);
}
function showItemsMenu(
  player,
  itemName,
  categoryName,
  fromTools = false,
  fromArmor = false,
) {
  const gui = new ActionFormData();
  gui.title(`Items`).body(`§7Manage items (${itemName.length} items)`);
  if (!itemName || !Array.isArray(itemName) || itemName.length === 0) {
    gui.body("§cNo items found in this category.");
    gui.button("§l§cBack\n§r§oPress", "textures/ui/arrow_left.png");
    gui.show(player).then((result) => {
      if (fromTools) {
        Tools(player);
      } else if (fromArmor) {
        Armor(player);
      } else {
        Shop(player);
      }
    });
    return;
  }
  for (const item of itemName) {
    if (item && item.name && item.cost) {
      gui.button(
        `${item.name}\n§r§7Buy: §g${item.cost} §r§7Sell: §g${item.sell}`,
        `${item.textures}`,
      );
    }
  }
  gui.button("§l§cBack\n§r§oPress", "textures/ui/arrow_left.png");
  gui.show(player).then((result) => {
    if (result.canceled) {
      if (fromTools) {
        Tools(player);
      } else if (fromArmor) {
        Armor(player);
      } else {
        Shop(player);
      }
      return;
    }
    if (result.selection === itemName.length) {
      if (fromTools) {
        Tools(player);
      } else if (fromArmor) {
        Armor(player);
      } else {
        Shop(player);
      }
      return;
    }
    if (result.selection >= 0 && result.selection < itemName.length) {
      const item = itemName[result.selection];
      showTransactionMenu(
        player,
        item,
        itemName,
        categoryName,
        fromTools,
        fromArmor,
      );
    }
  });
}
function showTransactionMenu(
  player,
  item,
  itemName,
  categoryName,
  fromTools = false,
  fromArmor = false,
) {
  const currencySymbol = getShopCurrencySymbol();
  const currencyName = getShopCurrencyName();
  const moneyAmount = getShopBalance(player);
  const economyBenefits = getEconomyBenefits(player);
  const discountPercent = economyBenefits.discount || 0;
  let finalCost = item.cost;
  if (discountPercent > 0) {
    finalCost = Math.floor(item.cost * (1 - discountPercent / 100));
    if (finalCost < 1 && item.cost > 0) finalCost = 1;
  }
  let costDisplay = `§g${item.cost}`;
  if (discountPercent > 0) {
    costDisplay = `§m§7${item.cost}§r §a${finalCost} (${discountPercent}% Off)`;
  }
  let brick = new ModalFormData()
    .title(`§6SHOP UI`)
    .textField(
      `§f${item.name} §8| §7Balance: §g${currencySymbol}${formatShopBalance(moneyAmount)}\n§7Buy: §g${costDisplay} §8| §7Sell: §g${item.sell}`,
      `Enter amount`,
    )
    .toggle("§fBuy / Sell §7(ON = Buy)", {
      defaultValue: true,
    });
  brick.show(player).then((res) => {
    if (res.canceled) {
      showItemsMenu(player, itemName, categoryName, fromTools, fromArmor);
      return;
    }
    const health = player.getComponent("minecraft:health");
    if (health && health.currentValue <= 0) {
      player.sendMessage("§cYou cannot trade while dead!");
      return;
    }
    let dataCost = finalCost * res.formValues[0];
    let dataSell = item.sell * res.formValues[0];
    let quantity = parseInt(res.formValues[0]);
    if (!res.formValues[0]) {
      player.sendMessage(`§cPlease enter the amount you want to transfer`);
      player.playSound(`note.bass`);
      showTransactionMenu(
        player,
        item,
        itemName,
        categoryName,
        fromTools,
        fromArmor,
      );
      return;
    }
    if (res.formValues[0].startsWith("-")) {
      player.sendMessage(
        `§cCannot have the prefix -, must be completed with numbers`,
      );
      player.playSound(`note.bass`);
      showTransactionMenu(
        player,
        item,
        itemName,
        categoryName,
        fromTools,
        fromArmor,
      );
      return;
    }
    if (res.formValues[0].startsWith("+")) {
      player.sendMessage(
        `§cCannot have the prefix +, must be completed with numbers`,
      );
      player.playSound(`note.bass`);
      showTransactionMenu(
        player,
        item,
        itemName,
        categoryName,
        fromTools,
        fromArmor,
      );
      return;
    }
    if (isNaN(res.formValues[0])) {
      player.sendMessage(`§cYou can only enter numbers, not other characters.`);
      player.playSound(`note.bass`);
      showTransactionMenu(
        player,
        item,
        itemName,
        categoryName,
        fromTools,
        fromArmor,
      );
      return;
    }
    if (res.formValues[1] == true) {
      if (item.enchantments) {
        const inventory = player.getComponent("inventory");
        if (inventory && inventory.container) {
          let emptySlots = 0;
          for (let i = 0; i < inventory.container.size; i++) {
            if (!inventory.container.getItem(i)) {
              emptySlots++;
            }
          }
          if (emptySlots < quantity) {
            player.sendMessage(`§c[Shop] Not enough inventory space!`);
            player.sendMessage(`§e[Shop] Enchanted books can't stack. You need §a${quantity} §eempty slots, but only have §c${emptySlots}§e.`);
            player.sendMessage("§e[Shop] Type §a/shop §ein chat to open shop again.");
            player.playSound(`note.bass`);
            return;
          }
        }
      }
      if (moneyAmount < BigInt(dataCost)) {
        player.sendMessage(
          `§cYour ${currencyName} is not enough, you need ${dataCost} ${currencyName} to buy`,
        );
        player.playSound(`note.bass`);
        showItemsMenu(player, itemName, categoryName, fromTools, fromArmor);
      } else {
        queueTransaction(
          player,
          async () => {
            try {
              player.sendMessage(`§e======= §6PURCHASE SUMMARY §e=======`);
              player.sendMessage(
                `§7Item: §f${item.name} §7[§f${item.item}:${item.data || 0}§7]`,
              );
              player.sendMessage(`§7Price per unit: §g${finalCost}${discountPercent > 0 ? ` §7(Orig: ${item.cost})` : ""}`);
              player.sendMessage(`§7Quantity: §f${quantity}`);
              player.sendMessage(`§7Total cost: §g${dataCost}`);
              player.sendMessage(`§e==============================`);
              try {
                runCommand(`gamerule sendcommandfeedback false`);
                removeShopBalance(player, dataCost);
                if (item.enchantments) {
                  try {
                    const inventory = player.getComponent("inventory");
                    if (inventory && inventory.container) {
                      const enchants = item.enchantments.split(",");
                      let successfulPurchases = 0;
                      for (let i = 0; i < quantity; i++) {
                        try {
                          const enchantedBook = new ItemStack("minecraft:enchanted_book", 1);
                          const enchantComp = enchantedBook.getComponent("enchantable");
                          if (enchantComp && enchantComp.addEnchantment) {
                            for (const ench of enchants) {
                              const parts = ench.split(":");
                              const lvl = parseInt(parts.pop());
                              let id = parts.join(":");
                              if (id.startsWith("minecraft:")) {
                                id = id.substring(10);
                              }
                              try {
                                enchantComp.addEnchantment({
                                  type: new EnchantmentType(id),
                                  level: lvl || 1
                                });
                              } catch (enchErr) {
                                console.warn(`[Shop] Failed to add enchantment ${id}:${lvl}`, enchErr);
                              }
                            }
                          }
                          const remainder = inventory.container.addItem(enchantedBook);
                          if (remainder) {
                            player.dimension.spawnItem(remainder, player.location);
                          }
                          successfulPurchases++;
                        } catch (itemErr) {
                          console.error(`[Shop] Error creating enchanted book #${i + 1}:`, itemErr);
                        }
                      }
                      if (successfulPurchases < quantity) {
                        player.sendMessage(`§e[Shop] Only ${successfulPurchases}/${quantity} enchanted books were created.`);
                      }
                    } else {
                      throw new Error("Inventory not found");
                    }
                  } catch (e) {
                    console.error("Error giving enchanted item:", e);
                    player.sendMessage("§cError processing enchanted items.");
                  }
                } else {
                  runCommand(
                    `give "${player.name}" ${item.item} ${quantity} ${item.data || 0}`,
                  );
                }
                runCommand(`gamerule sendcommandfeedback true`);
              } catch (commandError) {
                console.error("Command error:", commandError);
              }
              player.sendMessage(
                `§7You have purchased §ex${quantity} ${item.name} §7for §g${dataCost} ${currencyName}`,
              );
              player.playSound(`random.orb`);
            } catch (error) {
              console.error("Transaction error:", error);
              try {
                runCommand(`gamerule sendcommandfeedback true`);
              } catch (e) { }
              player.sendMessage("§cTransaction failed. Please try again.");
            }
          },
          () =>
            showItemsMenu(player, itemName, categoryName, fromTools, fromArmor),
        );
      }
    }
    if (res.formValues[1] == false) {
      if (item.notsold) {
        try {
          runCommand(
            `tellraw "${player.name}" {"rawtext":[{"text":"§cYou cannot sell this item."}]}`,
          );
          player.playSound(`note.bass`);
        } catch (error) {
          player.sendMessage("§cYou cannot sell this item.");
        }
        showItemsMenu(player, itemName, categoryName, fromTools, fromArmor);
      } else {
        queueTransaction(
          player,
          async () => {
            try {
              const inventory = player.getComponent("inventory");
              if (!inventory || !inventory.container) {
                player.sendMessage("§cInventory error.");
                return;
              }
              const container = inventory.container;
              const itemIdBase = item.item.replace("minecraft:", "");
              const targetItemId = `minecraft:${itemIdBase}`;
              let totalFound = 0;
              const slotsWithItem = [];
              for (let i = 0; i < container.size; i++) {
                const slotItem = container.getItem(i);
                if (slotItem) {
                  const slotTypeId = slotItem.typeId;
                  const isMatch = slotTypeId === targetItemId ||
                    slotTypeId === `minecraft:${itemIdBase}` ||
                    slotTypeId.endsWith(`:${itemIdBase}`) ||
                    slotTypeId === itemIdBase;
                  if (isMatch) {
                    totalFound += slotItem.amount;
                    slotsWithItem.push({ slot: i, item: slotItem, amount: slotItem.amount });
                  }
                }
              }
              if (totalFound >= quantity) {
                player.sendMessage(`§e======= §6SALE SUMMARY §e=======`);
                player.sendMessage(
                  `§7Item: §f${item.name} §7[§f${item.item}:${item.data || 0}§7]`,
                );
                player.sendMessage(`§7Price per unit: §g${item.sell}`);
                player.sendMessage(`§7Quantity: §f${quantity}`);
                player.sendMessage(`§7Total sale value: §g${dataSell}`);
                player.sendMessage(`§e==============================`);
                let remainingToRemove = quantity;
                for (const slotInfo of slotsWithItem) {
                  if (remainingToRemove <= 0) break;
                  const slotItem = container.getItem(slotInfo.slot);
                  if (!slotItem) continue;
                  if (slotItem.amount <= remainingToRemove) {
                    container.setItem(slotInfo.slot, undefined);
                    remainingToRemove -= slotItem.amount;
                  } else {
                    const newAmount = slotItem.amount - remainingToRemove;
                    slotItem.amount = newAmount;
                    container.setItem(slotInfo.slot, slotItem);
                    remainingToRemove = 0;
                  }
                }
                if (remainingToRemove <= 0) {
                  addShopBalance(player, dataSell);
                  player.sendMessage(
                    `§7You successfully sold §ex${quantity} ${item.name} §7for §g${dataSell} ${currencyName}`,
                  );
                  player.playSound(`random.orb`);
                } else {
                  player.sendMessage(`§cFailed to remove items from inventory. Transaction cancelled.`);
                  player.playSound(`note.bass`);
                }
              } else {
                player.sendMessage(`§cYou don't have enough items to sell. You have ${totalFound}, need ${quantity}.`);
                player.playSound(`note.bass`);
              }
            } catch (error) {
              console.error("Sale error:", error);
              player.sendMessage("§cTransaction failed. Please try again.");
            }
          },
          () =>
            showItemsMenu(player, itemName, categoryName, fromTools, fromArmor),
        );
      }
    }
  });
}
