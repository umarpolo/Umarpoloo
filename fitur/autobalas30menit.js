// fitur/autobalas30menit.js

const fs = require('fs');
const STATUS_PATH = './fitur/.forwardstatus.json';

const db = {}; // Simpan waktu terakhir balasan untuk tiap nomor

module.exports = async (sock, msg) => {
    // Cek status aktif
    if (fs.existsSync(STATUS_PATH)) {
        const { aktif } = JSON.parse(fs.readFileSync(STATUS_PATH));
        if (!aktif) return; // skip jika status nonaktif
    }

    const sender = msg.key.remoteJid;
    const pesan = msg.message?.conversation ||
                  msg.message?.extendedTextMessage?.text ||
                  msg.message?.imageMessage?.caption ||
                  msg.message?.videoMessage?.caption ||
                  msg.message?.documentMessage?.caption || '';

    // Hanya tanggapi pesan dari chat pribadi (bukan grup)
    if (!sender.endsWith('@s.whatsapp.net')) return;

    // Abaikan jika pesan diawali titik (perintah)
    if (pesan.trim().startsWith('.')) return;

    const now = Date.now();
    const last = db[sender] || 0;

    // Cek apakah sudah lebih dari 30 menit (1800 detik) sejak terakhir dibalas
    if (now - last > 30 * 60 * 1000) {
        db[sender] = now;
        await sock.sendMessage(sender, {
            text: '*Saya adalah asistennya Umar. Mohon tunggu sebentar ya, bos saya akan segera membalas pesan kamu.*'
        });
    }
};

