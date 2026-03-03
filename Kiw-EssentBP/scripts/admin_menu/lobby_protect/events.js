import { system, world } from "../../core.js";
import { getLobbyConfig, getRegionConfig, isInProtectedRegion, isEntityExcluded, getProtectedRegions } from "./config.js";
import { isAuthorizedAdmin, sendProtectionMessage, playerAreas } from "./utils.js";
import { getGenerators } from "../ore_generator/database_ore.js";
import { activateLobbyMode, deactivateLobbyMode } from "./lobby_inventory.js"
import { registerFarmlandEvents } from "./farmland_protect.js";

const isInOreGen = (loc, dim) =>
  dim.id === "minecraft:overworld" &&
  getGenerators().some(
    (g) =>
      g.pos1 &&
      g.pos2 &&
      loc.x >= Math.min(g.pos1.x, g.pos2.x) &&
      loc.x <= Math.max(g.pos1.x, g.pos2.x) &&
      loc.y >= Math.min(g.pos1.y, g.pos2.y) &&
      loc.y <= Math.max(g.pos1.y, g.pos2.y) &&
      loc.z >= Math.min(g.pos1.z, g.pos2.z) &&
      loc.z <= Math.max(g.pos1.z, g.pos2.z),
  );

const cache = {
  prot: new Map(),
  lastProt: 0,
  regions: [],
  regionsTime: 0,
  lastPos: new Map(),
  lastReg: new Map(),
};

const checkProt = (player, loc, regId, type) => {
  const now = Date.now(),
    key = `${regId}_${type}`;
  if (now - cache.lastProt < 5000 && cache.prot.has(key)) {
    const c = cache.prot.get(key);
    if (c.admin === isAuthorizedAdmin(player, regId)) return c.res;
  }
  const conf = getRegionConfig(regId),
    admin = isAuthorizedAdmin(player, regId);
  const res =
    !conf[type] || admin
      ? false
      : conf.protectedDimensions.includes(player.dimension.id.split(":")[1]);
  cache.prot.set(key, { res, admin });
  cache.lastProt = now;
  return res;
};

const partQ = [];

