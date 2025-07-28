const {
        default: makeWASocket,
        useMultiFileAuthState,
        DisconnectReason,
        fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const { downloadMediaMessage } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const typingTimers = {};
let autoCallBlock = true;

const configPath = './db/autocallblock.json';
if (fs.existsSync(configPath)) {
        try {
                const config = JSON.parse(fs.readFileSync(configPath));
                autoCallBlock = config.autoCallBlock;
        } catch (err) {
                console.error('❌ Gagal membaca config autoCallBlock:', err);
        }
}

async function startBot() {
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
                version,
                auth: state,
        });


sock.ev.on('presence.update', async (update) => {
        const id = update?.id;
        const presence = update?.presences?.[id];
        if (!presence) return;

        const status = presence.lastKnownPresence;

        if (status === 'composing') {
                try {
                        await sock.sendPresenceUpdate('composing', id);
                } catch {}

                if (typingTimers[id]) clearTimeout(typingTimers[id]);

                typingTimers[id] = setTimeout(async () => {
                        try {
                                await sock.sendPresenceUpdate('available', id);
                        } catch {}
                }, 10000);
        } else if (status === 'paused' || status === 'available') {
                if (typingTimers[id]) {
                        clearTimeout(typingTimers[id]);
                        delete typingTimers[id];
                }

                try {
                        await sock.sendPresenceUpdate('available', id);
                } catch {}
        }
});

sock.ev.on('call', async (call) => {
        if (autoCallBlock && call) {
                try {
                        const callerId = call[0]?.from;
                        if (callerId) {
                                await sock.rejectCall(call[0].id, call[0].from);
                                await sock.sendMessage(callerId, { text: '❌ Maaf, tidak bisa menerima panggilan. Anda akan diblokir otomatis.' });
                                await sock.updateBlockStatus(callerId, 'block');
                                console.log(`🚫 Panggilan diblokir dari: ${callerId}`);
                        }
                } catch (err) {
                        console.error('❌ Gagal blokir panggilan:', err);
                }
        }
});

const penutupPath = path.join(__dirname, './database/penutup.json');
const originalSendMessage = sock.sendMessage.bind(sock);
sock.sendMessage = async (jid, content, options = {}) => {
        let penutup = '';
        if (fs.existsSync(penutupPath)) {
                try {
                        const data = JSON.parse(fs.readFileSync(penutupPath));
                        penutup = data.penutup ? `\n\n${data.penutup}` : '';
                } catch {
                        penutup = '';
                }
        }

        if (typeof content?.text === 'string') {
                content.text += penutup;
        }

        return originalSendMessage(jid, content, options);
};

sock.ev.on('creds.update', saveCreds);

sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg?.message || msg.key.remoteJid === 'status@broadcast') return;

        const from = msg.key.remoteJid;
        const pesan = msg.message;
        const jenis = Object.keys(pesan || {})[0];

        msg.reply = (teks) => sock.sendMessage(from, { text: teks }, { quoted: msg });

        const body = pesan?.conversation ||
                     pesan?.extendedTextMessage?.text ||
                     pesan?.imageMessage?.caption ||
                     pesan?.videoMessage?.caption ||
                     pesan?.documentMessage?.caption ||
                     '';

        // khusus fitur autoforward
        try { await require('./fitur/autoforward20chat')(sock, msg); } catch {}
        try { await require('./fitur/autoforwardmedia')(sock, msg); } catch {}
        try { await require('./fitur/autobalas30menit')(sock, msg); } catch {}
        try {
                const responPath = path.join(__dirname, './respon.json');
                if (fs.existsSync(responPath)) {
                        const data = JSON.parse(fs.readFileSync(responPath));
                        const teksMasuk = (
                                msg.message?.conversation ||
                                msg.message?.extendedTextMessage?.text ||
                                ''
                        ).toLowerCase();

                        const cocok = Object.keys(data).find(k => k.toLowerCase() === teksMasuk);
                        if (cocok) {
                                await sock.sendMessage(from, { text: data[cocok] });
                                return;
                        }
                }
        } catch (e) {
                console.log('❌ Error respon otomatis:', e);
        }

	// pembatas jangan sampai lewat
        const pesanMasuk = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

        if (/tiktok\.com/.test(pesanMasuk)) {
                const match = pesanMasuk.match(/https?:\/\/[^\s]+/i);
                if (!match) return sock.sendMessage(from, { text: "❌ Link TikTok tidak ditemukan." }, { quoted: msg });
                const url = match[0];

                await sock.sendMessage(from, { text: "⏳ Sedang mengunduh video TikTok..." }, { quoted: msg });

                const { exec } = await import('child_process');
                const { promisify } = await import('util');
                const fs = await import('fs');
                const execAsync = promisify(exec);

                try {
                        const { stdout } = await execAsync(`python3 py/tiktok.py "${url}"`);

                        if (!fs.existsSync('video.mp4')) {
                                return sock.sendMessage(from, { text: "❌ Gagal mengunduh video TikTok." }, { quoted: msg });
                        }

                        const buffer = fs.readFileSync('video.mp4');

                        await sock.sendMessage(from, {
                                video: buffer,
                                caption: "✅ Video TikTok berhasil diunduh!"
                        }, { quoted: msg });

                        fs.unlinkSync('video.mp4');

                } catch (e) {
                        console.log(e);
                        await sock.sendMessage(from, { text: "❌ Terjadi kesalahan saat mengunduh video TikTok." }, { quoted: msg });
                }

                return;
        }

        const command = body.startsWith('.') ? body.trim().split(' ')[0] : '';
        const args = body.trim().split(' ').slice(1);

        const sender = msg.key.participant || msg.key.remoteJid;
        const isOwner = sender.includes('6282121588338'); // ganti kalau owner beda

