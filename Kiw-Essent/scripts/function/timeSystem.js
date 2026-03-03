import { system, world } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

const TIMEZONES = [
    "UTC-12", "UTC-11", "UTC-10", "UTC-9", "UTC-8", "UTC-7", "UTC-6",
    "UTC-5", "UTC-4", "UTC-3", "UTC-2", "UTC-1", "UTC+0", "UTC+1",
    "UTC+2", "UTC+3", "UTC+4", "UTC+5", "UTC+6", "UTC+7", "UTC+8",
    "UTC+9", "UTC+10", "UTC+11", "UTC+12", "UTC+13", "UTC+14"
];

const DEFAULT_SETTINGS = {
    enabled: false,
    displayTime: false,
    timezone: "UTC+7",
    smoothness: 100
};

const timeCache = {
    day: "00",
    month: "Jan",
    year: "2024",
    hour: "00",
    minute: "00",
    lastHour: -1,
    lastTick: -1
};

let cachedTimezone = null;
let cachedOffset = 0;

function getTimezoneOffset(timezone = DEFAULT_SETTINGS.timezone) {
    if (cachedTimezone === timezone) {
        return cachedOffset;
    }

    const offset = parseInt(timezone.replace("UTC", ""));
    const result = offset * 3600000;

    cachedTimezone = timezone;
    cachedOffset = result;

    return result;
}

function showTimeActionBar(player) {
    if (world.getDynamicProperty("time:displayTime") ?? DEFAULT_SETTINGS.displayTime) {
        const timezone = world.getDynamicProperty("time:timezone") ?? DEFAULT_SETTINGS.timezone;
        player.onScreenDisplay.setActionBar(
            `§e${timeCache.hour}:${timeCache.minute} §7| §f${timezone}`
        );
    }
}

let settingsCache = {
    enabled: false,
    displayTime: false,
    timezone: DEFAULT_SETTINGS.timezone,
    lastCacheTime: 0,
    cacheDuration: 5000
};

function getCachedSettings() {
    const now = Date.now();
    if (now - settingsCache.lastCacheTime > settingsCache.cacheDuration) {
        settingsCache.enabled = world.getDynamicProperty("time:enabled") ?? DEFAULT_SETTINGS.enabled;
        settingsCache.displayTime = world.getDynamicProperty("time:displayTime") ?? DEFAULT_SETTINGS.displayTime;
        settingsCache.timezone = world.getDynamicProperty("time:timezone") ?? DEFAULT_SETTINGS.timezone;
        settingsCache.lastCacheTime = now;
    }
    return settingsCache;
}

function updateTimeData() {
    const settings = getCachedSettings();
    const now = Date.now();
    
    const offset = getTimezoneOffset(settings.timezone);
    const currentDate = new Date(now + offset);

    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];

    const currentHour = currentDate.getUTCHours();
    const currentMinute = currentDate.getUTCMinutes();
    const currentSecond = currentDate.getUTCSeconds();

    const isHourChange = timeCache.lastHour !== currentHour;
    
    timeCache.lastHour = currentHour;
    timeCache.day = String(currentDate.getUTCDate()).padStart(2, "0");
    timeCache.month = months[currentDate.getUTCMonth()];
    timeCache.year = String(currentDate.getUTCFullYear());
    timeCache.hour = String(currentHour).padStart(2, "0");
    timeCache.minute = String(currentMinute).padStart(2, "0");

    if (settings.enabled) {
        try {
            const totalSeconds = (currentHour * 3600) + (currentMinute * 60) + currentSecond;
            
            const targetTick = Math.floor(((totalSeconds * 5 / 18) + 18000) % 24000);

            if (targetTick !== timeCache.lastTick) {
                timeCache.lastTick = targetTick;
                const overworld = world.getDimension("overworld");
                overworld.runCommand(`time set ${targetTick}`);
                overworld.runCommand("gamerule doDaylightCycle false");

                try {
                    world.getDimension("nether").runCommand(`time set ${targetTick}`);
                    world.getDimension("the_end").runCommand(`time set ${targetTick}`);
                } catch { }
            }
        } catch (error) {
            console.warn("Error updating Minecraft time:", error);
        }
    }

    if (settings.displayTime && isHourChange) {
        const players = world.getPlayers();
        for (const player of players) {
            showTimeActionBar(player);
        }
    }
}

