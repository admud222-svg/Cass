import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";
import { addMoney } from "../../function/moneySystem.js";

let MiningQuest, CombatQuest, FarmingQuest;

async function loadQuestClasses() {
    if (!MiningQuest) {
        const mining = await import("../quests/mining_quest.js");
        MiningQuest = mining.MiningQuest;
    }
    if (!CombatQuest) {
        const combat = await import("../quests/combat_quest.js");
        CombatQuest = combat.CombatQuest;
    }
    if (!FarmingQuest) {
        const farming = await import("../quests/farming_quest.js");
        FarmingQuest = farming.FarmingQuest;
    }
}

function getQuestConfig() {
    try {
        const config = world.getDynamicProperty('questConfig');
        return config ? JSON.parse(config) : {
            mining: { rewards: {}, cooldowns: {}, targets: {} },
            combat: { rewards: {}, cooldowns: {}, targets: {} },
            farming: { rewards: {}, cooldowns: {}, targets: {} }
        };
    } catch (error) {
        console.warn("Error getting quest config:", error);
        return {
            mining: { rewards: {}, cooldowns: {}, targets: {} },
            combat: { rewards: {}, cooldowns: {}, targets: {} },
            farming: { rewards: {}, cooldowns: {}, targets: {} }
        };
    }
}

async function saveQuestConfig(config) {
    try {
        world.setDynamicProperty('questConfig', JSON.stringify(config));
        await loadQuestClasses();
        MiningQuest?.updateQuestsFromConfig();
        CombatQuest?.updateQuestsFromConfig();
        FarmingQuest?.updateQuestsFromConfig();
        return true;
    } catch (error) {
        console.warn("Error saving quest config:", error);
        return false;
    }
}

export async function showQuestAdminMenu(player) {
    try {
        const form = new ActionFormData()
            .title("§6Quest Admin Menu")
            .body("§eSelect an option:")
            .button("Enable/Disable Quests\n§8Toggle quest availability", "textures/ui/toggle_on")
            .button("Edit Quest Settings\n§8Change rewards, targets, cooldowns", "textures/ui/accessibility_glyph_color")
            .button("Reset All Quests\n§8Reset progress for all players", "textures/ui/refresh")
            .button("§cBack", "textures/ui/arrow_left");

        const response = await form.show(player);
        if (!response.canceled) {
            switch (response.selection) {
                case 0:
                    await showQuestToggleMenu(player);
                    break;
                case 1:
                    await showQuestSettingsMenu(player);
                    break;
                case 2:
                    await resetAllQuests(player);
                    break;
            }
        }
    } catch (error) {
        console.warn("Error in quest admin menu:", error);
        player.sendMessage("§c⚠ An error occurred in the quest admin menu!");
    }
}

async function showQuestToggleMenu(player) {
    try {
        const form = new ActionFormData()
            .title("§6Toggle Quests")
            .body("§eSelect quest type to toggle:")
            .button("Combat Quests\n§8Enable/Disable combat quests", "textures/ui/sword")
            .button("Mining Quests\n§8Enable/Disable mining quests", "textures/blocks/diamond_ore")
            .button("Farming Quests\n§8Enable/Disable farming quests", "textures/blocks/wheat_stage_7")
            .button("§cBack", "textures/ui/arrow_left");

        const response = await form.show(player);
        if (!response.canceled) {
            switch (response.selection) {
                case 0:
                    await showCombatQuestToggle(player);
                    break;
                case 1:
                    await showMiningQuestToggle(player);
                    break;
                case 2:
                    await showFarmingQuestToggle(player);
                    break;
                case 3:
                    await showQuestAdminMenu(player);
                    break;
            }
        }
    } catch (error) {
        console.warn("Error in quest toggle menu:", error);
        player.sendMessage("§c⚠ An error occurred while toggling quests!");
    }
}

async function showQuestSettingsMenu(player) {
    try {
        const form = new ActionFormData()
            .title("§6Quest Settings")
            .body("§eSelect what to configure:")
            .button("Edit Individual Quest\n§8Edit specific quest settings", "textures/ui/accessibility_glyph_color")
            .button("Quick Edit Rewards\n§8Set rewards for all quests", "textures/ui/gift_square")
            .button("Quick Edit Targets\n§8Set targets for all quests", "textures/ui/anvil_icon")
            .button("Quick Edit Cooldowns\n§8Set cooldowns for all quests", "textures/ui/timer")
            .button("§cBack", "textures/ui/arrow_left");

        const response = await form.show(player);
        if (!response.canceled) {
            switch (response.selection) {
                case 0:
                    await showQuestTypeSelection(player);
                    break;
                case 1:
                    await showQuickRewardEdit(player);
                    break;
                case 2:
                    await showQuickTargetEdit(player);
                    break;
                case 3:
                    await showQuickCooldownEdit(player);
                    break;
                case 4:
                    await showQuestAdminMenu(player);
                    break;
            }
        }
    } catch (error) {
        console.warn("Error in quest settings menu:", error);
        player.sendMessage("§c⚠ An error occurred in the settings menu!");
    }
}

