import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { getClans, saveClans, getPlayerClan, getPlayerInvites, savePlayerInvites, setPlayerClan } from "./clan_db.js";
import { getConfig } from "../../config.js"; 

// =====================================
// SINKRONISASI SCOREBOARD MONEY
// =====================================
function getScoreMoney(player) {
    try {
        return world.scoreboard.getObjective("money")?.getScore(player) ?? 0;
    } catch { return 0; }
}

function deductScoreMoney(player, amount) {
    try {
        const obj = world.scoreboard.getObjective("money");
        if (obj) {
            const current = obj.getScore(player) ?? 0;
            obj.setScore(player, Math.max(0, current - amount));
        }
    } catch(e) {}
}

// =====================================
// MESIN PENDOBRAK ANTI USER-BUSY BUG & SUARA POP-UP SAJA
// =====================================
function forceShow(player, form, callback, isRetry = false) {
    if (!isRetry) player.playSound("random.pop", { volume: 0.8, pitch: 1.0 });
    form.show(player).then(res => {
        if (res.canceled && res.cancelationReason === "UserBusy") {
            system.run(() => forceShow(player, form, callback, true)); 
        } else {
            callback(res);
        }
    }).catch(e => console.warn(e));
}

// =====================================
// MENU UTAMA CLAN (LEADERBOARD)
// =====================================
export function openClanMenu(player) {
    const clanName = getPlayerClan(player);
    const clans = getClans();

    if (clanName === "") {
        const invites = getPlayerInvites(player);
        
        const clansList = Object.keys(clans).map(k => ({ name: k, data: clans[k] }));
        clansList.sort((a, b) => b.data.members.length - a.data.members.length);
        const top3 = clansList.slice(0, 3);

        let bodyText = `§fStatus: §cBelum Punya Clan\n§fUndangan Masuk: §a${invites.length}\n`;
        bodyText += "§7------------------------------\n";
        bodyText += "    §l§eLEADERBOARD TOP 3 CLAN§r\n\n";

        for (let i = 0; i < 3; i++) {
            if (top3[i]) {
                let clanData = top3[i].data;
                let totalMem = clanData.members.length + 1; 
                
                bodyText += `§l§aTop #${i+1} (${top3[i].name}) §8- §b${totalMem} Member§r\n`;
                bodyText += `§eLeader: §f${clanData.leader}\n`;
                
                if (clanData.members.length > 0) {
                    bodyText += `§3Member: §7${clanData.members.join(", ")}\n\n`;
                } else {
                    bodyText += `§3Member: §7Tidak ada\n\n`;
                }
            } else {
                bodyText += `§8Top #${i+1} (Kosong)\n\n`;
            }
        }

        const form = new ActionFormData()
            .title("CLAN SYSTEM")
            .body(bodyText) 
            .button("§lBuat Clan Baru", "textures/ui/anvil_icon")
            .button("§lCari & Gabung Clan", "textures/ui/magnifyingGlass")
            .button("§lCek Undangan", "textures/ui/mail_icon");
            
        forceShow(player, form, res => {
            if (res.canceled) return;
            if (res.selection === 0) createClanMenu(player);
            if (res.selection === 1) searchJoinClanMenu(player);
            if (res.selection === 2) viewInvitesMenu(player);
        });

    } else {
        const clanData = clans[clanName];
        if (!clanData) return; 
        
        const isLeader = clanData.leader === player.name;
        const reqCount = clanData.requests ? clanData.requests.length : 0;
        const pvpStatus = clanData.friendlyFire ? "§aAktif" : "§cMati";

        if (!clanData.messages) clanData.messages = [];
        const lastReadTime = player.getDynamicProperty("clan_chat_read") || 0;
        const unreadCount = clanData.messages.filter(msg => msg.time > lastReadTime).length;
        
        let chatBtnText = "§lClan Chat";
        let chatIcon = "textures/ui/message";
        if (unreadCount > 0) {
            chatBtnText = `§lClan Chat §c[${unreadCount} Baru]`;
            chatIcon = "textures/ui/mail_icon"; 
        }

        const form = new ActionFormData()
            .title(`CLAN: ${clanName}`)
            .body(`§7Leader: §e${clanData.leader}\n§7Member: §b${clanData.members.length + 1}/${getConfig().memberConfig.maxClanMembers}\n§7PvP Sesama Clan: ${pvpStatus}\n\n§rPilih aksi:`);

        form.button(chatBtnText, chatIcon); 
        form.button("§lDaftar Anggota", "textures/ui/FriendsIcon");
        
        if (isLeader) {
            form.button(`§lRequest Masuk (§c${reqCount}§0)`, "textures/items/paper");
            form.button("§lUndang Pemain", "textures/ui/invite_base");
            form.button("§lKick Anggota", "textures/ui/hammer_l");
            form.button("§lPengaturan PvP", "textures/items/iron_sword");
            form.button("§lGanti Nama Clan", "textures/ui/refresh_light");
            form.button("§l§cBubarkan Clan", "textures/ui/warning_alex");
        } else {
            form.button("§l§cKeluar dari Clan", "textures/ui/cancel");
        }

        forceShow(player, form, res => {
            if (res.canceled) return;
            if (res.selection === 0) openClanChatMenu(player, clanName, clanData);
            if (res.selection === 1) viewMembersMenu(player, clanName, clanData);
            
            if (isLeader) {
                if (res.selection === 2) reviewRequestsMenu(player, clanName, clanData);
                if (res.selection === 3) invitePlayerMenu(player, clanName);
                if (res.selection === 4) kickMemberMenu(player, clanName, clanData);
                if (res.selection === 5) clanSettingsMenu(player, clanName, clanData);
                if (res.selection === 6) renameClanMenu(player, clanName, clanData);
                if (res.selection === 7) disbandClanMenu(player, clanName);
            } else {
                if (res.selection === 2) leaveClanMenu(player, clanName);
            }
        });
    }
}

