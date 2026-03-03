import { system, world, ActionFormData, ModalFormData } from "../../core";
import { getGenerators, addGenerator, removeGenerator, updateGenerator } from './database_ore.js';

const ORE_TYPES = {
    coal: {
        block: 'coal_ore',
        weight: 20,
        heightRange: { min: 0.6, max: 1.0 } // Lebih ke atas
    },
    iron: {
        block: 'iron_ore',
        weight: 15,
        heightRange: { min: 0.4, max: 0.8 } // Tengah atas
    },
    gold: {
        block: 'gold_ore',
        weight: 10,
        heightRange: { min: 0.2, max: 0.6 } // Tengah
    },
    redstone: {
        block: 'redstone_ore',
        weight: 12,
        heightRange: { min: 0.1, max: 0.4 } // Tengah bawah
    },
    lapis: {
        block: 'lapis_ore',
        weight: 8,
        heightRange: { min: 0.1, max: 0.5 } // Tengah bawah
    },
    diamond: {
        block: 'diamond_ore',
        weight: 5,
        heightRange: { min: 0, max: 0.3 } // Bawah
    },
    emerald: {
        block: 'emerald_ore',
        weight: 3,
        heightRange: { min: 0, max: 0.2 } // Paling bawah
    }
};

const DEFAULT_SETTINGS = {
    enabled: true,
    autoReset: true,
    resetInterval: 300, // 5 minutes
    stoneChance: 60,
    cobbleChance: 20,
    ores: {
        coal: true,
        iron: true,
        gold: true,
        diamond: true,
        emerald: true,
        lapis: true,
        redstone: true
    },
    oreChances: {
        coal: 20,
        iron: 15,
        gold: 10,
        diamond: 5,
        emerald: 3,
        lapis: 8,
        redstone: 12
    }
};

// Store countdown timers for each generator
const generatorCountdowns = new Map();
// Store timer intervals for each generator
const generatorIntervals = new Map();

function showMainMenu(player) {
    const generators = getGenerators();
    const runningGens = generators.filter(g => g.settings.enabled && g.pos1 && g.pos2);
    const genStatus = runningGens.length > 0
        ? `\n§aRunning Generators: §f${runningGens.length}`
        : '\n§cNo generators are currently running!';
    
    const totalGens = generators.length;
    const gensWithLocation = generators.filter(g => g.pos1 && g.pos2).length;
    const gensWithoutLocation = totalGens - gensWithLocation;

    let locationStatus = '';
    if (gensWithoutLocation > 0) {
        locationStatus = `\n§eGenerators without location: §f${gensWithoutLocation}`;
    }

    const form = new ActionFormData()
        .title('§bORE GENERATOR | MINING SIMULATOR')
        .body(`Total Generators: §f${totalGens}${locationStatus}${genStatus}`);

    form.button('§2CREATE GENERATOR\n§8[ Create New ]', 'textures/ui/button_custom/air-block_128-63725')
        .button('§aSET LOCATION\n§8[ Set Position ]', 'textures/ui/button_custom/A-46499')
        .button('§dMANAGE GENERATORS\n§8[ Settings ]', 'textures/ui/button_custom/cheats-icon-33f13')
        .button('§6RESET ALL\n§8[ Reset ]', 'textures/ui/button_custom/Object-7ce37')
        .button('§cREMOVE GENERATOR\n§8[ Delete ]', 'textures/ui/trash');

    form.show(player).then(response => {
        if (!response || response.canceled) return;

        switch (response.selection) {
            case 0: createGenerator(player); break;
            case 1: setLocationMenu(player); break;
            case 2: manageGenerators(player); break;
            case 3: resetAllGenerators(player); break;
            case 4: removeGeneratorMenu(player); break;
        }
    });
}

