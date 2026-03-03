import { ModalFormData, world, system } from "../core.js";
const KICK_WARNING = "§cWARNING: Kick in 3s!\nReason: ";
export async function showKickPlayerMenu(source) {
  try {
    const players = Array.from(world.getPlayers()).filter(
      (p) => p.name !== source.name,
    );
    if (!players.length) {
      source.runCommand(
        `tellraw @s {"rawtext":[{"text":"§c✘ No players available to kick!"}]}`,
      );
      return;
    }
    const playerNames = players.map((p) => p.name);
    const kickForm = new ModalFormData()
      .title("§cKICK PLAYER")
      .dropdown("§eSelect Player\n§8Choose player to kick", playerNames, {
        defaultValue: 0,
        tooltip: "§6Select a player to kick from the server",
      })
      .textField(
        "§eKick Reason\n§8Why are you kicking this player?",
        "Enter reason...",
        { defaultValue: "", placeholder: "Enter kick reason" },
      )
      .toggle("§eShow Warning\n§8Send warning message before kick", {
        defaultValue: true,
        tooltip: "§6Show 3 second warning before kicking",
      });
    const response = await kickForm.show(source);
    if (response.canceled) return;
    const [playerIndex, reason = "No reason provided", warning] =
      response.formValues;
    const playerName = playerNames[playerIndex];
    if (warning) {
      await handleWarningKick(source, playerName, reason);
    } else {
      await executeKick(source, playerName, reason);
    }
  } catch (error) {
    console.warn("Kick menu error:", error);
    source.runCommand(
      `tellraw @s {"rawtext":[{"text":"§c✘ Error executing kick command"}]}`,
    );
  }
}
async function handleWarningKick(source, playerName, reason) {
  const target = world.getPlayers().find((p) => p.name === playerName);
  if (!target) return;
  target.runCommand(
    `tellraw @s {"rawtext":[{"text":"${KICK_WARNING}${reason}"}]}`,
  );
  system.runTimeout(() => {
    executeKick(source, playerName, reason);
  }, 60);
}
async function executeKick(source, playerName, reason) {
  try {
    source.runCommand(`kick "${playerName}" ${reason}`);
    source.runCommand(
      `tellraw @a {"rawtext":[{"text":"§e${playerName} was kicked by ${source.name}\nReason: ${reason}"}]}`,
    );
  } catch (error) {
    console.warn("Kick execution error:", error);
  }
}
