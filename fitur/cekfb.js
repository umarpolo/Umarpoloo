const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = async (sock, msg, command, args) => {
    const { remoteJid: from } = msg.key;
    const url = args[0];

    if (!url || !url.includes('facebook.com')) {
        return sock.sendMessage(from, {
            text: '⚠️ Format salah!\n\nContoh: .cekfb https://facebook.com/zuck'
        }, { quoted: msg });
    }

    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            }
        });

        const html = await res.text();
        const $ = cheerio.load(html);

        let nama = $('title').text().replace(/ \| Facebook.*$/, '') || 'Tidak ditemukan';
        let userId = html.match(/"userID":"(\d+)"/)?.[1] || 'Tidak ditemukan';

        // Foto profil HD
        let imgUrl = $('meta[property="og:image"]').attr('content')?.replace(/&amp;/g, '&') || null;

        // Bio
        let bio = $('div[data-testid="profile_intro_card_bio"]').text().trim() || 'Tidak ditemukan';

        // Pekerjaan
        let pekerjaan = $('div[data-overviewsection="work"]').text().trim() || 'Tidak ditemukan';

        // Pendidikan
        let pendidikan = $('div[data-overviewsection="education"]').text().trim() || 'Tidak ditemukan';

        // Tempat tinggal
        let tempatTinggal = $('div[data-overviewsection="places"]').text().trim() || 'Tidak ditemukan';

        // Tanggal lahir (kadang bisa muncul di page info)
        let ttl = html.match(/Lahir pada tanggal ([^<]+)/)?.[1] || 'Tidak ditemukan';

        let teks = `👤 *Cek Profil Facebook*\n\n` +
                   `🔗 Link: ${url}\n` +
                   `📛 Nama: ${nama}\n` +
                   `🆔 ID: ${userId}\n` +
                   `🎂 Tanggal Lahir: ${ttl}\n` +
                   `💼 Pekerjaan: ${pekerjaan}\n` +
                   `🎓 Pendidikan: ${pendidikan}\n` +
                   `🏠 Tinggal di: ${tempatTinggal}\n` +
                   `📝 Bio: ${bio}\n` +
                   `📷 Foto: ${imgUrl || 'Tidak ditemukan'}`;

        if (imgUrl) {
            await sock.sendMessage(from, {
                image: { url: imgUrl },
                caption: teks
            }, { quoted: msg });
        } else {
            await sock.sendMessage(from, { text: teks }, { quoted: msg });
        }

    } catch (err) {
        console.error(err);
        await sock.sendMessage(from, {
            text: '❌ Gagal mengambil data. Profil mungkin privat, atau URL salah.'
        }, { quoted: msg });
    }
};
