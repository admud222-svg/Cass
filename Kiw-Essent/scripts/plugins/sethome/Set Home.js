import { ActionFormData, ModalFormData, system, world } from "../../core";
import { getSethomeBenefits } from "../ranks/rank_benefits.js";
import {
  SETHOME_CONFIG,
  SETHOME_ICONS,
  PlayerCache,
  CooldownManager,
  RateLimiter,
  PROGRESS_CHARS,
} from "../../optimization.js";

const getHomeCfg = () => {
  try {
    const s = world.getDynamicProperty("homeConfig");
    return s ? JSON.parse(s) : {
      maxHomes: SETHOME_CONFIG.DEFAULT_MAX_HOMES,
      minY: SETHOME_CONFIG.MIN_Y,
      teleportDelay: SETHOME_CONFIG.TELEPORT_DELAY,
    };
  } catch {
    return {
      maxHomes: SETHOME_CONFIG.DEFAULT_MAX_HOMES,
      minY: SETHOME_CONFIG.MIN_Y,
      teleportDelay: SETHOME_CONFIG.TELEPORT_DELAY,
    };
  }
};

const ICONS = SETHOME_ICONS;
const iconKeys = Object.keys(ICONS);

const homeCache = new PlayerCache();
const teleportCooldowns = new CooldownManager();
const operationRateLimiter = new RateLimiter();
const activeTeleports = new Map();

system.runInterval(() => {
  homeCache.cleanup();
  teleportCooldowns.cleanup();
  operationRateLimiter.cleanup();
}, 100);

const msg = {
  max: '{"rawtext":[{"text":"§c⚠ Max home reached!"}]}',
  invalid: '{"rawtext":[{"text":"§c⚠ Invalid home name!"}]}',
  exist: '{"rawtext":[{"text":"§c⚠ Name already exists!"}]}',
  none: '{"rawtext":[{"text":"§c⚠ No home set!"}]}',
  move: '{"rawtext":[{"text":"§c✘ Teleport cancelled - You moved!"}]}',
  ok: (n) => `{"rawtext":[{"text":"§a✔ Welcome to §6${n}§a!"}]}`,
  del: (n) => `{"rawtext":[{"text":"§a✔ Home §6${n}§a deleted!"}]}`,
  new: (n) => `{"rawtext":[{"text":"§a✔ Home §6${n}§a created!"}]}`,
};

const isValidHomeName = (name) => {
  if (!name || typeof name !== "string") return false;
  const trimmed = name.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= SETHOME_CONFIG.MAX_HOME_NAME_LENGTH &&
    !/[\x00-\x1F\x7F"\\]/.test(trimmed)
  );
};

const getDimColor = (dim) => {
  const colors = { overworld: "§a", nether: "§c", the_end: "§d" };
  return colors[dim] || "§7";
};

const getHomes = (pl, useCache = true) => {
  const playerId = pl.id;
  
  if (useCache) {
    const cached = homeCache.get(playerId);
    if (cached) return cached;
  }
  
  const homes = [];
  const tags = pl.getTags();

  for (const tag of tags) {
    if (!tag.startsWith('{"Home":{')) continue;

    try {
      const parsed = JSON.parse(tag);
      if (parsed?.Home) homes.push(parsed.Home);
    } catch {
      pl.removeTag(tag);
    }
  }
  
  homeCache.set(playerId, homes);
  return homes;
};

const invalidateHomeCache = (pl) => {
  homeCache.invalidate(pl.id);
};

const findHomeTag = (pl, uuid) =>
  pl.getTags().find((t) => t.includes(`"UUID":"${uuid}"`));

const updateHomeTag = (pl, oldHome, newHome) => {
  const tag = findHomeTag(pl, oldHome.UUID);
  if (tag) {
    pl.removeTag(tag);
    pl.addTag(JSON.stringify({ Home: newHome }));
    invalidateHomeCache(pl);
    return true;
  }
  return false;
};

const createHomeObj = (name, desc, iconIdx, wmsg, location, dim) => ({
  Name: name.trim(),
  Description: desc.trim() || undefined,
  Pos: `${Math.trunc(location.x)} ${Math.trunc(location.y)} ${Math.trunc(location.z)}`,
  Dimension: dim,
  Icon: ICONS[iconKeys[iconIdx]],
  WelcomeMessage: wmsg.trim() || undefined,
  UUID: `${dim}:${Math.trunc(location.x)}:${Math.trunc(location.y)}:${Math.trunc(location.z)}`,
});

