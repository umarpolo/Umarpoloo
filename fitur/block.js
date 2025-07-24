// fitur/block.js

module.exports = async (sock, msg, command, args) => {
    const sender = msg.key.remoteJid;
    const isOwner = sender === '6282121588338@s.whatsapp.net';
    if (!isOwner) return sock.sendMessage(sender, { text: '❌ Hanya owner yang bisa pakai perintah ini.' });

    const noWa = (args[0] || '').replace(/[^0-9]/g, '');
    if (!noWa) return sock.sendMessage(sender, { text: '❌ Format salah!\nContoh: .block 6281234567890' });

    const jid = noWa + '@s.whatsapp.net';
    try {
        await sock.updateBlockStatus(jid, 'block');
        await sock.sendMessage(sender, { text: `✅ Nomor ${noWa} berhasil diblokir!` });
    } catch (err) {
        await sock.sendMessage(sender, { text: `❌ Gagal blokir nomor: ${err.message}` });
    }
};
