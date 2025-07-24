const axios = require('axios');

module.exports = async (sock, msg, command, args) => {
    try {
        const emoji1 = args[0];
        const emoji2 = args[1];

        if (!emoji1 || !emoji2) return msg.reply('❗ Contoh: .emojimix 😅 😎');

        // Convert emoji ke unicode format (e.g. U+1F60A jadi u1f60a)
        const toUnicode = (emoji) => {
            return [...emoji].map(c => 'u' + c.codePointAt(0).toString(16)).join('_');
        };

        const u1 = toUnicode(emoji1);
        const u2 = toUnicode(emoji2);
        const version = '20201001'; // Versi stabil dari Emojikitchen

        const url = `https://www.gstatic.com/android/keyboard/emojikitchen/${version}/${u1.split('_')[0]}/${u1}_${u2}.png`;

        // Cek apakah gambar valid (status 200)
        const check = await axios.head(url);
        if (check.status !== 200) return msg.reply('❌ Kombinasi tidak ditemukan.');

        const img = await axios.get(url, { responseType: 'arraybuffer' }).then(res => res.data);

        await sock.sendMessage(msg.key.remoteJid, {
            image: img,
            caption: `🌀 Emojimix dari:\n${emoji1} + ${emoji2}`
        }, { quoted: msg });

    } catch (err) {
        console.log('❌ Emojimix Error:', err.message);
        return msg.reply('❌ Gagal mengambil gambar dari Emojikitchen.');
    }
}