function homeMenu(pl) {
  if (!operationRateLimiter.canPerform(pl.id)) {
    pl.sendMessage("§c⚠ Please slow down!");
    return;
  }
  operationRateLimiter.recordOperation(pl.id);
  
  const cfg = getHomeCfg();
  const homes = getHomes(pl);
  const benefits = getSethomeBenefits(pl);
  const maxHomes = benefits.maxHomes && benefits.maxHomes > 0 ? benefits.maxHomes : cfg.maxHomes;

  new ActionFormData()
    .title("Home System")
    .body(
      `§7Current Homes: §a${homes.length}§7/§a${maxHomes}\n§7Manage your personal waypoints`,
    )
    .button("§aCreate Home\n§7Set current location", "textures/ui/color_plus")
    .button("§cManage", "textures/ui/icon_setting")
    .button("§bTeleport", "textures/ui/icon_map")
    .show(pl)
    .then((r) => {
      if (!r?.selection === undefined) return;

      const actions = [
        () =>
          homes.length >= maxHomes
            ? (pl.runCommand(`titleraw @s actionbar ${msg.max}`),
              pl.runCommand("playsound note.bass @s"))
            : createHome(pl, homes),
        () =>
          homes.length
            ? manageHome(pl, homes)
            : pl.runCommand(`titleraw @s actionbar ${msg.none}`),
        () =>
          homes.length
            ? viewHome(pl, homes)
            : pl.runCommand(`titleraw @s actionbar ${msg.none}`),
      ];

      actions[r.selection]?.();
    });
}

function createHome(pl, homes) {
  new ModalFormData()
    .title("Create Home §t§p§a")
    .textField("§eName\n§7Letters, numbers, underscore only", "Enter name...", {
      defaultValue: "",
    })
    .textField("§eDescription §7(optional)", "Enter description...", {
      defaultValue: "",
    })
    .dropdown("§eIcon", iconKeys, { defaultValue: 0 })
    .textField("§eWelcome Message §7(optional)", "Enter message...", {
      defaultValue: "",
    })
    .show(pl)
    .then((r) => {
      if (!r?.formValues) return;

      const [name, desc, iconIdx, wmsg] = r.formValues;
      const trimmedName = name.trim();

      if (!isValidHomeName(trimmedName)) {
        pl.sendMessage(
          `§c⚠ Invalid home name! Max ${SETHOME_CONFIG.MAX_HOME_NAME_LENGTH} chars, no special characters`,
        );
        return;
      }

      if (
        homes.some((h) => h.Name.toLowerCase() === trimmedName.toLowerCase())
      ) {
        pl.sendMessage("§c⚠ A home with this name already exists!");
        return;
      }

      const dim = pl.dimension.id.replace("minecraft:", "");
      const home = createHomeObj(name, desc, iconIdx, wmsg, pl.location, dim);

      pl.addTag(JSON.stringify({ Home: home }));
      invalidateHomeCache(pl);
      pl.sendMessage(`§a✔ Home "${trimmedName}" created successfully!`);
      pl.runCommand("playsound random.levelup @s");
    });
}

function manageHome(pl, homes) {
  const fm = new ActionFormData()
    .title("Manage Homes")
    .body(`§7Total: §b${homes.length}`);

  homes.forEach((home) => {
    fm.button(
      `${home.Name}§r\n§8${home.Description || home.Pos}`,
      home.Icon || ICONS.BELL,
    );
  });

  fm.show(pl).then((r) => {
    if (r?.selection !== undefined) editHome(pl, homes[r.selection]);
  });
}

function editHome(pl, home) {
  new ActionFormData()
    .title(`Edit: ${home.Name}`)
    .body(`§7${home.Pos} §8(${home.Dimension})`)
    .button("§eUpdate Location", "textures/ui/levitation_effect")
    .button("§bEdit Details", "textures/ui/icon_setting")
    .button("§cDelete", "textures/ui/icon_trash")
    .show(pl)
    .then((r) => {
      if (r?.selection === undefined) return;

      const actions = [
        () => updateHomeLoc(pl, home),
        () => editHomeDetail(pl, home),
        () => delHome(pl, home),
      ];

      actions[r.selection]();
    });
}

function viewHome(pl, homes) {
  const fm = new ActionFormData()
    .title("Teleport Home")
    .body(`§7Select destination`);

  homes.forEach((home) => {
    fm.button(
      `${home.Name}§r\n${getDimColor(home.Dimension)}${home.Dimension}§8: ${home.Pos}`,
      home.Icon || ICONS.BELL,
    );
  });

  fm.show(pl).then((r) => {
    if (r?.selection !== undefined) tpHome(pl, homes[r.selection]);
  });
}

function updateHomeLoc(pl, home) {
  const { x, y, z } = pl.location;
  const dim = pl.dimension.id.replace("minecraft:", "");
  const newHome = {
    ...home,
    Pos: `${Math.trunc(x)} ${Math.trunc(y)} ${Math.trunc(z)}`,
    Dimension: dim,
    UUID: `${dim}:${Math.trunc(x)}:${Math.trunc(y)}:${Math.trunc(z)}`,
  };

  if (updateHomeTag(pl, home, newHome)) {
    pl.sendMessage(`§a✔ Location updated for "${home.Name}"`);
    pl.runCommand("playsound random.levelup @s");
  }
}

