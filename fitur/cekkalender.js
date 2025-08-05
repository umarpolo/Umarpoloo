const axios = require('axios');
const moment = require('moment');

module.exports = async (sock, msg, command, args) => {
    const from = msg.key.remoteJid;
    console.log('[LOG] Perintah .cekkalender dipanggil');

    // Format tanggal ke DD-MM-YYYY (sesuai dokumentasi API Aladhan)
    const today = moment().format('DD-MM-YYYY');

    try {
        const res = await axios.get(`https://api.aladhan.com/v1/gToH?date=${today}`);
        const data = res.data.data;

        const gregorian = data.gregorian;
        const hijri = data.hijri;

        const hasil = `📅 *Kalender Hari Ini*\n\n` +
            `📆 *Masehi:* ${gregorian.date} (${gregorian.weekday.en})\n` +
            `🕌 *Hijriah:* ${hijri.date} (${hijri.weekday.en})\n\n` +
            `🗓️ Bulan Hijriah: ${hijri.month.en}\n` +
            `🗓️ Tahun Hijriah: ${hijri.year}\n` +
            `📌 Deskripsi Hari: ${hijri.holidays.length > 0 ? hijri.holidays.join(', ') : 'Tidak ada'}`;

        await sock.sendMessage(from, { text: hasil }, { quoted: msg });
    } catch (err) {
        console.error('[ERROR] Gagal mengambil data kalender:', err.message);
        await sock.sendMessage(from, { text: 'Gagal mengambil data kalender. Coba lagi nanti.' }, { quoted: msg });
    }
};