function createGenerator(player) {
    const generators = getGenerators();
    
    const form = new ModalFormData()
        .title("§bCreate Generator")
        .textField(
            "§eGenerator Name\n§8Enter unique identifier",
            "Example: Mine1, Cave2",
            { defaultValue: "", placeholder: "Enter generator name" }
        )
        .textField(
            "§eReset Interval\n§8Time between resets in seconds",
            "Example: 300",
            { defaultValue: "300", placeholder: "Enter reset interval" }
        )
        .toggle(
            "§eAuto Reset\n§8Automatically reset generator",
            { defaultValue: true, tooltip: "§6Enable automatic resetting" }
        )
        .toggle(
            "§eStone\n§8Include stone blocks",
            { defaultValue: true, tooltip: "§6Include stone in generation" }
        )
        .toggle(
            "§eCobblestone\n§8Include cobblestone blocks",
            { defaultValue: true, tooltip: "§6Include cobblestone in generation" }
        )
        .toggle(
            "§eCoal Ore\n§8Include coal ore blocks",
            { defaultValue: true, tooltip: "§6Include coal ore in generation" }
        )
        .toggle(
            "§eIron Ore\n§8Include iron ore blocks",
            { defaultValue: true, tooltip: "§6Include iron ore in generation" }
        )
        .toggle(
            "§eGold Ore\n§8Include gold ore blocks",
            { defaultValue: true, tooltip: "§6Include gold ore in generation" }
        )
        .toggle(
            "§eDiamond Ore\n§8Include diamond ore blocks",
            { defaultValue: true, tooltip: "§6Include diamond ore in generation" }
        )
        .toggle(
            "§eEmerald Ore\n§8Include emerald ore blocks",
            { defaultValue: true, tooltip: "§6Include emerald ore in generation" }
        )
        .toggle(
            "§eLapis Ore\n§8Include lapis ore blocks",
            { defaultValue: true, tooltip: "§6Include lapis ore in generation" }
        )
        .toggle(
            "§eRedstone Ore\n§8Include redstone ore blocks",
            { defaultValue: true, tooltip: "§6Include redstone ore in generation" }
        );

    form.show(player).then(response => {
        if (!response || response.canceled) return;

        const [name, interval, autoReset, stone, cobble, ...ores] = response.formValues;
        if (!name || name.trim() === '') {
            player.sendMessage('§c Please enter a name!');
            return;
        }

        // Check if name already exists
        if (generators.find(g => g.name === name)) {
            player.sendMessage('§c Generator with this name already exists!');
            return;
        }

        const resetInterval = Math.max(1, Math.floor(Number(interval) || 300));

        const settings = {
            ...DEFAULT_SETTINGS,
            autoReset,
            resetInterval,
            stoneChance: stone ? 60 : 0,
            cobbleChance: cobble ? 20 : 0,
            ores: {
                coal: ores[0],
                iron: ores[1],
                gold: ores[2],
                diamond: ores[3],
                emerald: ores[4],
                lapis: ores[5],
                redstone: ores[6]
            }
        };

        // Create generator without location (pos1 and pos2 will be null)
        addGenerator(name, null, null, settings);
        player.sendMessage(`§a Generator "${name}" created!\n§eNow set the location using "SET LOCATION" menu`);
        player.runCommand('playsound random.levelup @s');
    });
}

function setLocationMenu(player) {
    const generators = getGenerators();
    if (!generators.length) {
        player.sendMessage('§c No generators found! Create one first.');
        showMainMenu(player);
        return;
    }

    const form = new ActionFormData()
        .title('§aSet Location')
        .body('§eSelect generator to set location\n§7You must select a generator to continue');

    for (let i = 0; i < generators.length; i++) {
        const gen = generators[i];
        let status = '';
        if (gen.pos1 && gen.pos2) {
            status = `§a[Complete]`;
        } else if (gen.pos1 && !gen.pos2) {
            status = `§e[Set Pos2]`;
        } else {
            status = `§c[No Location]`;
        }
        form.button(`§e${gen.name}\n§8${status}`, 'textures/ui/button_custom/A-46499');
    }

    form.show(player).then(response => {
        if (!response || response.canceled) {
            showMainMenu(player);
            return;
        }

        const gen = generators[response.selection];
        if (!gen) {
            player.sendMessage('§c Invalid generator selection!');
            showMainMenu(player);
            return;
        }
        
        // Show edit location menu
        showEditLocationMenu(player, gen);
    });
}

