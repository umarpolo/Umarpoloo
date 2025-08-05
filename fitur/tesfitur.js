const fs = require('fs');
const path = require('path');

module.exports = async (sock, msg, command, args) => {
    const from = msg.key.remoteJid;
    const isOwner = from === '6282121588338@s.whatsapp.net'; // ganti sesuai owner utama
    if (!isOwner) return sock.sendMessage(from, { text: '❌ Fitur ini hanya untuk owner.' });

    const fiturName = args[0];
    if (!fiturName) return sock.sendMessage(from, { text: '⚠️ Format salah. Contoh: .tesfitur gombal' });

    const fiturPath = path.join(__dirname, `${fiturName}.js`);
    if (!fs.existsSync(fiturPath)) {
        return sock.sendMessage(from, { text: `❌ File fitur *${fiturName}.js* tidak ditemukan.` });
    }

    try {
        require(fiturPath);
        sock.sendMessage(from, { text: `✅ Fitur *${fiturName}.js* berhasil dipanggil tanpa error.` });
    } catch (err) {
        sock.sendMessage(from, { text: `❌ Gagal memanggil fitur *${fiturName}.js*:\n\n${err.message}` });
    }
};