async function showQuestToggle(player, questType, questsList) {
    try {
        const config = getQuestConfig();
        if (!config[questType]) config[questType] = {};
        if (!config[questType].enabled) config[questType].enabled = {};

        const form = new ModalFormData().title(`§6${questType.charAt(0).toUpperCase() + questType.slice(1)} Quest Toggle`);
        const toggles = [];

        questsList.forEach(quest => {
            form.toggle(`§e§l${quest.name}\n§6${quest.desc}`, 
                { defaultValue: config[questType].enabled[quest.id] !== false });
            toggles.push(quest.id);
        });

        const response = await form.show(player);
        if (!response.canceled) {
            toggles.forEach((questId, index) => {
                config[questType].enabled[questId] = response.formValues[index];
            });

            if (await saveQuestConfig(config)) {
                player.sendMessage(`§a✔ ${questType.charAt(0).toUpperCase() + questType.slice(1)} quest settings updated successfully!`);
            } else {
                player.sendMessage(`§c⚠ Failed to save ${questType} quest settings!`);
            }
        }
        await showQuestToggleMenu(player);
    } catch (error) {
        console.warn(`Error in ${questType} quest toggle:`, error);
        player.sendMessage(`§c⚠ An error occurred while toggling ${questType} quests!`);
    }
}

async function showCombatQuestToggle(player) {
    const combatQuests = [
        { id: "zombie", name: "Zombie Slayer", desc: "Toggle zombie slaying quests" },
        { id: "skeleton", name: "Skeleton Hunter", desc: "Toggle skeleton hunting quests" },
        { id: "spider", name: "Spider Exterminator", desc: "Toggle spider extermination quests" },
        { id: "creeper", name: "Creeper Destroyer", desc: "Toggle creeper destroying quests" },
        { id: "husk", name: "Desert Hunter", desc: "Toggle husk hunting quests" },
        { id: "stray", name: "Frozen Archer", desc: "Toggle stray hunting quests" },
        { id: "drowned", name: "Ocean Cleaner", desc: "Toggle drowned hunting quests" },
        { id: "witch", name: "Witch Hunter", desc: "Toggle witch hunting quests" },
        { id: "pillager", name: "Pillager Slayer", desc: "Toggle pillager slaying quests" },
        { id: "vindicator", name: "Vindicator Hunter", desc: "Toggle vindicator hunting quests" },
        { id: "ravager", name: "Ravager Destroyer", desc: "Toggle ravager destroying quests" }
    ];
    await showQuestToggle(player, "combat", combatQuests);
}

async function showQuickRewardEdit(player) {
    try {
        const config = getQuestConfig();
        const form = new ModalFormData()
            .title("§6Quick Edit Rewards")

            .textField(
                "§eCombat Quest Money Reward\n§6Enter amount (e.g. 2000)",
                "Enter amount",
                { defaultValue: config.combat?.rewards?.money?.toString() || "2000" }
            )
            .slider(
                "§eCombat Quest XP Reward\n§6Default: 100",
                0,
                500,
                { defaultValue: config.combat?.rewards?.xp || 100, valueStep: 10, tooltip: "§6XP reward for completing combat quests" }
            )

            .textField(
                "§eMining Quest Money Reward\n§6Enter amount (e.g. 1000)",
                "Enter amount",
                { defaultValue: config.mining?.rewards?.money?.toString() || "1000" }
            )
            .slider(
                "§eMining Quest XP Reward\n§6Default: 100",
                0,
                500,
                { defaultValue: config.mining?.rewards?.xp || 100, valueStep: 10, tooltip: "§6XP reward for completing mining quests" }
            )

            .textField(
                "§eFarming Quest Money Reward\n§6Enter amount (e.g. 1500)",
                "Enter amount",
                { defaultValue: config.farming?.rewards?.money?.toString() || "1500" }
            )
            .slider(
                "§eFarming Quest XP Reward\n§6Default: 100",
                0,
                500,
                { defaultValue: config.farming?.rewards?.xp || 100, valueStep: 10, tooltip: "§6XP reward for completing farming quests" }
            );

        const response = await form.show(player);
        if (!response.canceled) {
            const [
                combatMoneyReward,
                combatXpReward,
                miningMoneyReward,
                miningXpReward,
                farmingMoneyReward,
                farmingXpReward
            ] = response.formValues;

            if (!config.combat) config.combat = {};
            if (!config.mining) config.mining = {};
            if (!config.farming) config.farming = {};

            const combatMoney = parseInt(combatMoneyReward) || 2000;
            config.combat.rewards = {
                money: combatMoney,
                xp: combatXpReward,
                items: []
            };

            const miningMoney = parseInt(miningMoneyReward) || 1000;
            config.mining.rewards = {
                money: miningMoney,
                xp: miningXpReward,
                items: []
            };

            const farmingMoney = parseInt(farmingMoneyReward) || 1500;
            config.farming.rewards = {
                money: farmingMoney,
                xp: farmingXpReward,
                items: []
            };

            if (await saveQuestConfig(config)) {
                player.sendMessage("§a✔ Quest rewards updated successfully!");
                player.sendMessage("§e💰 Money Rewards:");
                player.sendMessage(`§7Combat: §6$${combatMoney}`);
                player.sendMessage(`§7Mining: §6$${miningMoney}`);
                player.sendMessage(`§7Farming: §6$${farmingMoney}`);
                player.sendMessage("§b✨ XP Rewards:");
                player.sendMessage(`§7Combat: §b${combatXpReward}`);
                player.sendMessage(`§7Mining: §b${miningXpReward}`);
                player.sendMessage(`§7Farming: §b${farmingXpReward}`);
            } else {
                player.sendMessage("§c⚠ Failed to save quest rewards!");
            }
        }
        await showQuestSettingsMenu(player);
    } catch (error) {
        console.warn("Error in quick reward edit:", error);
        player.sendMessage("§c⚠ An error occurred while editing rewards!");
    }
}