function showEditLocationMenu(player, gen) {
    // Get latest data from database
    const updatedGen = getGenerators().find(g => g.name === gen.name);
    if (!updatedGen) {
        player.sendMessage('§c Generator not found!');
        showMainMenu(player);
        return;
    }

    let pos1Info = '§cNot Set';
    let pos2Info = '§cNot Set';
    
    if (updatedGen.pos1) {
        pos1Info = `§a${updatedGen.pos1.x} ${updatedGen.pos1.y} ${updatedGen.pos1.z}`;
    }
    if (updatedGen.pos2) {
        pos2Info = `§a${updatedGen.pos2.x} ${updatedGen.pos2.y} ${updatedGen.pos2.z}`;
    }

    const form = new ActionFormData()
        .title(`§aEdit Location - ${gen.name}`)
        .body(`§eCurrent Location:\n§7Pos1: ${pos1Info}\n§7Pos2: ${pos2Info}\n\n§eStand at desired position and click button`);

    form.button('§aSET POSITION 1\n§8[ First Corner ]', 'textures/ui/button_custom/A-46499')
        .button('§aSET POSITION 2\n§8[ Second Corner ]', 'textures/ui/button_custom/A-9dabd')
        .button('§cBACK', 'textures/ui/trash');

    form.show(player).then(response => {
        if (!response || response.canceled) {
            showMainMenu(player);
            return;
        }

        switch (response.selection) {
            case 0: // Set Position 1
                setPosition1(player, updatedGen);
                break;
            case 1: // Set Position 2
                setPosition2(player, updatedGen);
                break;
            case 2: // Back
                showMainMenu(player);
                break;
        }
    });
}

function setPosition1(player, gen) {
    // Get current generator data
    const currentGen = getGenerators().find(g => g.name === gen.name);
    
    // Clear old area if both positions exist
    if (currentGen && currentGen.pos1 && currentGen.pos2) {
        clearGeneratorArea(currentGen);
    }
    
    const pos1 = {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z)
    };

    // Get current pos2 if exists
    const pos2 = currentGen?.pos2 || null;

    // Update generator with new pos1
    updateGenerator(gen.name, { pos1, pos2 });
    
    player.sendMessage(`§a Position 1 set for "${gen.name}" at: §f${pos1.x} ${pos1.y} ${pos1.z}`);
    player.runCommand('playsound random.levelup @s');
    
    // If both positions are set, reset the generator
    if (pos2) {
        const updatedGen = getGenerators().find(g => g.name === gen.name);
        if (updatedGen) {
            resetGenerator(updatedGen);
            
            // Restart auto-reset if enabled
            if (updatedGen.settings.autoReset && updatedGen.settings.enabled) {
                startGenerator(gen.name, updatedGen.settings);
            }
        }
    }
    
    // Return to edit menu
    showEditLocationMenu(player, gen);
}

function setPosition2(player, gen) {
    // Check if pos1 exists
    const currentGen = getGenerators().find(g => g.name === gen.name);
    if (!currentGen || !currentGen.pos1) {
        player.sendMessage('§c Position 1 must be set first!');
        showEditLocationMenu(player, gen);
        return;
    }

    // Clear old area if pos2 already exists
    if (currentGen.pos2) {
        clearGeneratorArea(currentGen);
    }

    const pos1 = currentGen.pos1;
    const pos2 = {
        x: Math.floor(player.location.x),
        y: Math.floor(player.location.y),
        z: Math.floor(player.location.z)
    };

    // Update generator with both locations
    updateGenerator(gen.name, { pos1, pos2 });
    
    player.sendMessage(`§a Position 2 set for "${gen.name}" at: §f${pos2.x} ${pos2.y} ${pos2.z}`);
    player.runCommand('playsound random.levelup @s');

    // Immediately reset the generator to fill with blocks
    const updatedGen = getGenerators().find(g => g.name === gen.name);
    if (updatedGen) {
        resetGenerator(updatedGen);
        
        // Start auto-reset if enabled
        if (updatedGen.settings.autoReset && updatedGen.settings.enabled) {
            startGenerator(gen.name, updatedGen.settings);
        }
    }
    
    // Return to edit menu
    showEditLocationMenu(player, gen);
}


