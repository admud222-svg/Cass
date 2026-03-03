import { system, world } from "../../core.js";
import { getLobbyConfig, getRegionConfig, isInProtectedRegion, isEntityExcluded, getProtectedRegions } from "./config.js";
import { isAuthorizedAdmin, sendProtectionMessage, playerAreas } from "./utils.js";
import { getGenerators } from "../ore_generator/database_ore.js";
import { activateLobbyMode, deactivateLobbyMode } from "./lobby_inventory.js"

const isInOreGen = (loc, dim) => dim.id === "minecraft:overworld" && getGenerators().some(g => g.pos1 && g.pos2 && loc.x >= Math.min(g.pos1.x, g.pos2.x) && loc.x <= Math.max(g.pos1.x, g.pos2.x) && loc.y >= Math.min(g.pos1.y, g.pos2.y) && loc.y <= Math.max(g.pos1.y, g.pos2.y) && loc.z >= Math.min(g.pos1.z, g.pos2.z) && loc.z <= Math.max(g.pos1.z, g.pos2.z));
const cache = { prot: new Map(), lastProt: 0, regions: [], regionsTime: 0, lastPos: new Map(), lastReg: new Map() };

const checkProt = (player, loc, regId, type) => {
  const now = Date.now(), key = `${regId}_${type}`;
  if (now - cache.lastProt < 5000 && cache.prot.has(key)) {
    const c = cache.prot.get(key);
    if (c.admin === isAuthorizedAdmin(player, regId)) return c.res;
  }
  const conf = getRegionConfig(regId), admin = isAuthorizedAdmin(player, regId);
  const res = (!conf[type] || admin) ? false : conf.protectedDimensions.includes(player.dimension.id.split(":")[1]);
  cache.prot.set(key, { res, admin }); cache.lastProt = now;
  return res;
};

const partQ = [];