async function showQuickTargetEdit(player) {
    try {
        const config = getQuestConfig();
        const form = new ModalFormData()
            .title("§6Quick Edit Targets")

            .slider("§e§l⚔ Zombie Quest Target\n§6Default: 10", 1, 50, { defaultValue: config.combat?.targets?.zombie || 10, valueStep: 1, tooltip: "§6Number of zombies to kill" })
            .slider("§e§l⚔ Skeleton Quest Target\n§6Default: 10", 1, 50, { defaultValue: config.combat?.targets?.skeleton || 10, valueStep: 1, tooltip: "§6Number of skeletons to kill" })
            .slider("§e§l⚔ Spider Quest Target\n§6Default: 8", 1, 50, { defaultValue: config.combat?.targets?.spider || 8, valueStep: 1, tooltip: "§6Number of spiders to kill" })
            .slider("§e§l⚔ Creeper Quest Target\n§6Default: 5", 1, 30, { defaultValue: config.combat?.targets?.creeper || 5, valueStep: 1, tooltip: "§6Number of creepers to kill" })

            .slider("§e§l⚔ Husk Quest Target\n§6Default: 12", 1, 50, { defaultValue: config.combat?.targets?.husk || 12, valueStep: 1, tooltip: "§6Number of husks to kill" })
            .slider("§e§l⚔ Stray Quest Target\n§6Default: 12", 1, 50, { defaultValue: config.combat?.targets?.stray || 12, valueStep: 1, tooltip: "§6Number of strays to kill" })
            .slider("§e§l⚔ Drowned Quest Target\n§6Default: 15", 1, 50, { defaultValue: config.combat?.targets?.drowned || 15, valueStep: 1, tooltip: "§6Number of drowned to kill" })
            .slider("§e§l⚔ Witch Quest Target\n§6Default: 8", 1, 30, { defaultValue: config.combat?.targets?.witch || 8, valueStep: 1, tooltip: "§6Number of witches to kill" })

            .slider("§e§l⚔ Pillager Quest Target\n§6Default: 10", 1, 30, { defaultValue: config.combat?.targets?.pillager || 10, valueStep: 1, tooltip: "§6Number of pillagers to kill" })
            .slider("§e§l⚔ Vindicator Quest Target\n§6Default: 8", 1, 30, { defaultValue: config.combat?.targets?.vindicator || 8, valueStep: 1, tooltip: "§6Number of vindicators to kill" })
            .slider("§e§l⚔ Ravager Quest Target\n§6Default: 3", 1, 20, { defaultValue: config.combat?.targets?.ravager || 3, valueStep: 1, tooltip: "§6Number of ravagers to kill" })

            .slider("§e§l⛏ Diamond Quest Target\n§6Default: 20", 1, 100, { defaultValue: config.mining?.targets?.diamond || 20, valueStep: 1, tooltip: "§6Number of diamonds to mine" })
            .slider("§e§l⛏ Iron Quest Target\n§6Default: 50", 1, 200, { defaultValue: config.mining?.targets?.iron || 50, valueStep: 5, tooltip: "§6Number of iron ores to mine" })
            .slider("§e§l⛏ Gold Quest Target\n§6Default: 30", 1, 150, { defaultValue: config.mining?.targets?.gold || 30, valueStep: 5, tooltip: "§6Number of gold ores to mine" })
            .slider("§e§l⛏ Emerald Quest Target\n§6Default: 20", 1, 100, { defaultValue: config.mining?.targets?.emerald || 20, valueStep: 1, tooltip: "§6Number of emeralds to mine" })
            .slider("§e§l⛏ Coal Quest Target\n§6Default: 40", 1, 200, { defaultValue: config.mining?.targets?.coal || 40, valueStep: 5, tooltip: "§6Number of coal ores to mine" })

            .slider("§e§l🌾 Wheat Quest Target\n§6Default: 20", 1, 200, { defaultValue: config.farming?.targets?.wheat || 20, valueStep: 5, tooltip: "§6Number of wheat to harvest" })
            .slider("§e§l🌾 Potato Quest Target\n§6Default: 20", 1, 200, { defaultValue: config.farming?.targets?.potato || 20, valueStep: 5, tooltip: "§6Number of potatoes to harvest" })
            .slider("§e§l🌾 Carrot Quest Target\n§6Default: 20", 1, 200, { defaultValue: config.farming?.targets?.carrot || 20, valueStep: 5, tooltip: "§6Number of carrots to harvest" })
            .slider("§e§l🌾 Beetroot Quest Target\n§6Default: 20", 1, 200, { defaultValue: config.farming?.targets?.beetroot || 20, valueStep: 5, tooltip: "§6Number of beetroots to harvest" });

        const response = await form.show(player);
        if (!response.canceled) {
            const [

                zombieTarget, skeletonTarget, spiderTarget, creeperTarget,

                huskTarget, strayTarget, drownedTarget, witchTarget,

                pillagerTarget, vindicatorTarget, ravagerTarget,

                diamondTarget, ironTarget, goldTarget, emeraldTarget, coalTarget,

                wheatTarget, potatoTarget, carrotTarget, beetrootTarget
            ] = response.formValues;

            if (!config.combat) config.combat = {};
            if (!config.mining) config.mining = {};
            if (!config.farming) config.farming = {};

            config.combat.targets = {

                zombie: zombieTarget,
                skeleton: skeletonTarget,
                spider: spiderTarget,
                creeper: creeperTarget,

                husk: huskTarget,
                stray: strayTarget,
                drowned: drownedTarget,
                witch: witchTarget,

                pillager: pillagerTarget,
                vindicator: vindicatorTarget,
                ravager: ravagerTarget
            };

            config.mining.targets = {
                diamond: diamondTarget,
                iron: ironTarget,
                gold: goldTarget,
                emerald: emeraldTarget,
                coal: coalTarget
            };

            config.farming.targets = {
                wheat: wheatTarget,
                potato: potatoTarget,
                carrot: carrotTarget,
                beetroot: beetrootTarget
            };

            if (await saveQuestConfig(config)) {
                player.sendMessage("§a✔ Quest targets updated successfully!");
                player.sendMessage("§c⚔ Combat Targets (Tier 1):");
                player.sendMessage(`§7- Zombie: ${zombieTarget} | Skeleton: ${skeletonTarget}`);
                player.sendMessage(`§7- Spider: ${spiderTarget} | Creeper: ${creeperTarget}`);
                player.sendMessage("§c⚔ Combat Targets (Tier 2):");
                player.sendMessage(`§7- Husk: ${huskTarget} | Stray: ${strayTarget}`);
                player.sendMessage(`§7- Drowned: ${drownedTarget} | Witch: ${witchTarget}`);
                player.sendMessage("§c⚔ Combat Targets (Tier 3):");
                player.sendMessage(`§7- Pillager: ${pillagerTarget} | Vindicator: ${vindicatorTarget}`);
                player.sendMessage(`§7- Ravager: ${ravagerTarget}`);
                player.sendMessage("§b⛏ Mining Targets:");
                player.sendMessage(`§7- Diamond: ${diamondTarget} | Iron: ${ironTarget}`);
                player.sendMessage(`§7- Gold: ${goldTarget} | Emerald: ${emeraldTarget}`);
                player.sendMessage(`§7- Coal: ${coalTarget}`);
                player.sendMessage("§a🌾 Farming Targets:");
                player.sendMessage(`§7- Wheat: ${wheatTarget} | Potato: ${potatoTarget}`);
                player.sendMessage(`§7- Carrot: ${carrotTarget} | Beetroot: ${beetrootTarget}`);
            } else {
                player.sendMessage("§c⚠ Failed to save quest targets!");
            }
        }
        await showQuestSettingsMenu(player);
    } catch (error) {
        console.warn("Error in quick target edit:", error);
        player.sendMessage("§c⚠ An error occurred while editing targets!");
    }
}

