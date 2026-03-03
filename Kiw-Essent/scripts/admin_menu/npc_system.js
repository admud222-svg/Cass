import { system, world, ActionFormData, ModalFormData } from "../core.js";
import { showMainMenu } from "../kiwora.js";
import { Bank } from "../plugins/bank/bank.js";
import { showClanMenu } from "../plugins/clan/clan.js";
import { Shop as ShopMenu } from "../menu_member/functions/shop/index.js";
import { ShowPlayerWarps } from "../menu_member/pwarp.js";
import { getRTPConfig, random_tp } from "../menu_member/random_teleport.js";
import { showQuestAdminMenu } from "../quest_system/admin/quest_admin.js";
import { CombatQuest } from "../quest_system/quests/combat_quest.js";
import { FarmingQuest } from "../quest_system/quests/farming_quest.js";
import { MiningQuest } from "../quest_system/quests/mining_quest.js";
import { EditWarp, ShowAvailableWarps } from "../warp.js";
import { editRules, showRules } from "./rules.js";
import { createNPCText } from "../plugins/floating-text/floating_text.js";
import { showAdminMenu, showServerList } from "./transfer-server/menu.js";
import { showXPShop, showXPShopAdmin } from "../plugins/npc-system/xp-shop/xp_shop.js";
import { showStarterKitMenu } from "../plugins/npc-system/starter-kit/starter.js";
import { showBountyMenu } from "../plugins/npc-system/bounty/bounty.js";
import { showTopUpRankMenu } from "../plugins/npc-system/top-up-rank/top-up-rank.js";
import { openBackpackMenu } from "../plugins/backpack/menu.js";
import { vote, showVoteAdminMenu } from "../plugins/npc-system/vote/index.js";
import { showRareShop, showRareShopAdmin } from "../plugins/npc-system/rare-shop/rare_shop.js";
import { showDailyRewardMenu as claimDailyReward, showDailyRewardAdminMenu } from "../plugins/npc-system/daily-reward/daily_reward.js";
import { showTeleportMenu, showTeleportAdminMenu } from "../plugins/npc-system/teleport/teleport.js";
import { showNPCShop, showNPCShopAdmin } from "../plugins/npc-system/npc-shop/npc_shop.js";
import { showRedeemCodeMenu, showRedeemCodeAdminMenu } from "../plugins/npc-system/redeem-code/redeem_code.js";
import { getLobbyConfig, saveLobbyConfig, getRegionConfig, saveRegionConfig, isInProtectedRegion } from "./lobby_protect/config.js";

const SOUNDS = {
  error: { prefix: "§c", sound: "note.bass", pitch: 0.5 },
  warning: { prefix: "§e", sound: "random.pop", pitch: 0.7 },
  success: { prefix: "§a", sound: "random.levelup", pitch: 1.0 },
  info: { prefix: "§b", sound: "random.pop", pitch: 1.0 },
};

const showMsg = (player, type, msg) => {
  const { prefix, sound, pitch } = SOUNDS[type] || SOUNDS.info;
  player.sendMessage(`${prefix} ${msg}`);
  try { player.runCommand(`playsound ${sound} @s ~~~ 1 ${pitch}`); } catch { }
};