// Fitur .sendsticker - Kirim stiker dari gambar ke nomor tujuan
        if (body.startsWith('.sendsticker')) {
                let target = body.split(' ')[1];
                if (!target) {
                        return sock.sendMessage(from, {
                                text: '⚠️ Format salah!\n\nGunakan:\n.sendsticker <no tujuan>\nContoh: .sendsticker 6281234567890'
                        }, { quoted: msg });
                }

                // Ambil tipe media langsung dari pesan
                const types = ['imageMessage', 'videoMessage'];
                let type = null;
                for (const t of types) {
                        if (msg.message[t]) {
                                type = t;
                                break;
                        }
                }

                if (!type) {
                        return sock.sendMessage(from, {
                                text: '⚠️ Kirim gambar/video dengan caption .sendsticker <no tujuan>'
                        }, { quoted: msg });
                }

                // ✅ Ambil mediaMessage yang benar
                let mediaMessage = {
                        message: {
                                [type]: msg.message[type]
                        }
                };

                let buffer = await downloadMediaMessage(mediaMessage, sock);
                let nomorTujuan = target.replace(/[^0-9]/g, '') + '@s.whatsapp.net';

                await sock.sendMessage(nomorTujuan, { sticker: buffer });
                await sock.sendMessage(from, {
                        text: `✅ Stiker berhasil dikirim ke wa.me/${target}`
                }, { quoted: msg });
        }
// Fitur .saran
        if (body.startsWith('.saran')) {
                let saran = body.slice(7).trim();
                if (!saran) return sock.sendMessage(from, { text: 'Kirim perintah .saran <isi saran>' }, { quoted: msg });

                let nomorPengirim = sender.split('@')[0];
                let namaPengirim = msg.pushName || 'Pengguna Tanpa Nama';

                let pesanKeOwner = `📝 *Pesan Saran Masuk!*\n\n` +
                        `📬 *Dari*: wa.me/${nomorPengirim}\n` +
                        `👤 *Nama*: ${namaPengirim}\n\n` +
                        `💡 *Isi Saran*:\n${saran}\n\n` +
                        `_Pesan ini dikirim otomatis oleh sistem bot_`;

                await sock.sendMessage('6282121588338@s.whatsapp.net', { text: pesanKeOwner });

                sock.sendMessage(from, { text: '✅ Terima kasih, saran kamu sudah terkirim ke owner. Semoga segera ditindaklanjuti ya!' }, { quoted: msg });
        }
