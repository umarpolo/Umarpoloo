const fs = require('fs');
const path = './kontak.json';

module.exports = async (sock, msg, command, args) => {
    const from = msg.key.remoteJid;
    const reply = (teks) => sock.sendMessage(from, { text: teks }, { quoted: msg });

    // Cek format
    if (args.length < 2) return reply('⚠️ Format salah!\nContoh: .kirimke <namakontak> <pesan>');

    // Ambil nama & isi pesan
    const namaKontak = args[0].toLowerCase();
    const isiPesan = args.slice(1).join(' ');

    // Baca file kontak
    let daftarKontak = [];
    if (fs.existsSync(path)) {
        try {
            daftarKontak = JSON.parse(fs.readFileSync(path));
        } catch {
            return reply('❌ Gagal membaca data kontak.');
        }
    }

    // Cari kontak berdasarkan nama
    const kontakTemu = daftarKontak.find(k => k.nama.toLowerCase() === namaKontak);
    if (!kontakTemu) return reply(`❌ Kontak dengan nama *${namaKontak}* tidak ditemukan.`);

    const nomorTujuan = kontakTemu.nomor + '@s.whatsapp.net';

    // Kirim pesan ke kontak
    try {
        await sock.sendMessage(nomorTujuan, { text: `_*Halo, ada pesan masuk nih dari seseorang!*_\n\n${isiPesan}` });
        await reply(`✅ Pesan berhasil dikirim ke *${kontakTemu.nama}* (${kontakTemu.nomor})`);
    } catch {
        reply('❌ Gagal mengirim pesan. Mungkin nomor tidak aktif atau bot belum pernah chat dengannya.');
    }
};