const NPC_TYPES = [
  { name: "Shop NPC", icon: "textures/ui/trade_icon", npcName: "§eMerchant", desc: "Buy and sell items", fn: ShopMenu },
  { name: "Daily Reward NPC", icon: "textures/ui/achievements", npcName: "§dDaily Reward", desc: "Claim your daily reward", fn: claimDailyReward, admin: showDailyRewardAdminMenu },
  { name: "Quest NPC", icon: "textures/items/book_enchanted", npcName: "§6Quest", desc: "Daily missions & challenges", fn: showQuestMenu, admin: showQuestAdminMenu },
  { name: "Bank NPC", icon: "textures/ui/MCoin", npcName: "§6Bank", desc: "Manage your finances", fn: Bank },
  { name: "Redeem Code NPC", icon: "textures/icon_custom/reedemcode", npcName: "§bRedeem Code", desc: "Redeem a gift code", fn: showRedeemCodeMenu, admin: showRedeemCodeAdminMenu },
  { name: "Vote NPC", icon: "textures/ui/icon_deals", npcName: "§dVote", desc: "Vote for the server", fn: vote, admin: showVoteAdminMenu },
  { name: "Clan NPC", icon: "textures/items/bordure_indented_banner_pattern", npcName: "§bClan", desc: "Clan management", fn: showClanMenu },
  { name: "Warp NPC", icon: "textures/ui/csb_faq_parrot", npcName: "§aWarp", desc: "Teleport to a location", fn: ShowAvailableWarps, admin: EditWarp },
  { name: "Backpack NPC", icon: "textures/ui/inventory_icon", npcName: "§dBackpack", desc: "Access extra storage", fn: openBackpackMenu },
  { name: "Rules NPC", icon: "textures/icon_custom/rules", npcName: "§6Rules", desc: "View server rules", fn: showRules, admin: editRules },
  { name: "Random Teleport NPC", icon: "textures/ui/dressing_room_capes", npcName: "§aRandom Teleport", desc: "Teleport to a random location", fn: random_tp, admin: editRandomTeleportSettings },
  { name: "Player Warp NPC", icon: "textures/ui/icon_recipe_construction", npcName: "§aPlayer Warp", desc: "Player-created warps", fn: ShowPlayerWarps },
  { name: "Server List NPC", icon: "textures/ui/world_glyph_color", npcName: "§bServer List", desc: "List of other servers", fn: showServerList, admin: showAdminMenu },
  { name: "XP Shop NPC", icon: "textures/items/experience_bottle", npcName: "§6XP Shop", desc: "Buy and sell XP", fn: showXPShop, admin: showXPShopAdmin },
  { name: "Starter Kit NPC", icon: "textures/ui/gift_square", npcName: "§bStarter Kit", desc: "Claim your starter kit", fn: showStarterKitMenu },
  { name: "Bounty NPC", icon: "textures/ui/regeneration_effect", npcName: "§cBounty", desc: "Set and claim bounties", fn: showBountyMenu },
  { name: "Top Up Rank NPC", icon: "textures/ui/MCoin", npcName: "§eTop Up Rank", desc: "Buy a premium rank", fn: showTopUpRankMenu },
  { name: "Rare Shop NPC", icon: "textures/items/nether_star", npcName: "§bRare Shop", desc: "Buy exclusive items", fn: showRareShop, admin: showRareShopAdmin },
  { name: "Teleport NPC", icon: "textures/ui/dressing_room_capes", npcName: "§aTeleport", desc: "Teleport to a location", fn: (p, n) => showTeleportMenu(p, n), admin: (p, n) => showTeleportAdminMenu(p, n) },
  { name: "Custom Shop NPC", icon: "textures/ui/trade_icon", npcName: "§eCustom Shop", desc: "Customizable shop system", fn: showNPCShop, admin: showNPCShopAdmin },
].map(n => ({ ...n, fullName: `${n.npcName}\n§7${n.desc}\n§8[Click Here]` }));

async function showUniversalNPCCustomization(player, npc, npcEntity) {
  const isKiwoNPC = npcEntity?.typeId === "kiwo:npc";
  const entityInfo = isKiwoNPC ? "§dInvisible (kiwo:npc)" : "§aVisible (minecraft:npc)";

  // Store entity info before showing form (entity might become invalid after async)
  const entityId = npcEntity?.id;
  const entityType = npcEntity?.typeId;
  const entityDimension = npcEntity?.dimension?.id;
  const entityLocation = npcEntity?.location ? { ...npcEntity.location } : null;

  const btns = [
    { text: `Use ${npc.name}\n§8Test functionality`, icon: npc.icon, actionType: "use" },
    ...(npc.admin ? [{ text: "Admin Settings\n§8Configure settings", icon: "textures/ui/gear", actionType: "admin" }] : []),
    // Only show customize appearance for visible NPCs (minecraft:npc)
    ...(!isKiwoNPC ? [{ text: "Customize Appearance\n§8Change skin & name", icon: "textures/ui/dressing_room_skins", actionType: "customize" }] : []),
    { text: "§cRemove NPC", icon: "textures/ui/trash_default", actionType: "remove" },
    { text: "§cClose", icon: "textures/ui/cancel", actionType: "close" }
  ];

  const form = new ActionFormData()
    .title(`§b${npc.name} Options`)
    .body(`§eWhat would you like to do with this ${npc.name}?\n\n§7Entity Type: ${entityInfo}`);
  btns.forEach(b => form.button(b.text, b.icon));

  const res = await form.show(player);
  if (res.canceled) return;

  const selectedAction = btns[res.selection]?.actionType;
  if (!selectedAction) return;

  switch (selectedAction) {
    case "use":
      npc.fn(player, npcEntity);
      break;
    case "admin":
      npc.admin(player, npcEntity);
      break;
    case "customize":
      try { player.runCommand(`dialogue open @e[type=npc,c=1,r=5] @s`); } catch { }
      break;
    case "remove":
      // Re-find the entity using stored info since original reference may be invalid
      removeNPCById(player, entityId, entityType, entityDimension, entityLocation);
      break;
  }
}

