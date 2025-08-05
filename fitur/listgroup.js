const { getGroupMetadata } = require('@whiskeysockets/baileys');

module.exports = async (sock, msg, command, args) => {
    try {
        const groups = await sock.groupFetchAllParticipating();
        const allGroups = Object.values(groups);

        if (allGroups.length === 0) {
            return sock.sendMessage(msg.key.remoteJid, { text: '❌ Bot tidak tergabung di grup manapun.' }, { quoted: msg });
        }

        let teks = '📃 *Daftar Grup yang Diikuti Bot:*\n\n';
        allGroups.forEach((g, i) => {
            teks += `${i + 1}. ${g.subject} (${g.participants.length} anggota)\n`;
        });

        teks += `\nTotal: ${allGroups.length} grup.`;

        await sock.sendMessage(msg.key.remoteJid, { text: teks }, { quoted: msg });
    } catch (err) {
        console.error('❌ Error listgroup:', err);
        await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal mengambil daftar grup.' }, { quoted: msg });
    }
}
