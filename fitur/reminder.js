module.exports = async (sock, msg, command, args) => {
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const reply = (teks) => sock.sendMessage(from, { text: teks }, { quoted: msg });

    if (args.length < 2) return reply('❌ Format salah!\nContoh: .reminder 10 Ingat minum air');

    const detik = parseInt(args[0]);
    const pesan = args.slice(1).join(' ');

    if (isNaN(detik) || detik <= 0) return reply('❌ Waktu harus dalam detik dan lebih dari 0!');

    reply(`⏱️ Pengingat akan dikirim dalam *${detik} detik*.\n📌 Pesan: ${pesan}`);

    setTimeout(() => {
        sock.sendMessage(sender, {
            text: `🔔 *Pengingat:*\n${pesan}`
        });
    }, detik * 1000);
};