// Remove NPC by finding it again using stored ID
function removeNPCById(player, entityId, entityType, dimensionId, location) {
  try {
    if (!entityId || !entityType || !dimensionId) {
      showMsg(player, "error", "NPC data not found!");
      return;
    }

    const dim = world.getDimension(dimensionId);
    if (!dim) {
      showMsg(player, "error", "Dimension not found!");
      return;
    }

    // Find the entity by searching near the stored location
    const searchOptions = {
      type: entityType,
      location: location || player.location,
      maxDistance: 10,
      tags: ["fixed_position"]
    };

    const entities = dim.getEntities(searchOptions);

    // Helper function to check if entity is valid
    const isEntityValid = (e) => e && (typeof e.isValid !== "function" || e.isValid());

    // Try to find by exact ID first
    let npcEntity = entities.find(e => e.id === entityId && isEntityValid(e));

    if (!npcEntity) {
      // Try finding any valid entity nearby
      npcEntity = entities.find(e => isEntityValid(e));
    }

    if (!npcEntity) {
      showMsg(player, "error", "NPC not found! It may have been removed already.");
      return;
    }

    removeNPCEntity(player, npcEntity);
  } catch (e) {
    console.warn("[NPC] Remove by ID error:", e);
    showMsg(player, "error", "Failed to find NPC!");
  }
}

// Remove NPC and its associated floating text and model
function removeNPCEntity(player, npcEntity) {
  try {
    if (!npcEntity) {
      showMsg(player, "error", "NPC entity is null!");
      return;
    }

    // Check if entity is still valid
    if (typeof npcEntity.isValid === "function" && !npcEntity.isValid()) {
      showMsg(player, "error", "NPC is no longer valid!");
      return;
    }

    // Find and remove associated floating text and model
    const tags = npcEntity.getTags();
    const npcIdTag = tags.find(t => t.startsWith("npc_id:"));
    if (npcIdTag) {
      const npcId = npcIdTag.replace("npc_id:", "");
      // Remove floating text
      const texts = npcEntity.dimension.getEntities({ type: "add:floating_text", tags: [`text_id:${npcId}`] });
      texts.forEach(t => { try { t.remove(); } catch { } });
      // Remove linked model entity
      const models = npcEntity.dimension.getEntities({ tags: [`model_id:${npcId}`] });
      models.forEach(m => { try { m.remove(); } catch { } });
    }

    npcEntity.remove();
    showMsg(player, "success", "NPC removed successfully!");
  } catch (e) {
    console.warn("[NPC] Remove error:", e);
    showMsg(player, "error", "Failed to remove NPC: " + e.message);
  }
}

async function editRandomTeleportSettings(player) {
  try {
    const cfg = getRTPConfig();
    const res = await new ModalFormData()
      .title("§aRandom Teleport Settings")
      .slider("Max Teleports Per Cooldown", 1, 10, 1, cfg.maxUses)
      .slider("Cooldown Time (minutes)", 1, 120, 1, cfg.cooldownTime / 60)
      .slider("Max Teleport Distance (blocks)", 500, 10000, 500, cfg.maxDistance)
      .show(player);

    if (res.canceled) return;

    world.setDynamicProperty("rtpConfig", JSON.stringify({
      maxUses: Math.floor(res.formValues[0]),
      cooldownTime: Math.floor(res.formValues[1] * 60),
      maxDistance: Math.floor(res.formValues[2]),
    }));
    showMsg(player, "success", "Random teleport settings updated successfully!");
  } catch (e) { showMsg(player, "error", "Unable to open Random Teleport settings."); }
}

function showQuestMenu(player) {
  const quests = [MiningQuest, CombatQuest, FarmingQuest];
  new ActionFormData()
    .title("§6Quest Menu")
    .body("§eSelect a quest type:")
    .button("Mining Quests\n§8Mine ores and minerals", "textures/blocks/emerald_ore")
    .button("Combat Quests\n§8Defeat monsters", "textures/ui/sword")
    .button("Farming Quests\n§8Harvest crops", "textures/blocks/beetroots_stage_3")
    .button("§cExit", "textures/ui/redX1")
    .show(player)
    .then(res => !res.canceled && res.selection < 3 && quests[res.selection].showMenu(player));
}


