const { downloadMediaMessage, generateProfilePicture } = require('@whiskeysockets/baileys');

module.exports = async (sock, msg, command, args) => {
    const from = msg.key.remoteJid;
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isImage = msg.message?.imageMessage || quoted?.imageMessage;

    if (!isImage) {
        return sock.sendMessage(from, { text: '❌ Kirim atau reply gambar dengan caption *.setppbot*' }, { quoted: msg });
    }

    const mediaMsg = msg.message.imageMessage
        ? msg
        : { message: { imageMessage: quoted.imageMessage }, key: msg.key };

    try {
        const buffer = await downloadMediaMessage(mediaMsg, 'buffer', {}, { logger: console });

        // ⚠️ WAJIB pakai generateProfilePicture di Baileys v6.7.18
        const { img } = await generateProfilePicture(buffer);

        await sock.updateProfilePicture(sock.user.id, img);

        await sock.sendMessage(from, { text: '✅ Foto profil bot berhasil diubah.' }, { quoted: msg });
    } catch (err) {
        console.error(err);
        await sock.sendMessage(from, { text: '❌ Gagal mengubah foto profil bot.' }, { quoted: msg });
    }
};
