import { ModalFormData, world, system } from "../../core.js";
import {
  getFormattedMoney,
  getFullMoney,
  addMoney,
  removeMoney,
} from "../../function/moneySystem.js";
import { getScore } from "../../function/getScore.js";
import { metricNumbers } from "../../lib/game.js";
const showError = (player, msg) => {
  player.runCommand(
    `titleraw @s actionbar {"rawtext":[{"text":"§c✖ §7${msg}"}]}`,
  );
  player.runCommand("playsound note.bass @s");
};
const showSuccess = (player, msg) => {
  player.runCommand(
    `titleraw @s actionbar {"rawtext":[{"text":"§a✓ ${msg}"}]}`,
  );
  player.runCommand("playsound random.levelup @s");
};
const getConfig = () => ({
  minTransfer: 1000,
  maxTransfer: 1000000,
  enabled: true,
  useCoinObjective: true,
  ...JSON.parse(world.getDynamicProperty("transferConfig") ?? "{}"),
});
const getOnlinePlayers = (excludePlayer) =>
  [...world.getPlayers()].filter((p) => p.name !== excludePlayer.name);
const getPlayerCoins = (player) => {
  return getScore(player, "coin") || 0;
};
const addPlayerCoins = (player, amount) => {
  try {
    player.runCommand(`scoreboard players add @s coin ${amount}`);
    return true;
  } catch (error) {
    console.warn("Error adding coins:", error);
    return false;
  }
};
const removePlayerCoins = (player, amount) => {
  try {
    const currentCoins = getPlayerCoins(player);
    if (currentCoins < amount) return false;
    player.runCommand(`scoreboard players remove @s coin ${amount}`);
    return true;
  } catch (error) {
    console.warn("Error removing coins:", error);
    return false;
  }
};
const formatCoins = (amount) => {
  return metricNumbers(amount.toString());
};
const initializeCoinObjective = () => {
  try {
    const dim = world.getDimension("overworld");
    dim.runCommand(`scoreboard objectives add coin dummy`);
  } catch (error) {
    if (!error.toString().includes("already exists")) {
      console.warn("Error creating coin objective:", error);
    }
  }
};
system.runTimeout(() => {
  initializeCoinObjective();
}, 10);
const validateAmount = (amountStr, config) => {
  if (!amountStr?.trim())
    return { valid: false, error: "please enter an amount" };
  const amount = parseInt(amountStr.replace(/[^0-9]/g, ""));
  if (
    !amount ||
    isNaN(amount) ||
    amount < config.minTransfer ||
    amount > config.maxTransfer
  ) {
    return {
      valid: false,
      error: `please enter an amount between $${metricNumbers(config.minTransfer)} and $${metricNumbers(config.maxTransfer)}`,
    };
  }
  return { valid: true, amount };
};
export const coinSystem = {
  getPlayerCoins,
  addPlayerCoins,
  removePlayerCoins,
  formatCoins,
  initializeCoinObjective,
};
export async function transferMoney(player) {
  const config = getConfig();
  if (!config.enabled) {
    showError(player, "money transfer is currently disabled");
    return;
  }
  const players = getOnlinePlayers(player);
  if (!players.length) {
    showError(player, "no other players online to transfer to");
    return;
  }
  const playerCoins = getPlayerCoins(player);
  const playerMoney = getFullMoney(player);
  const balanceText = `coins: ${formatCoins(playerCoins)} | money: ${getFormattedMoney(player)}`;
  const response = await new ModalFormData()
    .title(`${balanceText} §t§p§a`)
    .dropdown("transfer type ", ["coins", "money"], {
      defaultValue: 0,
      tooltip: "choose what to transfer",
    })
    .dropdown(
      "select player",
      players.map((p) => p.name),
      {
        defaultValue: 0,
        tooltip: "choose a player to send to",
      },
    )
    .textField(
      `amount (${formatCoins(config.minTransfer)}-${formatCoins(config.maxTransfer)})`,
      "enter amount",
      {
        defaultValue: "",
        placeholder: "enter amount to transfer",
        tooltip: "enter the amount you want to send",
      },
    )
    .show(player)
    .catch(() => null);
  if (!response?.formValues) return;
  const [transferTypeIndex, targetIndex, amountStr] = response.formValues;
  const validation = validateAmount(amountStr, config);
  if (!validation.valid) {
    showError(player, validation.error);
    return;
  }
  const target = players[targetIndex];
  if (!target) {
    showError(player, "that player is no longer online");
    return;
  }
  const transferTypes = ["coins", "money"];
  const selectedTransferType = transferTypes[transferTypeIndex];
  const useCoins = selectedTransferType === "coins";
  try {
    const { amount } = validation;
    if (useCoins) {
      if (playerCoins < amount) {
        showError(player, "you don't have enough coins");
        return;
      }
      if (!removePlayerCoins(player, amount)) {
        showError(player, "failed to remove coins from your account");
        return;
      }
      if (!addPlayerCoins(target, amount)) {
        addPlayerCoins(player, amount);
        showError(player, "failed to send coins to target player");
        return;
      }
      const formattedAmount = formatCoins(amount);
      showSuccess(
        player,
        `you sent ${formattedAmount} coins to ${target.name}`,
      );
      showSuccess(target, `${player.name} sent you ${formattedAmount} coins`);
      console.warn(
        `[COIN TRANSFER] ${player.name} sent ${formattedAmount} coins to ${target.name}`,
      );
    } else {
      if (playerMoney < BigInt(amount)) {
        showError(player, "you don't have enough money");
        return;
      }
      if (!removeMoney(player, amount)) {
        showError(player, "failed to remove money from your account");
        return;
      }
      if (!addMoney(target, amount)) {
        addMoney(player, amount);
        showError(player, "failed to send money to target player");
        return;
      }
      const formattedAmount = metricNumbers(amount.toString());
      showSuccess(player, `you sent $${formattedAmount} to ${target.name}`);
      showSuccess(target, `${player.name} sent you $${formattedAmount}`);
      console.warn(
        `[MONEY TRANSFER] ${player.name} sent $${formattedAmount} to ${target.name}`,
      );
    }
  } catch (error) {
    console.warn("[TRANSFER ERROR]", error);
    showError(player, "transfer failed. please try again");
  }
}