const setupNPCEntity = (npc, selected) => {
  npc.nameTag = "§r"; // Ensure name tag is hidden/reset
  npc.addTag(selected.name);
  npc.addTag("fixed_position");
  npc.addTag("from_menu");

  // Generate ID immediately to prevent race conditions with model linking
  let idTag = npc.getTags().find(t => t.startsWith("npc_id:"));
  let id;
  if (idTag) {
    id = idTag.replace("npc_id:", "");
  } else {
    id = Math.floor(Math.random() * 1e9).toString();
    npc.addTag("npc_id:" + id);
  }

  const pos = npc.location;
  const rot = npc.getRotation();
  npc.setDynamicProperty("npc:position", JSON.stringify({ ...pos, ry: rot.y }));

  system.runTimeout(() => {
    try {
      const text = createNPCText(npc.dimension, { x: pos.x, y: pos.y + 2, z: pos.z }, selected.fullName);
      if (text) {
        text.addTag("text_id:" + id);
        text.addTag(selected.name);
      }
    } catch (e) { console.warn("[NPC] Text error:", e); }
  }, 5);
};

// Entity types used in NPC system
const NPC_ENTITY_TYPES = ["minecraft:npc", "kiwo:npc"];

function resetNPCSystem(player) {
  let count = 0;
  ["overworld", "nether", "the_end"].forEach(dimName => {
    const dim = world.getDimension(dimName);
    if (!dim) return;
    // Clean both normal and custom invisible NPCs
    NPC_ENTITY_TYPES.forEach(entityType => {
      dim.getEntities({ type: entityType, tags: ["fixed_position"] }).forEach(n => { n.remove(); count++; });
    });
    // Clean custom model entities
    dim.getEntities({ tags: ["npc_model"] }).forEach(m => { m.remove(); count++; });
    // Clean floating texts
    dim.getEntities({ type: "add:floating_text", tags: ["npc_text"] }).forEach(t => { t.remove(); count++; });
  });
  showMsg(player, "success", `Removed ${count} system entities (NPCs + Models + Text).`);
}

function showMaintenanceMenu(player) {
  new ActionFormData()
    .title("§cNPC Maintenance")
    .body("§7Options to clean up or reset the NPC system.")
    .button("§cClean All NPCs & Texts", "textures/ui/trash_default")
    .button("Back", "textures/ui/arrow_left")
    .show(player)
    .then(res => !res.canceled && (res.selection === 0 ? resetNPCSystem(player) : npc_system(player)));
}

// Show NPC type selection menu (Normal vs Invisible)
async function showNPCTypeMenu(player, selected) {
  const form = new ActionFormData()
    .title(`§b${selected.name}`)
    .body(`§eSelect NPC appearance type:\n\n§7§lNormal NPC§r§7 - Uses standard Minecraft NPC skin\n§7§lCustom 3D NPC§r§7 - Uses custom 3D model (no NPC skin)`)
    .button("§aNormal NPC\n§8Standard Minecraft NPC", "textures/ui/icon_steve")
    .button("§dCustom 3D NPC\n§8Select custom model", "textures/ui/dressing_room_skins")
    .button("§cCancel", "textures/ui/cancel");

  const res = await form.show(player);
  if (res.canceled || res.selection === 2) return;

  if (res.selection === 0) {
    // Normal NPC
    spawnNPCWithType(player, selected, false, null);
  } else {
    // Custom 3D NPC - show model selection
    showModelSelectionMenu(player, selected);
  }
}

