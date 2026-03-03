import {
  world,
  system,
  ItemStack,
  Player,
  ActionFormData,
  ModalFormData,
  EnchantmentType,
  ItemLockMode,
} from "../../core";
import { BackpackDatabase } from "./backpack_database";
const db = new BackpackDatabase();
export const BackpackConfig = {
  get: () => {
    try {
      const data = world.getDynamicProperty("backpack_config");
      return data ? JSON.parse(data) : { maxSlots: 27 };
    } catch {
      return { maxSlots: 27 };
    }
  },
  save: (config) => {
    try {
      world.setDynamicProperty("backpack_config", JSON.stringify(config));
      return true;
    } catch {
      return false;
    }
  }
};
export function configureBackpackSystem(player) {
    const config = BackpackConfig.get();
    const form = new ModalFormData()
        .title("Backpack Configuration")
        .slider("Max Slots", 5, 54, { valueStep: 1, defaultValue: config.maxSlots });
    form.show(player).then(res => {
        if (res.canceled) return;
        const [maxSlots] = res.formValues;
        config.maxSlots = maxSlots;
        if (BackpackConfig.save(config)) {
            player.sendMessage("§aBackpack configuration saved!");
        } else {
            player.sendMessage("§cFailed to save configuration.");
        }
    });
}
function openBackpackMenu(player) {
  showBackpackList(player);
}
function showBackpackList(player) {
  const items = db.get(player.name) || [];
  const config = BackpackConfig.get();
  const form = new ActionFormData().title("Backpack Menu");
  const totalSlot = config.maxSlots;
  const usedSlots = items.length;
  const totalItem = items.reduce((sum, item) => sum + (item.amount || 0), 0);
  let info = `Storage: ${usedSlots}/${totalSlot} slots\nTotal items: ${totalItem}`;
  if (items.length === 0) {
    info += "\nYour backpack is empty.";
  } else {
    info += "\nSelect an item to withdraw or deposit new item.";
  }
  form.body(info);
  if (usedSlots < totalSlot) {
      form.button("Deposit Item (from inventory)");
  } else {
      form.button("§cBackpack Full (Deposit Unavailable)");
  }
  items.forEach((item, i) => {
    form.button(formatItemInfo(item, i));
  });
  form.button("Close");
  form
    .show(player)
    .then((res) => {
      if (res.canceled || res.selection === undefined) return;
      if (res.selection === 0) {
        if (usedSlots < totalSlot) {
            showDepositInventoryMenu(player);
        } else {
            player.sendMessage("§cYour backpack is full!");
            showBackpackList(player);
        }
      } else if (res.selection === items.length + 1) {
        return;
      } else if (res.selection > 0 && res.selection <= items.length) {
        showWithdrawForm(player, items, res.selection - 1);
      }
    })
    .catch((err) => {
      player.sendMessage("An error occurred while opening the backpack menu.");
    });
}
function isItemAllowedInBackpack(item) {
  if (!item) return false;
  if (item.typeId === "minecraft:enchanted_book") return false;
  if (item.typeId === "minecraft:bundle") return false;
  if (item.typeId.includes("shulker")) return false;
  if (item.getComponent("inventory")) return false;
  return true;
}
function showDepositInventoryMenu(player) {
  const inv = player.getComponent("inventory").container;
  const form = new ActionFormData().title("Deposit Item from Inventory");
  let slotMap = [];
  for (let i = 0; i < inv.size; i++) {
    const item = inv.getItem(i);
    if (
      item &&
      item.typeId !== "minecraft:air" &&
      item.amount > 0 &&
      !isItemLocked(item) &&
      isItemAllowedInBackpack(item)
    ) {
      form.button(`Slot ${i + 1}: ${formatInvItemInfo(item)}`);
      slotMap.push(i);
    }
  }
  if (slotMap.length === 0) {
    form.body(
      "No items in your inventory to deposit.\n\n§cNote: Locked items, Shulker Boxes, Bundles, Enchanted Books, and items with inventory cannot be stored.",
    );
  }
  form.button("Back");
  form.show(player).then((res) => {
    if (res.canceled || res.selection === undefined)
      return showBackpackList(player);
    if (res.selection === slotMap.length) {
      showBackpackList(player);
      return;
    }
    const slot = slotMap[res.selection];
    const item = inv.getItem(slot);
    if (!item || item.typeId === "minecraft:air" || item.amount <= 0) {
      player.sendMessage("Item not found in that slot!");
      return showDepositInventoryMenu(player);
    }
    if (isItemLocked(item)) {
      player.sendMessage(
        "§cThis item is locked and cannot be stored in your backpack!",
      );
      return showDepositInventoryMenu(player);
    }
    if (!isItemAllowedInBackpack(item)) {
      player.sendMessage(
        "§cThis item type (Container/Enchanted Book) cannot be stored in backpack!",
      );
      return showDepositInventoryMenu(player);
    }
    showDepositAmountForm(player, slot, item);
  });
}
function showDepositAmountForm(player, slot, item, errorMsg = "") {
  const itemInfo = formatItemDetailInfo(item);
  const form = new ModalFormData()
    .title("Deposit Item §t§p§a")
    .textField(
      `${itemInfo}\n\nHow many do you want to deposit? (1 - ${item.amount})${errorMsg ? `\n§c${errorMsg}` : ""}`,
      "Enter amount",
      { defaultValue: "1" },
    )
    .submitButton("Deposit");
  form.show(player).then((res) => {
    if (res.canceled || res.formValues === undefined)
      return showDepositInventoryMenu(player);
    const amount = parseInt(res.formValues[0]);
    if (isNaN(amount) || amount < 1 || amount > item.amount) {
      return showDepositAmountForm(
        player,
        slot,
        item,
        "Invalid amount! Please enter a valid number.",
      );
    }
    depositItem(player, slot, amount, () => showDepositInventoryMenu(player));
  });
}
function depositItem(player, slot, amount, cb) {
  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
    player.sendMessage("Invalid deposit amount!");
    if (cb) cb();
    return;
  }
  const inv = player.getComponent("inventory").container;
  const item = inv.getItem(slot);
  if (!item || item.typeId === "minecraft:air" || item.amount < amount) {
    player.sendMessage("Item not found or not enough amount!");
    if (cb) cb();
    return;
  }
  if (isItemLocked(item)) {
    player.sendMessage(
      "§cThis item is locked and cannot be stored in your backpack!",
    );
    if (cb) cb();
    return;
  }
  if (!isItemAllowedInBackpack(item)) {
    player.sendMessage(
      "§cThis item type (Container/Enchanted Book) cannot be stored in backpack!",
    );
    if (cb) cb();
    return;
  }
  let backpack = db.get(player.name) || [];
  const config = BackpackConfig.get();
  if (backpack.length >= config.maxSlots) {
      player.sendMessage("§cBackpack is full!");
      if (cb) cb();
      return;
  }
  const durability = getItemDurability(item);
  const enchantments = getItemEnchantments(item);
  const name = getItemCustomName(item);
  const lore = getItemLore(item);
  backpack.push({
    typeId: item.typeId,
    amount: amount,
    data: item.data || 0,
    durability: durability,
    name: name,
    lore: lore,
    enchantments: enchantments,
  });
  db.set(player.name, backpack);
  const remaining = item.amount - amount;
  if (remaining > 0) {
    inv.setItem(slot, new ItemStack(item.typeId, remaining));
  } else {
    inv.setItem(slot, null);
  }
  player.sendMessage(`Deposited ${amount}x ${item.typeId} to your backpack!`);
  if (cb) cb();
}
function formatBackpackItemDetailInfo(item) {
  let lines = [];
  if (item.name && item.name !== "") lines.push(`Name: ${item.name}`);
  lines.push(`Type: ${item.typeId}`);
  lines.push(`Amount: x${item.amount}`);
  if (item.enchantments && item.enchantments.length > 0) {
    lines.push(
      `Enchants: ${item.enchantments.map((e) => `${e.id || e.typeId || e.name || "?"}${e.level ? " " + e.level : ""}`).join(", ")}`,
    );
  }
  if (item.durability && typeof item.durability === "object") {
    if (
      typeof item.durability === "object" &&
      item.durability.maxDurability &&
      item.durability.remainingDurability !== undefined &&
      item.durability.durabilityPercentage !== undefined
    ) {
      lines.push(
        `Durability: ${item.durability.remainingDurability}/${item.durability.maxDurability} (${item.durability.durabilityPercentage}%)`,
      );
    } else {
      lines.push(`Durability: ${item.durability}`);
    }
  }
  if (item.lore && item.lore.length > 0)
    lines.push(`Lore: ${item.lore.join(", ")}`);
  return lines.join("\n");
}
function showWithdrawForm(player, items, idx, errorMsg = "") {
  const item = items[idx];
  const itemInfo = formatBackpackItemDetailInfo(item);
  const form = new ModalFormData()
    .title("Withdraw Item §t§p§a")
    .textField(
      `${itemInfo}\n\nHow many to withdraw? (1 - ${item.amount})${errorMsg ? `\n§c${errorMsg}` : ""}`,
      "Enter amount",
      { defaultValue: "1" },
    )
    .submitButton("Withdraw");
  form
    .show(player)
    .then((res) => {
      if (res.canceled || res.formValues === undefined)
        return showBackpackList(player);
      const amount = parseInt(res.formValues[0]) || 1;
      if (isNaN(amount) || amount < 1 || amount > item.amount) {
        return showWithdrawForm(
          player,
          items,
          idx,
          "Invalid amount! Please enter a valid number.",
        );
      }
      const validAmount = Math.max(1, Math.min(item.amount, amount));
      withdrawItem(player, idx, validAmount, () => showBackpackList(player));
    })
    .catch((err) => {
      player.sendMessage("An error occurred while withdrawing the item.");
      showBackpackList(player);
    });
}
function applyBackpackItemProperties(player, itemData) {
  try {
    const item = new ItemStack(itemData.typeId, itemData.amount);
    if (itemData.data !== undefined) item.data = itemData.data;
    if (
      itemData.durability &&
      typeof itemData.durability === "object" &&
      item.getComponent
    ) {
      const dur = item.getComponent("minecraft:durability");
      if (dur && typeof itemData.durability.currentDamage === "number")
        dur.damage = itemData.durability.currentDamage;
    }
    if (itemData.name && itemData.name !== "") item.nameTag = itemData.name;
    if (itemData.lore && itemData.lore.length > 0) {
      if (item.setLore) item.setLore(itemData.lore);
      else item.lore = itemData.lore;
    }
    if (
      itemData.enchantments &&
      itemData.enchantments.length > 0 &&
      item.getComponent
    ) {
      const enchComp = item.getComponent("enchantable");
      if (enchComp && enchComp.addEnchantment) {
        for (const ench of itemData.enchantments) {
          try {
            if (typeof ench.id === "string") {
              enchComp.addEnchantment({
                type: new EnchantmentType(ench.id),
                level: ench.level || 1,
              });
            }
          } catch (e) {}
        }
      }
    }
    const inv = player.getComponent("inventory").container;
    inv.addItem(item);
    return true;
  } catch (err) {
    return false;
  }
}
function withdrawItem(player, idx, amount, cb) {
  let backpack = db.get(player.name) || [];
  if (idx < 0 || idx >= backpack.length) {
    player.sendMessage("Invalid slot!");
    if (cb) cb();
    return;
  }
  const item = backpack[idx];
  const giveAmount = Math.min(item.amount, amount);
  const success = applyBackpackItemProperties(player, {
    ...item,
    amount: giveAmount,
  });
  if (!success) {
    player.sendMessage("Some item properties may not be applied!");
  }
  if (item.amount > giveAmount) {
    backpack[idx].amount -= giveAmount;
  } else {
    backpack.splice(idx, 1);
  }
  db.set(player.name, backpack);
  player.sendMessage(
    `Withdrew ${giveAmount}x ${item.typeId} from your backpack!`,
  );
  if (cb) cb();
}
function formatItemInfo(item, idx) {
  let info = `${idx + 1}. ${item.typeId} x${item.amount}`;
  if (item.name && item.name !== "") info += `\nName: ${item.name}`;
  if (item.enchantments && item.enchantments.length > 0) {
    const enchList = item.enchantments
      .slice(0, 2)
      .map(
        (e) =>
          `${e.id?.replace("minecraft:", "") || e.typeId || e.name || "?"}${e.level ? " " + e.level : ""}`,
      );
    info += `\nEnchant: ${enchList.join(", ")}${item.enchantments.length > 2 ? ", ..." : ""}`;
  }
  return info;
}
function formatInvItemInfo(item) {
  let info = `${item.typeId} x${item.amount}`;
  if (item.nameTag && item.nameTag !== "") info += `\nName: ${item.nameTag}`;
  if (item.enchantments && item.enchantments.length > 0) {
    info += ` [${item.enchantments.map((e) => `${e.id || e.typeId || e.name || "?"}${e.level ? " " + e.level : ""}`).join(", ")}]`;
  }
  if (
    item.durability &&
    typeof item.durability === "object" &&
    item.durability.maxDurability
  ) {
    info += ` (Durability: ${item.durability.remainingDurability}/${item.durability.maxDurability} (${item.durability.durabilityPercentage}%))`;
  }
  if (item.lore && item.lore.length > 0) {
    info += `\nLore: ${item.lore.join(", ")}`;
  }
  return info;
}
function getItemDurability(item) {
  if (!item) return null;
  try {
    const durabilityComponent =
      item.getComponent && item.getComponent("minecraft:durability");
    if (!durabilityComponent) return null;
    if (
      typeof durabilityComponent.maxDurability !== "number" ||
      typeof durabilityComponent.damage !== "number"
    )
      return null;
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
    )
      return null;
    return {
      maxDurability,
      currentDamage,
      remainingDurability,
      durabilityPercentage,
    };
  } catch {
    return null;
  }
}
function getItemEnchantments(item) {
  if (!item) return [];
  const enchantments = [];
  try {
    const enchantComp = item.getComponent && item.getComponent("enchantable");
    if (enchantComp) {
      try {
        const enchants =
          enchantComp.getEnchantments && enchantComp.getEnchantments();
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
      } catch {}
    }
  } catch {}
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
        const nameComp =
          item.getComponent && item.getComponent("minecraft:custom_name");
        if (nameComp && nameComp.name && nameComp.name.length > 0) {
          customName = nameComp.name;
        }
      } catch {}
    }
  } catch {}
  return customName;
}
function getItemLore(item) {
  if (!item) return [];
  try {
    if (item.lore && Array.isArray(item.lore)) return item.lore;
    if (item.getLore && typeof item.getLore === "function")
      return item.getLore();
  } catch {}
  return [];
}
function isItemLocked(item) {
  if (!item) return false;
  try {
    if (item.lockMode !== undefined) {
      return (
        item.lockMode === ItemLockMode.slot ||
        item.lockMode === ItemLockMode.inventory
      );
    }
  } catch {}
  return false;
}
function formatItemDetailInfo(item) {
  let lines = [];
  const name = getItemCustomName(item);
  if (name && name !== "") lines.push(`Name: ${name}`);
  lines.push(`Type: ${item.typeId}`);
  lines.push(`Amount: x${item.amount}`);
  const enchants = getItemEnchantments(item);
  if (enchants.length > 0) {
    lines.push(
      `Enchants: ${enchants.map((e) => `${e.id || e.typeId || "?"}${e.level ? " " + e.level : ""}`).join(", ")}`,
    );
  }
  const durability = getItemDurability(item);
  if (durability)
    lines.push(
      `Durability: ${durability.remainingDurability}/${durability.maxDurability} (${durability.durabilityPercentage}%)`,
    );
  const lore = getItemLore(item);
  if (lore.length > 0) lines.push(`Lore: ${lore.join(", ")}`);
  return lines.join("\n");
}
export { openBackpackMenu };
