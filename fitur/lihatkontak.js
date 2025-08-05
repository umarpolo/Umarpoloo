const fs = require('fs');
const path = require('path');

module.exports = async (sock, msg, command, args) => {
    const reply = (teks) => sock.sendMessage(msg.key.remoteJid, { text: teks }, { quoted: msg });
    const filePath = path.join(__dirname, '../kontak.json');

    if (!fs.existsSync(filePath)) return reply('📭 Belum ada kontak yang disimpan.');

    const data = fs.readFileSync(filePath);
    let daftarKontak = [];

    try {
        daftarKontak = JSON.parse(data);
    } catch (e) {
        return reply('❌ Gagal membaca file kontak.');
    }

    if (daftarKontak.length === 0) return reply('📭 Belum ada kontak yang disimpan.');

    let teks = '📇 *Daftar Kontak Tersimpan:*\n\n';
    daftarKontak.forEach((k, i) => {
        teks += `${i + 1}. ${k.nama} (${k.nomor})\n`;
    });
    teks += `\nTotal: ${daftarKontak.length} kontak`;

    reply(teks);
};
