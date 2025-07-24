module.exports = async (sock, msg, command, args) => {
    if (!args[0]) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: '📱 Contoh: .stalk 6281234567890'
        }, { quoted: msg });
    }

    const id = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';

    try {
        const ppUrl = await sock.profilePictureUrl(id, 'image').catch(() => null);
        const info = await sock.onWhatsApp(id);

        if (!info || !info[0]?.exists) {
            return sock.sendMessage(msg.key.remoteJid, {
                text: '❌ Nomor tidak terdaftar di WhatsApp.'
            }, { quoted: msg });
        }

        const { notify, jid } = info[0];

        const hasil = `👤 *Stalking WhatsApp*\n\n` +
            `📌 Nomor: ${jid.replace(/@.*/, '')}\n` +
            `📛 Nama: ${notify || '-'}\n` +
            `🖼️ Foto: ${ppUrl ? 'Terlampir' : 'Tidak tersedia'}`;

        if (ppUrl) {
            await sock.sendMessage(msg.key.remoteJid, {
                image: { url: ppUrl },
                caption: hasil
            }, { quoted: msg });
        } else {
            await sock.sendMessage(msg.key.remoteJid, { text: hasil }, { quoted: msg });
        }

    } catch (e) {
        console.error(e);
        await sock.sendMessage(msg.key.remoteJid, {
            text: '❌ Gagal stalking. Mungkin nomor salah atau privasi terlalu ketat.'
        }, { quoted: msg });
    }
};
