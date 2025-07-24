const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '../database/penutup.json');

module.exports = async (sock, msg, command, args) => {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes('6282121588338'); // Ganti jika owner beda

    if (!isOwner) {
        return sock.sendMessage(from, { text: '❌ Hanya owner yang bisa mengatur penutup.' }, { quoted: msg });
    }

    const teks = args.join(' ');
    if (!teks) {
        return sock.sendMessage(from, { text: '❌ Format salah.\nContoh: *.setpenutup Terima kasih sudah chat bot!*' }, { quoted: msg });
    }

    try {
        fs.writeFileSync(filePath, JSON.stringify({ penutup: teks }, null, 2));
        await sock.sendMessage(from, { text: `✅ Penutup berhasil diatur menjadi:\n\n"${teks}"` }, { quoted: msg });
    } catch (err) {
        console.error(err);
        await sock.sendMessage(from, { text: '❌ Gagal menyimpan penutup.' }, { quoted: msg });
    }
};