// List of available custom NPC models (All 40 models from npc_custom folder)
const NPC_CUSTOM_MODELS = [
  // === MERCHANTS ===
  { id: "npc_merchant_general", name: "Merchant General", icon: "textures/ui/trade_icon" },
  { id: "npc_merchant_blacksmith", name: "Blacksmith", icon: "textures/ui/anvil_icon" },
  { id: "npc_merchant_farming", name: "Farmer Merchant", icon: "textures/blocks/wheat_stage_7" },
  { id: "npc_merchant_mining", name: "Miner Merchant", icon: "textures/blocks/iron_ore" },
  { id: "npc_merchant_food", name: "Food Merchant", icon: "textures/items/apple" },
  { id: "npc_merchant_enchant", name: "Enchant Merchant", icon: "textures/items/book_enchanted" },
  { id: "npc_merchant_grinding", name: "Grinding Merchant", icon: "textures/items/diamond" },
  { id: "npc_merchant_shady", name: "Shady Merchant", icon: "textures/ui/icon_skull" },

  // === FARMERS, MINERS, WARRIORS ===
  { id: "npc_farmer_male", name: "Farmer (Male)", icon: "textures/items/wheat" },
  { id: "npc_farmer_female", name: "Farmer (Female)", icon: "textures/items/carrot" },
  { id: "npc_miner_male", name: "Miner (Male)", icon: "textures/items/iron_pickaxe" },
  { id: "npc_miner_female", name: "Miner (Female)", icon: "textures/items/diamond_pickaxe" },
  { id: "npc_warrior_male", name: "Warrior (Male)", icon: "textures/items/iron_sword" },
  { id: "npc_warrior_female", name: "Warrior (Female)", icon: "textures/items/diamond_sword" },
  { id: "npc_archer", name: "Archer", icon: "textures/items/bow_standby" },
  { id: "npc_swordsman", name: "Swordsman", icon: "textures/ui/sword" },
  { id: "npc_lumberjack", name: "Lumberjack", icon: "textures/items/iron_axe" },
  { id: "npc_martial_artist", name: "Martial Artist", icon: "textures/ui/strength_effect" },

  // === MAGES ===
  { id: "npc_mage_general", name: "Mage General", icon: "textures/items/blaze_rod" },
  { id: "npc_mage_combat", name: "Combat Mage", icon: "textures/ui/strength_effect" },
  { id: "npc_mage_farming", name: "Farming Mage", icon: "textures/blocks/wheat_stage_7" },
  { id: "npc_mage_mining", name: "Mining Mage", icon: "textures/blocks/diamond_ore" },
  { id: "npc_mage_skyblock", name: "Skyblock Mage", icon: "textures/ui/dressing_room_capes" },
  { id: "npc_old_mage", name: "Old Mage", icon: "textures/items/book_enchanted" },

  // === TAMERS ===
  { id: "npc_tamer_regular", name: "Tamer Regular", icon: "textures/items/lead" },
  { id: "npc_tamer_combat", name: "Combat Tamer", icon: "textures/items/iron_sword" },
  { id: "npc_tamer_farming", name: "Farming Tamer", icon: "textures/items/wheat" },
  { id: "npc_tamer_mining", name: "Mining Tamer", icon: "textures/items/iron_pickaxe" },

  // === SPECIAL CHARACTERS ===
  { id: "npc_fancy_man", name: "Fancy Man", icon: "textures/ui/icon_alex" },
  { id: "npc_fancy_lady", name: "Fancy Lady", icon: "textures/ui/dressing_room_skins" },
  { id: "npc_pretty_lady", name: "Pretty Lady", icon: "textures/ui/dressing_room_skins" },
  { id: "npc_blond_guy", name: "Blond Guy", icon: "textures/ui/icon_steve" },
  { id: "npc_architect", name: "Architect", icon: "textures/ui/icon_recipe_construction" },
  { id: "npc_seer", name: "Seer", icon: "textures/items/ender_eye" },
  { id: "npc_death", name: "Death", icon: "textures/items/bone" },
  { id: "npc_evil_overlord", name: "Evil Overlord", icon: "textures/ui/icon_skull" },
  { id: "npc_wacky_salesman", name: "Wacky Salesman", icon: "textures/ui/icon_deals" },

  // === CREATURES ===
  { id: "npc_baby_phoenix", name: "Baby Phoenix", icon: "textures/items/blaze_powder" },
  { id: "npc_skyblock_phoenix", name: "Skyblock Phoenix", icon: "textures/items/magma_cream" },
  { id: "npc_whale_balloon", name: "Whale Balloon", icon: "textures/ui/dressing_room_capes" },
];

// Show model selection menu
async function showModelSelectionMenu(player, selected) {
  const form = new ActionFormData()
    .title("§bSelect NPC Model")
    .body(`§eChoose a custom 3D model for your ${selected.name}:`);

  NPC_CUSTOM_MODELS.forEach(m => form.button(`${m.name}\n§8enchanted:${m.id}`, m.icon));
  form.button("§cCancel", "textures/ui/cancel");

  const res = await form.show(player);
  if (res.canceled || res.selection >= NPC_CUSTOM_MODELS.length) return;

  const selectedModel = NPC_CUSTOM_MODELS[res.selection];
  spawnNPCWithType(player, selected, true, selectedModel);
}

