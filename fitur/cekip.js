const axios = require('axios');

module.exports = async (sock, msg, command, args) => {
    const { remoteJid } = msg.key;
    const ip = args[0];

    if (!ip) {
        return sock.sendMessage(remoteJid, { text: '⚠️ Masukkan IP yang ingin dicek!\nContoh: .cekip 114.124.186.23' });
    }

    try {
        const res = await axios.get(`http://ip-api.com/json/${ip}`);
        const data = res.data;

        if (data.status !== 'success') {
            return sock.sendMessage(remoteJid, { text: '❌ Gagal menemukan lokasi untuk IP tersebut!' });
        }

        const teks = `📍 *Informasi Lokasi dari IP:* \`${ip}\`\n\n` +
            `🌐 *Negara:* ${data.country} ${data.countryCode ? `:flag_${data.countryCode.toLowerCase()}:` : ''}\n` +
            `🏙️ *Kota:* ${data.city}\n` +
            `🏢 *ISP:* ${data.isp}\n` +
            `📡 *Koordinat:* ${data.lat}, ${data.lon}\n` +
            `📍 *Google Maps:* https://maps.google.com/?q=${data.lat},${data.lon}`;

        await sock.sendMessage(remoteJid, { text: teks });
    } catch (e) {
        await sock.sendMessage(remoteJid, { text: '⚠️ Terjadi kesalahan saat mengambil data IP.' });
    }
};
