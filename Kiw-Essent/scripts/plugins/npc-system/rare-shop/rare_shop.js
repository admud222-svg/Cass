import { system, world, ItemStack } from "@minecraft/server";
import {
  ActionFormData,
  ModalFormData,
  MessageFormData,
} from "@minecraft/server-ui";
import {
  getFullMoney,
  removeMoney,
  getFormattedMoney,
  formatMoneyValue,
} from "../../../function/moneySystem.js";
import { ForceOpen, metricNumbers } from "../../../lib/game.js";
import { RareShopConfig } from "./rare_shop_config.js";

const UI_TEXTURES = {
  gear: "textures/ui/gear",
  check: "textures/ui/check",
  cancel: "textures/ui/cancel",
  plus: "textures/ui/plus",
  pencil: "textures/ui/anvil_icon",
  color_picker: "textures/ui/color_picker",
  arrow_left: "textures/ui/arrow_left",
};

class RareShop {
  static isAdmin(player) {
    return player.hasTag("admin");
  }

  static getRarityColor(rarityName, config) {
    return config.rarities[rarityName]?.color || "§f";
  }

  static async showMainMenu(player) {
    try {
      const config = RareShopConfig.get();
      const form = new ActionFormData();
      form.title("Rare Shop");
      form.body(
        "§7Welcome to the Limited Edition Shop.\n§7Exclusive items with limited stock.",
      );

      const isPlayerAdmin = this.isAdmin(player);
      if (isPlayerAdmin) {
        form.button("§cAdmin Settings\n§7Manage Shop", UI_TEXTURES.gear);
      }

      for (const item of config.items) {
        const rarityColor = this.getRarityColor(item.rarity, config);
        const priceText = `$${metricNumbers(item.price)}`;
        const stock = typeof item.stock === "number" ? item.stock : 0;

        let buttonText;
        if (stock > 0) {
          buttonText = `${rarityColor}${item.name}\n§r§7${priceText} §8| §e${stock} Left`;
        } else {
          buttonText = `§7${item.name}\n§cSOLD OUT`;
        }

        form.button(buttonText, item.texture);
      }

      const response = await ForceOpen(player, form);
      if (response.canceled) return;

      let index = response.selection;

      if (isPlayerAdmin) {
        if (index === 0) {
          RareShopAdmin.showMenu(player);
          return;
        }
        index--;
      }

      if (index >= 0 && index < config.items.length) {
        const selectedItem = config.items[index];
        const stock =
          typeof selectedItem.stock === "number" ? selectedItem.stock : 0;

        if (stock > 0) {
          this.showPurchaseConfirmation(player, selectedItem, index);
        } else {
          player.sendMessage("§cThis item is sold out!");
          this.showMainMenu(player); // Re-open menu
        }
      }
    } catch (error) {
      console.error(`Error showing Rare Shop to ${player.name}:`, error);
      player.sendMessage("§cAn error occurred while opening the shop.");
    }
  }

  static async showPurchaseConfirmation(player, item, itemIndex) {
    // Reload config to get fresh stock data
    const config = RareShopConfig.get();
    const freshItem = config.items[itemIndex];

    if (!freshItem || (freshItem.stock || 0) <= 0) {
      player.sendMessage("§cSorry! This item just went out of stock.");
      this.showMainMenu(player);
      return;
    }

    const rarityColor = this.getRarityColor(freshItem.rarity, config);
    const playerMoney = getFullMoney(player);

    const form = new ActionFormData();
    form.title(`Buy ${freshItem.name}`);

    let body = `§7You are about to purchase:\n\n`;
    body += `§7Name: ${rarityColor}${freshItem.name}\n`;
    body += `§7Rarity: ${rarityColor}${config.rarities[freshItem.rarity]?.display || freshItem.rarity}\n`;
    body += `§7Price: §a$${metricNumbers(freshItem.price)}\n`;
    body += `§7Stock Remaining: §e${freshItem.stock}\n`;
    body += `§7Description: §f${freshItem.description || "No description"}\n`;
    body += `\n§7Your Balance: §a$${formatMoneyValue(playerMoney)}`;

    if (playerMoney < freshItem.price) {
      body += `\n\n§cINSUFFICIENT FUNDS`;
    }

    form.body(body);
    form.button("Confirm Purchase", UI_TEXTURES.check);
    form.button("Cancel", UI_TEXTURES.cancel);

    const response = await ForceOpen(player, form);
    if (response.canceled || response.selection === 1) {
      this.showMainMenu(player);
      return;
    }

    if (response.selection === 0) {
      this.processPurchase(player, itemIndex);
    }
  }

