const fs = require('fs');
const path = require('path');
const STATUS_PATH = './fitur/.forwardstatus.json';
const FORWARDED_LOG = path.join(__dirname, '.forwardedMedia.json');
const OWNER_NUMBER = '6282121588338@s.whatsapp.net';

module.exports = async (sock, msg) => {
    // Cek status
    if (fs.existsSync(STATUS_PATH)) {
        const { aktif } = JSON.parse(fs.readFileSync(STATUS_PATH));
        if (!aktif) return;
    }

    if (!msg.message) return;
    const from = msg.key.remoteJid;
    if (from.endsWith('@g.us')) return;

    // Cek jenis media
    const mediaTypes = ['imageMessage', 'videoMessage', 'documentMessage', 'audioMessage'];
    const mediaType = mediaTypes.find(type => msg.message[type]);
    if (!mediaType) return;

    // Cegah duplikat
    if (!fs.existsSync(FORWARDED_LOG)) fs.writeFileSync(FORWARDED_LOG, '[]');
    let forwardedLog = JSON.parse(fs.readFileSync(FORWARDED_LOG));
    const messageId = msg.key.id;
    if (forwardedLog.includes(messageId)) return;

    try {
        await sock.sendMessage(OWNER_NUMBER, {
            text: `📩 *Media masuk dari:* ${from.replace(/[@:]/g, '')}\n\nForward media berikut ini:`
        });

        await sock.relayMessage(
            OWNER_NUMBER,
            { [mediaType]: msg.message[mediaType] },
            { messageId: msg.key.id }
        );

        forwardedLog.push(messageId);
        fs.writeFileSync(FORWARDED_LOG, JSON.stringify(forwardedLog));
    } catch (err) {
        console.error('Gagal forward media:', err);
    }
};
