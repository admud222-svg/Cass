import { world, ItemStack } from "@minecraft/server";
import { addMoney } from "../function/moneySystem.js";

export async function giveQuestRewards(player, rewards) {
  try {
    if (rewards.money) {
      if (addMoney(player, rewards.money)) {
        player.sendMessage(`§a+ $${rewards.money}`);
      } else {
        console.warn(`Failed to add money reward to player ${player.name}`);
      }
    }

    if (rewards.items && Array.isArray(rewards.items)) {
      const inventory = player.getComponent("inventory")?.container;
      for (const item of rewards.items) {
        if (item.id && item.count) {
          try {
            const itemStack = new ItemStack(item.id, item.count);
            if (inventory) {
              const leftOver = inventory.addItem(itemStack);
              if (leftOver) {
                player.dimension.spawnItem(leftOver, player.location);
                player.sendMessage(
                  "§eInventory full! Reward dropped at your feet.",
                );
              }
            } else {
              player.dimension.spawnItem(itemStack, player.location);
            }
          } catch (e) {
            try {
              player.runCommand("gamerule sendcommandfeedback false");
              player.runCommand(`give @s ${item.id} ${item.count}`);
              player.runCommand("gamerule sendcommandfeedback true");
            } catch (cmdErr) {
              player.runCommand("gamerule sendcommandfeedback true");
            }
          }
        }
      }
    }

    player.runCommand("playsound random.levelup @s ~~~ 1 1");
    player.runCommand("particle minecraft:totem_particle ~~~");

    return true;
  } catch (error) {
    console.warn("Error giving quest rewards:", error);
    return false;
  }
}

export function calculateRewardValue(rewards) {
  let totalValue = 0;

  if (rewards.money) {
    totalValue += rewards.money;
  }

  if (rewards.items && Array.isArray(rewards.items)) {
    for (const item of rewards.items) {
      const valuePerItem =
        {
          "minecraft:diamond": 100,
          "minecraft:golden_apple": 50,
          "minecraft:emerald": 25,
        }[item.id] || 5;
      totalValue += valuePerItem * item.count;
    }
  }

  return totalValue;
}

export function formatRewardDisplay(rewards) {
  const display = [];

  if (rewards.money) {
    display.push(`§6$${rewards.money}`);
  }

  if (rewards.items && Array.isArray(rewards.items)) {
    for (const item of rewards.items) {
      const itemName = item.id.replace("minecraft:", "").replace(/_/g, " ");
      display.push(`§e${itemName} §7x${item.count}`);
    }
  }

  return display.join("\n");
}

export function adjustRewardsByDifficulty(rewards, difficulty = 1) {
  const adjustedRewards = { ...rewards };

  if (adjustedRewards.money) {
    adjustedRewards.money = Math.floor(adjustedRewards.money * difficulty);
  }

  if (adjustedRewards.items && Array.isArray(adjustedRewards.items)) {
    adjustedRewards.items = adjustedRewards.items.map((item) => ({
      ...item,
      count: Math.max(1, Math.floor(item.count * difficulty)),
    }));
  }

  return adjustedRewards;
}

export function validateRewards(rewards) {
  if (!rewards) return false;

  if (rewards.money && typeof rewards.money !== "number") return false;

  if (rewards.items) {
    if (!Array.isArray(rewards.items)) return false;

    for (const item of rewards.items) {
      if (!item.id || typeof item.id !== "string") return false;
      if (!item.count || typeof item.count !== "number") return false;
    }
  }

  return true;
}
