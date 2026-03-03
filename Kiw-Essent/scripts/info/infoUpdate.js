import { Lang } from "../lib/Lang.js";

/**
 * Shows the changelog/update information to a player
 * @param {import("@minecraft/server").Player} source - The player to show the changelog to
 */
export function showChangelog(source) {
  const msg = Lang.t(source, "info.changelog.msg");
  source.runCommand(`tellraw @s {"rawtext":[{"text":"${msg}"}]}`);
}

