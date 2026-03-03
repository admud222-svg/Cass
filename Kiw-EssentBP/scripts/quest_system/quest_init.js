import { world, system } from "@minecraft/server";
import { MiningQuestSystem } from "./quests/mining_quest.js";
import { CombatQuestSystem } from "./quests/combat_quest.js";
import { FarmingQuestSystem } from "./quests/farming_quest.js";
function initScoreboards() {
    try {
        world.scoreboard.addObjective("diamond", "Diamond Mined");
        world.scoreboard.addObjective("iron", "Iron Mined");
        world.scoreboard.addObjective("gold", "Gold Mined");
        world.scoreboard.addObjective("emerald", "Emerald Mined");
        world.scoreboard.addObjective("coal", "Coal Mined");
        world.scoreboard.addObjective("zombie", "Zombies Killed");
        world.scoreboard.addObjective("skeleton", "Skeletons Killed");
        world.scoreboard.addObjective("spider", "Spiders Killed");
        world.scoreboard.addObjective("creeper", "Creepers Killed");
        world.scoreboard.addObjective("wheat", "Wheat Harvested");
        world.scoreboard.addObjective("carrot", "Carrots Harvested");
        world.scoreboard.addObjective("potato", "Potatoes Harvested");
        world.scoreboard.addObjective("beetroot", "Beetroot Harvested");
    } catch (error) {
        console.warn("Error initializing scoreboards:", error);
    }
}
system.runInterval(() => {
    try {
        const players = world.getAllPlayers();
        for (const player of players) {
            const tags = Array.from(player.getTags());
            for (const tag of tags) {
                if (tag.startsWith("quest:")) {
                    player.removeTag(tag);
                }
            }
            const objectives = world.scoreboard.getObjectives();
            for (const objective of objectives) {
                try {
                    objective.removeScore(player.scoreboard);
                } catch { }
            }
        }
    } catch (error) {
        console.warn("Error resetting quests:", error);
    }
}, 72000); 
export const QuestSystems = {
    Mining: MiningQuestSystem,
    Combat: CombatQuestSystem,
    Farming: FarmingQuestSystem,
    initialize: initScoreboards
}; 