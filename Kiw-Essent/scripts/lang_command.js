// !lang command disabled - use Member Menu > Language instead
// Language switching is now only available through the GUI menu

import { world } from "@minecraft/server";
import { Lang } from "./lib/Lang.js";

// Command disabled - Language can only be changed via Member Menu
/*
world.beforeEvents.chatSend.subscribe((ev) => {
    const { sender, message } = ev;
    if (!message.startsWith("!lang ")) return;

    ev.cancel = true;
    const args = message.trim().split(" ");
    const lang = args[1];

    if (lang === "en" || lang === "id") {
        Lang.set(sender, lang);
        sender.sendMessage(Lang.t(sender, "cmd.lang.success", lang === 'id' ? "Indonesia" : "English"));
    } else {
        sender.sendMessage(Lang.t(sender, "cmd.lang.usage"));
    }
});
*/

// Export empty to prevent import errors
export {};
