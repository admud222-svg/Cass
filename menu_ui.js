import { ActionFormData } from "@minecraft/server-ui";
import { world, system } from "@minecraft/server";
import { getPlayerRank } from "./ranks/rank.js";
import { getConfig } from "../config.js";
import { openClanMenu } from "./clans/clan.js";
import { openTPADashboard } from "./tpa/tpa_system.js"; 
import { openRtpMenu } from "./rtp/rtp.js";
import { openClaimMenu } from "./land/claimland.js";
import { openWarpMenu } from "./warps/warp.js";
import { openPlayerWarpMenu } from "./playerwarp/playerwarp.js";
import { openShopMenu } from "./shop/shop.js";

// IMPORT FITUR-FITUR BARU
import { openVaultMenu } from "./vault/vault.js"; 
import { openMarketMenu } from "./market/market.js"; 
import { openHomeMenu } from "./home/home.js"; 
import { openBankMenu } from "./bank/bank.js";
import { openTransferMenu } from "./transfer/transfer.js";
import { openReportMenu } from "./report/report.js";
import { openSettingsMenu } from "./settings/settings.js";
import { openJobMenu } from "./jobs/jobs.js";
import './npc/main';

// FUNGSI FORCE SHOW (Anti-Bug UI)
function forceShow(player, form, callback, isRetry = false) {
    if (!isRetry) player.playSound("random.pop", { volume: 0.8, pitch: 1.0 });
    form.show(player).then(res => {
        if (res.canceled && res.cancelationReason === "UserBusy") {
            system.run(() => forceShow(player, form, callback, true)); 
        } else {
            callback(res);
        }
    }).catch(e => console.warn(e));
}

// FUNGSI METRIC NUMBER (K, M, B, T)
function formatMetric(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(1).replace(/\.0$/, '') + 'T'; 
    if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';  
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';  
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';  
    return num.toString();
}

export function openMemberMainMenu(player) {
    const rank = getPlayerRank(player);
    
    // BACA UANG DARI SCOREBOARD
    let money = 0;
    try {
        const moneyObj = world.scoreboard.getObjective("money"); 
        if (moneyObj) {
            money = moneyObj.getScore(player) || 0;
        }
    } catch (e) {}
    
    const formattedMoney = formatMetric(money);

    // FAILSAFE TOGGLES
    let toggles = getConfig().menuToggles;
    if (!toggles) {
        toggles = { clan: true, tpa: true, rtp: true, claimland: true, serverwarp: true, playerwarp: true, shop: true, vault: true, market: true, home: true, bank: true, transfer: true, jobs: true, settings: true, report: true };
    }

    const form = new ActionFormData()
        .title("MEMBER MENU") 
        .body(`§l§b${player.name}§r\n§7Rank: ${rank.prefix}\n§7Money: §a$${formattedMoney}`);

    const actions = [];
    
    if (toggles.serverwarp !== false) { 
        form.button("Server Warps", "textures/Logo/mundo"); 
        actions.push("serverwarp"); 
    }
    if (toggles.rtp !== false) { 
        form.button("RTP (Random TP)", "textures/Logo/mundo2"); 
        actions.push("rtp"); 
    }
    if (toggles.tpa !== false) { 
        form.button("TPA Teleport", "textures/Logo/user"); 
        actions.push("tpa"); 
    }
    if (toggles.shop !== false) { 
        form.button("Shop", "textures/leaf_icons/image-1202"); 
        actions.push("shop"); 
    }
    if (toggles.vault !== false) { 
        form.button("Player Vault", "textures/Logo/gift"); 
        actions.push("vault"); 
    }
    if (toggles.market !== false) { 
        form.button("Player Market", "textures/Logo/cart"); 
        actions.push("market"); 
    }
    if (toggles.home !== false) { 
        form.button("Set Home", "textures/Logo/lobby"); 
        actions.push("home"); 
    }
    if (toggles.bank !== false) { 
        form.button("Bank", "textures/Logo/banco"); 
        actions.push("bank"); 
    }
    if (toggles.transfer !== false) { 
        form.button("Transfer Uang", "textures/Logo/money"); 
        actions.push("transfer"); 
    }
    if (toggles.jobs !== false) {
        form.button("Jobs Center", "textures/Logo/jobs"); 
        actions.push("jobs"); 
    }
    if (toggles.clan !== false) { 
        form.button("Clan System", "textures/Logo/fac"); 
        actions.push("clan"); 
    }
    if (toggles.claimland !== false) { 
        form.button("Claim Land", "textures/Logo/isla"); 
        actions.push("claimland"); 
    }
    if (toggles.playerwarp !== false) { 
        form.button("Player Warps", "textures/Logo/mundito"); 
        actions.push("playerwarp"); 
    }
    
    // PENGECEKAN TOGGLE PLAYER SETTINGS
    if (toggles.settings !== false) {
        form.button("Player Settings", "textures/Logo/tuerca"); 
        actions.push("settings"); 
    }
    
    // PENGECEKAN TOGGLE REPORT
    if (toggles.report !== false) {
        form.button("Report / Lapor", "textures/Logo/exclamarcion"); 
        actions.push("report"); 
    }
    
    forceShow(player, form, res => {
        if (res.canceled) return;
        const selectedAction = actions[res.selection];

        switch(selectedAction) {
            case "clan": openClanMenu(player); break;
            case "tpa": openTPADashboard(player); break; 
            case "rtp": openRtpMenu(player); break;
            case "claimland": openClaimMenu(player); break;
            case "serverwarp": openWarpMenu(player); break;
            case "playerwarp": openPlayerWarpMenu(player, "all"); break; 
            case "shop": openShopMenu(player); break;
            case "vault": openVaultMenu(player); break; 
            case "market": openMarketMenu(player); break; 
            case "home": openHomeMenu(player); break; 
            case "bank": openBankMenu(player); break; 
            case "transfer": openTransferMenu(player); break; 
            case "jobs": openJobMenu(player, false); break;
            case "settings": openSettingsMenu(player); break;
            case "report": openReportMenu(player); break;
        }
    });
}