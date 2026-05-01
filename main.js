// ini scripts/main.js
import { world, system, ItemStack, ItemLockMode } from "@minecraft/server";
import { updateScoreboardTitle } from "./scoreboard.js";
import { updateNametag } from "./name.js"; 
import { handleChat } from "./plugin/ranks/rank.js";
import { openAdminMenu } from "./ui_system.js"; 
import { openMemberMainMenu } from "./plugin/menu_ui.js"; 
import { getPlayerClan, getClans } from "./plugin/clans/clan_db.js";
import "./npc_system.js"; 
import "./plugin/protection/protection.js";
import "./plugin/redstone/redstone_detector.js";
import "./plugin/mining/mining.js";
import "./plugin/afk/afk.js";
import "./system/casino/ui.js";
import "./plugin/player/player_manager.js";
import { openDungeonExitMenu } from "./plugin/dungeon/dungeon_core.js";

import "./system/parkour/parkour.js";
import "./system/clear_lag/clearlag.js";
import "./system/cmd/cmd.js";
import { getConfig } from "./config.js"; 
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        updateScoreboardTitle(player);
        updateNametag(player);
    }
}, 2); 

// ==========================================
// CHAT SYSTEM & TOGGLE MENU AUTO
// ==========================================
world.beforeEvents.chatSend.subscribe((event) => {
    const { sender, message } = event;
    
    if (message.toLowerCase() === "+autojam" && sender.hasTag("admin")) {
        event.cancel = true;
        system.run(() => {
            const config = getConfig();
            config.autoGiveMenu = !(config.autoGiveMenu ?? true);
            saveConfig(config);
            
            sender.sendMessage(`§e[Sistem] §fAuto-Give Item Menu sekarang: ${config.autoGiveMenu ? "§aAKTIF" : "§cNONAKTIF"}`);
            sender.playSound("random.levelup");
        });
        return;
    }

    handleChat(event);
});

// ==========================================
// ITEM INTERACTION (BUKA MENU)
// ==========================================
world.beforeEvents.itemUse.subscribe((event) => {
    const { source: player, itemStack } = event;
    
    if (player.hasTag("in_dungeon")) {
        if (itemStack.typeId === "admud:admin_menu" || itemStack.typeId === "admud:member_menu") {
            event.cancel = true;
            system.run(() => {
                openDungeonExitMenu(player);
            });
            return; 
        }
    }

    if (itemStack.typeId === "admud:admin_menu" && player.hasTag("admin")) {
        system.run(() => openAdminMenu(player));
    }
    
    if (itemStack.typeId === "admud:member_menu") {
        system.run(() => openMemberMainMenu(player));
    }
});

system.afterEvents.scriptEventReceive.subscribe((event) => {
    if (event.id === "admud:menu" && event.sourceEntity) {
        if (event.sourceEntity.hasTag("in_dungeon")) {
            openDungeonExitMenu(event.sourceEntity);
            return;
        }
        openMemberMainMenu(event.sourceEntity);
    }
});

// ==========================================
// CLAN ANTI-FRIENDLY FIRE (PVP SESAMA CLAN)
// ==========================================
world.beforeEvents.entityHurt.subscribe((event) => {
    const victim = event.hurtEntity; 
    const attacker = event.damageSource.damagingEntity;

    if (victim?.typeId === "minecraft:player" && attacker?.typeId === "minecraft:player") {
        const clanVictim = getPlayerClan(victim);
        const clanAttacker = getPlayerClan(attacker);

        if (clanVictim !== "" && clanVictim === clanAttacker) {
            const clans = getClans();
            const clanData = clans[clanVictim];
            const isPvPOn = clanData?.friendlyFire ?? false;

            if (!isPvPOn) {
                event.cancel = true; 
                system.run(() => {
                    attacker.sendMessage(`§c[Clan] Kamu tidak bisa melukai §e${victim.name}§c! Kalian berdua adalah anggota Clan §b[${clanAttacker}]§c.`);
                });
            }
        }
    }
});

// ==========================================
// AUTO-GIVE & ANTI-DROP CUSTOM ITEMS
// ==========================================
world.afterEvents.playerSpawn.subscribe((e) => {
    const config = getConfig();
    
    if (config.autoGiveMenu ?? true) {
        system.runTimeout(() => {
            const player = e.player;
            const inv = player.getComponent("inventory")?.container;
            if (!inv) return;
            
            let hasMenu = false;
            let hasAdminMenu = false;
            
            for (let i = 0; i < inv.size; i++) {
                const item = inv.getItem(i);
                if (item?.typeId === "admud:member_menu") hasMenu = true;
                if (item?.typeId === "admud:admin_menu") hasAdminMenu = true;
            }
            
            try {
                if (!hasMenu) {
                    const memberItem = new ItemStack("admud:member_menu", 1);
                    memberItem.lockMode = ItemLockMode.inventory;
                    inv.addItem(memberItem);
                }
                
                if (!hasAdminMenu && player.hasTag("admin")) {
                    const adminItem = new ItemStack("admud:admin_menu", 1);
                    adminItem.lockMode = ItemLockMode.inventory; 
                    inv.addItem(adminItem);
                }
            } catch(err) {
                console.warn("[AdmudRankS] Gagal memberikan item menu: " + err);
            }
        }, 20); 
    }
});

system.runInterval(() => {
    try {
        for (const player of world.getAllPlayers()) {
            const dimension = player.dimension;
            const items = dimension.getEntities({ type: "minecraft:item" });
            
            for (const item of items) {
                const itemComp = item.getComponent("item");
                if (itemComp && itemComp.itemStack) {
                    const typeId = itemComp.itemStack.typeId;
                    if (typeId === "admud:member_menu" || typeId === "admud:admin_menu") {
                        item.kill(); 
                    }
                }
            }
        }
    } catch(e) {}
}, 40);