function initTimeSystem() {
    try {
        const properties = [
            ["time:enabled", DEFAULT_SETTINGS.enabled],
            ["time:displayTime", DEFAULT_SETTINGS.displayTime],
            ["time:timezone", DEFAULT_SETTINGS.timezone],
            ["time:smoothness", DEFAULT_SETTINGS.smoothness]
        ];

        for (const [key, defaultValue] of properties) {
            if (world.getDynamicProperty(key) === undefined) {
                world.setDynamicProperty(key, defaultValue);
            }
        }
    } catch (error) {
        console.warn("Error initializing time system:", error);
    }
}

export async function showTimeSettings(player) {
    const currentTimezone = world.getDynamicProperty("time:timezone") ?? DEFAULT_SETTINGS.timezone;
    const UI = new ActionFormData()
        .title("§e§lTime Settings")
        .body(
            `§fCurrent Time: §e${timeCache.hour}:${timeCache.minute}\n` +
            `§fDate: §e${timeCache.day} ${timeCache.month} ${timeCache.year}\n` +
            `§fTimezone: §e${currentTimezone}\n\n` +
            `§7Select an option to configure:`
        )
        .button("§2Toggle Real-Time\n§8» §fEnable/Disable system", "textures/ui/toggle_on")
        .button("§2Time Display\n§8» §fConfigure display", "textures/ui/clock_item")
        .button("§2Timezone\n§8» §fChange timezone", "textures/ui/worldsIcon")
        .button("§cEXIT", "textures/ui/cancel");

    const response = await UI.show(player);
    if (response.canceled) return;

    switch (response.selection) {
        case 0:
            toggleRealTime(player);
            break;
        case 1:
            configureTimeDisplay(player);
            break;
        case 2:
            selectTimezone(player);
            break;
    }
}

async function toggleRealTime(player) {
    const currentEnabled = world.getDynamicProperty("time:enabled") ?? DEFAULT_SETTINGS.enabled;
    world.setDynamicProperty("time:enabled", !currentEnabled);

    settingsCache.lastCacheTime = 0;

    player.sendMessage(`§8[§eTIME§8] §7Real-time system has been ${!currentEnabled ? "§aenabled" : "§cdisabled"}§7!`);

    if (!currentEnabled) {
        showTimeActionBar(player);
    }
    player.playSound("random.orb");
}

async function configureTimeDisplay(player) {
    const UI = new ModalFormData()
        .title("§e§lTime Display Settings")
        .toggle("§fShow Time Notifications", world.getDynamicProperty("time:displayTime") ?? DEFAULT_SETTINGS.displayTime)
        .slider("§fNotification Duration (seconds)", 1, 10, Math.min(5, 10));

    const response = await UI.show(player);
    if (response.canceled) return;

    const [displayTime, duration] = response.formValues;
    world.setDynamicProperty("time:displayTime", displayTime);

    settingsCache.lastCacheTime = 0;

    player.sendMessage("§8[§eTIME§8] §aDisplay settings updated!");

    if (displayTime) {
        showTimeActionBar(player);
    }
    player.playSound("random.levelup");
}

async function selectTimezone(player) {
    const currentTimezone = world.getDynamicProperty("time:timezone") ?? DEFAULT_SETTINGS.timezone;
    const UI = new ModalFormData()
        .title("§e§lSelect Timezone")
        .dropdown("§fSelect your timezone:", TIMEZONES, TIMEZONES.indexOf(currentTimezone));

    const response = await UI.show(player);
    if (response.canceled) return;

    const newTimezone = TIMEZONES[response.formValues[0]];
    world.setDynamicProperty("time:timezone", newTimezone);

    settingsCache.lastCacheTime = 0;

    player.sendMessage(`§8[§eTIME§8] §aTimezone updated to ${newTimezone}!`);

    showTimeActionBar(player);
    player.playSound("random.levelup");
}

system.runTimeout(() => {
    try {
        initTimeSystem();
    } catch (error) {
        console.warn("Failed to initialize time system:", error);
    }
}, 40);

system.runInterval(updateTimeData, 20);

export const getTimeData = () => ({
    day: timeCache.day,
    month: timeCache.month,
    year: timeCache.year,
    hour: timeCache.hour,
    minute: timeCache.minute
});