  static processPurchase(player, itemIndex) {
    const config = RareShopConfig.get();
    const item = config.items[itemIndex];

    // Race condition check
    if (!item || (item.stock || 0) <= 0) {
      player.sendMessage("§cPurchase failed: Item is out of stock.");
      return;
    }

    const money = getFullMoney(player);
    if (money < item.price) {
      player.sendMessage(
        `§cYou don't have enough money. Required: $${metricNumbers(item.price)}`,
      );
      return;
    }

    const inventory = player.getComponent("inventory")?.container;
    if (!inventory || inventory.emptySlotsCount < 1) {
      player.sendMessage("§cYour inventory is full!");
      return;
    }

    if (removeMoney(player, item.price)) {
      try {
        // Deduct stock immediately
        item.stock--;
        RareShopConfig.save(config);

        inventory.addItem(new ItemStack(item.id, item.amount || 1));

        player.sendMessage(
          `§aSuccessfully purchased §r${item.name} §afor §r$${metricNumbers(item.price)}`,
        );
        player.runCommand("playsound random.levelup @s");
      } catch (e) {
        console.warn(`Transaction error: ${e}`);
        // In a real DB system we would rollback here,
        // but with JSON config + game actions, manual refund might be needed if this rare error occurs
        player.sendMessage(`§cSystem error during purchase.`);
      }
    } else {
      player.sendMessage("§cTransaction failed (Money deduction error).");
    }
  }
}

class RareShopAdmin {
  static async showMenu(player) {
    const form = new ActionFormData();
    form.title("Rare Shop Admin");
    form.body("Manage items in the Rare Shop.");

    form.button("Add New Item", UI_TEXTURES.plus);
    form.button("Edit Items", UI_TEXTURES.pencil);
    form.button("Config Rarities", UI_TEXTURES.color_picker);
    form.button("Back to Shop", UI_TEXTURES.arrow_left);

    const response = await ForceOpen(player, form);
    if (response.canceled) return;

    switch (response.selection) {
      case 0:
        this.showAddItem(player);
        break;
      case 1:
        this.showEditList(player);
        break;
      case 2:
        this.showRarityConfig(player);
        break;
      case 3:
        RareShop.showMainMenu(player);
        break;
    }
  }

  static async showAddItem(player) {
    const config = RareShopConfig.get();
    const rarityKeys = Object.keys(config.rarities);

    const form = new ModalFormData();
    form.title("Add New Rare Item");
    form.textField("Item Name (Display)", "Ex: God Sword");
    form.textField("Item ID (Minecraft/Custom)", "Ex: minecraft:diamond_sword");
    form.textField("Price", "Ex: 100000");
    form.dropdown(
      "Rarity",
      rarityKeys.map((k) => config.rarities[k].display),
      { defaultValueIndex: 0 },
    );
    form.textField("Texture Path (Optional)", "textures/items/diamond_sword");
    form.textField("Description", "Item lore/info");
    form.textField("Amount per Buy", "1", { defaultValue: "1" });
    form.textField("Initial Stock", "5", { defaultValue: "5" });

    const response = await ForceOpen(player, form);
    if (response.canceled) {
      this.showMenu(player);
      return;
    }

    const [
      name,
      id,
      priceStr,
      rarityIndex,
      texture,
      desc,
      amountStr,
      stockStr,
    ] = response.formValues;
    const price = parseInt(priceStr);
    const amount = parseInt(amountStr);
    const stock = parseInt(stockStr);

    if (!name || !id || isNaN(price) || isNaN(amount) || isNaN(stock)) {
      player.sendMessage(
        "§cInvalid input. Name, ID, Price, Amount, and Stock are required numbers.",
      );
      this.showMenu(player);
      return;
    }

    const newItem = {
      id: id.trim(),
      name: name.trim(),
      price: price,
      rarity: rarityKeys[rarityIndex],
      texture: texture?.trim() || undefined,
      description: desc?.trim() || undefined,
      amount: amount,
      stock: stock,
    };

    config.items.push(newItem);
    if (RareShopConfig.save(config)) {
      player.sendMessage("§aItem added successfully!");
      this.showMenu(player);
    } else {
      player.sendMessage("§cFailed to save config.");
    }
  }