async function showQuickCooldownEdit(player) {
    try {
        const config = getQuestConfig();
        const form = new ModalFormData()
            .title("§6Quick Edit Cooldowns")
            .slider(
                "§eCombat Quest Cooldown\n§6Default: 12 hours",
                1,
                72,
                { defaultValue: (config.combat?.cooldowns?.default || 43200000) / 3600000, valueStep: 1, tooltip: "§6Hours before combat quests can be taken again" }
            )
            .slider(
                "§eMining Quest Cooldown\n§6Default: 24 hours",
                1,
                72,
                { defaultValue: (config.mining?.cooldowns?.default || 86400000) / 3600000, valueStep: 1, tooltip: "§6Hours before mining quests can be taken again" }
            )
            .slider(
                "§eFarming Quest Cooldown\n§6Default: 6 hours",
                1,
                72,
                { defaultValue: (config.farming?.cooldowns?.default || 21600000) / 3600000, valueStep: 1, tooltip: "§6Hours before farming quests can be taken again" }
            );

        const response = await form.show(player);
        if (!response.canceled) {
            const [combatHours, miningHours, farmingHours] = response.formValues;

            if (!config.combat) config.combat = {};
            if (!config.mining) config.mining = {};
            if (!config.farming) config.farming = {};

            config.combat.cooldowns = { default: combatHours * 3600000 };
            config.mining.cooldowns = { default: miningHours * 3600000 };
            config.farming.cooldowns = { default: farmingHours * 3600000 };

            if (await saveQuestConfig(config)) {
                player.sendMessage("§a✔ Quest cooldowns updated successfully!");
            } else {
                player.sendMessage("§c⚠ Failed to save quest cooldowns!");
            }
        }
        await showQuestSettingsMenu(player);
    } catch (error) {
        console.warn("Error in quick cooldown edit:", error);
        player.sendMessage("§c⚠ An error occurred while editing cooldowns!");
    }
}

