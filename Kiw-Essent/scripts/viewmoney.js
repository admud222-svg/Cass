import { world, system } from "./core.js";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { getFullMoney, addMoney, removeMoney, getFormattedMoney } from "./function/moneySystem.js";
import { metricNumbers } from "./lib/game.js";
import { Lang } from "./lib/Lang.js";


const messages = {
    error: (p, k, ...a) => `{"rawtext":[{"text":"§c✖ §7${Lang.t(p, k, ...a)}"}]}`,
    success: (p, k, ...a) => `{"rawtext":[{"text":"§a✓ ${Lang.t(p, k, ...a)}"}]}`,
    notify: (p, k, ...a) => `{"rawtext":[{"text":"${Lang.t(p, k, ...a)}"}]}`
};

const showMoneyMenu = (player) => {
    new ActionFormData()
        .title(Lang.t(player, "money.menu.title"))
        .body(Lang.t(player, "money.menu.body"))
        .button(Lang.t(player, "money.btn.view"), "textures/ui/icon_book_writable")
        .button(Lang.t(player, "money.btn.add"), "textures/ui/color_plus")
        .button(Lang.t(player, "money.btn.remove"), "textures/ui/icon_trash")
        .show(player)
        .then(({ selection, canceled }) => {
            if (!canceled) {
                [selectPlayer, showAddMoneyMenu, showRemoveMoneyMenu][selection](player);
            }
        });
};

const selectPlayer = (player) => {
    const players = Array.from(world.getPlayers());
    if (players.length === 0) {
        player.runCommand(`tellraw @s ${messages.error(player, "err.no_player")}`);
        return;
    }

    const playerList = players.map(p => p.name);
    new ModalFormData()
        .title(Lang.t(player, "money.select_player"))
        .dropdown(Lang.t(player, "money.select_player.dropdown"), playerList, {
            defaultValueIndex: 0
        })
        .show(player)
        .then(({ canceled, formValues }) => {
            if (!canceled) {
                displayMoney(player, playerList[formValues[0]]);
            }
        });
};

const displayMoney = (player, targetPlayerName) => {
    
    const targetPlayer = Array.from(world.getPlayers()).find(p => p.name === targetPlayerName);
    let formattedBalance = "$0";
    
    if (targetPlayer) {
        formattedBalance = getFormattedMoney(targetPlayer);
    }
    
    new MessageFormData()
        .title(Lang.t(player, "money.balance.title", targetPlayerName))
        .body(Lang.t(player, "money.balance.body", targetPlayerName, formattedBalance))
        .button1(Lang.t(player, "common.close"))
        .button2(Lang.t(player, "common.back"))
        .show(player)
        .then(({ selection }) => {
            if (selection === 1) showMoneyMenu(player);
        });
};

const handleMoneyTransaction = async (source, targetName, amount, isAdd) => {
    if (isNaN(amount) || amount <= 0) {
        source.runCommand(`tellraw @s ${messages.error(source, "err.invalid_amount")}`);
        source.runCommand("playsound note.bass @s ~~~ 1 0.5");
        return showMoneyMenu(source);
    }

    const targetPlayer = Array.from(world.getPlayers()).find(p => p.name === targetName);
    if (!targetPlayer) {
        source.runCommand(`tellraw @s ${messages.error(source, "err.player_not_found")}`);
        return showMoneyMenu(source);
    }
    
    
    let success;
    if (isAdd) {
        success = addMoney(targetPlayer, amount);
    } else {
        success = removeMoney(targetPlayer, amount);
    }
    
    if (!success) {
        
        return showMoneyMenu(source);
    }

    
    const formattedAmount = metricNumbers(amount.toString());
    source.runCommand(`tellraw @s ${messages.success(source, isAdd ? "money.sent" : "money.removed", formattedAmount, targetName)}`);
    // Note: For target notification, we should use target's language ideally.
    // However, targetName is a string here, but we found targetPlayer above.
    // Let's use targetPlayer for language context if possible.
    
    if (targetPlayer) {
         // Using targetPlayer for translation context
        targetPlayer.runCommand(`tellraw @s ${messages.notify(targetPlayer, isAdd ? "money.received" : "money.deducted", formattedAmount, source.name)}`);
    } else {
         // Fallback if target is offline (though code checks existence above, strictly speaking handleMoneyTransaction logic assumes online for now)
         source.runCommand(`tellraw "${targetName}" ${messages.notify(source, isAdd ? "money.received" : "money.deducted", formattedAmount, source.name)}`);
    }
    
    
    source.runCommand("playsound random.levelup @s ~~~ 1 2");
    system.runTimeout(() => {
        const newBalance = getFormattedMoney(targetPlayer);
        source.runCommand(`titleraw "${targetName}" actionbar {"rawtext":[{"text":"Balance: ${newBalance}"}]}`);
    }, 20);
};

const showTransactionMenu = (source, isAdd) => {
    const players = Array.from(world.getPlayers());
    const playerList = players.map(p => p.name);

    new ModalFormData()
        .title(Lang.t(source, isAdd ? "money.add.title" : "money.remove.title"))
        .dropdown(Lang.t(source, "money.transaction.select"), playerList, {
            defaultValueIndex: 0
        })
        .textField(Lang.t(source, "money.transaction.amount"), Lang.t(source, "money.transaction.amount.placeholder"), {
            defaultValue: ""
        })
        .show(source)
        .then(({ canceled, formValues }) => {
            if (!canceled) {
                handleMoneyTransaction(source, playerList[formValues[0]], parseInt(formValues[1]), isAdd);
            } else {
                showMoneyMenu(source);
            }
        });
};

const showAddMoneyMenu = source => showTransactionMenu(source, true);
const showRemoveMoneyMenu = source => showTransactionMenu(source, false);

export { showMoneyMenu };