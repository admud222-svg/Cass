import { system, world } from "@minecraft/server";
import { MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { Lang } from "../lib/Lang.js";
const SOUNDS = {
  accept: "note.pling",
  deny: "note.bass",
  countdown: "note.hat",
  teleport: "mob.endermen.portal",
};
const COMMANDS = {
  hideOutput: "gamerule sendcommandfeedback false",
  showOutput: "gamerule sendcommandfeedback true",
};
const cooldowns = new Map();
const COOLDOWN_DURATION = 10000;
const requestLimits = new Map();
const MAX_REQUESTS = 3;
const LIMIT_WINDOW = 60000;
const activeRequests = new Set();
export function TeleportRequest(player) {
  const lastRequest = cooldowns.get(player.id);
  if (lastRequest && Date.now() - lastRequest < COOLDOWN_DURATION) {
    const remainingTime = Math.ceil(
      (COOLDOWN_DURATION - (Date.now() - lastRequest)) / 1000,
    );
    player.runCommand(
      `titleraw @s actionbar {"rawtext":[{"text":"§c⚠ ${Lang.t(player, "tpa.msg.cooldown", remainingTime)}"}]}`,
    );
    return;
  }
  const playerRequests = requestLimits.get(player.id) || [];
  const now = Date.now();
  const recentRequests = playerRequests.filter(
    (time) => now - time < LIMIT_WINDOW,
  );
  if (recentRequests.length >= MAX_REQUESTS) {
    player.runCommand(
      `titleraw @s actionbar {"rawtext":[{"text":"§c⚠ ${Lang.t(player, "tpa.msg.too_many")}"}]}`,
    );
    return;
  }
  const players = Array.from(world.getPlayers());
  const playerNames = players.map((p) => p.name);
  if (playerNames.length === 0) {
    player.runCommand(`titleraw @s actionbar {"rawtext":[{"text":"§c${Lang.t(player, "tpa.msg.no_players")}"}]}`);
    return;
  }
  new ModalFormData()
    .title(Lang.t(player, "tpa.menu.title"))
    .dropdown(`§e${Lang.t(player, "tpa.menu.select_player")}`, playerNames, {
      defaultValueIndex: 0,
    })
    .toggle(`§b${Lang.t(player, "tpa.menu.bring_to_me")}\n§7${Lang.t(player, "tpa.menu.bring_desc")}`, {
      defaultValue: false,
    })
    .toggle(`§c${Lang.t(player, "tpa.menu.disable_requests")}`, {
      defaultValue: player.hasTag("disableTpa"),
    })
    .submitButton(Lang.t(player, "tpa.menu.send"))
    .show(player)
    .then((response) =>
      handleFormResponse(response, player, players, playerNames),
    )
    .catch(console.warn);
}
async function handleFormResponse(response, player, players, playerNames) {
  if (response.canceled) return;
  const [selectedIndex, tpHere, disableRequests] = response.formValues;
  const target = players.find((p) => p.name === playerNames[selectedIndex]);
  if (
    !target ||
    !Array.from(world.getPlayers()).some((p) => p.id === target.id)
  ) {
    player.runCommand(
      `titleraw @s actionbar {"rawtext":[{"text":"§c${Lang.t(player, "tpa.msg.player_offline")}"}]}`,
    );
    return;
  }
  if (disableRequests !== player.hasTag("disableTpa")) {
    player.runCommand(
      `titleraw @s actionbar {"rawtext":[{"text":"${disableRequests ? '§c' + Lang.t(player, 'tpa.msg.disabled') : '§a' + Lang.t(player, 'tpa.msg.enabled')}"}]}`,
    );
    disableRequests
      ? player.addTag("disableTpa")
      : player.removeTag("disableTpa");
  }
  if (target.hasTag("disableTpa")) {
    player.runCommand(
      `titleraw @s actionbar {"rawtext":[{"text":"§c${Lang.t(player, "tpa.msg.target_disabled", target.name)}"}]}`,
    );
    return;
  }
  if (player.hasTag("disableTpa")) {
    player.runCommand(
      `titleraw @s actionbar {"rawtext":[{"text":"§c${Lang.t(player, "tpa.msg.you_disabled")}"}]}`,
    );
    return;
  }
  const requestKey = `${player.id}-${target.id}`;
  if (activeRequests.has(requestKey)) {
    player.runCommand(
      `titleraw @s actionbar {"rawtext":[{"text":"§c${Lang.t(player, "tpa.msg.pending")}"}]}`,
    );
    return;
  }
  const playerRequests = requestLimits.get(player.id) || [];
  playerRequests.push(Date.now());
  requestLimits.set(player.id, playerRequests);
  cooldowns.set(player.id, Date.now());
  activeRequests.add(requestKey);
  const messageForm = new MessageFormData()
    .title(Lang.t(target, "tpa.request.title"))
    .body(
      tpHere ? `§b${player.name} §7${Lang.t(target, "tpa.request.body_wants_you", player.name)}` : `§b${player.name} §7${Lang.t(target, "tpa.request.body_wants_visit", player.name)}`,
    )
    .button1(Lang.t(target, "tpa.request.accept"))
    .button2(Lang.t(target, "tpa.request.decline"));
  player.runCommand(
    `titleraw @s actionbar {"rawtext":[{"text":"§a${Lang.t(player, "tpa.msg.request_sent", target.name)}"}]}`,
  );
  player.runCommand(`playsound ${SOUNDS.accept} @s`);
  const requestTimeout = system.runTimeout(() => {
    if (activeRequests.has(requestKey)) {
      activeRequests.delete(requestKey);
      player.runCommand(
        `titleraw @s actionbar {"rawtext":[{"text":"§c⚠ ${Lang.t(player, "tpa.msg.timeout")}"}]}`,
      );
    }
  }, 30000);
  const result = await messageForm.show(target);
  system.clearRun(requestTimeout);
  if (result.canceled || result.selection === undefined) {
    player.runCommand(
      `titleraw @s actionbar {"rawtext":[{"text":"§c${Lang.t(player, "tpa.msg.request_denied")}"}]}`,
    );
    player.runCommand(`playsound ${SOUNDS.deny} @s`);
    activeRequests.delete(requestKey);
    return;
  }
  if (result.selection === 1) {
    player.runCommand(
      `titleraw @s actionbar {"rawtext":[{"text":"§c${Lang.t(player, "tpa.msg.request_denied")}"}]}`,
    );
    player.runCommand(`playsound ${SOUNDS.deny} @s`);
    activeRequests.delete(requestKey);
    return;
  }
  if (
    !target ||
    !Array.from(world.getPlayers()).some((p) => p.id === target.id) ||
    target.hasTag("disableTpa")
  ) {
    player.runCommand(
      `titleraw @s actionbar {"rawtext":[{"text":"§c${Lang.t(player, "tpa.msg.target_unavailable")}"}]}`,
    );
    activeRequests.delete(requestKey);
    return;
  }
  try {
    player.runCommand(COMMANDS.hideOutput);
    const initialPosition = { ...player.location };
    player.runCommand(`titleraw @s actionbar {"rawtext":[{"text":"§e${Lang.t(player, "tpa.msg.stand_still")}"}]}`);
    for (let i = 3; i > 0; i--) {
      await new Promise((resolve, reject) => {
        system.runTimeout(() => {
          if (hasPlayerMoved(player, initialPosition)) {
            player.runCommand(
              `titleraw @s actionbar {"rawtext":[{"text":"§c${Lang.t(player, "tpa.msg.moved")}"}]}`,
            );
            player.runCommand(`playsound ${SOUNDS.deny} @s`);
            target.runCommand(
              `titleraw @s actionbar {"rawtext":[{"text":"§c${Lang.t(target, "tpa.msg.other_moved")}"}]}`,
            );
            target.runCommand(`playsound ${SOUNDS.deny} @s`);
            reject(new Error("Movement detected"));
            return;
          }
          const countdownMsg = `{"rawtext":[{"text":"§e${Lang.t(player, "tpa.msg.countdown", i)}"}]}`;
          player.runCommand(`titleraw @s actionbar ${countdownMsg}`);
          target.runCommand(`titleraw @s actionbar ${countdownMsg}`);
          player.runCommand(`playsound ${SOUNDS.countdown} @s`);
          target.runCommand(`playsound ${SOUNDS.countdown} @s`);
          resolve();
        }, 20);
      });
    }
    if (hasPlayerMoved(player, initialPosition)) {
      throw new Error("Movement detected at final check");
    }
    const targetName = tpHere ? target.name : player.name;
    const destinationName = tpHere ? player.name : target.name;
    const successMsg = `{"rawtext":[{"text":"§a${Lang.t(player, "tpa.msg.success")}"}]}`;
    executeCommandsSync(targetName, destinationName, [
      `effect @s resistance 10 255 true`,
      `tp @s "${destinationName}"`,
      `playsound ${SOUNDS.teleport} @s`,
      `titleraw @s actionbar ${successMsg}`,
    ]);
  } catch (error) {
    if (error.message !== "Movement detected") {
      console.warn("Teleport error:", error);
      player.sendMessage(`§c⚠ ${Lang.t(player, "tpa.msg.failed")}`);
    }
  } finally {
    activeRequests.delete(requestKey);
    const now = Date.now();
    for (const [playerId, requests] of requestLimits) {
      const validRequests = requests.filter(
        (time) => now - time < LIMIT_WINDOW,
      );
      if (validRequests.length === 0) {
        requestLimits.delete(playerId);
      } else {
        requestLimits.set(playerId, validRequests);
      }
    }
    try {
      player.runCommand(COMMANDS.showOutput);
    } catch (e) {
      console.warn("Error resetting command feedback:", e);
    }
  }
}
function executeCommandsSync(targetName, destinationName, commands) {
  const target = world.getPlayers().find((p) => p.name === targetName);
  if (!target) return;
  try {
    target.runCommand(COMMANDS.hideOutput);
    for (const cmd of commands) {
      target.runCommand(cmd);
    }
  } catch (error) {
    console.warn("Command execution error:", error);
  } finally {
    target.runCommand(COMMANDS.showOutput);
  }
}
function hasPlayerMoved(player, initialPos) {
  const currentPos = player.location;
  return (
    Math.abs(initialPos.x - currentPos.x) > 0.01 ||
    Math.abs(initialPos.y - currentPos.y) > 0.01 ||
    Math.abs(initialPos.z - currentPos.z) > 0.01
  );
}
function cleanupOldData() {
  const now = Date.now();
  for (const [playerId, time] of cooldowns) {
    if (now - time > COOLDOWN_DURATION) {
      cooldowns.delete(playerId);
    }
  }
  for (const [playerId, requests] of requestLimits) {
    const validRequests = requests.filter((time) => now - time < LIMIT_WINDOW);
    if (validRequests.length === 0) {
      requestLimits.delete(playerId);
    } else {
      requestLimits.set(playerId, validRequests);
    }
  }
}
system.runInterval(cleanupOldData, 60000);
