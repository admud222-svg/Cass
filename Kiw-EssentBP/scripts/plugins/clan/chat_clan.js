import { world, system, ActionFormData, ModalFormData, MessageFormData } from "../../core.js";
import { clanDB } from "../../function/getClan.js";

const MAX_HISTORY = 50;
const MAX_MESSAGE_LENGTH = 200;
const PAGE_SIZE = 10;
const SCROLL_LATEST = -1;
const SESSION_CACHE = new Map();

const getChatKey = (clanId) => `chat_${clanId}`;

const getNow = () => {
    const d = new Date();
    const dd = d.getDate().toString().padStart(2, '0');
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const H = d.getHours().toString().padStart(2, '0');
    const M = d.getMinutes().toString().padStart(2, '0');
    return { t: `${H}:${M}`, d: `${dd}/${mm}` };
};

const loadChatHistory = (clanId) => {
    if (SESSION_CACHE.has(clanId)) return SESSION_CACHE.get(clanId);
    const raw = clanDB.get(getChatKey(clanId));
    const history = raw || [];
    SESSION_CACHE.set(clanId, history);
    return history;
};

const saveChatHistory = (clanId, history) => {
    SESSION_CACHE.set(clanId, history);
    clanDB.set(getChatKey(clanId), history.slice(-MAX_HISTORY));
};

const addMessage = (clanId, sender, message, isOwner = false) => {
    const history = loadChatHistory(clanId);
    const now = getNow();
    history.push({
        s: sender.slice(0, 16),
        m: message.slice(0, MAX_MESSAGE_LENGTH),
        t: now.t,
        d: now.d,
        o: isOwner
    });
    saveChatHistory(clanId, history);
    return history;
};

const getMemberRank = (clanId, memberName) => {
    const pdata = clanDB.get(`player_${memberName}`);
    return pdata?.rank || "member";
};

const getOnlineMembers = (clan) => {
    const online = world.getPlayers().map(p => p.name);
    return clan.members.filter(m => online.includes(m));
};

/**
 * Format member list as body text for the sidebar.
 * Displayed via #body_text binding in the left sidebar panel.
 */
const formatMembersBody = (clan, viewerName) => {
    const online = getOnlineMembers(clan);
    const owners = [], mods = [], members = [];

    for (const m of clan.members) {
        const rank = getMemberRank(clan, m);
        const isOnline = online.includes(m);
        const dot = isOnline ? "§a●" : "§7●";
        const name = m === viewerName ? `§a${m}` : `§f${m}`;
        const tag = rank === "owner" ? " §e★" : rank === "mod" ? " §b◆" : "";
        const entry = `${dot} ${name}${tag}`;

        if (rank === "owner") owners.push(entry);
        else if (rank === "mod") mods.push(entry);
        else members.push(entry);
    }

    const lines = [];
    lines.push("§e§lMembers§r");
    if (owners.length) lines.push("§e§lOwner§r", ...owners);
    if (mods.length) lines.push("", "§b§lMod§r", ...mods);
    if (members.length) lines.push("", "§a§lMember§r", ...members);

    return lines.join('\n');
};

const broadcastToClan = (clanId, senderName, message, excludePlayer = null) => {
    const clan = clanDB.get(`clan_${clanId}`);
    if (!clan?.members) return;
    const fmt = `§e[Clan] §7${senderName}: §f${message}`;
    clan.members.forEach(name => {
        if (name === excludePlayer?.name) return;
        const p = world.getPlayers().find(pl => pl.name === name);
        p?.sendMessage(fmt);
    });
};

/**
 * Main clan chat UI - uses ActionFormData so it renders via kiw_clan_chat.json
 * Title contains "Clan Chat" which triggers the custom sidebar UI in server_form.json
 */
const SCROLL_STATE = new Map();