// ==========================================
// CLAN CHAT SYSTEM
// ==========================================
function openClanChatMenu(player, clanName, clanData) {
    player.setDynamicProperty("clan_chat_read", Date.now());

    const clans = getClans();
    const latestClanData = clans[clanName];
    const msgs = latestClanData.messages || [];
    let chatHistory = "";

    if (msgs.length === 0) {
        chatHistory = "§7Belum ada obrolan...\nJadilah yang pertama mengirim pesan!";
    } else {
        const recentMsgs = msgs.slice(-50);
        chatHistory = recentMsgs.map(m => {
            let d = new Date(m.time);
            let h = (d.getUTCHours() + 7) % 24; 
            let min = d.getUTCMinutes();
            let timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            let role = (latestClanData.leader === m.sender) ? "Owner" : "Member";

            return `§8[${timeStr}] §d[${role}] §e${m.sender}§f:\n§r${m.text}`;
        }).join("\n\n");
    }

    const form = new ActionFormData()
        .title("CHAT CLAN") 
        .body(chatHistory) 
        .button("§lKembali", "textures/ui/cancel") 
        .button("§lTulis Pesan", "textures/ui/pencil_edit_icon") 
        .button("§lHapus Pesan", "textures/ui/trash_default"); 

    forceShow(player, form, res => {
        if (res.canceled || res.selection === 0) return openClanMenu(player);
        if (res.selection === 1) writeClanMessageMenu(player, clanName);
        if (res.selection === 2) deleteClanMessageMenu(player, clanName);
    });
}

function writeClanMessageMenu(player, clanName) {
    const form = new ModalFormData()
        .title("Ketik Pesan")
        .textField("Kirim pesan ke anggota Clan:", "Contoh: Halo semua, ayo login!");

    forceShow(player, form, res => {
        const clans = getClans();
        if (res.canceled) return openClanChatMenu(player, clanName, clans[clanName]);
        
        let text = res.formValues[0].trim();
        if (text.length > 0) {
            if (!clans[clanName].messages) clans[clanName].messages = [];
            clans[clanName].messages.push({ sender: player.name, text: text, time: Date.now() });
            if (clans[clanName].messages.length > 50) clans[clanName].messages.shift();
            saveClans(clans);
            
            for (const p of world.getPlayers()) {
                if (getPlayerClan(p) === clanName && p.name !== player.name) {
                    p.sendMessage(`§d[Clan] §b${player.name}§f: ${text}`);
                    p.playSound("random.pop");
                }
            }
        }
        openClanChatMenu(player, clanName, getClans()[clanName]);
    });
}

