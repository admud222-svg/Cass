import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { getRanks, getPlayerRank, setPlayerRank, getPlayerOwnedRanks, addOwnedRank, isEquipFeatureEnabled, toggleEquipFeature, getRankCurrency } from "./plugin/ranks/rank.js";
import { getKits, getKitCooldown, claimRankKit } from "./plugin/ranks/rank_kits.js"; 
import { world, system } from "@minecraft/server";

// =====================================
// SINKRONISASI SCOREBOARD DINAMIS
// =====================================
function getScoreMoney(player) {
    try {
        const currency = getRankCurrency(); 
        return world.scoreboard.getObjective(currency)?.getScore(player) ?? 0;
    } catch { return 0; }
}

function deductScoreMoney(player, amount) {
    try {
        const currency = getRankCurrency();
        const obj = world.scoreboard.getObjective(currency);
        if (obj) {
            const current = obj.getScore(player) ?? 0;
            obj.setScore(player, Math.max(0, current - amount));
        }
    } catch(e) {}
}

// =========================================
// METRIC NUMBER FORMATTER
// =========================================
function formatMetric(num) {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1).replace(/\.0$/, '') + "B";
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + "M";
    if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + "K";
    return num.toString();
}

// =====================================
// MESIN PENDOBRAK ANTI USER-BUSY BUG
// =====================================
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

// =====================================
// MENU RANK SHOP UTAMA
// =====================================
export function openRankShop(player) {
    const ranks = getRanks();
    const playerRank = getPlayerRank(player);
    const ownedRanks = getPlayerOwnedRanks(player);
    const equippedRank = playerRank.id;
    const equipEnabled = isEquipFeatureEnabled();
    const currencyName = getRankCurrency().toUpperCase(); 
    
    const money = getScoreMoney(player);
    const formattedMoney = formatMetric(money); 
    
    const form = new ActionFormData()
        .title("§lRANK SHOP§f§0§1") 
        .body(`§l§b${player.name}§r\n§7Rank: ${playerRank.prefix}\n§7${currencyName}: §a${formattedMoney}\n\n§fKlik Rank untuk melihat Benefit-nya!`); 

    const sortedRanks = Object.entries(ranks).sort((a, b) => a[1].priority - b[1].priority);
    const btnMap = [];

    sortedRanks.forEach(([id, data]) => {
        const isPurchasable = data.isPurchasable !== false;
        
        // FILTER: Sembunyikan dari shop jika diset "TIDAK BISA DIBELI"
        // KECUALI pemain sudah memilikinya, tetap munculkan agar bisa di-equip
        if (!isPurchasable && !ownedRanks.includes(id) && equippedRank !== id) {
            return;
        }

        let icon = "";
        let text = "";
        
        if (equippedRank === id) {
            icon = "textures/ui/New_confirm_Hover";
            text = `${data.prefix} §r\n§a[TERPAKAI]`;
        } else if (ownedRanks.includes(id)) {
            icon = "textures/gui/newgui/mob_effects/village_hero_effect";
            text = equipEnabled ? `${data.prefix} §r\n§e[EQUIP]` : `${data.prefix} §r\n§7[OWNED]`;
        } else {
            icon = "textures/ui/lock";
            text = `${data.prefix} §r\n§e${formatMetric(data.price)} ${currencyName}`; 
        }
        form.button(text, icon);
        btnMap.push({ id, data });
    });

    if (player.hasTag("admin")) form.button("§lAdmin Setting\n§r§8[ Atur Fitur Equip ]", "textures/ui/settings_glyph_color_2x");

    forceShow(player, form, res => {
        if (res.canceled) return;
        if (res.selection === btnMap.length && player.hasTag("admin")) return adminRankEquipSetting(player);

        const selected = btnMap[res.selection];
        previewRank(player, selected.id, selected.data, ownedRanks, equippedRank, equipEnabled);
    });
}

