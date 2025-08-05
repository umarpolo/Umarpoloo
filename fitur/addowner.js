const fs = require('fs');
const path = require('path');

const ownerFile = path.join(__dirname, '../database/owner.json');
const ownerUtama = '6282121588338'; // Ganti jika owner utama berbeda

module.exports = async (sock, msg, command, args) => {
    const sender = msg.key.participant || msg.key.remoteJid;
    const from = msg.key.remoteJid;
    const nomorPengirim = sender.split('@')[0];

    if (nomorPengirim !== ownerUtama) {
        await sock.sendMessage(from, { text: '❌ Hanya owner utama yang bisa menambahkan owner baru!' }, { quoted: msg });
        return;
    }

    if (!args[0]) {
        await sock.sendMessage(from, { text: '📌 Format: .addowner <nomor>' }, { quoted: msg });
        return;
    }

    const noBaru = args[0].replace(/\D/g, ''); // Hanya angka
    if (!/^(\d{5,20})$/.test(noBaru)) {
        await sock.sendMessage(from, { text: '❌ Nomor tidak valid!' }, { quoted: msg });
        return;
    }

    let dataOwner = [];
    if (fs.existsSync(ownerFile)) {
        try {
            dataOwner = JSON.parse(fs.readFileSync(ownerFile));
        } catch {
            dataOwner = [];
        }
    }

    if (dataOwner.includes(noBaru)) {
        await sock.sendMessage(from, { text: `⚠️ Nomor ${noBaru} sudah terdaftar sebagai owner.` }, { quoted: msg });
        return;
    }

    dataOwner.push(noBaru);
    fs.writeFileSync(ownerFile, JSON.stringify(dataOwner, null, 2));
    await sock.sendMessage(from, { text: `✅ Nomor ${noBaru} berhasil ditambahkan sebagai owner.` }, { quoted: msg });
};
