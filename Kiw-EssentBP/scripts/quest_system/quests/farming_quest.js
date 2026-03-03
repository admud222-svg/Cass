import { world, system } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { addMoney } from "../../function/moneySystem.js";
export class FarmingQuest {
    static quests = [
        { id: "wheat", name: "Wheat Farmer", target: 2, block: "minecraft:wheat", icon: "textures/blocks/wheat_stage_7", reward: 1000, xpReward: 100, cooldown: 21600000, enabled: true }, 
        { id: "carrot", name: "Carrot Farmer", target: 20, block: "minecraft:carrots", icon: "textures/blocks/carrots_stage_3", reward: 1500, xpReward: 100, cooldown: 43200000, enabled: true }, 
        { id: "potato", name: "Potato Farmer", target: 20, block: "minecraft:potatoes", icon: "textures/blocks/potatoes_stage_3", reward: 1500, xpReward: 100, cooldown: 43200000, enabled: true }, 
        { id: "beetroots", name: "Beetroot Farmer", target: 20, block: "minecraft:beetroot", icon: "textures/blocks/beetroots_stage_3", reward: 2000, xpReward: 100, cooldown: 43200000, enabled: true } 
    ];
    static activeQuestCache = new Map();
    static isQuestActive(player, questId) {
        const playerId = player.id;
        if (!this.activeQuestCache.has(playerId)) {
            this.activeQuestCache.set(playerId, new Set());
        }
        const playerQuests = this.activeQuestCache.get(playerId);
        if (!playerQuests.has(questId)) {
            const hasQuest = player.hasTag(`quest:${questId}`);
            if (hasQuest) {
                playerQuests.add(questId);
            }
            return hasQuest;
        }
        return true;
    }
    static clearPlayerCache(playerId) {
        this.activeQuestCache.delete(playerId);
    }
    static getQuestConfig() {
        try {
            const config = world.getDynamicProperty('questConfig');
            return config ? JSON.parse(config) : null;
        } catch (error) {
            console.warn("Error getting quest config:", error);
            return null;
        }
    }
    static updateQuestsFromConfig() {
        const config = this.getQuestConfig();
        if (!config || !config.farming) return;
        if (config.farming.enabled) {
            this.quests.forEach(quest => {
                if (config.farming.enabled.hasOwnProperty(quest.id)) {
                    quest.enabled = config.farming.enabled[quest.id];
                }
            });
        }
        if (config.farming.targets) {
            this.quests.forEach(quest => {
                if (config.farming.targets[quest.id]) {
                    quest.target = config.farming.targets[quest.id];
                }
            });
        }
        if (config.farming.cooldowns) {
            this.quests.forEach(quest => {
                if (config.farming.cooldowns[quest.id]) {
                    quest.cooldown = config.farming.cooldowns[quest.id];
                }
            });
        }
        if (config.farming.rewards) {
            this.quests.forEach(quest => {
                if (config.farming.rewards.individual && config.farming.rewards.individual[quest.id]) {
                    const individualReward = config.farming.rewards.individual[quest.id];
                    quest.reward = individualReward.money || quest.reward;
                    quest.xpReward = individualReward.xp || quest.xpReward || 100;
                } else if (typeof config.farming.rewards === 'object' && config.farming.rewards !== null) {
                    if (config.farming.rewards.money) {
                        quest.reward = config.farming.rewards.money;
                    }
                    if (config.farming.rewards.xp) {
                        quest.xpReward = config.farming.rewards.xp;
                    }
                } else {
                    quest.reward = config.farming.rewards;
                }
            });
        }
    }
    static showMenu(player, returnToMain = null) {
        this.updateQuestsFromConfig();
        const hasActiveQuest = player.hasTag("adaquest");
        const form = new ActionFormData()
            .title("§6Farming Quests")
            .body(hasActiveQuest ? "§eYou have an active quest. Track progress or select another quest:" : "§eSelect a farming quest:");
        if (hasActiveQuest) {
            const activeQuest = this.quests.find(quest => player.hasTag(`quest:${quest.id}`));
            if (activeQuest) {
                const objective = world.scoreboard.getObjective(`quest_${activeQuest.id}`);
                const progress = objective ? objective.getScore(player.scoreboardIdentity) || 0 : 0;
                const percentComplete = Math.floor((progress / activeQuest.target) * 100);
                form.button(
                    `§l§a✔ Active Quest: ${activeQuest.name}\n§8Progress: §e${progress}/${activeQuest.target} §8(${percentComplete}%)\n§cClick to cancel`,
                    activeQuest.icon
                );
            }
        }
        for (const quest of this.quests) {
            if (!quest.enabled || player.hasTag(`quest:${quest.id}`)) continue;
            const lastCompletion = player.getDynamicProperty(`last_${quest.id}_completion`) || 0;
            const currentTime = Date.now();
            const timeLeft = lastCompletion + quest.cooldown - currentTime;
            let buttonText = `${quest.name}\n§8Harvest ${quest.target} ${quest.id}\n§6Reward: $${quest.reward}`;
            if (timeLeft > 0) {
                const hours = Math.floor(timeLeft / 3600000);
                const minutes = Math.floor((timeLeft % 3600000) / 60000);
                buttonText += ` §cCD: ${hours}h ${minutes}m`;
            }
            form.button(buttonText, quest.icon);
        }
        form.button("§l§c✘ Close\n§r§8Close the menu", "textures/ui/cancel");
        form.show(player).then(response => {
            if (!response.canceled) {
                if (response.selection === 0 && hasActiveQuest) {
                    const activeQuest = this.quests.find(quest => player.hasTag(`quest:${quest.id}`));
                    if (activeQuest) {
                        this.confirmCancelQuest(player, activeQuest, returnToMain);
                    }
                } else {
                    const availableQuests = this.quests.filter(q => q.enabled && !player.hasTag(`quest:${q.id}`));
                    const questIndex = hasActiveQuest ? response.selection - 1 : response.selection;
                    if (questIndex === availableQuests.length) {
                        if (returnToMain) {
                            returnToMain(player);
                        }
                        return;
                    }
                    if (questIndex < availableQuests.length) {
                        const selectedQuest = availableQuests[questIndex];
                        this.acceptQuest(player, selectedQuest);
                    }
                }
            } else if (returnToMain) {
                returnToMain(player);
            }
        });
    }
    static showAvailableQuests(player, returnToMain = null) {
        const form = new ActionFormData()
            .title("§6Available Farming Quests")
            .body("§eSelect a farming quest:");
        for (const quest of this.quests) {
            const lastCompletion = player.getDynamicProperty(`last_${quest.id}_completion`) || 0;
            const currentTime = Date.now();
            const timeLeft = lastCompletion + quest.cooldown - currentTime;
            let buttonText = `${quest.name}\n§8Harvest ${quest.target} ${quest.id}\n§6Reward: $${quest.reward}`;
            if (timeLeft > 0) {
                const hours = Math.floor(timeLeft / 3600000);
                const minutes = Math.floor((timeLeft % 3600000) / 60000);
                buttonText += ` §cCD: ${hours}h ${minutes}m`;
            }
            form.button(buttonText, quest.icon);
        }
        form.button("§cBack", "textures/ui/arrow_left");
        form.show(player).then(response => {
            if (!response.canceled) {
                if (response.selection < this.quests.length) {
                    const selectedQuest = this.quests[response.selection];
                    this.acceptQuest(player, selectedQuest);
                } else {
                    this.showMenu(player, returnToMain);
                }
            }
        });
    }
    static showActiveQuests(player, returnToMain = null) {
        const activeQuests = this.quests.filter(quest => player.hasTag(`quest:${quest.id}`));
        if (activeQuests.length === 0) {
            player.sendMessage("§c⚠ You don't have any active farming quests!");
            this.showMenu(player, returnToMain);
            return;
        }
        const form = new ActionFormData()
            .title("§6Active Farming Quests")
            .body("§eSelect a quest to view progress or cancel:");
        for (const quest of activeQuests) {
            const objective = world.scoreboard.getObjective(`quest_${quest.id}`);
            const progress = objective ? objective.getScore(player.scoreboardIdentity) || 0 : 0;
            const percentComplete = Math.floor((progress / quest.target) * 100);
            form.button(
                `${quest.name}\n§8Progress: §e${progress}/${quest.target} §8(${percentComplete}%)\n§cClick to cancel`,
                quest.icon
            );
        }
        form.button("§cBack", "textures/ui/arrow_left");
        form.show(player).then(response => {
            if (!response.canceled) {
                if (response.selection < activeQuests.length) {
                    this.confirmCancelQuest(player, activeQuests[response.selection], returnToMain);
                } else {
                    this.showMenu(player, returnToMain);
                }
            }
        });
    }
    static confirmCancelQuest(player, quest, returnToMain = null) {
        const form = new ActionFormData()
            .title("§l§cCancel Quest")
            .body(`§eAre you sure you want to cancel the quest:\n§f${quest.name}?\n\n§cThis action cannot be undone and all progress will be lost!`)
            .button("§l§c✘ Yes, Cancel Quest\n§r§8Cancel current quest", "textures/ui/redX1")
            .button("§l§a✔ No, Keep Quest\n§r§8Return to quests", "textures/ui/arrow_left");
        form.show(player).then(response => {
            if (!response.canceled) {
                if (response.selection === 0) {
                    player.removeTag(`quest:${quest.id}`);
                    player.removeTag("adaquest");
                    try {
                        player.runCommand(`scoreboard players reset @s quest_${quest.id}`);
                    } catch { }
                    player.sendMessage(`§a✔ Successfully cancelled quest: §e${quest.name}`);
                    player.runCommand("playsound note.bass @s ~~~ 1 1");
                }
            }
            this.showMenu(player, returnToMain);
        });
    }
    static acceptQuest(player, quest) {
        if (!quest) return;
        system.run(() => {
            try {
                const lastCompletion = player.getDynamicProperty(`last_${quest.id}_completion`) || 0;
                const currentTime = Date.now();
                const timeLeft = lastCompletion + quest.cooldown - currentTime;
                if (timeLeft > 0) {
                    const hours = Math.floor(timeLeft / 3600000);
                    const minutes = Math.floor((timeLeft % 3600000) / 60000);
                    player.runCommand("playsound mob.villager.no @s");
                    player.runCommand(`tellraw @s {"rawtext":[{"text":"§c⚠ This quest is still on cooldown! Time remaining: ${hours}h ${minutes}m"}]}`);
                    return;
                }
                if (player.hasTag("adaquest")) {
                    player.runCommand("playsound mob.villager.no @s");
                    player.runCommand('tellraw @s {"rawtext":[{"text":"§c⚠ You already have an active quest!"}]}');
                    return;
                }
                player.runCommand(`tag @s add quest:${quest.id}`);
                player.runCommand(`tag @s add adaquest`);
                player.runCommand(`scoreboard objectives add quest_${quest.id} dummy`);
                player.runCommand(`scoreboard players set @s quest_${quest.id} 0`);
                player.runCommand(`tellraw @s {"rawtext":[{"text":"§8[ §eQuest §8] §fSuccessfully accepted quest: §e${quest.name}"}]}`);
                player.runCommand("playsound mob.villager.yes @s");
            } catch (error) {
                console.warn("Error accepting quest:", error);
            }
        });
    }
    static {
        world.beforeEvents.playerBreakBlock.subscribe((event) => {
            const { player, block } = event;
            const blockId = block.typeId;
            for (const quest of this.quests) {
                if (player.hasTag(`quest:${quest.id}`) && blockId === quest.block) {
                    const blockState = block.permutation.getAllStates();
                    const maxGrowth = blockId === "minecraft:beetroots" ? 3 : 7;
                    if (blockState.growth < maxGrowth) return;
                    system.run(() => {
                        try {
                            player.runCommand(`scoreboard players add @s quest_${quest.id} 1`);
                            const objective = world.scoreboard.getObjective(`quest_${quest.id}`);
                            if (!objective) return;
                            const progress = objective.getScore(player.scoreboardIdentity);
                            player.runCommand(`tellraw @s {"rawtext":[{"text":"§8[ §eQuest §8] §fQuest progress: §e${progress}/${quest.target}"}]}`);
                            if (progress >= quest.target) {
                                player.runCommand(`tag @s remove quest:${quest.id}`);
                                player.runCommand(`tag @s remove adaquest`);
                                player.setDynamicProperty(`last_${quest.id}_completion`, Date.now());
                                player.runCommand(`scoreboard players reset @s quest_${quest.id}`);
                                const xpAmount = quest.xpReward || 100;
                                if (addMoney(player, quest.reward)) {
                                    player.runCommand(`tellraw @s {"rawtext":[{"text":"\n§8[ §6QUEST COMPLETED §8]\n§fQuest: §e${quest.name}\n§fRewards:\n§a+ §6$${quest.reward} §fMoney\n§a+ §b${xpAmount} XP\n"}]}`);
                                } else {
                                    player.runCommand(`tellraw @s {"rawtext":[{"text":"\n§8[ §6QUEST COMPLETED §8]\n§fQuest: §e${quest.name}\n§fRewards:\n§c× Failed to add money\n§a+ §b${xpAmount} XP\n"}]}`);
                                    console.warn(`Failed to add money reward to player ${player.name} for quest ${quest.id}`);
                                }
                                player.runCommand("playsound random.levelup @s ~~~ 1 1");
                                player.runCommand("particle minecraft:villager_happy ~~~");
                                player.runCommand(`xp ${xpAmount} @s`);
                            }
                        } catch (error) {
                            console.warn("Error updating quest progress:", error);
                        }
                    });
                    break;
                }
            }
        });
    }
}