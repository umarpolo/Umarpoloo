const axios = require('axios');

module.exports = async (sock, msg, command, args) => {
    if (!args.length) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: '❓ Ketik `.wiki <kata kunci>` untuk mencari informasi dari Wikipedia.'
        }, { quoted: msg });
    }

    const query = args.join(' ');
    const apiUrl = `https://id.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;

    try {
        const res = await axios.get(apiUrl);
        const data = res.data;

        if (data.type === 'disambiguation') {
            return sock.sendMessage(msg.key.remoteJid, {
                text: `🔎 Hasil terlalu umum. Coba lebih spesifik.\n\n${data.extract}`
            }, { quoted: msg });
        }

        const text = `📚 *Wikipedia: ${data.title}*\n\n${data.extract}\n\n🔗 ${data.content_urls?.desktop?.page || 'https://id.wikipedia.org/wiki/' + encodeURIComponent(query)}`;
        await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg });

    } catch (e) {
        console.error('Gagal ambil info Wikipedia:', e.message);
        await sock.sendMessage(msg.key.remoteJid, {
            text: '❌ Gagal mengambil informasi. Coba kata lain atau periksa koneksi.'
        }, { quoted: msg });
    }
};
