import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";
import { system, world } from "@minecraft/server";
import { getBankBalance, setBankBalance, getBankTransactions, addBankTransaction } from "./bank_db.js";

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

function getWalletBalance(player) {
    try {
        const moneyObj = world.scoreboard.getObjective("money");
        return moneyObj ? (moneyObj.getScore(player) || 0) : 0;
    } catch(e) { return 0; }
}

function setWalletBalance(player, amount) {
    try {
        const moneyObj = world.scoreboard.getObjective("money");
        if (moneyObj) moneyObj.setScore(player, Math.floor(amount));
    } catch(e) {}
}

// FUNGSI METRIC NUMBER
function formatMetric(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(1).replace(/\.0$/, '') + 'T'; 
    if (num >= 1e9) return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';  
    if (num >= 1e6) return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';  
    if (num >= 1e3) return (num / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';  
    return num.toString();
}

// ==========================================
// 1. MENU UTAMA BANK
// ==========================================
export function openBankMenu(player) {
    const bankBal = getBankBalance(player.name);
    const walletBal = getWalletBalance(player);

    const form = new ActionFormData()
        .title("§lSERVER BANK")
        // MENGGUNAKAN formatMetric() DI SINI
        .body(`Selamat datang di Bank!\n\n§fDompet (Cash): §a$${formatMetric(walletBal)}\n§fSaldo Bank: §e$${formatMetric(bankBal)}§r\n\nPilih transaksi yang ingin dilakukan:`)
        .button(`§lMy Bank (Riwayat)\n§r§8Cek Saldo & Mutasi`, "textures/ui/magnifyingGlass")
        .button(`§lDeposit\n§r§8Simpan uang ke Bank`, "textures/ui/arrow_down")
        .button(`§lWithdraw\n§r§8Tarik uang dari Bank`, "textures/ui/arrow_up");

    forceShow(player, form, res => {
        if (res.canceled) return;
        if (res.selection === 0) menuBankHistory(player);
        if (res.selection === 1) menuDeposit(player, walletBal, bankBal);
        if (res.selection === 2) menuWithdraw(player, walletBal, bankBal);
    });
}

// ==========================================
// 2. MY BANK (HISTORY TRANSAKSI)
// ==========================================
function menuBankHistory(player) {
    const trxs = getBankTransactions(player.name);
    const bankBal = getBankBalance(player.name);

    const form = new ActionFormData()
        .title("§lMUTASI REKENING")
        .body(`Saldo Akhir: §e$${formatMetric(bankBal)}§r\n\nRiwayat Transaksi Terakhir:`);

    if (trxs.length === 0) form.body(`Saldo Akhir: §e$${formatMetric(bankBal)}§r\n\n§cBelum ada riwayat transaksi.`);

    trxs.forEach(trx => {
        let icon = trx.type === "DEPOSIT" ? "textures/ui/arrow_down" : "textures/ui/arrow_up";
        let color = trx.type === "DEPOSIT" ? "§2[+] " : "§c[-] ";
        form.button(`§l${color}${trx.type}\n§r§8${trx.date} | $${formatMetric(trx.amount)}`, icon);
    });

    form.button("Kembali", "textures/ui/cancel");

    forceShow(player, form, res => {
        if (res.canceled || res.selection === trxs.length) return openBankMenu(player);
        menuTransactionDetail(player, trxs[res.selection]);
    });
}

// DETAIL TRANSAKSI
function menuTransactionDetail(player, trx) {
    let color = trx.type === "DEPOSIT" ? "§a" : "§c";
    let sign = trx.type === "DEPOSIT" ? "+" : "-";

    // Pada E-Receipt, angka tetap ditulis utuh agar realistis
    const form = new MessageFormData()
        .title("DETAIL TRANSAKSI")
        .body(`§e=== MINEKINGS E-RECEIPT ===§r\n\n§fID Transaksi: §b${trx.id}\n§fTanggal: §7${trx.date}\n§fJenis: ${color}${trx.type}§r\n§fNominal: ${color}${sign}$${trx.amount.toLocaleString('id-ID')}§r\n§fStatus: §aSUCCESS (Berhasil)§r\n\n§e===========================`)
        .button1("Tutup (Cetak Struk)")
        .button2("Kembali ke Riwayat");

    forceShow(player, form, res => {
        if (res.selection === 0 || res.canceled) return openBankMenu(player);
        if (res.selection === 1) return menuBankHistory(player);
    });
}

// ==========================================
// 3. DEPOSIT
// ==========================================
function menuDeposit(player, walletBal, bankBal) {
    const form = new ModalFormData()
        .title("DEPOSIT UANG")
        .textField(`Dompetmu: §a$${formatMetric(walletBal)}§r\nMasukkan jumlah yang ingin disimpan:\n§8(Ketik 'all' untuk setor semua)`, "Contoh: 50000");

    forceShow(player, form, res => {
        if (res.canceled) return openBankMenu(player);
        let input = res.formValues[0].trim().toLowerCase();
        let amount = input === "all" ? walletBal : parseInt(input);

        if (isNaN(amount) || amount <= 0) {
            player.sendMessage("§c[Bank] Masukkan angka nominal yang valid!");
            return openBankMenu(player);
        }
        if (amount > walletBal) {
            player.sendMessage("§c[Bank] Uang di dompetmu tidak cukup!");
            return openBankMenu(player);
        }

        setWalletBalance(player, walletBal - amount);
        setBankBalance(player.name, bankBal + amount);
        addBankTransaction(player.name, "DEPOSIT", amount);

        player.sendMessage(`§a[Bank] Berhasil menyetor §e$${formatMetric(amount)} §ake Bank!`);
        player.playSound("random.levelup");
        openBankMenu(player);
    });
}

// ==========================================
// 4. WITHDRAW
// ==========================================
function menuWithdraw(player, walletBal, bankBal) {
    const form = new ModalFormData()
        .title("TARIK UANG")
        .textField(`Saldo Bank: §e$${formatMetric(bankBal)}§r\nMasukkan jumlah yang ingin ditarik:\n§8(Ketik 'all' untuk tarik semua)`, "Contoh: 50000");

    forceShow(player, form, res => {
        if (res.canceled) return openBankMenu(player);
        let input = res.formValues[0].trim().toLowerCase();
        let amount = input === "all" ? bankBal : parseInt(input);

        if (isNaN(amount) || amount <= 0) {
            player.sendMessage("§c[Bank] Masukkan angka nominal yang valid!");
            return openBankMenu(player);
        }
        if (amount > bankBal) {
            player.sendMessage("§c[Bank] Saldo di bankmu tidak cukup!");
            return openBankMenu(player);
        }

        setBankBalance(player.name, bankBal - amount);
        setWalletBalance(player, walletBal + amount);
        addBankTransaction(player.name, "WITHDRAW", amount);

        player.sendMessage(`§a[Bank] Berhasil menarik §e$${formatMetric(amount)} §adari Bank!`);
        player.playSound("random.pop");
        openBankMenu(player);
    });
}