async function resetAllQuests(player) {
    try {
        const form = new ActionFormData()
            .title("§cReset Quest Settings")
            .body("§eSelect what you want to reset:")
            .button("Reset All Quest Progress\n§8Reset progress for all players", "textures/ui/refresh")
            .button("Reset Cooldowns\n§8Reset quest cooldowns", "textures/ui/timer")
            .button("Reset Rewards\n§8Reset to default rewards", "textures/ui/MCoin")
            .button("Reset Targets\n§8Reset to default targets", "textures/blocks/target_side")
            .button("§cBack", "textures/ui/arrow_left");

        const response = await form.show(player);
        if (!response.canceled) {
            switch (response.selection) {
                case 0:
                    await resetQuestProgress(player);
                    break;
                case 1:
                    await resetQuestCooldowns(player);
                    break;
                case 2:
                    await resetQuestRewards(player);
                    break;
                case 3:
                    await resetQuestTargets(player);
                    break;
                case 4:
                    await showQuestAdminMenu(player);
                    break;
            }
        }
    } catch (error) {
        console.warn("Error in reset menu:", error);
        player.sendMessage("§c⚠ An error occurred in the reset menu!");
    }
}

async function resetQuestProgress(player) {
    try {
        const confirmForm = new ActionFormData()
            .title("§cReset Quest Progress")
            .body("§eAre you sure you want to reset ALL quest progress for all players?\n§cThis action cannot be undone!")
            .button("§cYes, Reset All Progress", "textures/ui/redX1")
            .button("No, Cancel", "textures/ui/arrow_left");

        const response = await confirmForm.show(player);
        if (!response.canceled && response.selection === 0) {
            const config = getQuestConfig();

            ['mining', 'combat', 'farming'].forEach(type => {
                if (config[type]) {
                    config[type].progress = {};
                }
            });

            for (const p of world.getPlayers()) {
                const tags = Array.from(p.getTags());
                tags.forEach(tag => {
                    if (tag.startsWith('quest:')) {
                        p.removeTag(tag);
                    }
                });
                p.removeTag('adaquest');

                ['diamond', 'iron', 'gold', 'emerald', 'coal',
                    'zombie', 'skeleton', 'spider', 'creeper',
                    'wheat', 'carrot', 'potato', 'beetroot'].forEach(questId => {
                        p.setDynamicProperty(`last_${questId}_completion`, 0);
                    });
            }

            if (await saveQuestConfig(config)) {
                player.sendMessage("§a✔ All quest progress has been reset!");
                world.sendMessage("§6System: §eAll quest progress has been reset by an administrator.");
            } else {
                player.sendMessage("§c⚠ Failed to reset quest progress!");
            }
        }
    } catch (error) {
        console.warn("Error resetting quest progress:", error);
        player.sendMessage("§c⚠ An error occurred while resetting quest progress!");
    }
}

async function resetQuestCooldowns(player) {
    try {
        const confirmForm = new ActionFormData()
            .title("§cReset Quest Cooldowns")
            .body("§eSelect which quest type cooldowns to reset:")
            .button("Reset Mining Cooldowns\n§8Reset mining quest cooldowns", "textures/blocks/diamond_ore")
            .button("Reset Combat Cooldowns\n§8Reset combat quest cooldowns", "textures/items/diamond_sword")
            .button("Reset Farming Cooldowns\n§8Reset farming quest cooldowns", "textures/blocks/wheat_stage_7")
            .button("Reset ALL Cooldowns\n§8Reset all quest cooldowns", "textures/ui/refresh")
            .button("§cBack", "textures/ui/arrow_left");

        const response = await confirmForm.show(player);
        if (!response.canceled) {
            const config = getQuestConfig();
            let message = "";
            let questsToReset = [];

            switch (response.selection) {
                case 0:
                    if (config.mining) config.mining.cooldowns = {};
                    message = "mining";
                    questsToReset = ['diamond', 'iron', 'gold', 'emerald', 'coal'];
                    break;
                case 1:
                    if (config.combat) config.combat.cooldowns = {};
                    message = "combat";
                    questsToReset = ['zombie', 'skeleton', 'spider', 'creeper'];
                    break;
                case 2:
                    if (config.farming) config.farming.cooldowns = {};
                    message = "farming";
                    questsToReset = ['wheat', 'carrot', 'potato', 'beetroot'];
                    break;
                case 3:
                    ['mining', 'combat', 'farming'].forEach(type => {
                        if (config[type]) config[type].cooldowns = {};
                    });
                    message = "all";
                    questsToReset = [
                        'diamond', 'iron', 'gold', 'emerald', 'coal',
                        'zombie', 'skeleton', 'spider', 'creeper',
                        'wheat', 'carrot', 'potato', 'beetroot'
                    ];
                    break;
                default:
                    return;
            }

            if (await saveQuestConfig(config)) {
                for (const p of world.getPlayers()) {
                    questsToReset.forEach(questId => {
                        p.setDynamicProperty(`last_${questId}_completion`, 0);
                    });
                }
                player.sendMessage(`§a✔ Successfully reset ${message} quest cooldowns!`);
                world.sendMessage(`§6System: §e${message.charAt(0).toUpperCase() + message.slice(1)} quest cooldowns have been reset by an administrator.`);
            } else {
                player.sendMessage("§c⚠ Failed to reset cooldowns!");
            }
        }
    } catch (error) {
        console.warn("Error resetting cooldowns:", error);
        player.sendMessage("§c⚠ An error occurred while resetting cooldowns!");
    }
}

