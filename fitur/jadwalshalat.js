const axios = require('axios');

module.exports = async (sock, msg, command, args) => {
    const from = msg.key?.remoteJid;
    const query = args.join(' ').toLowerCase();

    if (!query) {
        return sock.sendMessage(from, { text: 'Masukkan nama kabupaten.\nContoh: .jadwalshalat aceh tamiang' }, { quoted: msg });
    }

    try {
        const kotaRes = await axios.get('https://api.myquran.com/v2/sholat/kota/semua');
        const kotaList = kotaRes.data.data;
        const kota = kotaList.find(k => k.lokasi.toLowerCase().includes(query));
        if (!kota) {
            return sock.sendMessage(from, { text: `Kabupaten "${query}" tidak ditemukan.` }, { quoted: msg });
        }

        const idKota = kota.id;
        const namaLokasi = kota.lokasi;
        const tanggal = new Date().toISOString().split('T')[0];
        const jadwalRes = await axios.get(`https://api.myquran.com/v2/sholat/jadwal/${idKota}/${tanggal}`);
        const j = jadwalRes.data.data.jadwal;

        const teks = `🕌 *Jadwal Shalat Hari Ini*\n📍 *${namaLokasi}*\n📆 ${j.tanggal}\n\n` +
                     `⏰ Imsak: ${j.imsak}\n` +
                     `🌅 Subuh: ${j.subuh}\n` +
                     `🌤️ Dzuhur: ${j.dzuhur}\n` +
                     `🌇 Ashar: ${j.ashar}\n` +
                     `🌆 Maghrib: ${j.maghrib}\n` +
                     `🌃 Isya: ${j.isya}`;

        await sock.sendMessage(from, { text: teks }, { quoted: msg });

    } catch (err) {
        console.error('Jadwal shalat error:', err);
        await sock.sendMessage(from, { text: 'Gagal mengambil data jadwal shalat. Coba lagi nanti.' }, { quoted: msg });
    }
};
