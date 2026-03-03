export const rankDefault = {
    ranks: {
        "rank:": { // Owner
            name: "Owner",
            color: "§4",
            prefix: "",
            commands: {
                "+gmc": { cmd: "gamemode c @s", msg: "§aCreative mode enabled§f" },
                "+gms": { cmd: "gamemode s @s", msg: "§aSurvival mode enabled§f" },
                "+gmsp": { cmd: "gamemode spectator @s", msg: "§aSpectator mode enabled§f" },
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" },
            }
        },
        "rank:": { // Admin
            name: "Admin",
            color: "§4",
            prefix: "",
            commands: {
                "+gmc": { cmd: "gamemode c @s", msg: "§aCreative mode enabled§f" },
                "+gms": { cmd: "gamemode s @s", msg: "§aSurvival mode enabled§f" },
                "+gmsp": { cmd: "gamemode spectator @s", msg: "§aSpectator mode enabled§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Member
            name: "Member",
            color: "§7",
            prefix: "",
            commands: {
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // VIP
            name: "VIP",
            color: "§c",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+nightvision": { cmd: "effect @s night_vision infinite", msg: "§aNight vision activated§f" },
                "+heal": { cmd: "effect @s instant_health", msg: "§aHealth restored§f" },
                "+weather": { cmd: "weather clear", msg: "§aWeather cleared§f" },
                "+haste": { cmd: "effect @s haste 1000 2", msg: "§aHaste effect applied§f" },
                "+day": { cmd: "time set day", msg: "§aTime set to day§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" },
                "+vanish": { cmd: "effect @s invisibility infinite", msg: "§aInvisibility activated§f" }
            }
        },
        "rank:": { // Diamond
            name: "Diamond",
            color: "§b",
            prefix: "",
            commands: {
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+heal": { cmd: "effect @s instant_health", msg: "§aHealth restored§f" },
                "+nightvision": { cmd: "effect @s night_vision infinite", msg: "§aNight vision activated§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Iron
            name: "Iron",
            color: "§d",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+nightvision": { cmd: "effect @s night_vision infinite", msg: "§aNight vision activated§f" },
                "+heal": { cmd: "effect @s instant_health", msg: "§aHealth restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Gold
            name: "Gold",
            color: "§b",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Stone
            name: "Stone",
            color: "§8",
            prefix: "",
            commands: {
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Noob
            name: "Noob",
            color: "§7",
            prefix: "",
            commands: {
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // End
            name: "End",
            color: "§5",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Nether
            name: "Nether",
            color: "§c",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Space
            name: "Space",
            color: "§9",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Fire
            name: "Fire",
            color: "§c",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Water
            name: "Water",
            color: "§9",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Air
            name: "Air",
            color: "§f",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Twitch
            name: "Twitch",
            color: "§5",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Youtube
            name: "Youtube",
            color: "§c",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Sniper
            name: "Sniper",
            color: "§2",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Command
            name: "Command",
            color: "§6",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Builder
            name: "Builder",
            color: "§e",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Legends
            name: "Legends",
            color: "§6",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Discord
            name: "Discord",
            color: "§5",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Helper
            name: "Helper",
            color: "§a",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Kingdom
            name: "Kingdom",
            color: "§6",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Dead
            name: "Dead",
            color: "§8",
            prefix: "",
            commands: {
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Hacker
            name: "Hacker",
            color: "§a",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Designer
            name: "Designer",
            color: "§d",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Kill
            name: "Kill",
            color: "§4",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        },
        "rank:": { // Pixel
            name: "Pixel",
            color: "§d",
            prefix: "",
            commands: {
                "+fly": { cmd: "ability @s mayfly true", msg: "§aFlight mode enabled§f" },
                "+fly off": { cmd: "ability @s mayfly false", msg: "§cFlight mode disabled§f" },
                "+feed": { cmd: "effect @s saturation", msg: "§aHunger restored§f" },
                "+clear": { cmd: "effect @s clear", msg: "§aAll effects cleared§f" }
            }
        }
    }
};