async function resetQuestRewards(player) {
    try {
        const confirmForm = new ActionFormData()
            .title("§cReset Quest Rewards")
            .body("§eSelect which quest type rewards to reset:")
            .button("Reset Mining Rewards\n§8Reset to default rewards", "textures/blocks/diamond_ore")
            .button("Reset Combat Rewards\n§8Reset to default rewards", "textures/items/diamond_sword")
            .button("Reset Farming Rewards\n§8Reset to default rewards", "textures/blocks/wheat_stage_7")
            .button("Reset ALL Rewards\n§8Reset all quest rewards", "textures/ui/refresh")
            .button("§cBack", "textures/ui/arrow_left");

        const response = await confirmForm.show(player);
        if (!response.canceled) {
            const config = getQuestConfig();
            let message = "";
            let questsToReset = [];

            const defaultRewards = {
                mining: { money: 1000, xp: 100 },
                combat: { money: 2000, xp: 100 },
                farming: { money: 1500, xp: 100 }
            };

            switch (response.selection) {
                case 0:
                    if (config.mining) config.mining.rewards = defaultRewards.mining;
                    message = "mining";
                    questsToReset = ['diamond', 'iron', 'gold', 'emerald', 'coal'];
                    break;
                case 1:
                    if (config.combat) config.combat.rewards = defaultRewards.combat;
                    message = "combat";
                    questsToReset = ['zombie', 'skeleton', 'spider', 'creeper'];
                    break;
                case 2:
                    if (config.farming) config.farming.rewards = defaultRewards.farming;
                    message = "farming";
                    questsToReset = ['wheat', 'carrot', 'potato', 'beetroot'];
                    break;
                case 3:
                    ['mining', 'combat', 'farming'].forEach(type => {
                        if (config[type]) config[type].rewards = defaultRewards[type];
                    });
                    message = "all";
                    questsToReset = [
                        'diamond', 'iron', 'gold', 'emerald', 'coal',
                        'zombie', 'skeleton', 'spider', 'creeper',
                        'wheat', 'carrot', 'potato', 'beetroot'
                    ];
                    break;
                default:
                    return;
            }

            if (await saveQuestConfig(config)) {
                for (const p of world.getPlayers()) {
                    questsToReset.forEach(questId => {
                        p.setDynamicProperty(`${questId}_reward_claimed`, false);
                        p.setDynamicProperty(`${questId}_reward_amount`, 0);
                        p.setDynamicProperty(`${questId}_xp_reward`, 0);
                    });
                }
                player.sendMessage(`§a✔ Successfully reset ${message} quest rewards!`);
                world.sendMessage(`§6System: §e${message.charAt(0).toUpperCase() + message.slice(1)} quest rewards have been reset by an administrator.`);
            } else {
                player.sendMessage("§c⚠ Failed to reset rewards!");
            }
        }
    } catch (error) {
        console.warn("Error resetting rewards:", error);
        player.sendMessage("§c⚠ An error occurred while resetting rewards!");
    }
}

async function resetQuestTargets(player) {
    try {
        const confirmForm = new ActionFormData()
            .title("§cReset Quest Targets")
            .body("§eSelect which quest type targets to reset:")
            .button("Reset Mining Targets\n§8Reset to default targets", "textures/blocks/diamond_ore")
            .button("Reset Combat Targets\n§8Reset to default targets", "textures/items/diamond_sword")
            .button("Reset Farming Targets\n§8Reset to default targets", "textures/blocks/wheat_stage_7")
            .button("Reset ALL Targets\n§8Reset all quest targets", "textures/ui/refresh")
            .button("§cBack", "textures/ui/arrow_left");

        const response = await confirmForm.show(player);
        if (!response.canceled) {
            const config = getQuestConfig();
            let message = "";
            let questsToReset = [];

            const defaultTargets = {
                mining: {
                    diamond: 20,
                    iron: 50,
                    gold: 30,
                    emerald: 20,
                    coal: 40
                },
                combat: {
                    zombie: 10,
                    skeleton: 10,
                    spider: 8,
                    creeper: 5
                },
                farming: {
                    wheat: 20,
                    carrot: 20,
                    potato: 20,
                    beetroot: 20
                }
            };

            switch (response.selection) {
                case 0:
                    if (config.mining) config.mining.targets = defaultTargets.mining;
                    message = "mining";
                    questsToReset = ['diamond', 'iron', 'gold', 'emerald', 'coal'];
                    break;
                case 1:
                    if (config.combat) config.combat.targets = defaultTargets.combat;
                    message = "combat";
                    questsToReset = ['zombie', 'skeleton', 'spider', 'creeper'];
                    break;
                case 2:
                    if (config.farming) config.farming.targets = defaultTargets.farming;
                    message = "farming";
                    questsToReset = ['wheat', 'carrot', 'potato', 'beetroot'];
                    break;
                case 3:
                    ['mining', 'combat', 'farming'].forEach(type => {
                        if (config[type]) config[type].targets = defaultTargets[type];
                    });
                    message = "all";
                    questsToReset = [
                        'diamond', 'iron', 'gold', 'emerald', 'coal',
                        'zombie', 'skeleton', 'spider', 'creeper',
                        'wheat', 'carrot', 'potato', 'beetroot'
                    ];
                    break;
                default:
                    return;
            }

            if (await saveQuestConfig(config)) {
                for (const p of world.getPlayers()) {
                    questsToReset.forEach(questId => {
                        p.setDynamicProperty(`${questId}_progress`, 0);
                        p.setDynamicProperty(`${questId}_target_completed`, false);
                        p.setDynamicProperty(`${questId}_current_target`, defaultTargets[message][questId] || 0);
                        p.removeTag(`quest:${questId}`);
                        try {
                            p.runCommand(`scoreboard players reset @s quest_${questId}`);
                        } catch { }
                    });
                }
                player.sendMessage(`§a✔ Successfully reset ${message} quest targets!`);
                world.sendMessage(`§6System: §e${message.charAt(0).toUpperCase() + message.slice(1)} quest targets have been reset by an administrator.`);
            } else {
                player.sendMessage("§c⚠ Failed to reset targets!");
            }
        }
    } catch (error) {
        console.warn("Error resetting targets:", error);
        player.sendMessage("§c⚠ An error occurred while resetting targets!");
    }
}