export function registerAllEvents() {
  registerFarmlandEvents();
  const handleBlock = (ev, type, msg) => {
    try {
      const { player, block } = ev;
      if (type === "blockBreakProtection" && isInOreGen(block.location, block.dimension)) return;
      const reg = isInProtectedRegion(block.location, block.dimension.id);
      if (!reg) return;
      if (type === "blockBreakProtection" && (block.typeId === "minecraft:farmland" || block.typeId?.includes("crop") || block.typeId?.includes("wheat") || block.typeId?.includes("carrot") || block.typeId?.includes("potato") || block.typeId?.includes("beetroot") || block.typeId?.includes("melon_stem") || block.typeId?.includes("pumpkin_stem") || block.typeId?.includes("torchflower") || block.typeId?.includes("pitcher") || block.typeId?.includes("berry") || block.typeId?.includes("cocoa") || block.typeId?.includes("wart"))) return;
      if (!checkProt(player, block.location, reg.id, type)) return;
      ev.cancel = true;
      sendProtectionMessage(player, msg);
      if (getRegionConfig(reg.id).showParticles)
        partQ.push({ dim: player.dimension, loc: block.location, type: "minecraft:large_smoke", delay: 0 });
    } catch {}
  };
  world.beforeEvents.playerBreakBlock.subscribe((e) =>
    handleBlock(e, "blockBreakProtection", "§c⚠ §7You cannot break blocks here!"),
  );
  world.beforeEvents.playerPlaceBlock.subscribe((e) =>
    handleBlock(e, "blockPlaceProtection", "§c⚠ §7You cannot place blocks here!"),
  );
  world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
    try {
      const { player, block, itemStack } = e,
        reg = isInProtectedRegion(block.location, block.dimension.id);
      if (!reg) return;
      if (
        itemStack &&
        (itemStack.typeId.includes("flint_and_steel") || itemStack.typeId.includes("fire_charge")) &&
        getRegionConfig(reg.id).fireProtection
      ) {
        e.cancel = true;
        sendProtectionMessage(player, "§c⚠ §7Fire is disabled!");
        return;
      }
      if (block.typeId === "minecraft:flower_pot") {
        if (
          checkProt(player, block.location, reg.id, "blockPlaceProtection") ||
          checkProt(player, block.location, reg.id, "blockBreakProtection")
        ) {
          e.cancel = true;
          sendProtectionMessage(player, "§c⚠ §7Flower pots are protected!");
          return;
        }
      }
      if (!checkProt(player, block.location, reg.id, "interactionProtection")) return;
      e.cancel = true;
      sendProtectionMessage(player, "§c⚠ §7Interaction restricted!");
    } catch {}
  });
  world.beforeEvents.playerInteractWithEntity.subscribe((e) => {
    try {
      const { player, target: t } = e;
      if (!t?.isValid() || !t.location) return;
      const reg = isInProtectedRegion(t.location, t.dimension.id);
      if (!reg || isEntityExcluded(t.typeId, reg.id) || !checkProt(player, t.location, reg.id, "interactionProtection")) return;
      if (t.typeId.includes("item_frame")) {
        e.cancel = true;
        sendProtectionMessage(player, "§c⚠ §7Item frames are protected!");
        if (getRegionConfig(reg.id).showParticles)
          partQ.push({
            dim: player.dimension,
            loc: t.location,
            type: "minecraft:villager_angry",
            delay: 0,
          });
      }
    } catch {}
  });
  world.beforeEvents.explosion.subscribe((e) => {
    const loc = e.source?.location;
    const dimId = e.source?.dimension?.id ?? e.dimension?.id;
    if (!dimId) return;
    const impactedBlocks = e.getImpactedBlocks();
    const blocksToDestroy = [];
    for (const block of impactedBlocks) {
      const blockReg = isInProtectedRegion(block.location, dimId);
      if (!blockReg || !(getRegionConfig(blockReg.id).explosionProtection ?? true)) {
        blocksToDestroy.push(block);
      }
    }
    if (blocksToDestroy.length === 0) {
      e.cancel = true;
    } else {
      e.setImpactedBlocks(blocksToDestroy);
    }
  });
  world.afterEvents.playerSpawn.subscribe(({ player }) => checkPlayerRegion(player));
  let liquidTick = 0;
  system.runInterval(() => {
    liquidTick++;
    if (liquidTick % 10 !== 0) return;
    const regions = getProtectedRegions().filter(r => getRegionConfig(r.id).liquidProtection);
    if (regions.length === 0) return;
    for (const region of regions) {
      try {
        const [x1, x2] = [Math.min(region.pos1.x, region.pos2.x), Math.max(region.pos1.x, region.pos2.x)];
        const [y1, y2] = [Math.min(region.pos1.y, region.pos2.y), Math.max(region.pos1.y, region.pos2.y)];
        const [z1, z2] = [Math.min(region.pos1.z, region.pos2.z), Math.max(region.pos1.z, region.pos2.z)];
        const dims = (getRegionConfig(region.id).protectedDimensions || ["overworld"]).map(d => `minecraft:${d}`);
        for (const dimId of dims) {
          try {
            const dim = world.getDimension(dimId);
            const step = Math.max(1, Math.floor((x2-x1)/5));
            for (let x = x1; x <= x2; x += step) {
              for (let y = y1; y <= y2; y += step) {
                for (let z = z1; z <= z2; z += step) {
                  try {
                    const block = dim.getBlock({ x, y, z });
                    if (block && block.isValid() && block.isLiquid) {
                      dim.runCommand(`fill ${x} ${y} ${z} ${x} ${y} ${z} minecraft:air replace ${block.typeId}`);
                    }
                  } catch {}
                }
              }
            }
          } catch {}
        }
      } catch {}
    }
  }, 1);
  system.runInterval(() => {
    const now = Date.now(),
      players = world.getPlayers();
    if (partQ.length)
      partQ.splice(0, 15).forEach((p, i) =>
        system.runTimeout(() => {
          try {
            p.dim.runCommand(`particle ${p.type} ${p.loc.x + 0.5} ${p.loc.y + 0.5} ${p.loc.z + 0.5}`);
          } catch {}
        }, p.delay + i * 5),
      );
    players.forEach((p) => {
      const reg = isInProtectedRegion(p.location, p.dimension.id);
      if (!reg) return;
      const conf = getRegionConfig(reg.id);
      if (conf.mobSpawnProtection) {
        p.dimension
          .getEntities({ location: p.location, maxDistance: 24 })
          .filter(
            (e) =>
              e.id !== p.id &&
              !e.typeId.includes("player") &&
              !isEntityExcluded(e.typeId, reg.id) &&
              isInProtectedRegion(e.location, e.dimension.id)?.id === reg.id,
          )
          .forEach((e) => e.remove());
      }
      if (!isAuthorizedAdmin(p, reg.id)) {
        if (conf.pvpProtection) try {
          p.runCommand("effect @s weakness 2 255 true");
        } catch {}
        if (conf.damageProtection) try {
          p.runCommand("effect @s resistance 2 255 true");
        } catch {}
        if (conf.hungerProtection) try {
          p.runCommand("effect @s saturation 2 255 true");
        } catch {}
      }
    });
    const online = new Set(players.map((p) => p.id));
    [playerAreas, cache.lastPos, cache.lastReg].forEach((m) => {
      for (const k of m.keys()) if (!online.has(k)) m.delete(k);
    });
    players.forEach((p) => {
      try {
        if (p.getTags().some((t) => t.startsWith("loadchunck`"))) return;
        const { x, y, z } = p.location,
          pos = { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) },
          lp = cache.lastPos.get(p.id);
        if (lp && lp.x === pos.x && lp.y === pos.y && lp.z === pos.z) return;
        cache.lastPos.set(p.id, pos);
        const reg = isInProtectedRegion(pos, p.dimension.id),
          curId = reg?.id,
          prevId = cache.lastReg.get(p.id);
        if (curId !== prevId) {
          cache.lastReg.set(p.id, curId);
          checkPlayerRegion(p, reg);
        }
      } catch {}
    });
  }, 20);
}

export function checkPlayerRegion(player, region = undefined) {
  try {
    const reg =
      region === undefined
        ? isInProtectedRegion(player.location, player.dimension.id)
        : region;
    if (!reg) {
      if (playerAreas.has(player.id)) {
        deactivateLobbyMode(player);
        player.onScreenDisplay.setActionBar("§c: §lWILDERNESS §r§8» §7Protection Disabled");
        playerAreas.delete(player.id);
      }
      return;
    }
    const conf = getRegionConfig(reg.id);
    conf.lobbyInventoryEnabled ? activateLobbyMode(player) : deactivateLobbyMode(player);
    playerAreas.set(player.id, { regionId: reg.id, isProtected: true });
    if (conf.notifyOnEnter) {
      const admin = isAuthorizedAdmin(player, reg.id);
      player.onScreenDisplay.setActionBar(
        admin
          ? "§6: §lADMIN ZONE §r§8» §7Bypass Enabled"
          : "§b: §lSAFE ZONE §r§8» §7You are now protected",
      );
    }
  } catch {}
}