function resetAllGenerators(player) {
    const generators = getGenerators();
    let resetCount = 0;
    for (const gen of generators) {
        if (gen.pos1 && gen.pos2) {
            resetGenerator(gen);
            resetCount++;
        }
    }
    if (resetCount > 0) {
        player.sendMessage(`§a ${resetCount} generator(s) have been reset!`);
    } else {
        player.sendMessage('§c No generators with location set to reset!');
    }
}

function isPlayerInGenerator(player, gen) {
    const { pos1, pos2 } = gen;
    if (!pos1 || !pos2) return false;
    
    const minX = Math.min(pos1.x, pos2.x) - 1;
    const minY = Math.min(pos1.y, pos2.y) - 1;
    const minZ = Math.min(pos1.z, pos2.z) - 1;
    const maxX = Math.max(pos1.x, pos2.x) + 1;
    const maxY = Math.max(pos1.y, pos2.y) + 1;
    const maxZ = Math.max(pos1.z, pos2.z) + 1;

    const loc = player.location;
    return (
        loc.x >= minX && loc.x <= maxX &&
        loc.y >= minY && loc.y <= maxY &&
        loc.z >= minZ && loc.z <= maxZ
    );
}

function hasPlayerNearGenerator(gen, radius = 50) {
    const { pos1, pos2 } = gen;
    if (!pos1 || !pos2) return false;
    
    const centerX = (pos1.x + pos2.x) / 2;
    const centerY = (pos1.y + pos2.y) / 2;
    const centerZ = (pos1.z + pos2.z) / 2;
    
    for (const player of world.getPlayers()) {
        const loc = player.location;
        const distance = Math.sqrt(
            Math.pow(loc.x - centerX, 2) + 
            Math.pow(loc.y - centerY, 2) + 
            Math.pow(loc.z - centerZ, 2)
        );
        
        if (distance <= radius) {
            return true;
        }
    }
    
    return false;
}

function clearGeneratorArea(gen) {
    const { pos1, pos2 } = gen;
    
    if (!pos1 || !pos2) {
        return;
    }
    
    const minX = Math.min(pos1.x, pos2.x);
    const minY = Math.min(pos1.y, pos2.y);
    const minZ = Math.min(pos1.z, pos2.z);
    const maxX = Math.max(pos1.x, pos2.x);
    const maxY = Math.max(pos1.y, pos2.y);
    const maxZ = Math.max(pos1.z, pos2.z);

    // Teleport players out of the area before clearing
    for (const player of world.getPlayers()) {
        if (isPlayerInGenerator(player, gen)) {
            const safeDist = 3;
            const teleportX = Math.random() < 0.5
                ? minX - safeDist - Math.random() * 3
                : maxX + safeDist + Math.random() * 3;
            const teleportZ = Math.random() < 0.5
                ? minZ - safeDist - Math.random() * 3
                : maxZ + safeDist + Math.random() * 3;
            const teleportY = maxY + 2 + Math.floor(Math.random() * 2);

            player.teleport({
                x: teleportX,
                y: teleportY,
                z: teleportZ
            });
            player.sendMessage('§c You have been ejected from the generator area!');
        }
    }

    const dimension = world.getDimension('overworld');
    const commands = [];

    // Fill entire area with air
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                commands.push(`setblock ${x} ${y} ${z} minecraft:air`);
            }
        }
    }

    // Execute commands in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < commands.length; i += BATCH_SIZE) {
        const batch = commands.slice(i, i + BATCH_SIZE);
        system.run(() => {
            for (let j = 0; j < batch.length; j++) {
                dimension.runCommand(batch[j]);
            }
        });
    }
}