// Spawn NPC with selected visibility type
function spawnNPCWithType(src, selected, isInvisible, customModel) {
  // Determine which entity to spawn
  const entityType = isInvisible ? "kiwo:npc" : "minecraft:npc";
  const playerRot = src.getRotation();

  try {
    const region = isInProtectedRegion(src.location);
    if (region) {
      const rc = getRegionConfig(region.id);
      const entitiesToExclude = ["minecraft:npc", "kiwo:npc"];
      entitiesToExclude.forEach(e => {
        if (!rc.excludedEntities?.includes(e)) {
          rc.excludedEntities = [...(rc.excludedEntities || []), e];
        }
      });
      saveRegionConfig(region.id, rc);
    }
    const lc = getLobbyConfig();
    const entitiesToExclude = ["minecraft:npc", "kiwo:npc"];
    entitiesToExclude.forEach(e => {
      if (!lc.excludedEntities?.includes(e)) {
        lc.excludedEntities = [...(lc.excludedEntities || []), e];
      }
    });
    saveLobbyConfig(lc);

    // Spawn the appropriate entity type
    if (isInvisible) {
      src.runCommand(`summon kiwo:npc ~~~`);
      // Also spawn the custom model entity if selected
      if (customModel) {
        src.runCommand(`summon enchanted:${customModel.id} ~~~`);
      }
    } else {
      src.runCommand(`summon minecraft:npc ~~~`);
    }
  } catch (e) {
    console.warn("[NPC] Summon failed:", e);
    return showMsg(src, "error", "Failed to spawn NPC.");
  }

  system.runTimeout(() => {
    // Find a fresh NPC that hasn't been setup yet (no fixed_position tag)
    const entities = src.dimension.getEntities({ type: entityType, location: src.location, maxDistance: 3 });
    const npcEntity = entities.find(e => !e.hasTag("fixed_position") && !e.hasTag("from_menu"));

    if (npcEntity) {
      // Apply rotation to main NPC entity
      npcEntity.setRotation(playerRot);
      setupNPCEntity(npcEntity, selected);

      // Link custom model entity to NPC if spawned
      if (isInvisible && customModel) {
        const modelEntities = src.dimension.getEntities({
          type: `enchanted:${customModel.id}`,
          location: src.location,
          maxDistance: 3
        });
        // Find a fresh model that hasn't been setup yet
        const modelEntity = modelEntities.find(e => !e.hasTag("fixed_position") && !e.hasTag("npc_model"));
        
        if (modelEntity) {
          const npcIdTag = npcEntity.getTags().find(t => t.startsWith("npc_id:"));
          if (npcIdTag) {
            modelEntity.addTag(npcIdTag.replace("npc_id:", "model_id:"));
            modelEntity.addTag("npc_model");
            modelEntity.addTag("fixed_position");
            // Apply rotation to custom model
            modelEntity.setRotation(playerRot);
            modelEntity.setDynamicProperty("npc:position", JSON.stringify({ ...src.location, ry: playerRot.y }));
          }
        }
        showMsg(src, "success", `Spawned ${selected.name} with ${customModel.name} model!`);
      } else {
        const typeText = isInvisible ? " (Invisible - kiwo:npc)" : "";
        showMsg(src, "success", `Successfully spawned ${selected.name}${typeText}!`);
      }
    } else {
      showMsg(src, "error", "Could not find the spawned NPC!");
    }
  }, 10);
}

export function npc_system(src) {
  try {
    const form = new ActionFormData().title("§bNPC System").body("§eSelect an NPC to spawn or manage system:");
    NPC_TYPES.forEach(n => form.button(`${n.name}\n§r${n.desc}`, n.icon));
    form.button("§cMaintenance / Reset", "textures/ui/automation_glyph_color");
    form.button("Back", "textures/ui/arrow_left");

    form.show(src).then(res => {
      if (res.canceled) return;
      if (res.selection === NPC_TYPES.length) return showMaintenanceMenu(src);
      if (res.selection === NPC_TYPES.length + 1) return showMainMenu(src);

      const selected = NPC_TYPES[res.selection];
      // Show NPC type selection menu (Normal vs Invisible)
      showNPCTypeMenu(src, selected);
    });
  } catch (e) { console.warn("[NPC] Menu error:", e); showMsg(src, "error", "An error occurred in the NPC menu."); }
}