async function showMiningQuestToggle(player) {
    const miningQuests = [
        { id: "diamond", name: "Diamond Mining", desc: "Toggle diamond mining quests" },
        { id: "iron", name: "Iron Mining", desc: "Toggle iron mining quests" },
        { id: "gold", name: "Gold Mining", desc: "Toggle gold mining quests" },
        { id: "emerald", name: "Emerald Mining", desc: "Toggle emerald mining quests" },
        { id: "coal", name: "Coal Mining", desc: "Toggle coal mining quests" }
    ];
    await showQuestToggle(player, "mining", miningQuests);
}

async function showFarmingQuestToggle(player) {
    const farmingQuests = [
        { id: "wheat", name: "Wheat Farmer", desc: "Toggle wheat farming quests" },
        { id: "potato", name: "Potato Farmer", desc: "Toggle potato farming quests" },
        { id: "carrot", name: "Carrot Farmer", desc: "Toggle carrot farming quests" },
        { id: "beetroot", name: "Beetroot Farmer", desc: "Toggle beetroot farming quests" }
    ];
    await showQuestToggle(player, "farming", farmingQuests);
}

async function showQuestTypeSelection(player) {
    try {
        const form = new ActionFormData()
            .title("§6Select Quest Type")
            .body("§eSelect quest type to edit:")
            .button("Combat Quests\n§8Edit combat quest settings", "textures/items/diamond_sword")
            .button("Mining Quests\n§8Edit mining quest settings", "textures/blocks/diamond_ore")
            .button("Farming Quests\n§8Edit farming quest settings", "textures/blocks/wheat_stage_7")
            .button("§cBack", "textures/ui/arrow_left");

        const response = await form.show(player);
        if (!response.canceled) {
            switch (response.selection) {
                case 0:
                    await showCombatQuestList(player);
                    break;
                case 1:
                    await showMiningQuestList(player);
                    break;
                case 2:
                    await showFarmingQuestList(player);
                    break;
                case 3:
                    await showQuestSettingsMenu(player);
                    break;
            }
        }
    } catch (error) {
        console.warn("Error in quest type selection:", error);
        player.sendMessage("§c⚠ An error occurred!");
    }
}

async function showQuestList(player, questType, questClass) {
    try {
        await loadQuestClasses();
        const QuestClass = questClass === "combat" ? CombatQuest : questClass === "mining" ? MiningQuest : FarmingQuest;
        QuestClass.updateQuestsFromConfig();
        
        const form = new ActionFormData()
            .title(`§6${questType.charAt(0).toUpperCase() + questType.slice(1)}`)
            .body("§eSelect a quest to edit:");

        const config = getQuestConfig();
        QuestClass.quests.forEach(quest => {
            const isEnabled = config[questClass]?.enabled?.[quest.id] !== false;
            const status = isEnabled ? "§a✓ Enabled" : "§c✗ Disabled";
            const reward = typeof quest.reward === 'object' ? quest.reward.money : quest.reward;
            form.button(`${quest.name}\n§8Target: ${quest.target} | Reward: $${reward || 0}\n${status}`, quest.icon);
        });

        form.button("§cBack", "textures/ui/arrow_left");
        const response = await form.show(player);
        
        if (!response.canceled) {
            if (response.selection < QuestClass.quests.length) {
                await showIndividualQuestEdit(player, questClass, QuestClass.quests[response.selection]);
            } else {
                await showQuestTypeSelection(player);
            }
        }
    } catch (error) {
        console.warn(`Error showing ${questType} quest list:`, error);
        player.sendMessage("§c⚠ An error occurred!");
    }
}

async function showCombatQuestList(player) {
    await showQuestList(player, "Combat Quests", "combat");
}

async function showMiningQuestList(player) {
    await showQuestList(player, "Mining Quests", "mining");
}

async function showFarmingQuestList(player) {
    await showQuestList(player, "Farming Quests", "farming");
}

