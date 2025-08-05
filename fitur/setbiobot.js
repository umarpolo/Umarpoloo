module.exports = async (sock, msg, command, args) => {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes('6282121588338'); // Ganti jika owner beda

    if (!isOwner) {
        return sock.sendMessage(from, { text: '❌ Hanya owner yang bisa mengganti bio bot.' }, { quoted: msg });
    }

    const teksBio = args.join(' ');
    if (!teksBio) {
        return sock.sendMessage(from, { text: '❌ Format salah.\nContoh: *.setbiobot Ini bio baru ku!*' }, { quoted: msg });
    }

    try {
        await sock.updateProfileStatus(teksBio);
        await sock.sendMessage(from, { text: `✅ Bio bot berhasil diubah menjadi:\n\n"${teksBio}"` }, { quoted: msg });
    } catch (err) {
        console.error(err);
        await sock.sendMessage(from, { text: '❌ Gagal mengubah bio bot.' }, { quoted: msg });
    }
};
