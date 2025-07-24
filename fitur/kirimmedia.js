const { downloadMediaMessage } = require('@whiskeysockets/baileys');

module.exports = async (sock, msg, command, args) => {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const nomor = args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

    if (!args[0]) return sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Format salah.\n\nReply media: .kirimmedia 628xxxx\nAtau kirim media + caption: .kirimmedia 628xxxx'
    }, { quoted: msg });

    let targetMessage = null;

    // ✅ Mode 1: reply media
    if (quoted) {
        const type = Object.keys(quoted)[0];
        const media = await downloadMediaMessage(
            { message: quoted },
            'buffer',
            {},
            { logger: console }
        );
        const caption = quoted[type]?.caption || '';

        await sock.sendMessage(nomor, {
            [type.replace('Message', '')]: media,
            caption: caption
        }, { quoted: msg });
        return;
    }

    // ✅ Mode 2: kirim media + caption
    const type = Object.keys(msg.message).find(v =>
        ['imageMessage', 'videoMessage', 'documentMessage'].includes(v)
    );

    if (!type) return sock.sendMessage(msg.key.remoteJid, {
        text: '❌ Tidak ada media ditemukan.\n\nKirim media + caption atau reply media.'
    }, { quoted: msg });

    const media = await downloadMediaMessage(msg, 'buffer', {}, { logger: console });
    const caption = msg.message[type]?.caption?.split(' ').slice(1).join(' ') || '';

    await sock.sendMessage(nomor, {
        [type.replace('Message', '')]: media,
        caption: caption
    }, { quoted: msg });
};