function resetGenerator(gen) {
    const { pos1, pos2, settings } = gen;
    
    // Check if generator has location set
    if (!pos1 || !pos2) {
        return;
    }
    
    const minX = Math.min(pos1.x, pos2.x);
    const minY = Math.min(pos1.y, pos2.y);
    const minZ = Math.min(pos1.z, pos2.z);
    const maxX = Math.max(pos1.x, pos2.x);
    const maxY = Math.max(pos1.y, pos2.y);
    const maxZ = Math.max(pos1.z, pos2.z);
    const height = maxY - minY;

    // Teleport players out of the generator area
    for (const player of world.getPlayers()) {
        if (isPlayerInGenerator(player, gen)) {
            const safeDist = 3;
            const teleportX = Math.random() < 0.5
                ? minX - safeDist - Math.random() * 3
                : maxX + safeDist + Math.random() * 3;
            const teleportZ = Math.random() < 0.5
                ? minZ - safeDist - Math.random() * 3
                : maxZ + safeDist + Math.random() * 3;
            const teleportY = maxY + 2 + Math.floor(Math.random() * 2);

            player.teleport({
                x: teleportX,
                y: teleportY,
                z: teleportZ
            });
            player.sendMessage('§c You have been ejected from the generator area!');
        }
    }

    // Calculate total weight for enabled ores only
    let totalOreWeight = 0;
    const enabledOres = [];

    for (const [ore, enabled] of Object.entries(settings.ores)) {
        if (enabled && settings.oreChances[ore] > 0) {
            totalOreWeight += settings.oreChances[ore];
            enabledOres.push({
                type: ore,
                chance: settings.oreChances[ore],
                data: ORE_TYPES[ore]
            });
        }
    }

    const dimension = world.getDimension('overworld');
    const commands = [];

    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                const relativeHeight = (y - minY) / height;
                let block = 'minecraft:air'; // Default to air

                // First determine if we're placing stone or cobble
                const baseRand = Math.random() * 100;
                const stoneThreshold = settings.stoneChance;
                const cobbleThreshold = stoneThreshold + settings.cobbleChance;

                if (baseRand < stoneThreshold && settings.stoneChance > 0) {
                    block = 'minecraft:stone';
                } else if (baseRand < cobbleThreshold && settings.cobbleChance > 0) {
                    block = 'minecraft:cobblestone';
                }

                // If we didn't place stone or cobble, try placing an ore
                if (block === 'minecraft:air' && enabledOres.length > 0) {
                    const oreRand = Math.random() * totalOreWeight;
                    let currentWeight = 0;

                    for (const ore of enabledOres) {
                        if (relativeHeight >= ore.data.heightRange.min &&
                            relativeHeight <= ore.data.heightRange.max) {
                            currentWeight += ore.chance;
                            if (oreRand <= currentWeight) {
                                block = `minecraft:${ore.data.block}`;
                                break;
                            }
                        }
                    }

                    // If no ore was placed, default to stone
                    if (block === 'minecraft:air') {
                        block = 'minecraft:stone';
                    }
                }

                commands.push(`setblock ${x} ${y} ${z} ${block}`);
            }
        }
    }

    const BATCH_SIZE = 100;
    for (let i = 0; i < commands.length; i += BATCH_SIZE) {
        const batch = commands.slice(i, i + BATCH_SIZE);
        system.run(() => {
            for (let j = 0; j < batch.length; j++) {
                dimension.runCommand(batch[j]);
            }
        });
    }
}

function startGenerator(name, settings) {
    const gen = getGenerators().find(g => g.name === name);
    if (!gen || !gen.pos1 || !gen.pos2) return;

    // Clear existing timer if any
    const existingInterval = generatorIntervals.get(name);
    if (existingInterval) {
        system.clearRun(existingInterval);
        generatorIntervals.delete(name);
    }

    if (settings.autoReset && settings.enabled) {
        // Initialize countdown in Map if not exists
        if (!generatorCountdowns.has(name)) {
            generatorCountdowns.set(name, settings.resetInterval);
        }
        
        const intervalTicks = 20; // Run every second (20 ticks = 1 second)

        const timerInterval = system.runInterval(() => {
            const currentGen = getGenerators().find(g => g.name === name);
            if (!currentGen || !currentGen.pos1 || !currentGen.pos2 || !currentGen.settings.enabled || !currentGen.settings.autoReset) {
                const interval = generatorIntervals.get(name);
                if (interval) {
                    system.clearRun(interval);
                    generatorIntervals.delete(name);
                }
                generatorCountdowns.delete(name);
                return;
            }

            // Get current countdown from Map
            let countdown = generatorCountdowns.get(name);
            if (countdown === undefined || countdown === null) {
                countdown = currentGen.settings.resetInterval;
                generatorCountdowns.set(name, countdown);
            }

            // Check if there are players near the generator
            if (!hasPlayerNearGenerator(currentGen)) {
                // Reset countdown when no players nearby, but don't reset the generator
                if (countdown !== currentGen.settings.resetInterval) {
                    generatorCountdowns.set(name, currentGen.settings.resetInterval);
                }
                return;
            }

            // Decrease countdown
            countdown--;
            generatorCountdowns.set(name, countdown);

            if (countdown <= 5 && countdown > 0) {
                for (const player of world.getPlayers()) {
                    if (isPlayerInGenerator(player, currentGen)) {
                        player.onScreenDisplay.setActionBar(`§c Generator resetting in §e${countdown} §cseconds!`);
                        player.runCommand(`playsound note.pling @s ~ ~ ~ 1 ${0.5 + countdown * 0.1}`);
                    }
                }
            }

            if (countdown <= 0) {
                // Only reset if there are players nearby
                if (hasPlayerNearGenerator(currentGen)) {
                    resetGenerator(currentGen);
                }
                // Reset countdown
                generatorCountdowns.set(name, currentGen.settings.resetInterval);
            }
        }, intervalTicks);
        
        // Store timer interval in Map
        generatorIntervals.set(name, timerInterval);
    }
}

