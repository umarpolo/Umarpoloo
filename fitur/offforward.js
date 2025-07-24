const fs = require('fs');
const STATUS_PATH = './fitur/.forwardstatus.json';
const OWNER_NUMBER = '6282121588338@s.whatsapp.net';

module.exports = async (sock, msg) => {
    if (msg.key.participant !== OWNER_NUMBER && msg.key.remoteJid !== OWNER_NUMBER) return;

    fs.writeFileSync(STATUS_PATH, JSON.stringify({ aktif: false }, null, 2));
    await sock.sendMessage(msg.key.remoteJid, { text: '⛔ Auto forward *dimatikan*.' });
};
