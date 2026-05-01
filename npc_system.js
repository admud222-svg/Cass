import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui"; 
import { openRankShop, openRankKitMenu } from "./ui_shop.js";

import { openClanMenu } from "./plugin/clans/clan.js";
import { openTPADashboard } from "./plugin/tpa/tpa_system.js"; 
import { openRtpMenu } from "./plugin/rtp/rtp.js";
import { openClaimMenu } from "./plugin/land/claimland.js";
import { openPlayerWarpMenu } from "./plugin/playerwarp/playerwarp.js";
import { openShopMenu, openSingleCategoryShop } from "./plugin/shop/shop.js";
import { openVaultMenu } from "./plugin/vault/vault.js"; 
import { openMarketMenu } from "./plugin/market/market.js"; 
import { openHomeMenu } from "./plugin/home/home.js"; 
import { openBankMenu } from "./plugin/bank/bank.js";
import { openTransferMenu } from "./plugin/transfer/transfer.js";
import { openReportMenu } from "./plugin/report/report.js";
import { openSettingsMenu } from "./plugin/settings/settings.js";
import { openJobMenu } from "./plugin/jobs/jobs.js";
import { openWarpMenu, teleportToSingleWarp } from "./plugin/warps/warp.js";
import { openMainMenu } from "./plugin/npc/main.js";
import { openDungeonPortalMenu } from "./plugin/dungeon/dungeon_core.js";
import { dailyMenu } from "./plugin/daily/daily.js";
import { rulesMenu } from "./plugin/rules/rules.js";
import { openRedeemMenu } from "./system/redeem_code/redeem_code.js";
import { casino, coinFlip, dice, guessNumber, openLuckyCardDraw, wheelOfFortune, slotMachine, roulette, higherOrLower, blackjack, showCashier } from "./system/casino/ui.js";
import { openParkourNpcMenu } from "./system/parkour/parkour.js";
function isAdmin(player) {
    return player.hasTag("admin"); 
}

function handleNpcClick(player, entity, featureName, callback) {
    if (isAdmin(player)) {
        system.run(() => {
            const form = new ActionFormData()
                .title(`§l§c[ADMIN]§r NPC Manager`)
                .body(`Kamu mengklik NPC: §l§b${featureName}§r\n\nPilih aksi yang ingin dilakukan:`)
                .button(`Buka Menu ${featureName}`, "textures/ui/send_icon")
                .button(`§l§eEdit Tampilan NPC`, "textures/icon/setting")
                .button(`§l§cHapus NPC Ini`, "textures/ui/trash_default"); 

            form.show(player).then(res => {
                if (res.canceled) return;
                
                if (res.selection === 0) {
                    callback(player); 
                    
                } else if (res.selection === 1) {
                    const loc = entity.location;
                    const visualEntities = entity.dimension.getEntities({
                        location: loc,
                        maxDistance: 1,
                        type: "admud:custom_npc"
                    });
                    
                    const targetToEdit = visualEntities.length > 0 ? visualEntities[0] : entity;
                    openMainMenu(player, targetToEdit);
                    
                } else if (res.selection === 2) {
                    const loc = entity.location;
                    try {
                        entity.remove();
                        player.runCommand(`kill @e[tag=npc_skin,x=${loc.x},y=${loc.y},z=${loc.z},r=1]`);
                        player.sendMessage(`§a[Admin] Berhasil menghapus NPC ${featureName}!`);
                    } catch(e) {
                        try {
                            player.runCommand(`kill @e[type=${entity.typeId},x=${loc.x},y=${loc.y},z=${loc.z},r=1,c=1]`);
                            player.runCommand(`kill @e[tag=npc_skin,x=${loc.x},y=${loc.y},z=${loc.z},r=1]`);
                            player.sendMessage(`§a[Admin] Berhasil menghapus NPC ${featureName}!`);
                        } catch (err) {
                            player.sendMessage(`§c[Admin] Gagal menghapus NPC.`);
                        }
                    }
                }
            }).catch(e => console.warn(e));
        });
    } else {
        system.run(() => callback(player));
    }
}

