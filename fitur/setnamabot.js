module.exports = async (sock, msg, command, args) => {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const isOwner = sender.includes('6282121588338'); // Ganti jika owner beda

    if (!isOwner) {
        return sock.sendMessage(from, { text: '❌ Hanya owner yang bisa mengganti nama bot.' }, { quoted: msg });
    }

    const namaBaru = args.join(' ');
    if (!namaBaru) {
        return sock.sendMessage(from, { text: '❌ Format salah.\nContoh: *.setnamabot Nama Baru Bot*' }, { quoted: msg });
    }

    try {
        await sock.updateProfileName(namaBaru);
        await sock.sendMessage(from, { text: `✅ Nama bot berhasil diubah menjadi:\n\n*${namaBaru}*` }, { quoted: msg });
    } catch (err) {
        console.error(err);
        await sock.sendMessage(from, { text: '❌ Gagal mengubah nama bot.' }, { quoted: msg });
    }
};
