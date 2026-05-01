import QuickDB from "../../system/qidb/database.js";

const bankBalDB = new QuickDB("bank_bal", "local");
const bankTrxDB = new QuickDB("bank_trx", "local");

export function getBankBalance(playerName) { return bankBalDB.get(playerName) ?? 0; }
export function setBankBalance(playerName, amount) { bankBalDB.set(playerName, Math.floor(amount)); }
export function getBankTransactions(playerName) { return bankTrxDB.get(playerName) ?? []; }

export function addBankTransaction(playerName, type, amount) {
    let trxs = getBankTransactions(playerName);
    const dateObj = new Date();
    const dateStr = `${dateObj.getDate().toString().padStart(2,'0')}/${(dateObj.getMonth()+1).toString().padStart(2,'0')}/${dateObj.getFullYear()} ${dateObj.getHours().toString().padStart(2,'0')}:${dateObj.getMinutes().toString().padStart(2,'0')}`;
    const trxId = "TRX-" + Math.random().toString(36).substr(2, 6).toUpperCase() + "-" + dateObj.getSeconds();

    trxs.unshift({ id: trxId, type: type, amount: parseInt(amount), date: dateStr, timestamp: Date.now() });
    if (trxs.length > 30) trxs.pop(); 
    bankTrxDB.set(playerName, trxs);
}

export function getAllBankPlayers() { return bankBalDB.keys(); }
export function resetPlayerBank(playerName) { bankBalDB.delete(playerName); bankTrxDB.delete(playerName); }
export function resetAllBanks() { bankBalDB.keys().forEach(k => bankBalDB.delete(k)); bankTrxDB.keys().forEach(k => bankTrxDB.delete(k)); }