export function registerAllEvents() {
  const handleBlock = (ev, type, msg) => {
    try {
      const { player, block } = ev;
      if (type === 'blockBreakProtection' && isInOreGen(block.location, block.dimension)) return;
      const reg = isInProtectedRegion(block.location, block.dimension.id);
      if (!reg || !checkProt(player, block.location, reg.id, type)) return;
      ev.cancel = true;
      sendProtectionMessage(player, msg);
      if (getRegionConfig(reg.id).showParticles) partQ.push({ dim: player.dimension, loc: block.location, type: "minecraft:large_smoke", delay: 0 });
    } catch { }
  };

  world.beforeEvents.playerBreakBlock.subscribe(e => handleBlock(e, 'blockBreakProtection', "§c⚠ §7You cannot break blocks here!"));
  world.beforeEvents.playerPlaceBlock.subscribe(e => handleBlock(e, 'blockPlaceProtection', "§c⚠ §7You cannot place blocks here!"));

  world.beforeEvents.playerInteractWithBlock.subscribe(e => {
    try {
      const { player, block, itemStack } = e, reg = isInProtectedRegion(block.location, block.dimension.id);
      if (!reg) return;
      if (itemStack && (itemStack.typeId.includes("flint_and_steel") || itemStack.typeId.includes("fire_charge")) && getRegionConfig(reg.id).fireProtection) {
        e.cancel = true; sendProtectionMessage(player, "§c⚠ §7Fire is disabled!"); return;
      }

      if (block.typeId === "minecraft:flower_pot") {
        if (checkProt(player, block.location, reg.id, 'blockPlaceProtection') || checkProt(player, block.location, reg.id, 'blockBreakProtection')) {
          e.cancel = true; sendProtectionMessage(player, "§c⚠ §7Flower pots are protected!"); return;
        }
      }

      if (!checkProt(player, block.location, reg.id, 'interactionProtection')) return;
      e.cancel = true; sendProtectionMessage(player, "§c⚠ §7Interaction restricted!");
    } catch { }
  });

  const farmlandCooldown = new Map();

  system.runInterval(() => {
    const players = world.getPlayers();
    for (const p of players) {
      try {
        const reg = isInProtectedRegion(p.location, p.dimension.id);
        if (!reg || isAuthorizedAdmin(p, reg.id)) continue;

        const conf = getRegionConfig(reg.id);
        if (!conf.farmlandProtection) continue;

        const pos = { x: Math.floor(p.location.x), y: Math.floor(p.location.y), z: Math.floor(p.location.z) };
        const currentBlock = p.dimension.getBlock(pos);
        
        if (!currentBlock || currentBlock.typeId !== "minecraft:farmland") continue;

        // Spiral search for nearest safe spot (radius 3)
        let safePos = null;
        searchLoop:
        for (let r = 1; r <= 3; r++) {
          for (let x = -r; x <= r; x++) {
            for (let z = -r; z <= r; z++) {
              if (Math.abs(x) !== r && Math.abs(z) !== r) continue;
              
              const tx = pos.x + x;
              const tz = pos.z + z;
              const b = p.dimension.getBlock({ x: tx, y: pos.y, z: tz });
              const bUp = p.dimension.getBlock({ x: tx, y: pos.y + 1, z: tz });
              
              if (b && b.typeId !== "minecraft:farmland" && (!bUp || bUp.isAir)) {
                // If block is solid, stand on top (y+1). If air/liquid, stay at y.
                const yOff = (!b.isAir && !b.isLiquid) ? 1 : 0;
                safePos = { x: tx + 0.5, y: pos.y + yOff, z: tz + 0.5 };
                break searchLoop;
              }
            }
          }
        }

        if (safePos) {
          p.teleport(safePos, { dimension: p.dimension });
          p.runCommand("playsound mob.shulker.teleport @s ~~~ 1 1.5");
        } else {
          // Fallback if no safe spot found nearby
          p.teleport({ x: pos.x + 0.5, y: pos.y + 1, z: pos.z + 0.5 }, { dimension: p.dimension });
        }

        const now = Date.now();
        if (!farmlandCooldown.has(p.id) || now - farmlandCooldown.get(p.id) > 1000) {
           sendProtectionMessage(p, "§c⚠ §7Farmland Protected!");
           farmlandCooldown.set(p.id, now);
        }
      } catch { }
    }
  }, 2);

  world.beforeEvents.playerInteractWithEntity.subscribe(e => {
    try {
      const { player, target: t } = e;
      if (!t?.isValid() || !t.location) return;
      const reg = isInProtectedRegion(t.location, t.dimension.id);
      if (!reg || isEntityExcluded(t.typeId, reg.id) || !checkProt(player, t.location, reg.id, 'interactionProtection')) return;
      if (t.typeId.includes("item_frame")) {
        e.cancel = true; sendProtectionMessage(player, "§c⚠ §7Item frames are protected!");
        if (getRegionConfig(reg.id).showParticles) partQ.push({ dim: player.dimension, loc: t.location, type: "minecraft:villager_angry", delay: 0 });
      }
    } catch { }
  });

  world.beforeEvents.explosion.subscribe(e => {
    const loc = e.source?.location;
    if (!loc || !getLobbyConfig().explosionProtection || !isInProtectedRegion(loc, e.source?.dimension?.id)) return;
    e.cancel = true;
  });

  world.afterEvents.playerSpawn.subscribe(({ player }) => checkPlayerRegion(player));
  world.afterEvents.entitySpawn.subscribe(({ entity }) => {
    try {
      if (!entity?.isValid()) return;
      const reg = isInProtectedRegion(entity.location, entity.dimension.id);
      if (!reg) return;
      const conf = getRegionConfig(reg.id);
      if (entity.typeId === "minecraft:item" && conf.itemDropProtection) { entity.remove(); return; }
      if (entity.typeId.includes("player")) return;

      if (conf.mobSpawnProtection && !isEntityExcluded(entity.typeId, reg.id)) entity.remove();
    } catch { }
  });

  const fireScanner = {
    regions: [], lastUpdate: 0, gen: null,
    init() { this.gen = this.chunkGenerator(); },
    *chunkGenerator() {
      while (true) {
        if (!this.regions.length) { yield null; continue; }
        for (const r of this.regions) {
          const [x1, x2] = [Math.min(r.pos1.x, r.pos2.x), Math.max(r.pos1.x, r.pos2.x)];
          const [y1, y2] = [Math.min(r.pos1.y, r.pos2.y), Math.max(r.pos1.y, r.pos2.y)];
          const [z1, z2] = [Math.min(r.pos1.z, r.pos2.z), Math.max(r.pos1.z, r.pos2.z)];
          for (let x = x1; x <= x2; x += 32) for (let y = y1; y <= y2; y += 32) for (let z = z1; z <= z2; z += 32)
            yield { dims: r.dims, c: [x, y, z, Math.min(x + 31, x2), Math.min(y + 31, y2), Math.min(z + 31, z2)] };
        }
        yield "PASS_COMPLETE";
      }
    }
  };
  fireScanner.init();

  system.runInterval(() => {
    const now = Date.now(), players = world.getPlayers();

    if (partQ.length) partQ.splice(0, 15).forEach((p, i) => system.runTimeout(() => { try { p.dim.runCommand(`particle ${p.type} ${p.loc.x + .5} ${p.loc.y + .5} ${p.loc.z + .5}`) } catch { } }, p.delay + i * 5));

    if (now - fireScanner.lastUpdate > 2000) {
      fireScanner.regions = getProtectedRegions().map(r => ({ ...r, conf: getRegionConfig(r.id) })).filter(r => r.conf.fireProtection).map(r => ({ ...r, dims: r.conf.protectedDimensions || ["overworld"] }));
      fireScanner.lastUpdate = now;
    }
    for (let i = 0; i < 10; i++) {
      const next = fireScanner.gen.next();
      if (next.value === "PASS_COMPLETE" || !next.value) break;
      const { dims, c } = next.value;
      dims.forEach(d => { try { const dim = world.getDimension(d); dim.runCommand(`fill ${c[0]} ${c[1]} ${c[2]} ${c[3]} ${c[4]} ${c[5]} minecraft:air replace minecraft:fire`); dim.runCommand(`fill ${c[0]} ${c[1]} ${c[2]} ${c[3]} ${c[4]} ${c[5]} minecraft:air replace minecraft:soul_fire`); } catch { } });
    }

    players.forEach(p => {
      const reg = isInProtectedRegion(p.location, p.dimension.id);
      if (!reg) return;
      const conf = getRegionConfig(reg.id);
      if (conf.mobSpawnProtection) {
        p.dimension.getEntities({ location: p.location, maxDistance: 24 }).filter(e => e.id !== p.id && !e.typeId.includes("player") && !isEntityExcluded(e.typeId, reg.id) && isInProtectedRegion(e.location, e.dimension.id)?.id === reg.id).forEach(e => e.remove());
      }
      if (!isAuthorizedAdmin(p, reg.id)) {
        if (conf.pvpProtection) try { p.runCommand("effect @s weakness 2 255 true"); } catch { }
        if (conf.damageProtection) try { p.runCommand("effect @s resistance 2 255 true"); } catch { }
        if (conf.hungerProtection) try { p.runCommand("effect @s saturation 2 255 true"); } catch { }
      }
    });

    const online = new Set(players.map(p => p.id));
    [playerAreas, cache.lastPos, cache.lastReg].forEach(m => { for (const k of m.keys()) if (!online.has(k)) m.delete(k); });

    players.forEach(p => {
      try {
        if (p.getTags().some(t => t.startsWith("loadchunck`"))) return;
        const { x, y, z } = p.location, pos = { x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) }, lp = cache.lastPos.get(p.id);
        if (lp && lp.x === pos.x && lp.y === pos.y && lp.z === pos.z) return;
        cache.lastPos.set(p.id, pos);
        const reg = isInProtectedRegion(pos, p.dimension.id), curId = reg?.id, prevId = cache.lastReg.get(p.id);
        if (curId !== prevId) { cache.lastReg.set(p.id, curId); checkPlayerRegion(p, reg); }
      } catch { }
    });
  }, 20);
}

export function checkPlayerRegion(player, region = undefined) {
  try {
    const reg = region === undefined ? isInProtectedRegion(player.location, player.dimension.id) : region;

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
      player.onScreenDisplay.setActionBar(admin ? "§6: §lADMIN ZONE §r§8» §7Bypass Enabled" : "§b: §lSAFE ZONE §r§8» §7You are now protected");
    }
  } catch { }
}
