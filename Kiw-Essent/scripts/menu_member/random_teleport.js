import { system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

const cooldowns = new Map();
const pending = new Map();
const rtpQueue = new Map(); // playerName => { loc, old, tick }
const CENTER = [0, 0];

const msg = {
  title: "Random Teleport",
  cd: (s) => `{"rawtext":[{"text":"§cCooldown! Wait §e${s} §csec"}]}`,
  wait: '{"rawtext":[{"text":"§eFinding safe location..."}]}',
  move: '{"rawtext":[{"text":"§cTeleport cancelled - You moved!"}]}',
  cancel: '{"rawtext":[{"text":"§cRandom teleport cancelled"}]}',
  error: '{"rawtext":[{"text":"§cFailed to process teleport request"}]}',
  under:
    '{"rawtext":[{"text":"§cPlease wait, still processing previous teleport"}]}',
};

export function random_tp(pl) {
  const cfg = getRTPConfig();
  const now = Date.now();
  let ts = cooldowns.get(pl.name) || [];
  ts = ts.filter((t) => now - t < cfg.cooldownTime * 1000);
  if (ts.length >= cfg.maxUses) {
    const sisa = Math.ceil((cfg.cooldownTime * 1000 - (now - ts[0])) / 1000);
    pl.runCommand(`titleraw @s actionbar ${msg.cd(sisa)}`);
    return;
  }
  if (pending.has(pl.name) || rtpQueue.has(pl.name)) {
    pl.runCommand(`titleraw @s actionbar ${msg.under}`);
    return;
  }

  const sisa = cfg.maxUses - ts.length;
  new ActionFormData()
    .title(msg.title)
    .body(
      `§7Uses: §b${sisa}§7/${cfg.maxUses} \n§7Range: §b${cfg.maxDistance}`,
    )
    .button("§bTeleport", "textures/ui/icon_winter")
    .button("§cCancel", "textures/ui/cancel")
    .show(pl)
    .then((res) => handleRTP(pl, ts, now, res))
    .catch(() => pl.runCommand(`titleraw @s actionbar ${msg.error}`));
}

function doRandomTeleport(pl, ts, now) {
  const cfg = getRTPConfig();
  const x =
    Math.floor(Math.random() * (cfg.maxDistance * 2 + 1)) - cfg.maxDistance;
  const z =
    Math.floor(Math.random() * (cfg.maxDistance * 2 + 1)) - cfg.maxDistance;
  const fakeY = 320;
  const loc = { x, y: fakeY, z };
  const oldLoc = { ...pl.location, dim: pl.dimension.id };
  pl.addTag(`rtpOld\`${JSON.stringify(oldLoc)}`);
  try {
    if (!pl || !pl.dimension) throw new Error("Player tidak valid");
    
    // FIX: Deactivate lobby mode BEFORE teleporting to prevent item loss
    try { deactivateLobbyMode(pl); } catch (e) {}

    pl.teleport(
      { x: CENTER[0], y: 320, z: CENTER[1] },
      { dimension: world.getDimension("overworld") },
    );
    pl.teleport(loc, { dimension: world.getDimension("overworld") });
    rtpQueue.set(pl.name, { loc, old: oldLoc, tick: 0 });
    pl.runCommand(`titleraw @s actionbar ${msg.wait}`);
    ts.push(now);
    cooldowns.set(pl.name, ts);
  } catch (e) {
    pending.delete(pl.name);
    rtpQueue.delete(pl.name);
    pl?.runCommand?.(`titleraw @s actionbar ${msg.error}`);
  }
}

function doRandomTeleportWithCountdown(pl, ts, now, cb) {
  const cfg = getRTPConfig();
  const DELAY = cfg.teleportDelay || 3;
  const pos0 = pl.location;
  let cd = DELAY,
    frame = 0;
  pending.set(pl.name, true);
  const barLen = 10;
  const intv = system.runInterval(() => {
    const pos = pl.location;
    if (
      Math.abs(pos.x - pos0.x) > 0.1 ||
      Math.abs(pos.y - pos0.y) > 0.1 ||
      Math.abs(pos.z - pos0.z) > 0.1
    ) {
      system.clearRun(intv);
      pending.delete(pl.name);
      pl.runCommand(`titleraw @s actionbar ${msg.move}`);
      return;
    }
    const totalFrames = DELAY * 20;
    const progress = (cd / DELAY) * barLen - (frame / totalFrames) * barLen;
    const trans = ["▏", "▎", "▍", "▌", "▋", "▊", "▉"];
    const full = Math.max(0, Math.floor(progress));
    let bar = "█".repeat(full);
    const frac = progress - full;
    if (frac > 0 && full < barLen)
      bar += trans[Math.floor(frac * trans.length)];
    bar += " ".repeat(Math.max(0, barLen - bar.length));
    pl.onScreenDisplay.setActionBar(
      `§e⚡ Teleport Countdown [§b${bar}§e] §b${cd}s`,
    );
    frame++;
    if (frame >= 20) {
      frame = 0;
      cd--;
    }
    if (cd <= 0) {
      system.clearRun(intv);
      pending.delete(pl.name);
      cb();
    }
  }, 1);
}

function handleRTP(pl, ts, now, res) {
  if (res.canceled || res.selection === 1) {
    pl.runCommand(`titleraw @s actionbar ${msg.cancel}`);
    return;
  }
  try {
    doRandomTeleportWithCountdown(pl, ts, now, () =>
      doRandomTeleport(pl, ts, now),
    );
  } catch {
    pl.runCommand(`titleraw @s actionbar ${msg.error}`);
    pending.delete(pl.name);
  }
}

// Interval hanya cek player di rtpQueue, bukan all player
system.runInterval(() => {
  for (const [name, data] of rtpQueue) {
    const pl = world.getPlayers().find((p) => p.name === name);
    if (!pl) {
      rtpQueue.delete(name);
      continue;
    }
    let y = data.loc.y;
    let blk = pl.dimension.getBlock({ x: data.loc.x, y, z: data.loc.z });
    while (
      y >= -64 &&
      blk &&
      (blk.isAir || blk.isLiquid || blk.typeId === "minecraft.cave_air")
    ) {
      y--;
      blk = pl.dimension.getBlock({ x: data.loc.x, y, z: data.loc.z });
    }
    if (
      y >= -64 &&
      blk &&
      typeof blk.x === "number" &&
      typeof blk.y === "number" &&
      typeof blk.z === "number"
    ) {
      const fy = Math.round(blk.y + 1);
      try {
        pl.teleport(
          { x: blk.x + 0.5, y: fy, z: blk.z + 0.5 },
          { dimension: world.getDimension("overworld") },
        );
        pl.removeTag(`rtpLoad\`${JSON.stringify(data.loc)}`);
        pl.removeTag(`rtpOld\`${JSON.stringify(data.old)}`);
        pl.onScreenDisplay.updateSubtitle(
          `§fYou have been teleported to §bX: ${Math.round(blk.x + 0.5)} Y: ${fy} Z: ${Math.round(blk.z + 0.5)}`,
        );
        pl.runCommand("playsound mob.endermen.portal @s ~ ~ ~ 1 1 1");
      } catch (e) {
        pl?.runCommand?.(`titleraw @s actionbar ${msg.error}`);
      }
      rtpQueue.delete(name);
    }
  }
}, 2); // interval bisa diubah, misal 2 tick (100ms) biar lebih ringan

world.beforeEvents.playerLeave.subscribe(({ player: pl }) => {
  if (pending.has(pl.name)) pending.delete(pl.name);
  if (rtpQueue.has(pl.name)) rtpQueue.delete(pl.name);
  const old = pl.getTags().find((t) => t.startsWith("rtpOld`"));
  if (old) {
    const { x, y, z, dim } = JSON.parse(old.split("`")[1]);
    system.run(() => {
      try {
        pl.teleport({ x, y, z }, { dimension: world.getDimension(dim) });
        pl.removeTag(old);
      } catch {}
    });
  }
});

export function getRTPConfig() {
  try {
    const s = world.getDynamicProperty("rtpConfig");
    if (s) return JSON.parse(s);
  } catch {}
  return {
    maxUses: 3,
    cooldownTime: 5 * 60,
    maxDistance: 2000,
    teleportDelay: 3,
  };
}

export function random_tp_instant(pl) {
  const cfg = getRTPConfig();
  const now = Date.now();
  let ts = cooldowns.get(pl.name) || [];
  ts = ts.filter((t) => now - t < cfg.cooldownTime * 1000);
  if (ts.length >= cfg.maxUses) {
    const sisa = Math.ceil((cfg.cooldownTime * 1000 - (now - ts[0])) / 1000);
    system.run(() => {
      pl.runCommand(`titleraw @s actionbar ${msg.cd(sisa)}`);
    });
    return;
  }
  if (pending.has(pl.name) || rtpQueue.has(pl.name)) {
    system.run(() => {
      pl.runCommand(`titleraw @s actionbar ${msg.under}`);
    });
    return;
  }
  system.run(() => {
    doRandomTeleportWithCountdown(pl, ts, now, () =>
      doRandomTeleport(pl, ts, now),
    );
  });
}
