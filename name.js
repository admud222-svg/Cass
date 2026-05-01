import { getConfig } from "./config.js";
import { resolvePlaceholders } from "./placeholder.js";

export function updateNametag(player) {
    // 1. CEK SAKLAR SETTING: Jika player menyembunyikan custom nametag
    if (player.hasTag("setting_hide_custom_name")) {
        // Kembalikan nametag ke nama aslinya saja
        if (player.nameTag !== player.name) {
            player.nameTag = player.name; 
        }
        return; // Berhenti di sini, jangan lanjut ke kode bawah
    }

    // 2. JIKA SAKLAR MATI: Gunakan format Custom dari Admin
    const config = getConfig();
    const newTag = resolvePlaceholders(config.nametagFormat, player);
    
    if (player.nameTag !== newTag) {
        player.nameTag = newTag;
    }
}