function deleteClanMessageMenu(player, clanName) {
    const clans = getClans();
    const clanData = clans[clanName];
    const msgs = clanData.messages || [];
    const myMsgs = msgs.filter(m => m.sender === player.name);

    if (myMsgs.length === 0) {
        player.sendMessage("§e[Clan] Kamu belum pernah mengirim pesan apa pun.");
        return openClanChatMenu(player, clanName, clanData);
    }

    const form = new ActionFormData()
        .title("Hapus Pesan")
        .body("Pilih pesanmu yang ingin ditarik/dihapus secara permanen:");

    const reversedMsgs = [...myMsgs].reverse();
    reversedMsgs.forEach(m => {
        let shortText = m.text.length > 25 ? m.text.substring(0, 25) + "..." : m.text;
        let d = new Date(m.time);
        let h = (d.getUTCHours() + 7) % 24; 
        let min = d.getUTCMinutes();
        let timeStr = `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        form.button(`[${timeStr}] ${shortText}`, "textures/ui/trash_default");
    });
    form.button("§lKembali", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === reversedMsgs.length) {
            return openClanChatMenu(player, clanName, clanData);
        }
        const targetMsg = reversedMsgs[res.selection];
        clans[clanName].messages = clans[clanName].messages.filter(m => m.time !== targetMsg.time);
        saveClans(clans);
        player.sendMessage("§a[Clan] Pesan berhasil ditarik/dihapus!");
        openClanChatMenu(player, clanName, clans[clanName]);
    });
}

function clanSettingsMenu(player, clanName, clanData) {
    const isPvPOn = clanData.friendlyFire ?? false; 
    const form = new ActionFormData()
        .title("Pengaturan Clan")
        .body("Atur fitur clan di bawah ini:")
        .button(`PvP Sesama Clan: ${isPvPOn ? "§a[ON]" : "§c[OFF]"}`, "textures/items/iron_sword")
        .button("§lKembali", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === 1) return openClanMenu(player);
        const clans = getClans();
        clans[clanName].friendlyFire = !isPvPOn;
        saveClans(clans);
        player.sendMessage(`§e[Clan] §fPvP sesama clan berhasil ${!isPvPOn ? "§aDINYALAKAN" : "§cDIMATIKAN"}.`);
        clanSettingsMenu(player, clanName, clans[clanName]); 
    });
}

function searchJoinClanMenu(player) {
    const clans = getClans();
    const activeClans = Object.keys(clans).filter(k => !clans[k].renamedTo);
    if (activeClans.length === 0) return player.sendMessage("§c[Clan] Belum ada clan yang berdiri di server ini.");
    const form = new ActionFormData().title("Cari Clan").body("Pilih clan untuk mengirim permintaan bergabung:");
    activeClans.forEach(cName => form.button(`§l${cName}\n§r§8Leader: ${clans[cName].leader}`));
    forceShow(player, form, res => {
        if (res.canceled) return openClanMenu(player);
        const targetClan = activeClans[res.selection];
        const db = getClans();
        if (!db[targetClan].requests) db[targetClan].requests = [];
        if (db[targetClan].requests.includes(player.name)) return player.sendMessage("§e[Clan] Kamu sudah mengirim permintaan ke clan ini.");
        db[targetClan].requests.push(player.name);
        saveClans(db);
        player.sendMessage(`§a[Clan] Permintaan bergabung telah dikirim ke Clan §e${targetClan}§a.`);
    });
}

function reviewRequestsMenu(player, clanName, clanData) {
    const reqs = clanData.requests || [];
    if (reqs.length === 0) {
        player.sendMessage("§e[Clan] Tidak ada pemain yang meminta bergabung saat ini.");
        return openClanMenu(player);
    }
    const form = new ActionFormData().title("Request Bergabung");
    reqs.forEach(req => form.button(`Terima/Tolak:\n§8${req}`));
    forceShow(player, form, res => {
        if (res.canceled) return openClanMenu(player);
        const targetReq = reqs[res.selection];
        const subForm = new ActionFormData().title("Kelola Request").body(`Pemain §e${targetReq} §ringin masuk ke clanmu.`).button("§l§aTERIMA").button("§l§cTOLAK");
        forceShow(player, subForm, action => {
            if (action.canceled) return openClanMenu(player);
            const db = getClans();
            db[clanName].requests = (db[clanName].requests || []).filter(r => r !== targetReq);
            if (action.selection === 0) { 
                if (db[clanName].members.length + 1 >= getConfig().memberConfig.maxClanMembers) {
                    saveClans(db); return player.sendMessage("§c[Clan] Clan kamu sudah penuh!");
                }
                db[clanName].members.push(targetReq); saveClans(db);
                player.sendMessage(`§a[Clan] Berhasil menerima ${targetReq}!`);
                const p = world.getPlayers({name: targetReq})[0];
                if (p) { 
                    setPlayerClan(p, `§b${clanName}`); // FIX MENGGUNAKAN setPlayerClan
                    p.sendMessage(`§a[Clan] Request diterima, kamu sekarang anggota Clan ${clanName}.`); 
                }
            } else { 
                saveClans(db); player.sendMessage(`§c[Clan] Menolak request ${targetReq}.`);
            }
        });
    });
}

// ==========================================
// TRANSAKSI UANG (SCOREBOARD CONNECTED)
// ==========================================
export function renameClanMenu(player, oldClanName, clanData) {
    const config = getConfig().memberConfig;
    const now = Date.now();
    const cooldownMs = (config.clanRenameCooldown || 7) * 86400000; 
    
    if (now - (clanData.lastRenamed || 0) < cooldownMs) {
        return player.sendMessage(`§c[Clan] Kamu baru bisa mengganti nama clan ${Math.ceil((cooldownMs - (now - (clanData.lastRenamed || 0))) / 86400000)} hari lagi.`);
    }
    
    const money = getScoreMoney(player);
    const cost = config.clanRenameCost || 0;
    
    const form = new ModalFormData()
        .title("Ganti Nama Clan")
        .textField(`Biaya: $${cost}\nUangmu: $${money}\n\nMasukkan Nama Baru:`, "Maks. 5 Huruf");
        
    forceShow(player, form, res => {
        if (res.canceled) return openClanMenu(player);
        let newClan = res.formValues[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase(); 
        
        if (newClan.length === 0 || newClan.length > 5) return player.sendMessage("§c[Clan] Nama harus 1-5 huruf!");
        if (money < cost) return player.sendMessage("§c[Clan] Uang Scoreboard kamu tidak cukup!");
        
        const clans = getClans();
        if (clans[newClan]) return player.sendMessage("§c[Clan] Nama clan sudah dipakai!");
        
        deductScoreMoney(player, cost); // Potong uang Scoreboard
        
        clans[newClan] = { ...clanData, lastRenamed: now };
        clans[oldClanName] = { renamedTo: newClan }; 
        saveClans(clans);
        
        [clanData.leader, ...clanData.members].forEach(mName => {
            const p = world.getPlayers({name: mName})[0];
            if (p) setPlayerClan(p, `§b${newClan}`); // FIX MENGGUNAKAN setPlayerClan
        });
        player.sendMessage(`§a[Clan] Berhasil mengganti nama clan menjadi §b[${newClan}]§a!`);
    });
}

export function createClanMenu(player) {
    const config = getConfig().memberConfig;
    const cost = config.clanCreateCost || 0;
    const money = getScoreMoney(player); 

    const form = new ModalFormData()
        .title("Buat Clan Baru")
        .textField(`Biaya Buat: $${cost}\nUang Scoreboard Kamu: $${money}\n\nTAG Clan (Maks 5 Huruf):`, "PRO");
        
    forceShow(player, form, res => {
        if (res.canceled) return openClanMenu(player);
        
        if (money < cost) return player.sendMessage("§c[Clan] Uang Scoreboard kamu tidak cukup untuk membuat Clan!");

        let newClan = res.formValues[0].replace(/[^a-zA-Z0-9]/g, "").toUpperCase(); 
        if (newClan.length === 0 || newClan.length > 5) return player.sendMessage("§c[Clan] Gagal! Tag Clan harus 1 - 5 huruf.");
        
        const clans = getClans();
        if (clans[newClan]) return player.sendMessage("§c[Clan] Nama sudah dipakai!");
        
        deductScoreMoney(player, cost); // Potong uang Scoreboard

        clans[newClan] = { leader: player.name, members: [], friendlyFire: false, messages: [] };
        saveClans(clans);
        setPlayerClan(player, `§b${newClan}`); // FIX MENGGUNAKAN setPlayerClan
        player.sendMessage(`§a[Clan] Berhasil mendirikan Clan §b[${newClan}]§a.`);
    });
}

function viewInvitesMenu(player) {
    const invites = getPlayerInvites(player);
    if (invites.length === 0) { player.sendMessage("§e[Clan] Tidak ada undangan."); return openClanMenu(player); }
    const form = new ActionFormData().title("Undangan").body("Pilih clan untuk masuk:");
    invites.forEach(inv => form.button(`Gabung: ${inv}`));
    forceShow(player, form, res => {
        if (res.canceled) return openClanMenu(player);
        const target = invites[res.selection];
        savePlayerInvites(player, invites.filter(i => i !== target));
        const clans = getClans();
        if (!clans[target]) return player.sendMessage(`§c[Clan] Clan sudah bubar.`);
        clans[target].members.push(player.name); saveClans(clans);
        setPlayerClan(player, `§b${target}`); // FIX MENGGUNAKAN setPlayerClan
        player.sendMessage(`§a[Clan] Resmi bergabung dengan Clan §b[${target}]§a!`);
    });
}

function viewMembersMenu(player, clanName, clanData) {
    const list = [`§e[Leader] ${clanData.leader}`];
    clanData.members.forEach(m => list.push(`§7- ${m}`));
    const form = new ActionFormData().title(`Anggota ${clanName}`).body(list.join("\n")).button("Kembali");
    forceShow(player, form, () => openClanMenu(player));
}

function invitePlayerMenu(player, clanName) {
    const players = [...world.getPlayers()].filter(p => p.name !== player.name && getPlayerClan(p) === "");
    const pNames = players.map(p => p.name);
    if (pNames.length === 0) return player.sendMessage("§c[Clan] Semua pemain online sudah punya clan.");
    const form = new ModalFormData().title("Undang ke Clan").dropdown("Pilih pemain online:", pNames);
    forceShow(player, form, res => {
        if (res.canceled) return openClanMenu(player);
        const targetPlayer = players[res.formValues[0]];
        const invites = getPlayerInvites(targetPlayer);
        if (!invites.includes(clanName)) {
            invites.push(clanName); savePlayerInvites(targetPlayer, invites);
            targetPlayer.sendMessage(`§a[Clan] Undangan masuk ke Clan §e[${clanName}]§a! Cek Menu.`);
        }
        player.sendMessage(`§a[Clan] Undangan terkirim ke §e${targetPlayer.name}§a.`);
    });
}

function kickMemberMenu(player, clanName, clanData) {
    if (clanData.members.length === 0) return player.sendMessage("§c[Clan] Belum ada anggota.");
    const form = new ModalFormData().title("Kick Anggota").dropdown("Pilih anggota:", clanData.members);
    forceShow(player, form, res => {
        if (res.canceled) return openClanMenu(player);
        const targetName = clanData.members[res.formValues[0]];
        const clans = getClans();
        clans[clanName].members = clans[clanName].members.filter(m => m !== targetName); saveClans(clans);
        const targetPlayer = world.getPlayers({ name: targetName })[0];
        if (targetPlayer) { 
            setPlayerClan(targetPlayer, ""); // FIX MENGGUNAKAN setPlayerClan
            targetPlayer.sendMessage(`§c[Clan] Dikeluarkan dari Clan.`); 
        }
        player.sendMessage(`§a[Clan] Berhasil kick §e${targetName}§a.`);
    });
}

function leaveClanMenu(player, clanName) {
    const form = new MessageFormData().title("Keluar").body(`Yakin keluar dari ${clanName}?`).button1("§l§cYA").button2("§lBATAL");
    forceShow(player, form, res => {
        if (res.selection === 1 || res.canceled) return openClanMenu(player);
        const clans = getClans();
        if (clans[clanName]) { clans[clanName].members = clans[clanName].members.filter(m => m !== player.name); saveClans(clans); }
        setPlayerClan(player, ""); // FIX MENGGUNAKAN setPlayerClan
        player.sendMessage(`§c[Clan] Kamu keluar dari clan.`);
    });
}

function disbandClanMenu(player, clanName) {
    const form = new MessageFormData().title("BUBARKAN").body(`Yakin bubarkan ${clanName}? Ini permanen!`).button1("§l§cBUBARKAN").button2("BATAL");
    forceShow(player, form, res => {
        if (res.selection === 1 || res.canceled) return openClanMenu(player);
        const clans = getClans();
        clans[clanName].members.forEach(mName => {
            const p = world.getPlayers({ name: mName })[0];
            if (p) { 
                setPlayerClan(p, ""); // FIX MENGGUNAKAN setPlayerClan
                p.sendMessage(`§c[Clan] Clan dibubarkan Leader.`); 
            }
        });
        delete clans[clanName]; saveClans(clans);
        setPlayerClan(player, ""); // FIX MENGGUNAKAN setPlayerClan
        player.sendMessage(`§a[Clan] Clan dibubarkan.`);
    });
}