  static async showEditList(player) {
    const config = RareShopConfig.get();
    const form = new ActionFormData();
    form.title("Edit Items");
    form.body("Select an item to edit or delete.");

    config.items.forEach((item) => {
      const stock = item.stock !== undefined ? item.stock : 0;
      form.button(`${item.name}\n§7Stock: ${stock}`);
    });
    form.button("Back", UI_TEXTURES.arrow_left);

    const response = await ForceOpen(player, form);
    if (response.canceled || response.selection === config.items.length) {
      this.showMenu(player);
      return;
    }

    this.showEditItem(player, response.selection);
  }

  static async showEditItem(player, index) {
    const config = RareShopConfig.get();
    const item = config.items[index];
    if (!item) {
      this.showEditList(player);
      return;
    }

    const rarityKeys = Object.keys(config.rarities);
    const currentRarityIndex = rarityKeys.indexOf(item.rarity);

    const form = new ModalFormData();
    form.title(`Edit: ${item.name}`);
    form.textField("Item Name", "", { defaultValue: item.name });
    form.textField("Item ID", "", { defaultValue: item.id });
    form.textField("Price", "", { defaultValue: item.price.toString() });
    form.dropdown(
      "Rarity",
      rarityKeys.map((k) => config.rarities[k].display),
      { defaultValueIndex: currentRarityIndex !== -1 ? currentRarityIndex : 0 },
    );
    form.textField("Texture Path", "", { defaultValue: item.texture || "" });
    form.textField("Description", "", { defaultValue: item.description || "" });
    form.textField("Amount", "", {
      defaultValue: item.amount?.toString() || "1",
    });
    form.textField("Stock", "", {
      defaultValue: item.stock?.toString() || "0",
    });
    form.toggle("§cDELETE ITEM", { defaultValue: false });

    const response = await ForceOpen(player, form);
    if (response.canceled) {
      this.showEditList(player);
      return;
    }

    const [
      name,
      id,
      priceStr,
      rarityIndex,
      texture,
      desc,
      amountStr,
      stockStr,
      deleteItem,
    ] = response.formValues;

    if (deleteItem) {
      config.items.splice(index, 1);
      if (RareShopConfig.save(config)) {
        player.sendMessage("§cItem deleted.");
        this.showEditList(player);
      }
      return;
    }

    item.name = name.trim();
    item.id = id.trim();
    item.price = parseInt(priceStr);
    item.rarity = rarityKeys[rarityIndex];
    item.texture = texture?.trim() || undefined;
    item.description = desc?.trim() || undefined;
    item.amount = parseInt(amountStr);
    item.stock = parseInt(stockStr);

    if (RareShopConfig.save(config)) {
      player.sendMessage("§aItem updated.");
      this.showEditList(player);
    } else {
      player.sendMessage("§cFailed to save config.");
    }
  }

  static async showRarityConfig(player) {
    const config = RareShopConfig.get();
    const form = new ActionFormData();
    form.title("Config Rarities");
    form.body("Rarity Overview (Read-only in this version)");

    Object.entries(config.rarities).forEach(([key, val]) => {
      form.button(
        `${val.color}${val.display}\n§7Key: ${key}`,
        UI_TEXTURES.color_picker,
      );
    });

    form.button("Back", UI_TEXTURES.arrow_left);

    await ForceOpen(player, form);
    this.showMenu(player);
  }
}

export function showRareShop(player) {
  RareShop.showMainMenu(player);
}

export function showRareShopAdmin(player) {
  RareShopAdmin.showMenu(player);
}