function removeGeneratorMenu(player) {
    const generators = getGenerators();
    if (!generators.length) {
        player.sendMessage('§c No generators to remove!');
        return;
    }

    const form = new ActionFormData()
        .title('§cRemove Generator')
        .body('§eSelect generator to remove');

    for (let i = 0; i < generators.length; i++) {
        form.button(`§c${generators[i].name}\n§8Click to Remove`, 'textures/ui/button_custom/air-block_128-63725');
    }

    form.show(player).then(response => {
        if (!response || response.canceled) return;

        const gen = generators[response.selection];
        
        // Clear area before removing generator
        if (gen.pos1 && gen.pos2) {
            clearGeneratorArea(gen);
        }
        
        // Stop timer and remove countdown
        const interval = generatorIntervals.get(gen.name);
        if (interval) {
            system.clearRun(interval);
            generatorIntervals.delete(gen.name);
        }
        generatorCountdowns.delete(gen.name);
        
        removeGenerator(gen.name);
        player.sendMessage(`§a Generator "${gen.name}" removed!`);
        player.runCommand('playsound random.break @s');
    });
}

function manageGenerators(player) {
    const generators = getGenerators();
    if (!generators.length) {
        player.sendMessage('§c No generators to manage!');
        return;
    }

    const form = new ActionFormData()
        .title('§dManage')
        .body('§eSelect generator to manage');

    for (let i = 0; i < generators.length; i++) {
        const gen = generators[i];
        const hasLocation = gen.pos1 && gen.pos2;
        const status = gen.settings.enabled ? '§aEnabled' : '§cDisabled';
        const locationStatus = hasLocation ? '§a[Has Location]' : '§c[No Location]';
        form.button(`${gen.name}\n§8${status} | ${locationStatus}`, 'textures/ui/button_custom/air-block_128-63725');
    }

    form.show(player).then(response => {
        if (!response || response.canceled) return;

        const gen = generators[response.selection];
        showGeneratorSettings(player, gen);
    });
}

