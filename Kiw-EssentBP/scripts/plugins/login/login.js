import { world, system } from '@minecraft/server';
import { ActionFormData, ModalFormData, MessageFormData } from '@minecraft/server-ui';
const getAppConfig = () => ({
    adminTag: world.getDynamicProperty("cfg:admin_tag") ?? "admin",
    systemDB: world.getDynamicProperty("cfg:sys_db") ?? "sys:auth_enabled",
    playerDB: world.getDynamicProperty("cfg:plr_db") ?? "player:auth_data",
    sessionDB: world.getDynamicProperty("cfg:ses_db") ?? "player:is_logged_in"
});
const SERVER_LOGS = [];
const ACTIVE_UIS = new Set();
const notify = (player, message) => {
    player.onScreenDisplay.setActionBar(`§l§b[AUTH]§r ${message}`);
};
system.runInterval(() => {
    const config = getAppConfig();
    const isSystemActive = world.getDynamicProperty(config.systemDB) ?? false;
    if (!isSystemActive) return;
    for (const player of world.getPlayers()) {
        const playerName = player.name;
        if (!playerName) continue;
        const isAuthenticated = player.getDynamicProperty(config.sessionDB) ?? false;
        if (!isAuthenticated) {
            enforceSecurity(player);
            if (!ACTIVE_UIS.has(playerName)) {
                const accountData = player.getDynamicProperty(config.playerDB);
                if (accountData) {
                    LoginUI(player, JSON.parse(accountData));
                } else {
                    RegisterUI(player);
                }
            }
        }
    }
}, 40); 
world.afterEvents.playerSpawn.subscribe((e) => {
    const { player, initialSpawn } = e;
    if (initialSpawn) {
        system.run(() => {
            const config = getAppConfig();
            player.setDynamicProperty(config.sessionDB, false);
            notify(player, "§eEstablishing secure tunnel...");
        });
    }
});
world.beforeEvents.playerLeave.subscribe((e) => {
});
function RegisterUI(player) {
    ACTIVE_UIS.add(player.name);
    const form = new ModalFormData()
        .title("§lNEW USER REGISTRATION")
        .textField("§7Welcome. Create a unique identity to secure your profile.\n\n§aStep 1: Username", "Enter username...")
        .textField("§aStep 2: Password\n§7Used for re-authentication.", "Enter password...")
        .toggle("§6I agree to server policies.", { defaultValue: false });
    form.show(player).then((res) => {
        ACTIVE_UIS.delete(player.name);
        if (res.canceled) return;
        const [user, pass, agreed] = res.formValues;
        if (!agreed || !user || !pass) {
            notify(player, "§cRegistration failed. Missing data/agreement.");
            return;
        }
        system.run(() => {
            const config = getAppConfig();
            const account = { u: user, p: pass, date: new Date().toLocaleDateString() };
            player.setDynamicProperty(config.playerDB, JSON.stringify(account));
            player.setDynamicProperty(config.sessionDB, true);
            player.playSound("random.levelup");
            sendWelcomeMessage(player, user, pass);
            addLog(`[REGISTER] ${player.name} as ${user}`);
        });
    });
}
function LoginUI(player, accountData) {
    ACTIVE_UIS.add(player.name);
    const desc = `§l§cSECURITY PROTOCOL§r\n§7Player: §f${player.name}\n§7Account: §f${accountData.u}\n\n§ePlease enter your security password:`;
    const form = new ModalFormData()
        .title("§lSECURE GATEWAY")
        .textField(desc, "Enter password...");
    form.show(player).then((res) => {
        ACTIVE_UIS.delete(player.name);
        if (res.canceled) return;
        const [pass] = res.formValues;
        system.run(() => {
            if (pass === accountData.p) {
                const config = getAppConfig();
                player.setDynamicProperty(config.sessionDB, true);
                notify(player, "§aAccess granted. Welcome back.");
                player.playSound("random.orb");
                addLog(`[LOGIN] ${player.name} verified.`);
            } else {
                notify(player, "§cVerification failed.");
                player.playSound("mob.villager.no");
            }
        });
    });
}
export function AdminDashboardUI(player) {
    const config = getAppConfig();
    const isSystemOn = world.getDynamicProperty(config.systemDB) ?? false;
    const form = new ActionFormData()
        .title("§lNETWORK ADMIN")
        .body(`§7Status: ${isSystemOn ? "§aONLINE" : "§cOFFLINE"}\n§7Admin Tag: §b${config.adminTag}`)
        .button("§lConfig\n§r§7Keys & Tags", "textures/ui/settings_glyph_color_2x")
        .button("§lUsers\n§r§7Reset Accounts", "textures/ui/op")
        .button("§lLogs\n§r§7System Activity", "textures/items/book_normal")
        .button(`§lToggle\n§r§7${isSystemOn ? "§aEnabled" : "§cDisabled"}`, isSystemOn ? "textures/icon/notification/success" : "textures/icon/notification/cross");
    form.show(player).then((res) => {
        if (res.canceled) return;
        switch(res.selection) {
            case 0: AdminConfigUI(player); break;
            case 1: AdminResetUI(player); break;
            case 2: AdminLogsUI(player); break;
            case 3: 
                system.run(() => {
                    world.setDynamicProperty(config.systemDB, !isSystemOn);
                    notify(player, `System: ${!isSystemOn ? "§aON" : "§cOFF"}`);
                });
                break;
        }
    });
}
function AdminConfigUI(player) {
    const curr = getAppConfig();
    const isSystemOn = world.getDynamicProperty(curr.systemDB) ?? false;
    const form = new ModalFormData()
        .title("§lCORE SETTINGS")
        .textField("Admin Tag", "admin", { defaultValue: curr.adminTag })
        .textField("System Key", "sys_db", { defaultValue: curr.systemDB })
        .textField("Account Key", "plr_db", { defaultValue: curr.playerDB })
        .textField("Session Key", "ses_db", { defaultValue: curr.sessionDB })
        .toggle("System Enabled", { defaultValue: isSystemOn });
    form.show(player).then((res) => {
        if (res.canceled) return;
        const [tag, sys, plr, ses, enabled] = res.formValues;
        system.run(() => {
            world.setDynamicProperty("cfg:admin_tag", tag);
            world.setDynamicProperty("cfg:sys_db", sys);
            world.setDynamicProperty("cfg:plr_db", plr);
            world.setDynamicProperty("cfg:ses_db", ses);
            world.setDynamicProperty(sys, enabled);
            notify(player, "§aParameters updated.");
        });
    });
}
function AdminResetUI(admin) {
    const players = world.getPlayers();
    const names = players.map(p => p.name);
    const form = new ModalFormData()
        .title("§lPURGE DATA")
        .dropdown("Select Player", names)
        .toggle("§cConfirm Wipe?", { defaultValue: false });
    form.show(admin).then((res) => {
        if (res.canceled) return;
        const [idx, confirm] = res.formValues;
        const target = players[idx];
        if (target && confirm) {
            system.run(() => {
                const config = getAppConfig();
                target.setDynamicProperty(config.playerDB, undefined);
                target.setDynamicProperty(config.sessionDB, false);
                notify(admin, `§a${target.name} purged.`);
                notify(target, "§7Account reset by admin.");
                addLog(`[RESET] Admin ${admin.name} purged ${target.name}`);
            });
        }
    });
}
function AdminLogsUI(player) {
    const logs = SERVER_LOGS.slice(-15).join("\n");
    new MessageFormData()
        .title("§lSECURITY LOGS")
        .body(logs || "§7No logs.")
        .button1("Close")
        .show(player);
}
function enforceSecurity(player) {
    try {
        player.addEffect("slowness", 45, { amplifier: 255, showParticles: false });
        player.addEffect("blindness", 45, { amplifier: 255, showParticles: false });
        player.addEffect("weakness", 45, { amplifier: 255, showParticles: false });
    } catch {}
}
function sendWelcomeMessage(player, user, pass) {
    player.sendMessage(`\n§b§l======================================\n§l ACCOUNT REGISTERED\n\n§7 ID: §f${user}\n§7 Pass: §f${pass}\n\n§c KEEP SAFE!\n§b§l======================================\n`);
}
function addLog(msg) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    SERVER_LOGS.push(`§8[${time}]§r ${msg}`);
}