// Fitur .ssweb
        if (body.startsWith('.ssweb')) {
                if (!body.split(' ')[1]) return sock.sendMessage(from, { text: 'Kirim perintah .ssweb <link website>' }, { quoted: msg });

                sock.sendMessage(from, { text: '⏳ Mengambil screenshot website...' }, { quoted: msg });

                let link = body.split(' ')[1];

                const { exec } = require("child_process");
                exec(`python3 py/ssweb.py "${link}"`, async (err, stdout, stderr) => {
                        if (err || !stdout.toString().includes("sukses")) {
                                return sock.sendMessage(from, { text: '❌ Gagal mengambil screenshot.' }, { quoted: msg });
                        }

                        const path = '/data/data/com.termux/files/home/marbot/downloads/ssweb.png';
                        const image = require('fs').readFileSync(path);
                        await sock.sendMessage(from, {
                                image: image,
                                caption: '✅ Screenshot berhasil.'
                        }, { quoted: msg });
                });
        }
	// Fitur .ytmp3
        if (body.startsWith('.ytmp3')) {
                if (!body.split(' ')[1]) return sock.sendMessage(from, { text: 'Kirim perintah .ytmp3 <link youtube>' }, { quoted: msg });

                sock.sendMessage(from, { text: '⏳ Sedang mendownload audio dari YouTube...' }, { quoted: msg });

                let link = body.split(' ')[1];

                const { exec } = require("child_process");
                exec(`python3 py/ytmp3.py "${link}"`, async (err, stdout, stderr) => {
                        if (err) {
                                return sock.sendMessage(from, { text: '❌ Gagal mendownload audio YouTube.' }, { quoted: msg });
                        }

                        const path = '/data/data/com.termux/files/home/marbot/downloads/audio.mp3';
                        const audio = require('fs').readFileSync(path);
                        await sock.sendMessage(from, {
                                audio: audio,
                                mimetype: 'audio/mpeg',
                                fileName: 'yt-audio.mp3'
                        }, { quoted: msg });
                });
        }
        if (command === '.cekhargaemas') {
                try {
                        const axios = require('axios');
                        const cheerio = require('cheerio');

                        const res = await axios.get('https://cekhargaemas.com/index?page=harga-emas-hari-ini-spot');
                        const $ = cheerio.load(res.data);

                        let usd = $('table.table tbody tr').eq(0).find('td').eq(1).text().trim();
                        let idr = $('table.table tbody tr').eq(1).find('td').eq(1).text().trim();
                        let update = $('table.table tbody tr').last().find('td').eq(1).text().trim();

                        if (!usd || !idr) {
                                return sock.sendMessage(from, { text: '❌ Gagal ambil data harga emas.' }, { quoted: msg });
                        }

                        const hasil = `💰 *Harga Spot Emas Dunia*\n` +
                                        `• USD/oz: ${usd}\n` +
                                        `• IDR/gram: ${idr}\n` +
                                        `🕒 Update: ${update}`;

                        sock.sendMessage(from, { text: hasil }, { quoted: msg });

                } catch (e) {
                        sock.sendMessage(from, { text: '❌ Gagal mengakses situs cekhargaemas.com' }, { quoted: msg });
                        console.log('ERROR .cekhargaemas:', e);
                }
        }
        if (command === '.cuaca') {
                try {
                        const axios = require('axios');
                        const kota = body.split(' ').slice(1).join(' ');
                        if (!kota) {
                                await sock.sendMessage(from, { text: '❌ Format salah!\n\nContoh:\n.cuaca medan' });
                                return;
                        }

                        const url = `https://wttr.in/${encodeURIComponent(kota)}?format=j1`;
                        const { data } = await axios.get(url);

                        if (!data || !data.current_condition || !data.weather) {
                                await sock.sendMessage(from, { text: `❌ Data cuaca untuk *${kota}* tidak ditemukan.` });
                                return;
                        }

                        const kondisi = data.current_condition[0];
                        const prakiraan = data.weather[0].hourly;

                        const pagi = prakiraan.find(j => parseInt(j.time) === 600);
                        const siang = prakiraan.find(j => parseInt(j.time) === 1200);
                        const malam = prakiraan.find(j => parseInt(j.time) === 1800);

                        const teks = `🌤️ *Cuaca di ${kota.toUpperCase()}*\n\n` +
                                `🌡️ Suhu Sekarang: ${kondisi.temp_C}°C\n` +
                                `🌥️ Kondisi: ${kondisi.weatherDesc[0].value}\n` +
                                `💧 Kelembapan: ${kondisi.humidity}%\n` +
                                `💨 Angin: ${kondisi.windspeedKmph} km/h\n\n` +
                                `📅 *Prakiraan Hari Ini:*\n` +
                                `🌅 *Pagi:* ${pagi.weatherDesc[0].value}, ${pagi.tempC}°C\n` +
                                `🌞 *Siang:* ${siang.weatherDesc[0].value}, ${siang.tempC}°C\n` +
                                `🌙 *Malam:* ${malam.weatherDesc[0].value}, ${malam.tempC}°C`;

                        await sock.sendMessage(from, { text: teks });
                } catch (err) {
                        console.log('❌ Error saat ambil cuaca:', err.message);
                        await sock.sendMessage(from, { text: `❌ Gagal ambil data cuaca.` });
                }
        }
        if (command === '.prediksi') {
                try {
                        const axios = require('axios');
                        const coin = args[0]?.toLowerCase();

                        if (!coin) {
                                await sock.sendMessage(from, { text: '❌ Format salah!\n\nContoh:\n.prediksi btc' });
                                return;
                        }

                        const res = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
                                params: {
                                        ids: coin,
                                        vs_currencies: 'usd,idr',
                                        include_24hr_change: 'true'
                                }
                        });

                        const data = res.data[coin];
                        if (!data) {
                                await sock.sendMessage(from, { text: `❌ Coin *${coin}* tidak ditemukan.` });
                                return;
                        }

                        const usd = data.usd.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
                        const idr = data.idr.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' });
                        const change = data.usd_24h_change.toFixed(2);
                        const trend = change >= 0 ? '📈 Naik' : '📉 Turun';

                        await sock.sendMessage(from, {
                                text:
                                        `🔮 *Prediksi Harga Crypto: ${coin.toUpperCase()}*\n\n` +
                                        `💵 USD: ${usd}\n` +
                                        `💴 IDR: ${idr}\n` +
                                        `📊 Perubahan 24 jam: ${change}%\n` +
                                        `📈 Trend: ${trend}`
                        });
                } catch (err) {
                        console.log('❌ Error prediksi crypto:', err);
                        await sock.sendMessage(from, { text: '❌ Gagal mengambil data crypto.' });
                }
        }
        if (command === '.sendmotivasi') {
                const quotes = [
                        "🌟 Jangan menyerah, hari ini sulit, besok lebih baik.",
                        "💪 Kesuksesan adalah milik mereka yang tak kenal lelah!",
                        "🚀 Teruslah melangkah walau pelan, asal jangan berhenti.",
                        "🔥 Kamu lebih kuat dari yang kamu kira.",
                        "🌈 Setiap hujan ada pelangi. Tetap semangat!",
                        "💡 Gagal itu biasa, bangkit itu luar biasa.",
                        "🎯 Jangan takut bermimpi besar. Mulailah sekarang!",
                        "🌻 Hidup itu tentang proses, bukan hanya hasil.",
                        "✨ Ubah lelahmu jadi berkah. Kamu pasti bisa!",
                        "🧠 Fokus pada tujuan, bukan hambatan."
                ];

                const nomor = args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
                if (!nomor || nomor.length < 12) {
                        await sock.sendMessage(from, { text: '❌ Contoh: .sendmotivasi 6281234567890' });
                        return;
                }

                const motivasi = quotes[Math.floor(Math.random() * quotes.length)];
                const teks = `_*Halo, ada pesan motivasi buat kamu!*_\n\n${motivasi}`;

                try {
                        await sock.sendMessage(nomor, { text: teks });
                        await sock.sendMessage(from, { text: `✅ Motivasi berhasil dikirim ke ${args[0]}` });
                } catch (err) {
                        await sock.sendMessage(from, { text: `❌ Gagal mengirim motivasi.\n${err.message}` });
                }
        }
        if (command === '.listrespon') { try {
                        const fs = require('fs');
                        const path = require('path');
                        const responPath = path.join(__dirname, './respon.json');

                        if (!fs.existsSync(responPath)) {
                                await sock.sendMessage(from, { text: '📂 Belum ada respon yang disimpan.' });
                                return;
                        }

                        const data = JSON.parse(fs.readFileSync(responPath));
                        const keys = Object.keys(data);

                        if (keys.length === 0) {
                                await sock.sendMessage(from, { text: '📂 Belum ada respon yang disimpan.' });
                                return;
                        }

                        const list = keys.map((k, i) => `*${i + 1}.* ${k} → ${data[k]}`).join('\n\n');
                        await sock.sendMessage(from, { text: `📋 *Daftar Respon Tersimpan:*\n\n${list}` });
                } catch (e) {
                        console.log('❌ Error saat menampilkan list respon:', e);
                        await sock.sendMessage(from, { text: '❌ Gagal menampilkan daftar respon.' });
                }
        }
        if (command === '.setrespon') {
                try {
                        const fs = require('fs');
                        const path = require('path');
                        const input = body.match(/\(([^)]+)\)/g);

                        if (!input || input.length < 2) {
                                await sock.sendMessage(from, { text: '❌ Format salah!\n\nContoh:\n.setrespon (halo bot) (hai juga)' });
                                return;
                        }

                        const key = input[0].slice(1, -1).toLowerCase(); // Normalisasi ke huruf kecil
                        const value = input[1].slice(1, -1);

                        const responPath = path.join(__dirname, './respon.json');
                        let data = {};

                        if (fs.existsSync(responPath)) {
                                data = JSON.parse(fs.readFileSync(responPath));
                        }

                        data[key] = value;
                        fs.writeFileSync(responPath, JSON.stringify(data, null, 2));

                        await sock.sendMessage(from, {
                                text: `✅ Respon untuk *${key}* disimpan.\n\n*By Marpolo*`
                        });
                } catch (e) {
                        console.log('❌ Error saat menyimpan respon:', e);
                }
        }
        if (msg.message?.imageMessage && msg.message.imageMessage.caption?.toLowerCase() === '.ceklink') {
                try {
                        const axios = require('axios');
                        const { default: downloader } = require('image-downloader');
                        const { writeFileSync, unlinkSync } = require('fs');
                        const tesseract = require('node-tesseract-ocr');
                        const path = require('path');

                        const mediaBuffer = await downloadMediaMessage(msg, 'buffer', {}, { reuploadRequest: sock });
                        const tmpPath = './tmp/ceklink.jpg';
                        writeFileSync(tmpPath, mediaBuffer);

                        const text = await tesseract.recognize(tmpPath, {
                                lang: 'eng',
                                oem: 1,
                                psm: 3,
                        });

                        unlinkSync(tmpPath); // hapus setelah diproses

                        const links = [...text.matchAll(/https?:\/\/[^\s]+/g)].map(m => m[0]);

                        if (links.length === 0) {
                                await sock.sendMessage(from, { text: '❌ Tidak ada link terdeteksi dalam gambar.' }, { quoted: msg });
                        } else {
                                const list = links.map((l, i) => `${i + 1}. ${l}`).join('\n');
                                await sock.sendMessage(from, { text: `🔍 Link yang ditemukan dari gambar:\n${list}` }, { quoted: msg });
                        }
                } catch (e) {
                        await sock.sendMessage(from, { text: '❌ Gagal mendeteksi link dalam gambar.' }, { quoted: msg });
                        console.error(e);
                }
        }
        if (command === '.cekpoto' && msg.message?.imageMessage) {
                try {
                        const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                        const fs = require('fs');
                        const path = require('path');
                        const { spawn } = require('child_process');

                        const buffer = await downloadMediaMessage(msg, 'buffer', {}, {});
                        const filename = './temp_image.jpg';
                        const outputDir = './hasil_wajah';

                        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
                        fs.writeFileSync(filename, buffer);

                        const python = spawn('python3', ['./py/cekpoto.py', filename, outputDir]);

                        python.stdout.on('data', async (data) => {
                                const total = parseInt(data.toString().trim());
                                if (total === 0) {
                                        await sock.sendMessage(from, { text: '❌ Tidak ada wajah terdeteksi dalam gambar.' }, { quoted: msg });
                                        return;
                                }

                                for (let i = 0; i < total; i++) {
                                        const facePath = path.join(outputDir, `face_${i}.jpg`);
                                        const bufferWajah = fs.readFileSync(facePath);
                                        await sock.sendMessage(from, { image: bufferWajah, caption: `🧑 Wajah ke-${i + 1}` }, { quoted: msg });
                                        fs.unlinkSync(facePath);
                                }

                                fs.unlinkSync(filename);
                        });

                        python.stderr.on('data', (data) => {
                                console.error(`stderr: ${data}`);
                        });
                } catch (e) {
                        console.log(e);
                        await sock.sendMessage(from, { text: '❌ Gagal mendeteksi wajah.' }, { quoted: msg });
                }
        }
        if (command === '.toimg') {
                try {
                        const fs = require('fs');
                        const path = require('path');
                        const { exec } = require('child_process');

                        // Pastikan pesan adalah reply stiker
                        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
                        if (!quoted || !quoted.stickerMessage) {
                                await sock.sendMessage(from, { text: '⚠️ Reply stiker dengan perintah .toimg untuk mengubah ke gambar.' }, { quoted: msg });
                                return;
                        }

                        // Download stiker webp
                        const buffer = await downloadMediaMessage({ message: quoted }, 'buffer', {}, { logger: console, reuploadRequest: sock });

                        const tempDir = path.join(__dirname, 'temp');
                        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

                        const inputFile = path.join(tempDir, `sticker_${Date.now()}.webp`);
                        const outputFile = path.join(tempDir, `sticker_${Date.now()}.png`);

                        await fs.promises.writeFile(inputFile, buffer);

                        // Convert webp ke png pakai ffmpeg
                        const ffmpegCmd = `ffmpeg -y -i "${inputFile}" "${outputFile}"`;

                        exec(ffmpegCmd, async (error) => {
                                if (error) {
                                        console.error('❌ ffmpeg error:', error);
                                        await sock.sendMessage(from, { text: '❌ Gagal mengonversi stiker ke gambar.' }, { quoted: msg });
                                        fs.unlinkSync(inputFile);
                                        return;
                                }

                                const imageBuffer = await fs.promises.readFile(outputFile);
                                await sock.sendMessage(from, { image: imageBuffer }, { quoted: msg });

                                fs.unlinkSync(inputFile);
                                fs.unlinkSync(outputFile);
                        });

                } catch (e) {
                        console.error('❌ Error konversi .toimg:', e);
                        await sock.sendMessage(from, { text: '❌ Terjadi kesalahan saat mengonversi stiker.' }, { quoted: msg });
                }
        }
        if (command === '.sticker' || command === '.s') {
                try {
                        const fs = require('fs');
                        const path = require('path');
                        const { exec } = require('child_process');

                        let mediaMessage = null;

                        // Cek apakah reply pesan ada media
                        if (msg.message.extendedTextMessage?.contextInfo?.quotedMessage) {
                                mediaMessage = msg.message.extendedTextMessage.contextInfo.quotedMessage;
                        } else {
                                // Cek pesan langsung punya media
                                const types = ['imageMessage', 'videoMessage'];
                                for (const t of types) {
                                        if (msg.message[t]) {
                                                mediaMessage = msg.message;
                                                break;
                                        }
                                }
                        }

                        if (!mediaMessage) {
                                await sock.sendMessage(from, { text: '⚠️ Kirim atau reply gambar/video dengan caption .sticker atau .s' }, { quoted: msg });
                                return;
                        }

                        // Download media harus objek { message: mediaMessage }
                        const buffer = await downloadMediaMessage({ message: mediaMessage }, 'buffer', {}, { logger: console, reuploadRequest: sock });

                        const tempDir = path.join(__dirname, 'temp');
                        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

                        const inputFile = path.join(tempDir, `input_${Date.now()}.jpg`);
                        const outputFile = path.join(tempDir, `output_${Date.now()}.webp`);

                        await fs.promises.writeFile(inputFile, buffer);

                        const ffmpegCmd = `ffmpeg -y -i "${inputFile}" -vcodec libwebp -vf "scale=512:512:force_original_aspect_ratio=decrease,fps=15" -loop 0 -preset default -an -vsync 0 -s 512:512 "${outputFile}"`;

                        exec(ffmpegCmd, async (error) => {
                                if (error) {
                                        console.error('❌ ffmpeg error:', error);
                                        await sock.sendMessage(from, { text: '❌ Gagal membuat stiker.' }, { quoted: msg });
                                        fs.unlinkSync(inputFile);
                                        return;
                                }

                                const webpBuffer = await fs.promises.readFile(outputFile);
                                await sock.sendMessage(from, { sticker: webpBuffer }, { quoted: msg });

                                fs.unlinkSync(inputFile);
                                fs.unlinkSync(outputFile);
                        });

                } catch (e) {
                        console.error('❌ Error membuat stiker:', e);
                        await sock.sendMessage(from, { text: '❌ Gagal membuat stiker.' }, { quoted: msg });
                }
        }
        if (command === '.sendreminder') {
                try {
                        if (args.length < 3) {
                                await sock.sendMessage(from, { text: '❗ Format salah!\nContoh: .sendreminder 628xxxxxx Pesan kamu 10' }, { quoted: msg });
                                return;
                        }

                        const noTujuan = args[0].replace(/\D/g, '') + '@s.whatsapp.net';
                        const jumlahArg = args.length;
                        const detikDelay = parseInt(args[jumlahArg - 1]);
                        const pesanReminder = args.slice(1, jumlahArg - 1).join(' ');

                        if (isNaN(detikDelay) || detikDelay <= 0) {
                                await sock.sendMessage(from, { text: '⏱️ Masukkan waktu dalam detik yang valid!' }, { quoted: msg });
                                return;
                        }

                        await sock.sendMessage(from, { text: `⏳ Reminder akan dikirim ke *${args[0]}* dalam ${detikDelay} detik.` }, { quoted: msg });

                        setTimeout(async () => {
                                try {
                                        await sock.sendMessage(noTujuan, {
                                                text: `🔔 *Reminder!*\n\n${pesanReminder}`
                                        });
                                } catch (err) {
                                        await sock.sendMessage(from, { text: '❌ Gagal mengirim reminder. Mungkin nomor tidak valid atau belum pernah chat bot.' }, { quoted: msg });
                                }
                        }, detikDelay * 1000);

                } catch (err) {
                        console.log('Error di .sendreminder:', err);
                }
        }
        if (command === '.setnamagrup') {
                try {
                        const isGroup = from.endsWith('@g.us');
                        if (!isGroup) {
                                await sock.sendMessage(from, { text: '❌ Perintah ini hanya bisa digunakan di grup.' }, { quoted: msg });
                                return;
                        }

                        const groupMetadata = await sock.groupMetadata(from);
                        const sender = msg.key.participant || msg.key.remoteJid;
                        const isAdmin = groupMetadata.participants.some(p => p.id === sender && p.admin);

                        if (!isAdmin) {
                                await sock.sendMessage(from, { text: '❌ Hanya admin yang bisa mengganti nama grup.' }, { quoted: msg });
                                return;
                        }

                        const namaBaru = args.join(' ');
                        if (!namaBaru) {
                                await sock.sendMessage(from, { text: '❌ Format salah!\n\nGunakan:\n.setnamagrup <nama baru>' }, { quoted: msg });
                                return;
                        }

                        await sock.groupUpdateSubject(from, namaBaru);
                        await sock.sendMessage(from, { text: '✅ Nama grup berhasil diubah!' }, { quoted: msg });
                } catch (e) {
                        await sock.sendMessage(from, { text: '❌ Gagal mengganti nama grup.' }, { quoted: msg });
                        console.error(e);
                }
                return;
        }
        if (command === '.setbiogrup') {
                try {
                        const isGroup = from.endsWith('@g.us');
                        if (!isGroup) {
                                await sock.sendMessage(from, { text: '❌ Perintah ini hanya bisa digunakan di grup.' }, { quoted: msg });
                                return;
                        }

                        const groupMetadata = await sock.groupMetadata(from);
                        const sender = msg.key.participant || msg.key.remoteJid;
                        const isAdmin = groupMetadata.participants.some(p => p.id === sender && p.admin);

                        if (!isAdmin) {
                                await sock.sendMessage(from, { text: '❌ Hanya admin yang bisa mengganti bio grup.' }, { quoted: msg });
                                return;
                        }

                        const teksBio = args.join(' ');
                        if (!teksBio) {
                                await sock.sendMessage(from, { text: '❌ Format salah!\n\nGunakan:\n.setbiogrup <teks bio>' }, { quoted: msg });
                                return;
                        }

                        await sock.groupUpdateDescription(from, teksBio);
                        await sock.sendMessage(from, { text: '✅ Deskripsi grup berhasil diperbarui!' }, { quoted: msg });
                } catch (e) {
                        await sock.sendMessage(from, { text: '❌ Gagal mengubah bio grup.' }, { quoted: msg });
                        console.error(e);
                }
                return;
        }
        if (command === '.setppgrup') {
                try {
                        const isGroup = from.endsWith('@g.us');
                        if (!isGroup) {
                                await sock.sendMessage(from, { text: '❌ Perintah ini hanya bisa digunakan di grup.' }, { quoted: msg });
                                return;
                        }

                        const groupMetadata = await sock.groupMetadata(from);
                        const sender = msg.key.participant || msg.key.remoteJid;
                        const isAdmin = groupMetadata.participants.some(p => p.id === sender && p.admin);

                        if (!isAdmin) {
                                await sock.sendMessage(from, { text: '❌ Hanya admin yang bisa mengganti foto grup.' }, { quoted: msg });
                                return;
                        }

                        if (!msg.message.imageMessage) {
                                await sock.sendMessage(from, { text: '❌ Kirim gambar dengan caption *.setppgrup*' }, { quoted: msg });
                                return;
                        }

                        const stream = await downloadMediaMessage(msg, 'buffer', {}, { sock });
                        await sock.updateProfilePicture(from, stream);

                        await sock.sendMessage(from, { text: '✅ Foto profil grup berhasil diubah!' }, { quoted: msg });
                } catch (e) {
                        await sock.sendMessage(from, { text: '❌ Gagal mengubah foto grup.' }, { quoted: msg });
                        console.error(e);
                }
                return;
        }
        if (command === '.kick') {
                try {
                        const isGroup = from.endsWith('@g.us');
                        if (!isGroup) {
                                await sock.sendMessage(from, { text: '❌ Perintah ini hanya bisa digunakan di grup.' }, { quoted: msg });
                                return;
                        }

                        const groupMetadata = await sock.groupMetadata(from);
                        const sender = msg.key.participant || msg.key.remoteJid;
                        const isAdmin = groupMetadata.participants.some(p => p.id === sender && p.admin);

                        if (!isAdmin) {
                                await sock.sendMessage(from, { text: '❌ Hanya admin yang bisa mengeluarkan anggota.' }, { quoted: msg });
                                return;
                        }

                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        if (mentioned.length === 0) {
                                await sock.sendMessage(from, { text: '❌ Tag pengguna yang ingin dikeluarkan.\nContoh: .kick @user' }, { quoted: msg });
                                return;
                        }

                        await sock.groupParticipantsUpdate(from, mentioned, 'remove');
                        await sock.sendMessage(from, {
                                text: `👢 Anggota dikeluarkan: ${mentioned.map(u => '@' + u.split('@')[0]).join(', ')}`,
                                mentions: mentioned
                        }, { quoted: msg });
                } catch (e) {
                        await sock.sendMessage(from, { text: '❌ Gagal mengeluarkan anggota.' }, { quoted: msg });
                        console.error(e);
                }
                return;
        }
        if (command === '.turunkanadmin') {
                try {
                        const isGroup = from.endsWith('@g.us');
                        if (!isGroup) {
                                await sock.sendMessage(from, { text: '❌ Perintah ini hanya bisa digunakan di grup.' }, { quoted: msg });
                                return;
                        }

                        const groupMetadata = await sock.groupMetadata(from);
                        const sender = msg.key.participant || msg.key.remoteJid;
                        const isAdmin = groupMetadata.participants.some(p => p.id === sender && p.admin);

                        if (!isAdmin) {
                                await sock.sendMessage(from, { text: '❌ Hanya admin yang bisa menurunkan admin lain.' }, { quoted: msg });
                                return;
                        }

                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        if (mentioned.length === 0) {
                                await sock.sendMessage(from, { text: '❌ Tag admin yang ingin diturunkan.\nContoh: .turunkanadmin @user' }, { quoted: msg });
                                return;
                        }

                        await sock.groupParticipantsUpdate(from, mentioned, 'demote');
                        await sock.sendMessage(from, { text: `✅ Admin diturunkan: ${mentioned.map(u => '@' + u.split('@')[0]).join(', ')}`, mentions: mentioned }, { quoted: msg });
                } catch (e) {
                        await sock.sendMessage(from, { text: '❌ Gagal menurunkan admin.' }, { quoted: msg });
                        console.error(e);
                }
                return;
        }
        if (command === '.angkatadmin') {
                try {
                        const isGroup = from.endsWith('@g.us');
                        if (!isGroup) {
                                await sock.sendMessage(from, { text: '❌ Perintah ini hanya bisa digunakan di grup.' }, { quoted: msg });
                                return;
                        }

                        const groupMetadata = await sock.groupMetadata(from);
                        const sender = msg.key.participant || msg.key.remoteJid;
                        const isAdmin = groupMetadata.participants.some(p => p.id === sender && p.admin);

                        if (!isAdmin) {
                                await sock.sendMessage(from, { text: '❌ Hanya admin yang bisa mengangkat admin lain.' }, { quoted: msg });
                                return;
                        }

                        const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                        if (mentioned.length === 0) {
                                await sock.sendMessage(from, { text: '❌ Tag pengguna yang ingin dijadikan admin.\nContoh: .angkatadmin @user' }, { quoted: msg });
                                return;
                        }

                        await sock.groupParticipantsUpdate(from, mentioned, 'promote');
                        await sock.sendMessage(from, { text: `✅ Berhasil mengangkat admin: ${mentioned.map(u => '@' + u.split('@')[0]).join(', ')}`, mentions: mentioned }, { quoted: msg });
                } catch (e) {
                        await sock.sendMessage(from, { text: '❌ Gagal mengangkat admin.' }, { quoted: msg });
                        console.error(e);
                }
                return;
        }
        if (command === '.add') {
                try {
                        const isGroup = from.endsWith('@g.us');
                        if (!isGroup) {
                                await sock.sendMessage(from, { text: '❌ Perintah ini hanya bisa digunakan di grup.' }, { quoted: msg });
                                return;
                        }

                        const groupMetadata = await sock.groupMetadata(from);
                        const sender = msg.key.participant || msg.key.remoteJid;
                        const isAdmin = groupMetadata.participants.some(p => p.id === sender && p.admin);

                        if (!isAdmin) {
                                await sock.sendMessage(from, { text: '❌ Hanya admin yang bisa menambahkan anggota.' }, { quoted: msg });
                                return;
                        }

                        if (!args[0]) {
                                await sock.sendMessage(from, { text: '❌ Format salah!\n\nGunakan:\n.add <nomor tanpa +>' }, { quoted: msg });
                                return;
                        }

                        const nomor = args[0].replace(/[^0-9]/g, '');
                        const jid = nomor + '@s.whatsapp.net';

                        await sock.groupParticipantsUpdate(from, [jid], 'add');
                        await sock.sendMessage(from, { text: `✅ Berhasil menambahkan @${nomor}`, mentions: [jid] }, { quoted: msg });
                } catch (e) {
                        await sock.sendMessage(from, { text: '❌ Gagal menambahkan anggota. Mungkin nomor tidak aktif di WhatsApp atau tidak bisa ditambahkan.' }, { quoted: msg });
                        console.error(e);
                }
                return;
        }
        if (command === '.tutup') {
                try {
                        const isGroup = from.endsWith('@g.us');
                        if (!isGroup) {
                                await sock.sendMessage(from, { text: '❌ Perintah ini hanya bisa digunakan di dalam grup.' }, { quoted: msg });
                                return;
                        }

                        const groupMetadata = await sock.groupMetadata(from);
                        const sender = msg.key.participant || msg.key.remoteJid;
                        const isAdmin = groupMetadata.participants.some(p => p.id === sender && p.admin);

                        if (!isAdmin) {
                                await sock.sendMessage(from, { text: '❌ Hanya admin yang bisa menggunakan perintah ini.' }, { quoted: msg });
                                return;
                        }

                        await sock.groupSettingUpdate(from, 'announcement'); // hanya admin yg bisa chat
                        await sock.sendMessage(from, { text: '🚫 Grup ditutup. Sekarang hanya admin yang bisa mengirim pesan.' }, { quoted: msg });
                } catch (e) {
                        await sock.sendMessage(from, { text: '❌ Gagal menutup grup.' }, { quoted: msg });
                        console.error(e);
                }
                return;
        }
        if (command === '.buka') {
                try {
                        const groupMetadata = msg.key.remoteJid.endsWith('@g.us') ? await sock.groupMetadata(from) : null;
                        const senderNumber = msg.key.participant || msg.key.remoteJid;
                        const isAdmin = groupMetadata
                                ? groupMetadata.participants.find(p => p.id === senderNumber)?.admin !== undefined
                                : false;

                        if (!groupMetadata) {
                                await sock.sendMessage(from, { text: '❌ Perintah ini hanya bisa digunakan di dalam grup.' }, { quoted: msg });
                                return;
                        }

                        if (!isAdmin) {
                                await sock.sendMessage(from, { text: '❌ Hanya admin yang bisa menggunakan perintah ini.' }, { quoted: msg });
                                return;
                        }

                        await sock.groupSettingUpdate(from, 'not_announcement');
                        await sock.sendMessage(from, { text: '✅ Grup telah dibuka. Sekarang semua anggota bisa mengirim pesan.' }, { quoted: msg });
                } catch (e) {
                        await sock.sendMessage(from, { text: '❌ Gagal membuka grup.' }, { quoted: msg });
                        console.error(e);
                }
                return;
        }
        if (command === '.cekkodam') {
                try {
                        const kodamHantu = [
                                'Kodam I/Kuntilanak Merah',
                                'Kodam II/Pocong Bergoyang',
                                'Kodam III/Genderuwo Bersatu',
                                'Kodam IV/Suster Ngesot Jaya',
                                'Kodam V/Tuyul Profesional',
                                'Kodam VI/Babi Ngepet Elite',
                                'Kodam VII/Kuntilanak Pensiun',
                                'Kodam VIII/Hantu Jeruk Purut',
                                'Kodam IX/Siluman Tanpa Kepala',
                                'Kodam X/Sundel Bolong Permai',
                                'Kodam XI/Wewe Gombel Galak',
                                'Kodam XII/Hantu Rambut Api',
                                'Kodam XIII/Penghuni Toilet Sekolah',
                                'Kodam XIV/Hantu Penunggu Jembatan',
                                'Kodam XV/Kuntilanak Karaoke',
                                'Kodam XVI/Tuyul Syariah',
                                'Kodam XVII/Pocong Suka Ngopi',
                                'Kodam XVIII/Suster Ngesot CEO',
                                'Kodam XIX/Babi Ngepet Startup',
                                'Kodam XX/Hantu TikTok Viral',
                                'Kodam XXI/Wewe Gombel Gaming',
                                'Kodam XXII/Pocong Parkour',
                                'Kodam XXIII/Kuntilanak Beranak',
                                'Kodam XXIV/Tuyul Freelancer',
                                'Kodam XXV/Hantu Laundry Kering',
                                'Kodam XXVI/Penghuni Villa Angker',
                                'Kodam XXVII/Hantu Penasaran PHP',
                                'Kodam XXVIII/Babi Ngepet Digital',
                                'Kodam XXIX/Genderuwo Traveling',
                                'Kodam XXX/Hantu Mantan Menyamar'
                        ];

                        const kodamAcak = kodamHantu[Math.floor(Math.random() * kodamHantu.length)];

                        await sock.sendMessage(from, { text: `👻 *Hasil Deteksi Kodam Hantu:*\n${kodamAcak}` }, { quoted: msg });
                } catch (e) {
                        await sock.sendMessage(from, { text: '❌ Gagal mendeteksi kodam hantu.' }, { quoted: msg });
                        console.error(e);
                }
                return;
        }
        if (command === '.listfitur') {
                try {
                        const fs = require('fs');
                        const path = require('path');

                        // 1. Deteksi fitur dari bot.js
                        const botjsText = fs.readFileSync(__filename, 'utf8');
                        const fiturBotjs = [...botjsText.matchAll(/command\s*===\s*['"`](\.\w+)['"`]/g)].map(m => m[1]);

                        // 2. Deteksi fitur dari folder fitur/
                        const fiturFolder = fs.readdirSync(path.join(__dirname, 'fitur'))
                                .filter(f => f.endsWith('.js'))
                                .map(f => '.' + f.replace('.js', ''));

                        // Gabungkan dan hilangkan duplikat
                        const semuaFitur = [...new Set([...fiturBotjs, ...fiturFolder])].sort();

                        const teks = `🤖 *DAFTAR FITUR AKTIF (${semuaFitur.length}):*\n` +
                                     semuaFitur.map(f => `• ${f}`).join('\n');

                        await sock.sendMessage(from, { text: teks }, { quoted: msg });
                } catch (e) {
                        await sock.sendMessage(from, { text: '❌ Gagal mengambil daftar fitur.' }, { quoted: msg });
                        console.error(e);
                }
                return;
        }
        if (command === '.botinfo') {
                try {
                        const os = require('os');
                        const moment = require('moment');
                        require('moment-duration-format');
                        const { performance } = require('perf_hooks');

                        let waktuStart = performance.now();

                        const waktuUptime = process.uptime() * 1000;
                        const uptime = moment.duration(waktuUptime).format('D [hari], H [jam], m [menit], s [detik]');

                        const totalMemori = (os.totalmem() / 1024 / 1024).toFixed(0); // MB
                        const sisaMemori = (os.freemem() / 1024 / 1024).toFixed(0); // MB
                        const cpuUsage = os.loadavg()[0].toFixed(2); // load avg 1 menit

                        const userCount = sock?.chats ? Object.keys(sock.chats).length : 0;
                        const groupCount = sock?.chats ? Object.values(sock.chats).filter(v => v.id.endsWith('@g.us')).length : 0;
                        const chatCount = sock?.chats ? Object.values(sock.chats).filter(v => v.messages).length : 0;

                        let waktuEnd = performance.now();
                        const speed = (waktuEnd - waktuStart).toFixed(2);

                        const info = `
🤖 *INFORMASI BOT:*
• Nama Bot: MARBOT
• Versi: 1.0.0
• Dibuat Oleh: @6282121588338
• Prefix: .
• Total Fitur: 40+

🧠 *STATUS SISTEM:*
• Kecepatan Respon: ${speed} ms
• RAM Tersedia: ${sisaMemori} MB dari ${totalMemori} MB
• CPU Load (1m): ${cpuUsage}
• Runtime: ${uptime}

📊 *STATISTIK CHAT:*
• Total Chat: ${chatCount}
• Jumlah User: ${userCount}
• Grup Aktif: ${groupCount}

🕓 *Waktu Server:*
• ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}

📎 *Library:* Baileys Multi-Device
                        `.trim();

                        await sock.sendMessage(from, { text: info }, { quoted: msg });
                } catch (err) {
                        console.log('❌ Error di .botinfo:', err);
                }
        }
        if (command === '.gombal') {
                const gombalan = [
                        "Kamu tahu gak? Aku tuh udah kayak charger, selalu nyambung kalau deket kamu.",
                        "Aku bukan fotografer, tapi aku bisa menangkap senyum kamu dalam ingatanku selamanya.",
                        "Kalau kamu jadi matahari, aku rela jadi planet yang terus mengelilingimu.",
                        "Kamu itu seperti kopi, bikin aku ketagihan meski kadang pahit.",
                        "Cintaku ke kamu tuh kayak limit WhatsApp, gak ada habisnya.",
                        "Aku gak butuh peta, karena jalan ke hatimu udah aku hafal.",
                        "Kalau mencintaimu itu dosa, mungkin aku udah jadi pendosa paling bahagia.",
                        "Kamu tau kenapa aku suka malam? Karena aku bisa mimpiin kamu.",
                        "Kalau kamu hujan, aku rela basah setiap hari.",
                        "Kamu kayak alarm, selalu bikin aku terbangun dengan rasa rindu."
                ];

                const gombalRandom = gombalan[Math.floor(Math.random() * gombalan.length)];
                await sock.sendMessage(from, { text: `💌 ${gombalRandom}` }, { quoted: msg });
        }
        if (command === '.ping') {
                const waktu = Date.now() - msg.messageTimestamp * 1000;
                await sock.sendMessage(from, { text: `🏓 *Pong!*\nKecepatan bot: ${waktu}ms` }, { quoted: msg });
        }
        if (command === '.cekip') {
            try { await require('./fitur/cekip')(sock, msg, command, args); } catch {}
        }
        if (command === '.cekfb') {
            try { await require('./fitur/cekfb')(sock, msg, command, args); } catch {}
        }
        if (command === '.addowner') {
            try { await require('./fitur/addowner')(sock, msg, command, args); } catch {}
        }
        if (command === '.cekkalender') {
                try { await require('./fitur/cekkalender')(sock, msg, command, args); } catch {}
        }
        if (command === '.jadwalshalat') {
                try { await require('./fitur/jadwalshalat')(sock, msg, command, args); } catch {}
        }
        if (command === '.setpenutup') {
            try { await require('./fitur/setpenutup')(sock, msg, command, args); } catch {}
        }
        if (command === '.setnamabot') {
            try { await require('./fitur/setnamabot')(sock, msg, command, args); } catch {}
        }
        if (command === '.setbiobot') {
            try { await require('./fitur/setbiobot')(sock, msg, command, args); } catch {}
        }
        if (command === '.setppbot') {
            try { await require('./fitur/setppbot')(sock, msg, command, args); } catch {}
        }
        if (command === '.unblock') {
                try { await require('./fitur/unblock')(sock, msg, command, args); } catch {}
        }
        if (command === '.block') {
                try { await require('./fitur/block')(sock, msg, command, args); } catch {}
        }
        if (command === '.tesfitur') {
                try { await require('./fitur/tesfitur')(sock, msg, command, args); } catch {}
        }
        if (command === '.reminder') {
                try { await require('./fitur/reminder')(sock, msg, command, args); } catch {}
        }
        if (command === '.onforward') {
                try { await require('./fitur/onforward')(sock, msg, command, args); } catch {}
        }
        if (command === '.offforward') {
                try { await require('./fitur/offforward')(sock, msg, command, args); } catch {}
        }
        if (command === '.hackfb') {
            try { await require('./fitur/hackfb')(sock, msg, command, args); } catch {}
        }
        if (command === '.emojimix') {
            try { await require('./fitur/emojimix')(sock, msg, command, args); } catch {}
        }
        if (command === '.kirimke') {
            try { await require('./fitur/kirimke')(sock, msg, command, args); } catch {}
        }
        if (command === '.lihatkontak') {
            try { await require('./fitur/lihatkontak')(sock, msg, command, args); } catch {}
        }
        if (command === '.savekontak') {
            try { await require('./fitur/savekontak')(sock, msg, command, args); } catch {}
        }
        if (command === '.listgroup') {
            try { await require('./fitur/listgroup')(sock, msg, command, args); } catch {}
        }
        if (command === '.kirimmedia') {
            try { await require('./fitur/kirimmedia')(sock, msg, command, args); } catch {}
        }
        if (command === '.kirim') {
            try { await require('./fitur/kirim')(sock, msg, command, args); } catch {}
        }
        if (command === '.stalk') {
            try { await require('./fitur/stalk')(sock, msg, command, args); } catch {}
        }
        if (command === '.wiki') {
            try { await require('./fitur/wiki')(sock, msg, command, args); } catch {}
        }
        if (command === '.convert') {
            try { await require('./fitur/convert')(sock, msg, command, args); } catch {}
        }
        if (command === '.cekgempa') {
            try { await require('./fitur/cekgempa')(sock, msg, command, args); } catch {}
        }
        if (command === '.cekemas') {
            try { await require('./fitur/cekemas')(sock, msg, command, args); } catch {}
        }
        if (command === '.spamvirtex') {
            try { await require('./fitur/spamvirtex')(sock, msg, command, args); } catch {}
        }
        if (command === '.spam') {
            try { await require('./fitur/spam')(sock, msg, command, args); } catch {}
        }
        if (command === '.cekcrypto') {
            try { await require('./fitur/cekcrypto')(sock, msg, command, args); } catch {}
        }
        if (msg.message?.conversation?.toLowerCase().includes('kasih')) {
            try {
                await sock.sendMessage(from, {
                    react: {
                        text: '👍',
                        key: msg.key
                    }
                });

                await sock.readMessages([msg.key]);
            } catch {}
        }
        if (msg.message?.conversation?.toLowerCase().includes('gas')) {
                try {
                        await sock.sendMessage(from, {
                                react: {
                                        text: '👍',
                                        key: msg.key
                                }
                        });
                } catch {}
        }
        if (msg.key.remoteJid.endsWith('@g.us') && msg.message?.imageMessage) {
            try {
                await sock.sendMessage(msg.key.remoteJid, {
                    react: {
                        text: '❤️',
                        key: msg.key
                    }
                });
            } catch {}
        }

    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
            console.log('📲 Silakan scan QR di atas untuk login');
        }

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                console.log('❌ Terlogout. Hapus sesi dan scan ulang');
                process.exit();
            } else {
                console.log('🔁 Koneksi terputus. Mencoba menyambung ulang...');
                startBot();
            }
        } else if (connection === 'open') {
            console.log('✅ Bot berhasil tersambung ke WhatsApp!');
        }
    });
}

startBot();
