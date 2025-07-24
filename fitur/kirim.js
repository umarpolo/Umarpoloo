module.exports = async (sock, msg, command, args) => {
    if (args.length < 2) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: '❗ Format salah\nContoh: .kirim 6281234567890 Hai apa kabar'
        }, { quoted: msg });
    }

    const noTujuan = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    const isiPesan = args.slice(1).join(' ');

    const teksGabung = `_*Halo, ada pesan masuk nih dari seseorang!*_\n\n${isiPesan}`;

    try {
        await sock.sendMessage(noTujuan, { text: teksGabung });

        await sock.sendMessage(msg.key.remoteJid, {
            text: `✅ Pesan berhasil dikirim ke ${args[0]}`
        }, { quoted: msg });

    } catch (e) {
        console.error(e);
        await sock.sendMessage(msg.key.remoteJid, {
            text: '❌ Gagal mengirim pesan. Mungkin nomor tidak aktif atau bot belum pernah chat nomor tersebut.'
        }, { quoted: msg });
    }
};