world.afterEvents.playerInteractWithEntity.subscribe((event) => {
    const { target: entity, player } = event;

    const tags = entity.getTags();
    const singleWarpTag = tags.find(tag => tag.startsWith("sys_singlewarp_"));
    const singleShopTag = tags.find(tag => tag.startsWith("sys_shopcat_"));
    
    if (singleWarpTag) {
        const warpIdTarget = singleWarpTag.replace("sys_singlewarp_", "");
        handleNpcClick(player, entity, "Single Warp", (p) => teleportToSingleWarp(p, warpIdTarget));
        return; 
    }

    if (singleShopTag) {
        const catIdTarget = singleShopTag.replace("sys_shopcat_", "");
        handleNpcClick(player, entity, "Category Shop", (p) => openSingleCategoryShop(p, catIdTarget));
        return; 
    }

    if (entity.hasTag("sys_serverwarp")) handleNpcClick(player, entity, "Server Warps", openWarpMenu);
    else if (entity.hasTag("sys_rtp")) handleNpcClick(player, entity, "RTP", openRtpMenu);
    else if (entity.hasTag("sys_tpa")) handleNpcClick(player, entity, "TPA", openTPADashboard);
    else if (entity.hasTag("sys_shop")) handleNpcClick(player, entity, "Shop", openShopMenu);
    else if (entity.hasTag("sys_vault")) handleNpcClick(player, entity, "Vault", openVaultMenu);
    else if (entity.hasTag("sys_market")) handleNpcClick(player, entity, "Market", openMarketMenu);
    else if (entity.hasTag("sys_home")) handleNpcClick(player, entity, "Set Home", openHomeMenu);
    else if (entity.hasTag("sys_bank")) handleNpcClick(player, entity, "Bank", openBankMenu);
    else if (entity.hasTag("sys_transfer")) handleNpcClick(player, entity, "Transfer", openTransferMenu);
    else if (entity.hasTag("sys_jobs")) handleNpcClick(player, entity, "Jobs Center", (p) => openJobMenu(p, false));
    else if (entity.hasTag("sys_clan")) handleNpcClick(player, entity, "Clan System", openClanMenu);
    else if (entity.hasTag("sys_claimland")) handleNpcClick(player, entity, "Claim Land", openClaimMenu);
    else if (entity.hasTag("sys_playerwarp")) handleNpcClick(player, entity, "Player Warps", (p) => openPlayerWarpMenu(p, "all"));
    else if (entity.hasTag("sys_settings")) handleNpcClick(player, entity, "Settings", openSettingsMenu);
    else if (entity.hasTag("sys_report")) handleNpcClick(player, entity, "Report", openReportMenu);
    else if (entity.hasTag("sys_daily")) handleNpcClick(player, entity, "Daily Reward", dailyMenu);
    else if (entity.hasTag("sys_rules")) handleNpcClick(player, entity, "Server Rules", rulesMenu);
    
    // REDEEM CODE
    else if (entity.hasTag("sys_redeem")) handleNpcClick(player, entity, "Redeem Code", openRedeemMenu);
    
    else if (entity.hasTag("sys_cas_coinflip")) handleNpcClick(player, entity, "Coin Flip", coinFlip);
    else if (entity.hasTag("sys_cas_dice")) handleNpcClick(player, entity, "Dice Game", dice);
    else if (entity.hasTag("sys_cas_guess")) handleNpcClick(player, entity, "Guess Number", guessNumber);
    else if (entity.hasTag("sys_cas_lucky")) handleNpcClick(player, entity, "Lucky Card", openLuckyCardDraw);
    else if (entity.hasTag("sys_cas_wheel")) handleNpcClick(player, entity, "Wheel of Fortune", wheelOfFortune);
    else if (entity.hasTag("sys_cas_slot")) handleNpcClick(player, entity, "Slot Machine", slotMachine);
    else if (entity.hasTag("sys_cas_roulette")) handleNpcClick(player, entity, "Roulette", roulette);
    else if (entity.hasTag("sys_cas_higher")) handleNpcClick(player, entity, "Higher or Lower", higherOrLower);
    else if (entity.hasTag("sys_cas_blackjack")) handleNpcClick(player, entity, "Blackjack", blackjack);
    else if (entity.hasTag("sys_cas_cashier")) handleNpcClick(player, entity, "Casino Cashier", showCashier);
    else if (entity.hasTag("sys_parkour")) handleNpcClick(player, entity, "Parkour Menu", openParkourNpcMenu);

    else if (entity.hasTag("sys_rankshop") || (entity.typeId === "admud:rankshop" && !entity.getTags().some(t => t.startsWith("sys_")))) {
        handleNpcClick(player, entity, "Rank Shop", openRankShop);
    } 
    else if (entity.hasTag("sys_rankkit") || (entity.typeId === "admud:rankkit" && !entity.getTags().some(t => t.startsWith("sys_")))) {
        handleNpcClick(player, entity, "Rank Kits", openRankKitMenu);
    }
    else if (entity.hasTag("sys_casino") || entity.typeId === "casino:casino") {
        handleNpcClick(player, entity, "Casino", casino);
    }
    else if (entity.hasTag("sys_dungeon")) {
        handleNpcClick(player, entity, "Dungeon Portal", openDungeonPortalMenu);

    }
});