const showClanChatUI = (player, scrollOffset = SCROLL_LATEST) => {
    const pData = clanDB.get(`player_${player.name}`);
    const clanId = pData?.clanId;
    if (!clanId) return player.sendMessage("§cYou are not in a clan!");
    const clan = clanDB.get(`clan_${clanId}`);
    if (!clan) return player.sendMessage("§cClan data not found.");

    const history = loadChatHistory(clanId);
    const isOwner = pData?.rank === "owner";

    // Pagination — pull from full history, show PAGE_SIZE at a time
    const recentMsgs = history.slice(-MAX_HISTORY);
    const msgCount = recentMsgs.length;
    const maxScroll = Math.max(0, msgCount - PAGE_SIZE);
    const currentScroll = scrollOffset === SCROLL_LATEST
        ? maxScroll  // default: show newest messages
        : Math.min(Math.max(0, scrollOffset), maxScroll);
    SCROLL_STATE.set(player.name, currentScroll);
    const visibleMsgs = recentMsgs.slice(currentScroll, currentScroll + PAGE_SIZE);

    // Body = chat messages only in right panel
    const chatLines = ["§e§l--- Chat ---§r"];
    if (msgCount === 0) chatLines.push("§7No messages yet.");
    else for (const msg of visibleMsgs) {
        const date = msg.d ? `${msg.d} ` : '';
        chatLines.push(`§7[${date}${msg.t}] ${msg.o ? "§e" : "§b"}${msg.s}§r: §f${msg.m}`);
    }

    const form = new ActionFormData()
        .title(`Clan Chat: ${clan.name || clanId}§t§p§a${isOwner ? '§1' : '§0'}`)
        .body(chatLines.join('\n'));

    // Sidebar buttons
    const btns = [];
    btns.push({ id: 'up',      lbl: currentScroll > 0         ? `§a▲ Up (${currentScroll})`              : '§7▲ Up' });
    btns.push({ id: 'down',    lbl: currentScroll < maxScroll ? `§a▼ Down (${maxScroll - currentScroll})` : '§7▼ Down' });
    btns.push({ id: 'send',    lbl: '§a§l✉ Send' });
    btns.push({ id: 'refresh', lbl: '§b§l⟳ Refresh' });
    if (isOwner) btns.push({ id: 'clear', lbl: '§c§l✕ Clear' });
    btns.forEach(b => form.button(b.lbl));

    form.show(player).then(res => {
        if (res.canceled) { SCROLL_STATE.delete(player.name); return; }
        const action = btns[res.selection]?.id;
        if (action === 'up')           system.runTimeout(() => showClanChatUI(player, Math.max(0, currentScroll - 1)), 1);
        else if (action === 'down')    system.runTimeout(() => showClanChatUI(player, Math.min(maxScroll, currentScroll + 1)), 1);
        else if (action === 'send')    showSendMessageForm(player, clanId, clan.name);
        else if (action === 'refresh') system.runTimeout(() => showClanChatUI(player, SCROLL_LATEST), 1);
        else if (action === 'clear')   showClearConfirm(player, clanId, clan.name);
    });
};

/**
 * Send message popup - uses ModalFormData for text input
 */
const showSendMessageForm = (player, clanId, clanName) => {
    const form = new ModalFormData()
        .title(`Send Message §t§p§a`)
        .textField("Message", "Type your message here...");

    form.show(player).then(res => {
        if (res.canceled) {
            system.runTimeout(() => showClanChatUI(player, SCROLL_STATE.get(player.name) ?? SCROLL_LATEST), 1);
            return;
        }
        const [msg] = res.formValues || [];
        if (msg?.trim()) {
            const pData = clanDB.get(`player_${player.name}`);
            const isOwner = pData?.rank === "owner";
            addMessage(clanId, player.name, msg.trim(), isOwner);
            broadcastToClan(clanId, player.name, msg.trim(), player);
            player.sendMessage(`§e[Clan] §7You: §f${msg.trim()}`);
        }
        // After sending, jump to newest
        system.runTimeout(() => showClanChatUI(player, SCROLL_LATEST), 2);
    });
};

const showClearConfirm = (player, clanId, clanName) => {
    const form = new MessageFormData()
        .title("Clear Chat History")
        .body("Are you sure you want to clear all chat history?\nThis cannot be undone.")
        .button1("Yes, Clear")
        .button2("Cancel");

    form.show(player).then(res => {
        if (res.selection === 0) {
            SESSION_CACHE.delete(clanId);
            clanDB.delete(getChatKey(clanId));
            player.sendMessage("§aChat history cleared!");
        }
        system.runTimeout(() => showClanChatUI(player, SCROLL_LATEST), 1);
    });
};

const sendQuickMessage = (player, message) => {
    const pData = clanDB.get(`player_${player.name}`);
    const clanId = pData?.clanId;
    if (!clanId) {
        player.sendMessage("§cYou are not in a clan!");
        return false;
    }
    if (!message?.trim()) return false;

    const isOwner = pData?.rank === "owner";
    addMessage(clanId, player.name, message.trim(), isOwner);
    broadcastToClan(clanId, player.name, message.trim(), player);
    player.sendMessage(`§e[Clan] §7You: §f${message.trim()}`);
    return true;
};

export { showClanChatUI, sendQuickMessage, loadChatHistory };