function showGeneratorSettings(player, gen) {
    try {
    const form = new ModalFormData()
            .title("§d" + gen.name + " Settings")
            .toggle("§eEnabled\n§8Turn generator on/off", { defaultValue: gen.settings.enabled })
            .toggle("§eAuto Reset\n§8Automatically reset blocks", { defaultValue: gen.settings.autoReset })
            .textField("§eReset Interval\n§8Time between resets in seconds", "Example: 300", { defaultValue: gen.settings.resetInterval.toString() })
            .slider("§eStone Chance", 0, 100, { defaultValue: gen.settings.stoneChance, valueStep: 5 })
            .slider("§eCobblestone Chance", 0, 100, { defaultValue: gen.settings.cobbleChance, valueStep: 5 })
            .toggle("§eCoal Ore", { defaultValue: gen.settings.ores.coal })
            .slider("§eCoal Chance", 0, 100, { defaultValue: gen.settings.oreChances?.coal || 20, valueStep: 5 })
            .toggle("§eIron Ore", { defaultValue: gen.settings.ores.iron })
            .slider("§eIron Chance", 0, 100, { defaultValue: gen.settings.oreChances?.iron || 15, valueStep: 5 })
            .toggle("§eGold Ore", { defaultValue: gen.settings.ores.gold })
            .slider("§eGold Chance", 0, 100, { defaultValue: gen.settings.oreChances?.gold || 10, valueStep: 5 })
            .toggle("§eDiamond Ore", { defaultValue: gen.settings.ores.diamond })
            .slider("§eDiamond Chance", 0, 100, { defaultValue: gen.settings.oreChances?.diamond || 5, valueStep: 5 })
            .toggle("§eEmerald Ore", { defaultValue: gen.settings.ores.emerald })
            .slider("§eEmerald Chance", 0, 100, { defaultValue: gen.settings.oreChances?.emerald || 3, valueStep: 5 })
            .toggle("§eLapis Ore", { defaultValue: gen.settings.ores.lapis })
            .slider("§eLapis Chance", 0, 100, { defaultValue: gen.settings.oreChances?.lapis || 8, valueStep: 5 })
            .toggle("§eRedstone Ore", { defaultValue: gen.settings.ores.redstone })
            .slider("§eRedstone Chance", 0, 100, { defaultValue: gen.settings.oreChances?.redstone || 12, valueStep: 5 });

        form.show(player)
            .then((response) => {
                if (response.canceled) {
                    return;
                }

                const [
                    enabled, autoReset, intervalStr, stoneChance, cobbleChance,
            coalEnabled, coalChance, ironEnabled, ironChance, goldEnabled, goldChance,
            diamondEnabled, diamondChance, emeraldEnabled, emeraldChance,
                    lapisEnabled, lapisChance, redstoneEnabled, redstoneChance
                ] = response.formValues;

                const resetInterval = Math.max(1, Math.floor(Number(intervalStr) || 300));

        const settings = {
            enabled,
            autoReset,
            resetInterval,
            stoneChance,
            cobbleChance,
            ores: {
                coal: coalEnabled,
                iron: ironEnabled,
                gold: goldEnabled,
                diamond: diamondEnabled,
                emerald: emeraldEnabled,
                lapis: lapisEnabled,
                redstone: redstoneEnabled
            },
            oreChances: {
                coal: coalChance,
                iron: ironChance,
                gold: goldChance,
                diamond: diamondChance,
                emerald: emeraldChance,
                lapis: lapisChance,
                redstone: redstoneChance
            }
        };

        updateGenerator(gen.name, { settings });
                player.sendMessage("§a Generator " + gen.name + " settings updated!\n§eReset interval: " + resetInterval + " seconds");
                player.runCommand("playsound random.levelup @s");

        // Only start generator if it has location set
        const updatedGen = getGenerators().find(g => g.name === gen.name);
        if (updatedGen && updatedGen.pos1 && updatedGen.pos2) {
            // Reset countdown when settings change
            generatorCountdowns.set(gen.name, resetInterval);
            
            if (enabled && autoReset) {
                startGenerator(gen.name, settings);
            } else {
                // Stop timer if disabled
                const interval = generatorIntervals.get(gen.name);
                if (interval) {
                    system.clearRun(interval);
                    generatorIntervals.delete(gen.name);
                }
            }
        } else {
            player.sendMessage("§e Note: Generator location not set. Use 'SET LOCATION' to set position.");
        }
            })
            .catch((error) => {
                player.sendMessage("§c Failed to update generator settings");
            });
    } catch (error) {
        player.sendMessage("§c Failed to open settings menu");
    }
}

function initializeAllGenerators() {
    const generators = getGenerators();
    for (const gen of generators) {
        if (gen.settings.enabled && gen.settings.autoReset && gen.pos1 && gen.pos2) {
            // Reset countdown to current resetInterval
            generatorCountdowns.set(gen.name, gen.settings.resetInterval);
            startGenerator(gen.name, gen.settings);
        }
    }
}

// Auto-start all enabled generators when world loads
world.afterEvents.worldLoad.subscribe(() => {
    system.runTimeout(() => {
        initializeAllGenerators();
    }, 40); // Wait 2 seconds after world load
});

// Also initialize on script load (for first time or reload)
system.runTimeout(() => {
    initializeAllGenerators();
}, 40);

export { showMainMenu as ore_generator };