world.afterEvents.entitySpawn.subscribe(e => {
  if (e.entity.typeId !== "minecraft:npc") return;
  system.runTimeout(() => {
    try {
      if (!e.entity.isValid() || NPC_TYPES.some(t => e.entity.hasTag(t.name)) || e.entity.hasTag("from_menu")) return;
      const npcType = NPC_TYPES.find(t => e.entity.hasTag(t.name));
      if (npcType) setupNPCEntity(e.entity, npcType);
    } catch { }
  }, 1);
});

const handleNPCInteraction = (player, npcEntity) => {
  if (!NPC_TYPES.some(t => npcEntity.hasTag(t.name)) && !npcEntity.hasTag("from_menu")) return;
  const npcType = NPC_TYPES.find(t => npcEntity.hasTag(t.name));

  system.run(() => {
    if (player.hasTag("admin")) {
      if (npcType) showUniversalNPCCustomization(player, npcType, npcEntity);
    } else if (npcType) {
      npcType.fn(player, npcEntity);
      try { player.runCommand("playsound random.pop @s ~~~ 1 1"); } catch { }
    }
  });
};

world.beforeEvents.playerInteractWithEntity.subscribe(e => {
  // Support both minecraft:npc and kiwo:npc
  if (NPC_ENTITY_TYPES.includes(e.target.typeId) && (NPC_TYPES.some(t => e.target.hasTag(t.name)) || e.target.hasTag("from_menu"))) {
    e.cancel = true;
    handleNPCInteraction(e.player, e.target);
  }
});

world.afterEvents.entityHitEntity.subscribe(e => {
  // Support both minecraft:npc and kiwo:npc
  if (NPC_ENTITY_TYPES.includes(e.hitEntity.typeId) && e.damagingEntity.typeId === "minecraft:player") {
    if (NPC_TYPES.some(t => e.hitEntity.hasTag(t.name)) || e.hitEntity.hasTag("from_menu")) handleNPCInteraction(e.damagingEntity, e.hitEntity);
  }
});

let tick = 0;
system.runInterval(() => {
  tick = (tick + 1) % 8;
  ["overworld", "nether", "the_end"].forEach(dimName => {
    const dim = world.getDimension(dimName);
    if (!dim) return;
    try {
      // Get all NPC entities (both minecraft:npc and kiwo:npc)
      const npcs = [];
      NPC_ENTITY_TYPES.forEach(entityType => {
        npcs.push(...dim.getEntities({ type: entityType, tags: ["fixed_position"] }));
      });

      npcs.forEach(npc => {
        const sPos = npc.getDynamicProperty("npc:position");
        if (sPos) {
          const sp = JSON.parse(sPos);
          if (Math.abs(npc.location.x - sp.x) > 0.01 || Math.abs(npc.location.y - sp.y) > 0.01 || Math.abs(npc.location.z - sp.z) > 0.01) {
            npc.teleport({ x: sp.x, y: sp.y, z: sp.z }, { rotation: { x: 0, y: sp.ry ?? npc.getRotation().y } });
          }
        }
      });

      if (tick === 0) {
        const texts = dim.getEntities({ type: "add:floating_text", tags: ["npc_text"] });
        const textMap = new Map(texts.map(t => {
          const tag = t.getTags().find(tg => tg.startsWith("text_id:"));
          return tag ? [tag.replace("text_id:", ""), t] : null;
        }).filter(Boolean));

        npcs.forEach(npc => {
          const id = npc.getTags().find(t => t.startsWith("npc_id:"))?.replace("npc_id:", "");
          if (!id) return;
          const text = textMap.get(id);
          const pos = { x: npc.location.x, y: npc.location.y + 2, z: npc.location.z };

          if (text?.isValid()) text.teleport(pos);
          else {
            const type = NPC_TYPES.find(t => npc.hasTag(t.name));
            if (type) {
              const newText = createNPCText(dim, pos, type.fullName);
              if (newText) { newText.addTag(`text_id:${id}`); newText.addTag(type.name); }
            }
          }
        });

        textMap.forEach((text, id) => { if (!npcs.some(n => n.hasTag(`npc_id:${id}`))) try { text.remove(); } catch { } });
      }
    } catch { }
  });
}, 5);