async function showIndividualQuestEdit(player, questType, quest) {
    try {
        await loadQuestClasses();
        if (questType === 'combat') {
            CombatQuest.updateQuestsFromConfig();
            const updatedQuest = CombatQuest.quests.find(q => q.id === quest.id);
            if (updatedQuest) quest = updatedQuest;
        } else if (questType === 'mining') {
            MiningQuest.updateQuestsFromConfig();
            const updatedQuest = MiningQuest.quests.find(q => q.id === quest.id);
            if (updatedQuest) quest = updatedQuest;
        } else {
            FarmingQuest.updateQuestsFromConfig();
            const updatedQuest = FarmingQuest.quests.find(q => q.id === quest.id);
            if (updatedQuest) quest = updatedQuest;
        }
        
        const config = getQuestConfig();
        if (!config[questType]) config[questType] = {};
        
        const currentTarget = config[questType].targets?.[quest.id] || quest.target;
        const currentCooldown = config[questType].cooldowns?.[quest.id] || quest.cooldown;
        const currentRewardMoney = questType === 'combat' 
            ? (config[questType].rewards?.individual?.[quest.id]?.money || config[questType].rewards?.money || quest.reward?.money || 0)
            : (config[questType].rewards?.individual?.[quest.id]?.money || (typeof quest.reward === 'object' ? quest.reward.money : quest.reward || 0));
        const currentRewardXP = questType === 'combat'
            ? (config[questType].rewards?.individual?.[quest.id]?.xp || config[questType].rewards?.xp || quest.reward?.xp || 100)
            : (config[questType].rewards?.individual?.[quest.id]?.xp || quest.xpReward || 100);
        const isEnabled = config[questType].enabled?.[quest.id] !== false;

        const form = new ModalFormData()
            .title(`§6Edit ${quest.name}`)
            .toggle(`§eEnable Quest\n§6Quest is ${isEnabled ? 'enabled' : 'disabled'}`, { defaultValue: isEnabled })
            .slider(`§eTarget\n§6Current: ${currentTarget}`, 1, questType === 'combat' ? 50 : 200, { 
                defaultValue: currentTarget, 
                valueStep: 1,
                tooltip: `§6Set the target amount for ${quest.name}`
            })
            .textField(`§eMoney Reward\n§6Current: $${currentRewardMoney}`, "Enter amount", { 
                defaultValue: currentRewardMoney.toString() 
            })
            .slider(`§eXP Reward\n§6Current: ${currentRewardXP}`, 0, 500, { 
                defaultValue: currentRewardXP, 
                valueStep: 10,
                tooltip: `§6Set the XP reward for ${quest.name}`
            })
            .slider(`§eCooldown (Hours)\n§6Current: ${Math.floor(currentCooldown / 3600000)}h`, 1, 72, { 
                defaultValue: Math.floor(currentCooldown / 3600000), 
                valueStep: 1,
                tooltip: `§6Set cooldown in hours for ${quest.name}`
            });

        const response = await form.show(player);
        if (!response.canceled) {
            const [enabled, target, moneyRewardStr, xpReward, cooldownHours] = response.formValues;
            const moneyReward = parseInt(moneyRewardStr) || 0;

            if (!config[questType].enabled) config[questType].enabled = {};
            if (!config[questType].targets) config[questType].targets = {};
            if (!config[questType].cooldowns) config[questType].cooldowns = {};
            if (!config[questType].rewards) config[questType].rewards = {};

            config[questType].enabled[quest.id] = enabled;
            config[questType].targets[quest.id] = target;
            config[questType].cooldowns[quest.id] = cooldownHours * 3600000;
            
            if (questType === 'combat') {
                if (!config[questType].rewards.individual) config[questType].rewards.individual = {};
                if (!config[questType].rewards.individual[quest.id]) {
                    config[questType].rewards.individual[quest.id] = {};
                }
                config[questType].rewards.individual[quest.id].money = moneyReward;
                config[questType].rewards.individual[quest.id].xp = xpReward;
            } else {
                if (!config[questType].rewards.individual) config[questType].rewards.individual = {};
                config[questType].rewards.individual[quest.id] = {
                    money: moneyReward,
                    xp: xpReward
                };
            }

            if (await saveQuestConfig(config)) {
                player.sendMessage(`§a✔ Successfully updated ${quest.name}!`);
                player.sendMessage(`§eSettings:`);
                player.sendMessage(`§7- Enabled: ${enabled ? '§aYes' : '§cNo'}`);
                player.sendMessage(`§7- Target: §e${target}`);
                player.sendMessage(`§7- Money Reward: §6$${moneyReward}`);
                player.sendMessage(`§7- XP Reward: §b${xpReward}`);
                player.sendMessage(`§7- Cooldown: §e${cooldownHours} hours`);
                player.runCommand("playsound random.levelup @s");
            } else {
                player.sendMessage("§c⚠ Failed to save quest settings!");
            }
        }
        
        if (questType === 'combat') {
            await showCombatQuestList(player);
        } else if (questType === 'mining') {
            await showMiningQuestList(player);
        } else {
            await showFarmingQuestList(player);
        }
    } catch (error) {
        console.warn("Error editing individual quest:", error);
        player.sendMessage("§c⚠ An error occurred while editing quest!");
    }
}