// =====================================
// MENU PREVIEW RANK 
// =====================================
function previewRank(player, targetID, rankData, ownedRanks, equippedRank, equipEnabled) {
    const currencyName = getRankCurrency().toUpperCase();
    let bodyText = `§f§lDetail Rank: §r${rankData.prefix}\n\n`;

    bodyText += `§e✨ Rank Commands & Skills:\n`;
    const cmdKeys = Object.keys(rankData.commands || {});
    if (cmdKeys.length > 0) {
        cmdKeys.forEach(cmd => {
            bodyText += `§8- §a+${cmd}\n`;
        });
    } else {
        bodyText += `§8- §7(Belum ada skill khusus untuk rank ini)\n`;
    }
    bodyText += `\n`;

    const landLimit = rankData.landLimit || 3;
    const landMode = rankData.landMode === "block" ? "Block" : "Area";
    bodyText += `§b🏰 Benefit Claim Land:\n`;
    bodyText += `§8- §fKamu bisa mengamankan wilayah kekuasaanmu hingga maksimal §a${landLimit} ${landMode}§f! Jangan biarkan orang lain mencuri hartamu.\n\n`;

    const warpLimit = rankData.warpLimit || 1;
    bodyText += `§d🌌 Benefit Player Warp:\n`;
    bodyText += `§8- §fBebas membuat hingga §a${warpLimit} titik warp pribadi§f supaya teman-temanmu gampang berkunjung ke tempatmu!\n\n`;

    const form = new ActionFormData()
        .title(`PREVIEW: ${targetID.toUpperCase()}`)
        .body(bodyText);

    let actionType = "buy";
    
    if (equippedRank === targetID) {
        form.button("§lSedang Dipakai\n§r§8Ini rank kamu saat ini", "textures/ui/New_confirm_Hover");
        actionType = "equipped";
    } else if (ownedRanks.includes(targetID)) {
        if (equipEnabled) {
            form.button("§lPakai Rank Ini\n§r§8Klik untuk Equip Rank", "textures/gui/newgui/mob_effects/village_hero_effect");
            actionType = "equip";
        } else {
            form.button("§lRank Dimiliki\n§r§8(Equip sedang dimatikan Admin)", "textures/ui/lock");
            actionType = "locked_equip";
        }
    } else {
        form.button(`§lBeli Rank Sekarang\n§r§8Harga: ${formatMetric(rankData.price)} ${currencyName}`, "textures/ui/color_plus");
        actionType = "buy";
    }

    form.button("§lKembali\n§r§8Ke List Rank Shop", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === 1) return openRankShop(player);

        if (res.selection === 0) {
            if (actionType === "equipped") {
                player.sendMessage("§e[Rank Shop] Kamu sudah memakai rank ini.");
                return openRankShop(player);
            } else if (actionType === "locked_equip") {
                player.sendMessage("§c[Rank Shop] Maaf, Admin sedang menonaktifkan fitur ganti rank manual.");
                return openRankShop(player);
            } else {
                executeBuyOrEquip(player, targetID, rankData, actionType);
            }
        }
    });
}

