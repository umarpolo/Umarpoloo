const fs = require('fs');
const path = require('path');

module.exports = async (sock, msg, command, args) => {
    const reply = (teks) => sock.sendMessage(msg.key.remoteJid, { text: teks }, { quoted: msg });

    if (args.length < 2) return reply('❌ Format salah!\nContoh: .savekontak 6281234567890 Budi_Tampan');

    const nomor = args[0].replace(/\D/g, '');
    const nama = args.slice(1).join(' ').replace(/_/g, ' ');
    const waktu = new Date().toISOString();

    const kontakBaru = { nomor, nama, waktu };

    const filePath = path.join(__dirname, '../kontak.json');
    let kontakList = [];

    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath);
            kontakList = JSON.parse(data);
        }
    } catch (e) {
        return reply('❌ Gagal membaca data kontak.');
    }

    // Cek duplikat
    const sudahAda = kontakList.find(k => k.nomor === nomor);
    if (sudahAda) return reply('⚠️ Kontak sudah ada dalam database.');

    kontakList.push(kontakBaru);

    try {
        fs.writeFileSync(filePath, JSON.stringify(kontakList, null, 2));
        reply(`✅ Kontak *${nomor} (${nama})* berhasil disimpan!`);
    } catch (e) {
        reply('❌ Gagal menyimpan kontak.');
    }
};