function editHomeDetail(pl, home) {
  const currentIcon = iconKeys.findIndex((key) => ICONS[key] === home.Icon);

  new ModalFormData()
    .title(`Edit: ${home.Name} §t§p§a`)
    .textField("§eName", "Enter name...", { defaultValue: home.Name })
    .textField("§eDescription §7(optional)", "Enter description...", {
      defaultValue: home.Description || "",
    })
    .dropdown("§eIcon", iconKeys, { defaultValue: Math.max(0, currentIcon) })
    .textField("§eWelcome Message §7(optional)", "Enter message...", {
      defaultValue: home.WelcomeMessage || "",
    })
    .show(pl)
    .then((r) => {
      if (!r?.formValues) return;

      const [name, desc, iconIdx, wmsg] = r.formValues;
      const trimmedName = name.trim();

      if (trimmedName !== home.Name && !isValidHomeName(trimmedName)) {
        pl.sendMessage(
          `§c⚠ Invalid home name! Max ${SETHOME_CONFIG.MAX_HOME_NAME_LENGTH} chars, no special characters`,
        );
        return;
      }

      const homes = getHomes(pl);
      if (
        trimmedName !== home.Name &&
        homes.some(
          (h) =>
            h.UUID !== home.UUID &&
            h.Name.toLowerCase() === trimmedName.toLowerCase(),
        )
      ) {
        pl.sendMessage("§c⚠ A home with this name already exists!");
        return;
      }

      const newHome = {
        ...home,
        Name: trimmedName || home.Name,
        Description: desc.trim() || undefined,
        Icon: ICONS[iconKeys[iconIdx]],
        WelcomeMessage: wmsg.trim() || undefined,
      };

      if (updateHomeTag(pl, home, newHome)) {
        pl.sendMessage(`§a✔ Home "${newHome.Name}" updated!`);
        pl.runCommand("playsound random.levelup @s");
      }
    });
}

function delHome(pl, home) {
  new ActionFormData()
    .title("Delete Home")
    .body(`§cDelete §f${home.Name}§c?`)
    .button("§cConfirm", "textures/ui/icon_trash")
    .button("§aCancel", "textures/ui/icon_cancel")
    .show(pl)
    .then((r) => {
      if (r?.selection === 0) {
        const tag = findHomeTag(pl, home.UUID);
        if (tag) {
          pl.removeTag(tag);
          invalidateHomeCache(pl);
          pl.sendMessage(`§a✔ Home "${home.Name}" deleted.`);
          pl.runCommand("playsound random.break @s");
        }
      }
    });
}

function tpHome(pl, home) {
  if (activeTeleports.has(pl.id)) {
    pl.sendMessage("§c⚠ You are already teleporting!");
    return;
  }
  
  if (teleportCooldowns.isOnCooldown(pl.id)) {
    const remaining = Math.ceil(teleportCooldowns.getRemainingMs(pl.id) / 1000);
    pl.sendMessage(`§c⚠ Please wait ${remaining}s before teleporting again!`);
    return;
  }

  const cfg = getHomeCfg();
  const { Name, Pos, Dimension, WelcomeMessage } = home;
  const coords = Pos.split(" ");

  if (coords.length !== 3) return;

  const [x, y, z] = coords;
  const pos0 = { ...pl.location };
  let cd = cfg.teleportDelay;
  let frame = 0;

  activeTeleports.set(pl.id, true);
  teleportCooldowns.setCooldown(pl.id);

  const intv = system.runInterval(() => {
    const { location } = pl;
    if (
      Math.abs(pos0.x - location.x) > SETHOME_CONFIG.TELEPORT_MOVEMENT_TOLERANCE ||
      Math.abs(pos0.y - location.y) > SETHOME_CONFIG.TELEPORT_MOVEMENT_TOLERANCE ||
      Math.abs(pos0.z - location.z) > SETHOME_CONFIG.TELEPORT_MOVEMENT_TOLERANCE
    ) {
      system.clearRun(intv);
      activeTeleports.delete(pl.id);
      pl.runCommand(`titleraw @s actionbar ${msg.move}`);
      pl.runCommand("playsound note.bass @s");
      return;
    }

    const totalFrames = cfg.teleportDelay * 20;
    const progress = (cd / cfg.teleportDelay) * 10 - (frame / totalFrames) * 10;
    const full = Math.max(0, Math.floor(progress));
    let bar = PROGRESS_CHARS.FULL.repeat(full);
    const frac = progress - full;

    if (frac > 0 && full < 10) {
      bar += PROGRESS_CHARS.TRANSITIONS[Math.floor(frac * PROGRESS_CHARS.TRANSITIONS.length)];
    }
    bar += PROGRESS_CHARS.EMPTY.repeat(Math.max(0, 10 - bar.length));

    pl.onScreenDisplay.setActionBar(`§e⚡ Teleporting [§b${bar}§e] §b${cd}s`);

    if (++frame >= 20) {
      frame = 0;
      cd--;
    }

    if (cd <= 0) {
      system.clearRun(intv);
      activeTeleports.delete(pl.id);
      pl.runCommand(`execute in ${Dimension} run tp @s ${x} ${y} ${z}`);
      pl.runCommand(`titleraw @s actionbar ${msg.ok(Name)}`);
      if (WelcomeMessage) pl.sendMessage(`§e➤ ${WelcomeMessage}`);
      pl.runCommand("playsound random.levelup @s");
    }
  }, 1);
}

export { homeMenu as HomeSystem, invalidateHomeCache };