// =====================================
// EKSEKUSI PEMBELIAN ATAU EQUIP
// =====================================
function executeBuyOrEquip(player, targetID, rankData, actionType) {
    if (actionType === "equip") {
        setPlayerRank(player, targetID);
        player.sendMessage(`§a[Rank Shop] Berhasil! Kamu sekarang menggunakan rank ${rankData.prefix}§a!`);
        return openRankShop(player);
    }

    if (actionType === "buy") {
        const currencyName = getRankCurrency().toUpperCase();
        const currentMoney = getScoreMoney(player);
        if (currentMoney < rankData.price) {
            player.sendMessage(`§c[Rank Shop] ${currencyName} kamu tidak cukup! Butuh §e${formatMetric(rankData.price)}`);
            return openRankShop(player);
        }

        const confirm = new MessageFormData()
            .title("Konfirmasi Pembelian")
            .body(`Apakah kamu yakin ingin membeli rank ${rankData.prefix} §rseharga §e${formatMetric(rankData.price)} ${currencyName}§r?\n\n§7Catatan: Rank ini akan langsung dipakai otomatis setelah dibeli!`)
            .button1("§lBELI SEKARANG")
            .button2("BATAL");
            
        forceShow(player, confirm, res => {
            if (res.selection === 1 || res.canceled) {
                return previewRank(player, targetID, rankData, getPlayerOwnedRanks(player), getPlayerRank(player).id, isEquipFeatureEnabled());
            }
            
            const freshMoney = getScoreMoney(player);
            if (freshMoney < rankData.price) return player.sendMessage(`§c[Rank Shop] ${currencyName} mu tiba-tiba tidak cukup (mungkin berubah saat konfirmasi)!`);
            
            deductScoreMoney(player, rankData.price);
            
            addOwnedRank(player, targetID);
            setPlayerRank(player, targetID);
            
            player.sendMessage(`§aSukses membeli dan memakai rank ${rankData.prefix}§a! Sisa ${currencyName} mu: ${formatMetric(freshMoney - rankData.price)}`);
            player.runCommandAsync(`playsound random.levelup @s`);
            openRankShop(player);
        });
    }
}

// =====================================
// ADMIN SETTING EQUIP RANK 
// =====================================
function adminRankEquipSetting(player) {
    const isEnabled = isEquipFeatureEnabled();
    const form = new ActionFormData()
        .title("RANK SETTING")
        .body("Izinkan pemain untuk mengganti (equip) rank yang sudah mereka beli ke rank yang lain?")
        .button(`Fitur Equip: ${isEnabled ? "§a[AKTIF]" : "§c[MATI]"}`, "textures/ui/refresh_light")
        .button("§lKembali", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === 1) return openRankShop(player);
        const newState = toggleEquipFeature();
        player.sendMessage(`§e[Admin] Fitur Equip Rank berhasil ${newState ? "§aDIAKTIFKAN" : "§cDIMATIKAN"}.`);
        adminRankEquipSetting(player);
    });
}

// =====================================
// MENU KITS 
// =====================================
export function openRankKitMenu(player) {
    const kits = getKits();
    const ranks = getRanks();
    const playerRank = getPlayerRank(player);
    const ownedRanks = getPlayerOwnedRanks(player); 
    
    let money = 0;
    try { money = world.scoreboard.getObjective("money")?.getScore(player) ?? 0; } catch (e) {}
    
    const formattedMoney = formatMetric(money); 
    const now = Date.now();

    const form = new ActionFormData()
        .title("RANK KITS")
        .body(`§l§b${player.name}§r\n§7Rank Saat Ini: ${playerRank.prefix}\n§7Money: §a$${formattedMoney}`);

    const sortedKits = Object.entries(kits).sort((a, b) => {
        const prioA = ranks[a[1].reqRank || "member"]?.priority || 0;
        const prioB = ranks[b[1].reqRank || "member"]?.priority || 0;
        return prioA - prioB;
    });

    const btnMap = [];

    sortedKits.forEach(([id, data]) => {
        const cd = getKitCooldown(player, id);
        const reqRank = data.reqRank || "member";
        let icon = "";
        let text = "";

        if (!ownedRanks.includes(reqRank)) {
            icon = "textures/ui/lock";
            text = `§l${data.name}\n§r§c[ BELI RANK ${reqRank.toUpperCase()} ]`;
        } else if (now < cd) {
            const timeLeft = Math.ceil((cd - now) / 60000);
            const hours = Math.floor(timeLeft / 60);
            const mins = timeLeft % 60;
            icon = "textures/items/bundle_lime_open"; 
            text = `§l${data.name}\n§r§7[ CD: ${hours}j ${mins}m ]`;
        } else {
            icon = "textures/items/bundle_lime"; 
            text = `§l${data.name}\n§r§a[ KLAIM SEKARANG ]`;
        }

        form.button(text, icon);
        btnMap.push(id);
    });

    forceShow(player, form, res => {
        if (res.canceled) return;
        const selectedKitID = btnMap[res.selection];
        claimRankKit(player, selectedKitID);
    });
}