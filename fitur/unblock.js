// fitur/unblock.js

module.exports = async (sock, msg, command, args) => {
    const sender = msg.key.remoteJid;

    const noWa = (args[0] || '').replace(/[^0-9]/g, '');
    if (!noWa) {
        return sock.sendMessage(sender, {
            text: '❌ Format salah!\n\nContoh:\n.unblock 6281234567890'
        });
    }

    const jid = noWa + '@s.whatsapp.net';
    try {
        await sock.updateBlockStatus(jid, 'unblock');
        await sock.sendMessage(sender, {
            text: `✅ Nomor *${noWa}* berhasil dibuka blokirnya.`
        });
    } catch (err) {
        await sock.sendMessage(sender, {
            text: `❌ Gagal membuka blokir: ${err.message}`
        });
    }
};
