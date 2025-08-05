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
const chalk = require('chalk');
const { exec } = require('child_process');
const { spawn } = require('child_process');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys')

let typingTimers = {};
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
        const sessionPath = process.argv[2] || './auth_info'
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
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
                                await sock.sendMessage(callerId, { text: '❌ Maaf, tidak bisa menerima panggilan. Anda akan diblokir otomatis, untuk buka blokir nya kirim perintah kebot dengan .unblock <nomormu> dari no lain' });
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

        // Tambahan: tampilkan log rapi di Termux
        const teks = pesan?.conversation ||
                     pesan?.extendedTextMessage?.text ||
                     pesan?.imageMessage?.caption ||
                     pesan?.videoMessage?.caption ||
                     pesan?.documentMessage?.caption ||
                     pesan?.buttonsResponseMessage?.selectedButtonId ||
                     pesan?.listResponseMessage?.singleSelectReply?.selectedRowId ||
                     'Media atau pesan lain';

        const isGroup = from.endsWith('@g.us');

        console.log(
                chalk.green('[ PESAN MASUK ]'),
                chalk.cyan(new Date().toLocaleTimeString()),
                chalk.yellow(jenis.toUpperCase()),
                chalk.magenta(isGroup ? 'GRUP' : 'PRIBADI'),
                '\nDari :', chalk.blue(from),
                '\nIsi  :', chalk.white(teks)
        );

        // Fungsi reply tetap
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

        if (pesanMasuk.startsWith('.jadibot')) {
                let nomor = msg.sender.split('@')[0]
                let { exec } = require('child_process')
                sock.sendMessage(msg.from, { text: `⏳ Menyiapkan jadibot untuk *${nomor}*...\nQR akan muncul di Termux` }, { quoted: msg })

                exec(`python3 py/jadibot.py ${nomor}`, (err, stdout, stderr) => {
                        if (err) return sock.sendMessage(msg.from, { text: `❗ Gagal menjalankan jadibot:\n${err.message}` }, { quoted: msg })
                        if (stderr) return sock.sendMessage(msg.from, { text: `⚠️ stderr:\n${stderr}` }, { quoted: msg })

                        sock.sendMessage(msg.from, { text: `✅ Jadibot untuk *${nomor}* sedang berjalan!\n\n${stdout}` }, { quoted: msg })
                })
        }
        if (body.startsWith('.playstore')) {
                if (!body.includes('play.google.com')) return sock.sendMessage(from, { text: 'Kirim link Play Store yang valid' });
                sock.sendMessage(from, { text: '⏳ Sedang mengunduh APK, tunggu sebentar...' });

                const { exec } = require('child_process');
                const link = body.split(' ')[1];

                exec(`python3 py/playstore.py "${link}"`, async (err, stdout) => {
                        if (err || !stdout.includes('.apk')) return sock.sendMessage(from, { text: 'Gagal mengunduh APK' });

                        const file = stdout.trim();
                        await sock.sendMessage(from, {
                                document: { url: `./${file}` },
                                mimetype: 'application/vnd.android.package-archive',
                                fileName: file
                        });
                });
        }
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

        if (body.startsWith('.bratvid')) {
                const teks = body.split(' ').slice(1).join(' ');
                if (!teks) return msg.reply('Masukkan teksnya!\n\nContoh: .bratvid Halo Dunia');

                msg.reply('⏳ Sedang membuat stiker video...');

                const { exec } = require("child_process");
                exec(`python3 py/bratvid.py "${teks.replace(/"/g, '\\"')}"`, (err, stdout, stderr) => {
                        if (err || stderr) return msg.reply('Terjadi error saat membuat stiker video.');
                        const file = stdout.trim();
                        sock.sendMessage(msg.key.remoteJid, { sticker: { url: file } }, { quoted: msg });
                });
        }
        if ((body.startsWith('.brat ') || body === '.brat') && !body.startsWith('.bratvid')) {
                const teks = body.slice(6).trim();
                if (!teks) return msg.reply('Masukkan teks-nya!\n\nContoh: .brat hallo dunia');

                if (teks.split('.').length > 5) return msg.reply('Maksimal hanya 5 kalimat.');

                msg.reply('⏳ Sedang membuat stiker...');

                const { exec } = require('child_process');
                const output = `/data/data/com.termux/files/home/marbot/tmp/brat.webp`;

                exec(`python3 py/brat.py "${teks.replace(/"/g, '\\"')}"`, async (err) => {
                        if (err) return msg.reply('Terjadi error saat membuat stiker.');

                        await sock.sendMessage(from, {
                                sticker: { url: output }
                        }, { quoted: msg });
                });
        }
        if (body.startsWith('.circle') && msg.type === 'imageMessage') {
                const quoted = msg.message.imageMessage;
                const downloadMedia = await downloadMediaMessage(msg, 'buffer', {}, { logger, reuploadRequest, mediaType: 'image' });
                const inputPath = './temp_input.jpg';
                const outputPath = './media/circle.png';
                fs.writeFileSync(inputPath, downloadMedia);

                exec(`python py/circle.py ${inputPath}`, async (err, stdout) => {
                        if (err) return sock.sendMessage(from, { text: '❌ Gagal memproses gambar' }, { quoted: msg });

                        const hasil = fs.readFileSync(stdout.toString().trim());
                        await sock.sendMessage(from, { image: hasil, caption: '✅ Berhasil dipotong jadi lingkaran!' }, { quoted: msg });

                        fs.unlinkSync(inputPath);
                        fs.unlinkSync(stdout.toString().trim());
                });
        }
        if (body === '.cctv') {
                const { exec } = require('child_process')
                exec('python3 ./py/cctv.py', async (err, stdout) => {
                        if (stdout.trim() === 'sukses') {
                                const media = await fs.readFileSync('./temp_cctv.jpg')
                                await sock.sendMessage(from, { image: media, caption: '📷 Live CCTV Snapshot' }, { quoted: msg })
                        } else {
                                await sock.sendMessage(from, { text: 'Gagal mengambil gambar CCTV.' }, { quoted: msg })
                        }
                })
                return
        }
        if (body.startsWith('.kalkulator ')) {
                const { execFile } = require('child_process')
                const rumus = body.slice(12).trim()
                if (!rumus) {
                        await sock.sendMessage(from, { text: 'Masukkan rumus setelah perintah .kalkulator' }, { quoted: msg })
                        return
                }
                execFile('python3', ['./py/kalkulator.py', rumus], (error, stdout, stderr) => {
                        if (error) {
                                sock.sendMessage(from, { text: 'Error saat menjalankan kalkulator.' }, { quoted: msg })
                                return
                        }
                        const hasil = stdout.trim()
                        sock.sendMessage(from, { text: `Hasil: ${hasil}` }, { quoted: msg })
                })
                return
        }
        if (body.startsWith('.anime')) {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Sebentar, mengambil gambar karakter anime HD...' });

                const axios = require('axios');
                const fs = require('fs');
                const path = require('path');
                const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

                try {
                        const res = await axios.get('https://api.waifu.pics/sfw/waifu');
                        const imageUrl = res.data.url;

                        const fileName = './temp/naruto.jpg';
                        const writer = fs.createWriteStream(fileName);

                        const response = await axios({
                                url: imageUrl,
                                method: 'GET',
                                responseType: 'stream'
                        });

                        response.data.pipe(writer);

                        writer.on('finish', async () => {
                                const buffer = fs.readFileSync(fileName);
                                await sock.sendMessage(msg.key.remoteJid, {
                                        image: buffer,
                                        caption: '🌪️ Karakter random dari anime '
                                });
                                fs.unlinkSync(fileName);
                        });

                        writer.on('error', (err) => {
                                console.error('Download gagal:', err);
                        });
                } catch (err) {
                        console.log('Error:', err);
                        await sock.sendMessage(msg.key.remoteJid, { text: 'Gagal mengambil gambar Naruto.' });
                }
        }
        if (body.startsWith('.ktp')) {
                let input = body.slice(4).trim()
                if (!input.includes('|')) {
                        return sock.sendMessage(msg.key.remoteJid, { text: 'Contoh:\n.ktp Nama|NIK|TTL|Alamat|Pekerjaan' }, { quoted: msg })
                }

                let [nama, nik, ttl, alamat, pekerjaan] = input.split('|').map(a => a.trim())
                if (!nama || !nik || !ttl || !alamat || !pekerjaan) {
                        return sock.sendMessage(msg.key.remoteJid, { text: 'Semua field harus diisi!\nContoh:\n.ktp Nama|NIK|TTL|Alamat|Pekerjaan' }, { quoted: msg })
                }

                let { exec } = require('child_process')
                exec(`python py/ktp.py "${nama}" "${nik}" "${ttl}" "${alamat}" "${pekerjaan}"`, async (err, stdout, stderr) => {
                        if (err) return sock.sendMessage(msg.key.remoteJid, { text: 'Gagal membuat KTP.' }, { quoted: msg })
                        let hasil = require('fs').readFileSync('./py/hasil_ktp.jpg')
                        sock.sendMessage(msg.key.remoteJid, { image: hasil, caption: 'Berikut hasil KTP palsumu~' }, { quoted: msg })
                })
        }
        // Fitur .blur
        if (msg.message?.imageMessage && (msg.message.imageMessage.caption?.toLowerCase() === '.blur' || msg.body?.toLowerCase() === '.blur')) {
                try {
                        const { writeFileSync, unlinkSync, existsSync, readFileSync } = require('fs')
                        const { exec } = require('child_process')
                        const path = require('path')

                        const mediaBuffer = await downloadMediaMessage(msg, 'buffer', {}, { reuploadRequest: sock.updateMediaMessage })
                        const inputPath = path.join(__dirname, 'temp_image.jpg')
                        const outputPath = path.join(__dirname, 'blurred.jpg')

                        writeFileSync(inputPath, mediaBuffer)

                        exec(`python py/blur.py ${inputPath} ${outputPath}`, async (err, stdout, stderr) => {
                                console.log('[DEBUG] Python stdout:', stdout)
                                console.log('[DEBUG] Python stderr:', stderr)

                                if (err) {
                                        console.error('[ERROR] Proses Python gagal:', err)
                                        return sock.sendMessage(msg.key.remoteJid, {
                                                text: '❌ Gagal memburamkan gambar.'
                                        }, { quoted: msg })
                                }

                                if (!existsSync(outputPath)) {
                                        console.error('[ERROR] File blurred.jpg tidak ditemukan setelah Python')
                                        return sock.sendMessage(msg.key.remoteJid, {
                                                text: '❌ File hasil blur tidak ditemukan.'
                                        }, { quoted: msg })
                                }

                                try {
                                        const blurredBuffer = readFileSync(outputPath)

                                        await sock.sendMessage(msg.key.remoteJid, {
                                                image: blurredBuffer,
                                                caption: '*Gambar berhasil diblur!*'
                                        }, { quoted: msg })

                                        unlinkSync(inputPath)
                                        unlinkSync(outputPath)
                                } catch (e) {
                                        console.error('[ERROR] Gagal kirim gambar blur:', e)
                                        sock.sendMessage(msg.key.remoteJid, {
                                                text: '❌ Gagal mengirim gambar hasil blur.'
                                        }, { quoted: msg })
                                }
                        })
                } catch (e) {
                        console.error('[ERROR .blur]', e)
                        sock.sendMessage(msg.key.remoteJid, {
                                text: '❌ Terjadi kesalahan saat proses blur.'
                        }, { quoted: msg })
                }
        }
        if (msg.message?.videoMessage && body.startsWith('.tomp3')) {
                let media = await downloadMediaMessage(msg, "buffer", {}, { reuploadRequest: sock });
                let filename = './temp_video.mp4';
                let outname = './output_audio.mp3';

                require('fs').writeFileSync(filename, media);

                const { exec } = require('child_process');
                exec(`python3 py/tomp3.py "${filename}" "${outname}"`, async (err, stdout, stderr) => {
                        if (err || !require('fs').existsSync(outname)) {
                                await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal mengubah video ke MP3.' }, { quoted: msg });
                                return;
                        }

                        let hasil = require('fs').readFileSync(outname);
                        await sock.sendMessage(msg.key.remoteJid, {
                                audio: hasil,
                                mimetype: 'audio/mpeg',
                                ptt: false
                        }, { quoted: msg });

                        require('fs').unlinkSync(filename);
                        require('fs').unlinkSync(outname);
                });
        }
        if ((msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').startsWith('.fbmp4')) {
                let teks = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
                let url = teks.split(' ')[1]
                if (!url) return await sock.sendMessage(msg.key.remoteJid, { text: 'URL tidak ditemukan.' }, { quoted: msg })

                const { exec } = require('child_process')
                exec(`python3 py/fbmp4.py "${url}"`, async (err, stdout) => {
                        if (err) {
                                await sock.sendMessage(msg.key.remoteJid, { text: 'Gagal memproses video Facebook.' }, { quoted: msg })
                                return
                        }

                        // Ambil baris terakhir dari stdout yang mengandung link .mp4
                        let lines = stdout.trim().split('\n')
                        let mp4url = lines.find(x => x.includes('http') && x.includes('.mp4'))

                        if (!mp4url) {
                                await sock.sendMessage(msg.key.remoteJid, { text: 'Link video tidak ditemukan.' }, { quoted: msg })
                                return
                        }

                        await sock.sendMessage(msg.key.remoteJid, { video: { url: mp4url }, caption: '✅ Berikut videonya' }, { quoted: msg })
                })
        }
        if ((msg.message?.conversation || msg.message?.extendedTextMessage?.text)?.startsWith('.ytmp4')) {
                let teks = msg.message?.conversation || msg.message?.extendedTextMessage?.text
                if (!teks.split(' ')[1]) return sock.sendMessage(msg.key.remoteJid, { text: 'Masukkan link YouTube.\nContoh: .ytmp4 https://youtu.be/abc123' }, { quoted: msg })

                let url = teks.split(' ')[1]
                sock.sendMessage(msg.key.remoteJid, { text: '⏳ Sedang mengunduh video, mohon tunggu...' }, { quoted: msg })

                const { exec } = require('child_process')
                exec(`python3 py/ytmp4.py ${url}`, async (err, stdout) => {
                        if (err) {
                                sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal mengunduh video.' }, { quoted: msg })
                                return
                        }

                        let filePath = stdout.trim()
                        await sock.sendMessage(msg.key.remoteJid, {
                                video: { url: filePath },
                                mimetype: 'video/mp4',
                                caption: '✅ Berikut videonya!'
                        }, { quoted: msg })
                })
        }
        if (body.startsWith('.ytmp3')) {
                const q = body.split(' ')[1];

                if (!q) return msg.reply('Masukkan link YouTube-nya!\n\nContoh: .ytmp3 https://youtu.be/xxxx');

                await msg.reply('⏳ Sedang mendownload audio...');

                const { exec } = require('child_process');
                const fs = require('fs');
                const path = require('path');

                const downloadsFolder = path.join(__dirname, 'downloads');

                exec(`python3 py/ytmp3.py "${q}"`, async (error, stdout, stderr) => {
                        if (error) {
                                return msg.reply('❌ Gagal download audio.');
                        }

                        const files = fs.readdirSync(downloadsFolder)
                                .filter(file => file.endsWith('.mp3'))
                                .map(file => ({
                                        file,
                                        time: fs.statSync(path.join(downloadsFolder, file)).mtime.getTime()
                                }))
                                .sort((a, b) => b.time - a.time);

                        if (files.length === 0) {
                                return msg.reply('❌ Audio tidak ditemukan setelah proses download.');
                        }

                        const latestFile = path.join(downloadsFolder, files[0].file);

                        await sock.sendMessage(from, {
                                audio: { url: latestFile },
                                mimetype: 'audio/mp4'
                        }, { quoted: msg });

                        fs.unlinkSync(latestFile);
                });
        }
        if (body.startsWith('.xhamster')) {
                const q = body.split(' ')[1]
                if (!q) return sock.sendMessage(from, { text: '❌ Masukkan link XHamster!\n\nContoh:\n.xhamster https://id.xhamster.com/videos/...' }, { quoted: msg })

                sock.sendMessage(from, { text: '⏳ Sedang mengambil video dari XHamster...' }, { quoted: msg })

                const { exec } = require('child_process')
                exec(`python3 py/xhamster.py "${q}"`, async (err, stdout, stderr) => {
                        if (err) {
                                await sock.sendMessage(from, { text: `❌ Gagal:\n${stderr}` }, { quoted: msg })
                                return
                        }

                        if (stdout.includes('✅ Berhasil')) {
                                const fs = require('fs')
                                const path = require('path')
                                const folder = path.join(__dirname, 'media/xhamster')
                                const files = fs.readdirSync(folder).filter(f => f.endsWith('.mp4')).map(f => path.join(folder, f))
                                if (files.length === 0) {
                                        await sock.sendMessage(from, { text: '❌ Tidak ditemukan file video.' }, { quoted: msg })
                                        return
                                }

                                const lastFile = files.map(f => ({ file: f, time: fs.statSync(f).mtime }))
                                                       .sort((a, b) => b.time - a.time)[0].file

                                const video = fs.readFileSync(lastFile)
                                await sock.sendMessage(from, { video: video, mimetype: 'video/mp4' }, { quoted: msg })

                                // hapus file setelah dikirim
                                fs.unlinkSync(lastFile)
                        } else {
                                await sock.sendMessage(from, { text: `❌ Gagal:\n${stdout}` }, { quoted: msg })
                        }
                })
        }
        if (teks.startsWith('.gambar ')) {
                try {
                        const tema = teks.split(' ').slice(1).join(' ');
                        if (!tema) return sock.sendMessage(msg.key.remoteJid, { text: 'Masukkan tema gambar. Contoh: .gambar kucing' }, { quoted: msg });

                        const { execSync } = require('child_process');
                        const url = execSync(`python py/gambar.py "${tema}"`).toString().trim();

                        const axios = require('axios');
                        const res = await axios.get(url, { responseType: 'arraybuffer' });

                        await sock.sendMessage(msg.key.remoteJid, {
                                image: res.data,
                                caption: `Gambar bertema: ${tema}`
                        }, { quoted: msg });

                } catch (err) {
                        console.error(err);
                        await sock.sendMessage(msg.key.remoteJid, { text: 'Gagal mengambil gambar.' }, { quoted: msg });
                }
        }
        if (body.startsWith('.walpaper')) {
                msg.reply('_Tunggu sebentar, mengambil wallpaper super HD..._')

                const axios = require('axios')
                const fs = require('fs')
                const { fromBuffer } = require('file-type')

                const url = `https://picsum.photos/1080/1920?random=${Math.floor(Math.random() * 1000)}`

                try {
                        const res = await axios.get(url, { responseType: 'arraybuffer' })
                        const buffer = Buffer.from(res.data)
                        const type = await fromBuffer(buffer)
                        const filePath = `tmp_wallpaper.${type.ext}`
                        fs.writeFileSync(filePath, buffer)

                        await sock.sendMessage(msg.key.remoteJid, {
                                image: fs.readFileSync(filePath),
                                caption: '📱 Wallpaper Super HD'
                        })

                        fs.unlinkSync(filePath)
                } catch (err) {
                        msg.reply('⚠️ Gagal mengambil wallpaper, coba lagi nanti.')
                        console.error(err)
                }
        }
        if (command === '.coffe') {
                try {
                        const axios = require('axios');
                        const fs = require('fs');
                        const path = require('path');

                        // Ambil gambar kopi dari API
                        const res = await axios.get('https://coffee.alexflipnote.dev/random.json');
                        const imageUrl = res.data.file;

                        // Unduh gambar
                        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                        const buffer = Buffer.from(response.data, 'binary');

                        await sock.sendMessage(msg.key.remoteJid, {
                                image: buffer,
                                caption: '☕ Secangkir kopi untukmu 🍂',
                        }, { quoted: msg });
                } catch (e) {
                        await sock.sendMessage(msg.key.remoteJid, {
                                text: '❌ Gagal mengambil gambar kopi.',
                        }, { quoted: msg });
                }
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
        if (body === '.motivasi') {
                const motivasiJudi = [
                        "🛑 Jangan berjudi, karena menang membuatmu serakah, kalah membuatmu miskin.",
                        "💸 Judi tidak akan membuatmu kaya, hanya mempercepat kehancuranmu.",
                        "⚠️ Uang hasil judi tidak akan pernah membawa berkah.",
                        "🔁 Judi membuatmu terjebak dalam siklus kekalahan yang tak berujung.",
                        "🧠 Orang pintar menjauhi judi, orang nekat menyambut kebangkrutan.",
                        "📉 Judi bisa membuat rumah tangga hancur dan pertemanan rusak.",
                        "💀 Judi menghancurkan hidup perlahan tapi pasti.",
                        "⛔ Tuhan tidak ridho dengan harta haram dari judi online.",
                        "💣 Judi online terlihat mudah, tapi ujungnya menghancurkan mental dan keuangan.",
                        "🕳️ Judi itu candu. Sekali masuk, susah keluar.",
                        "😢 Banyak yang jual motor, gadai HP, kehilangan segalanya karena judi online.",
                        "🏚️ Rumahmu bisa ambruk, bukan karena gempa, tapi karena chip.",
                        "🧾 Mau jadi orang sukses? Mulailah dari menjauhi judi.",
                        "😡 Judi bukan cara cepat kaya. Itu cara cepat miskin dan stres.",
                        "⚖️ Jangan tukar masa depanmu dengan kemenangan palsu di game slot.",
                        "😵 Judi membuatmu terjebak ilusi kemenangan.",
                        "👎 Tidak ada yang menang dalam judi, kecuali bandar.",
                        "📵 Uninstall semua aplikasi judi online sebelum hidupmu uninstall dari dunia nyata.",
                        "🧘 Jauhi judi, dekatkan diri pada Tuhan dan kerja halal.",
                        "💬 Gak keren main slot, keren itu yang kerja keras dan sabar.",
                        "🎭 Judi mempermainkan harapanmu, bukan menolongmu.",
                        "🕯️ Bukan keberuntungan yang kamu butuhkan, tapi kesadaran.",
                        "🌪️ Judi menghancurkan diam-diam: uang, waktu, iman, dan hubungan.",
                        "🛑 Jangan tunggu kalah ratusan ribu baru berhenti, berhentilah sekarang.",
                        "📊 Uang 100 ribu bisa buat makan 3 hari, bukan dibakar di game slot.",
                        "😔 Jangan bangga top-up buat judi, banggalah kalau bisa bantu orangtua.",
                        "💭 Kamu gak butuh hoki, kamu butuh tujuan hidup.",
                        "🚫 Gak ada ‘sekali aja’ dalam judi. Itu perangkapnya.",
                        "📛 Judi online itu haram, dosa, dan buang-buang hidup.",
                        "🙏 Kalau kamu sayang keluargamu, jauhi judi online sekarang juga."
                ];

                const randomIndex = Math.floor(Math.random() * motivasiJudi.length);
                const quote = motivasiJudi[randomIndex];
                await sock.sendMessage(from, { text: quote }, { quoted: msg });
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
        if (body.startsWith('.cekcryptoall')) {
                exec('python3 py/cekcryptoall.py', (err, stdout) => {
                        if (err) return sock.sendMessage(from, { text: 'Gagal mengambil data' }, { quoted: msg })
                        sock.sendMessage(from, { text: stdout }, { quoted: msg })
                })
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
        if (body.startsWith('.ceritahoror')) {
                await sock.sendMessage(msg.key.remoteJid, { text: '⏳ Mengambil cerita horor...' });

                const { exec } = require('child_process');
                exec('python3 py/ceritahoror.py', async (err, stdout, stderr) => {
                        if (err || stderr) {
                                await sock.sendMessage(msg.key.remoteJid, { text: 'Gagal mengambil cerita horor.' });
                                return;
                        }

                        const cerita = stdout.trim();
                        if (!cerita) {
                                await sock.sendMessage(msg.key.remoteJid, { text: 'Cerita horor kosong.' });
                                return;
                        }

                        await sock.sendMessage(msg.key.remoteJid, { text: cerita });
                });
        }
        if (body.startsWith('.tts ')) {
                let teks = body.slice(5).trim();
                if (!teks) return sock.sendMessage(msg.key.remoteJid, { text: '❌ Masukkan teksnya, contoh: .tts aku cinta negara ini.' }, { quoted: msg });

                const { exec } = require('child_process');
                const fs = require('fs');
                exec(`python3 py/prabowo_tts.py "${teks.replace(/"/g, '\\"')}"`, async (err, stdout, stderr) => {
                        if (err || !fs.existsSync('prabowo.mp3')) {
                                await sock.sendMessage(msg.key.remoteJid, { text: '❌ Gagal buat suara TTS.' }, { quoted: msg });
                                return;
                        }

                        let audio = fs.readFileSync('prabowo.mp3');
                        await sock.sendMessage(msg.key.remoteJid, {
                                audio: audio,
                                mimetype: 'audio/mpeg',
                                ptt: false
                        }, { quoted: msg });

                        fs.unlinkSync('temp.mp3');
                        fs.unlinkSync('prabowo.mp3');
                });
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
	//joinnn
        if (body.startsWith('.join ')) {
                let link = body.split(' ')[1]
                if (!link) return sock.sendMessage(from, { text: 'Masukkan link grup atau channel.' }, { quoted: msg })

                let code = ''
                try {
                        if (link.includes('chat.whatsapp.com/')) {
                                code = link.split('chat.whatsapp.com/')[1].split('?')[0].trim()
                                await sock.groupAcceptInvite(code)
                                await sock.sendMessage(from, { text: '✅ Berhasil join grup!' }, { quoted: msg })
                        } else if (link.includes('whatsapp.com/channel/')) {
                                code = link.split('whatsapp.com/channel/')[1].split('?')[0].trim()
                                await sock.channelJoinInvite(code)
                                await sock.sendMessage(from, { text: '✅ Berhasil join channel!' }, { quoted: msg })
                        } else {
                                await sock.sendMessage(from, { text: 'Link tidak valid!' }, { quoted: msg })
                        }
                } catch (err) {
                        await sock.sendMessage(from, { text: '❌ Gagal join! Pastikan link aktif dan bot tidak diblokir owner grup/channel.' }, { quoted: msg })
                }
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
        if (body.startsWith('.topcrypto')) {
                const { exec } = require('child_process')
                exec(`python3 py/tocrypto.py`, (err, stdout) => {
                        if (err || !stdout) return sock.sendMessage(from, { text: 'Gagal ambil data koin' })

                        sock.sendMessage(from, { text: `📈 *250 Coin Teratas Berdasarkan Market Cap:*\n\n${stdout}` })
                })
        }
        if (body.startsWith('.infotix')) {
                const { exec } = require('child_process')
                exec(`python3 py/infotix.py`, (err, stdout) => {
                        if (err || !stdout) return sock.sendMessage(from, { text: 'Gagal ambil data crypto' })
                        sock.sendMessage(from, { text: `📊 *Top 7 Market Cap Crypto:*\n\n${stdout}` })
                })
        }
        if (body.startsWith('.emoji ')) {
                msg.reply('Tunggu sebentar...')
                const teks = body.split(' ')[1]
                const emojiUrl = `https://emojicdn.elk.sh/${encodeURIComponent(teks)}?style=apple`
                const outputPath = './emoji.png'
                const { default: fetch } = await import('node-fetch')
                const fs = require('fs')
                const res = await fetch(emojiUrl)

                if (!res.ok) return msg.reply('Gagal ambil gambar emoji 😢')

                const fileStream = fs.createWriteStream(outputPath)
                await new Promise((resolve, reject) => {
                        res.body.pipe(fileStream)
                        res.body.on('error', reject)
                        fileStream.on('finish', resolve)
                })

                await sock.sendMessage(from, {
                        image: fs.readFileSync(outputPath),
                        caption: teks
                }, { quoted: msg })
        }
        if (body.startsWith('.konvercrypto')) {
                const args = body.split(' ');
                if (args.length < 3) return msg.reply('Contoh: .konvercrypto 1000000 btc');
                const jumlah = args[1];
                const koin = args[2];

                exec(`python3 py/konvercrypto.py ${jumlah} ${koin}`, (err, stdout) => {
                        if (err) return msg.reply('Terjadi kesalahan.');
                        msg.reply(stdout.trim());
                });
        }
        if (body.startsWith('.toplose')) {
                const { exec } = require('child_process')
                const arg = body.split(' ')[1] || '1'
                msg.reply('Tunggu sebentar...')
                exec(`python py/toplose.py ${arg}`, (err, stdout) => {
                        if (err) return msg.reply('Gagal mengambil data')
                        msg.reply(stdout.trim())
                })
        }
        if (body.startsWith('.topharga')) {
                await msg.reply('Tunggu sebentar...')
                const { exec } = require('child_process')
                exec('python3 py/topharga.py', async (err, stdout) => {
                        if (err) return await msg.reply('Terjadi kesalahan.')
                        await msg.reply(stdout.trim())
                })
        }
        if (body.startsWith('.topwin')) {
                const teks = body.split(' ')[1]
                if (!teks) return msg.reply('Masukkan jumlah hari!\nContoh: *.topwin 7*')

                exec(`python3 py/topwin.py ${teks}`, (err, stdout) => {
                        if (err) return msg.reply('Terjadi kesalahan.')
                        msg.reply(stdout.trim())
                })
        }
        if (body.startsWith('.cekukuran')) {
                const { exec } = require('child_process')
                msg.reply('🔄 Sedang menghitung total ukuran file bot...')

                exec('du -sh ~/marbot', (err, stdout, stderr) => {
                        if (err || stderr) {
                                msg.reply('⚠️ Gagal menghitung ukuran folder.')
                                return
                        }

                        const hasil = stdout.trim()
                        msg.reply(`📦 *Total Ukuran Bot:*\n${hasil}`)
                })
        }
        if (body.startsWith('.cekhuruf')) {
                const { exec } = require('child_process')
                msg.reply('🔄 Menghitung total huruf dari file teks (tanpa gambar/video)...')

                const cmd = `find ~/marbot -type f \\( -name "*.js" -o -name "*.json" -o -name "*.txt" -o -name "*.md" -o -name "*.html" -o -name "*.css" -o -name "*.py" -o -name "*.sh" -o -name "*.java" -o -name "*.c" -o -name "*.cpp" -o -name "*.go" -o -name "*.rs" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \\) -exec cat {} + | wc -m`

                exec(cmd, (err, stdout, stderr) => {
                        if (err || stderr) {
                                msg.reply('⚠️ Gagal menghitung jumlah huruf.'); 
                                return
                        }

                        const totalHuruf = stdout.trim()
                        msg.reply(`🔡 *Total Jumlah Huruf di File Teks (folder marbot):*\n${totalHuruf} karakter`)
                })
        }
        if (body.startsWith('.statkode')) {
                await msg.reply('Tunggu sebentar, sedang menghitung statistik kode...')
                const { exec } = require('child_process')
                exec('python3 py/statkode.py', async (err, stdout) => {
                        if (err) return msg.reply('Gagal menjalankan statkode.py')
                        await msg.reply(stdout.trim())
                })
        }
        if (body.startsWith('.cekdata')) {
                const email = body.split(' ')[1]
                if (!email) return msg.reply('Masukkan email!\n\nContoh: *.cekdata email@gmail.com*')
                msg.reply('Tunggu sebentar, sedang memeriksa kebocoran...')
                exec(`python py/cekdata.py ${email}`, (err, stdout) => {
                        if (err) return msg.reply('Gagal memeriksa data.')
                        msg.reply(stdout.trim())
                })
        }
        if (body.startsWith('.bandingkan')) {
                const teks = body.split(' ')
                if (teks.length !== 3) {
                        await sock.sendMessage(from, { text: '❌ Format salah!\n\nContoh:\n.bandingkan btc eth' }, { quoted: msg })
                        return
                }

                const coinInput1 = teks[1].toLowerCase()
                const coinInput2 = teks[2].toLowerCase()
                const fetch = require('node-fetch')

                const getCoinId = async (namaKoin) => {
                        try {
                                const res = await fetch('https://api.coingecko.com/api/v3/coins/list')
                                const allCoins = await res.json()

                                // Prioritaskan pencocokan dari symbol, lalu id, lalu name
                                let coin = allCoins.find(c => c.symbol.toLowerCase() === namaKoin)
                                if (coin) return coin.id

                                coin = allCoins.find(c => c.id.toLowerCase() === namaKoin)
                                if (coin) return coin.id

                                coin = allCoins.find(c => c.name.toLowerCase() === namaKoin)
                                return coin ? coin.id : null
                        } catch (err) {
                                return null
                        }
                }

                const id1 = await getCoinId(coinInput1)
                const id2 = await getCoinId(coinInput2)

                if (!id1 || !id2) {
                        await sock.sendMessage(from, { text: '❌ Gagal menemukan nama coin!\nPastikan kamu menulis simbol atau nama yang valid (contoh: btc, eth, xrp, doge, shiba)' }, { quoted: msg })
                        return
                }

                const getData = async (id) => {
                        try {
                                const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}`)
                                if (!res.ok) return null
                                const data = await res.json()
                                return {
                                        name: data.name,
                                        price_usd: data.market_data.current_price.usd,
                                        price_idr: data.market_data.current_price.idr,
                                        market_cap: data.market_data.market_cap.usd,
                                        volume: data.market_data.total_volume.usd
                                }
                        } catch {
                                return null
                        }
                }

                const data1 = await getData(id1)
                const data2 = await getData(id2)

                if (!data1 || !data2) {
                        await sock.sendMessage(from, { text: '❌ Gagal mengambil data dari server CoinGecko.' }, { quoted: msg })
                        return
                }

                let teksHasil = `📊 *Perbandingan Koin: ${data1.name} vs ${data2.name}*\n\n`
                teksHasil += `💰 Harga Sekarang:\n- ${data1.name}: $${data1.price_usd.toLocaleString()} / Rp${data1.price_idr.toLocaleString()}\n- ${data2.name}: $${data2.price_usd.toLocaleString()} / Rp${data2.price_idr.toLocaleString()}\n\n`
                teksHasil += `🏦 Market Cap:\n- ${data1.name}: $${data1.market_cap.toLocaleString()}\n- ${data2.name}: $${data2.market_cap.toLocaleString()}\n\n`
                teksHasil += `📈 Volume 24 Jam:\n- ${data1.name}: $${data1.volume.toLocaleString()}\n- ${data2.name}: $${data2.volume.toLocaleString()}\n\n`

                const skor1 = data1.market_cap + data1.volume
                const skor2 = data2.market_cap + data2.volume

                if (skor1 > skor2) {
                        teksHasil += `✅ Rekomendasi: *${data1.name}* lebih unggul dari sisi market cap dan volume.`
                } else if (skor2 > skor1) {
                        teksHasil += `✅ Rekomendasi: *${data2.name}* lebih unggul dari sisi market cap dan volume.`
                } else {
                        teksHasil += `⚖️ Kedua koin memiliki performa yang seimbang.`
                }

                await sock.sendMessage(from, { text: teksHasil }, { quoted: msg })
        }
        if (body.startsWith('.mlcounter')) {
                const hero = body.split(' ')[1]
                if (!hero) return sock.sendMessage(from, { text: 'Contoh: .mlcounter miya' }, { quoted: msg })
                const { exec } = require('child_process')
                exec(`python3 py/mlcounter.py ${hero}`, (err, stdout) => {
                        if (err) return sock.sendMessage(from, { text: '❌ Gagal mengambil data counter.' }, { quoted: msg })
                        sock.sendMessage(from, { text: stdout.trim() }, { quoted: msg })
                })
        }
        if (body.startsWith('.mlhero')) {
                const teks = body.split(' ')[1]
                if (!teks) return sock.sendMessage(from, { text: 'Kirim seperti: .mlhero miya' }, { quoted: msg })

                const { exec } = require('child_process')
                sock.sendMessage(from, { text: '🔎 Mengambil data hero...' }, { quoted: msg })

                exec(`python3 py/mlhero.py ${teks}`, async (err, stdout) => {
                        if (err || !stdout.includes('ok|')) {
                                sock.sendMessage(from, { text: '❌ Hero tidak ditemukan atau gagal mengambil data.' }, { quoted: msg })
                                return
                        }

                        const hasil = stdout.trim().split('|')
                        if (hasil[0] !== 'ok') {
                                sock.sendMessage(from, { text: hasil[1] || '❌ Terjadi kesalahan.' }, { quoted: msg })
                                return
                        }

                        const [_, nama, role, specialty, lane, difficulty, imageUrl] = hasil
                        const caption = `🧙 Nama: ${nama}\n🎯 Role: ${role}\n✨ Specialty: ${specialty}\n🛡️ Lane: ${lane}\n🔥 Difficulty: ${difficulty}\n📚 Source: mobile-legends.fandom.com`

                        try {
                                const axios = require('axios')
                                const res = await axios.get(imageUrl, { responseType: 'arraybuffer' })
                                const buffer = Buffer.from(res.data, 'binary')
                                await sock.sendMessage(from, {
                                        image: buffer,
                                        caption
                                }, { quoted: msg })
                        } catch {
                                sock.sendMessage(from, { text: caption }, { quoted: msg })
                        }
                })
        }
        if (teks.startsWith('.menu')) {
                const nomorOwner = '6282121588338'
                const githubLink = 'https://github.com/dashboard'
                const saluranWa = 'https://whatsapp.com/channel/0029Vb6BFQ6HQbS9aUAwOt2R'
                const FB = 'https://www.facebook.com/profile.php?id=100088336765857'
                const situsweb = 'umarpolo.com'
                const grupwa = 'https://chat.whatsapp.com/L9BNIrq8yMqJUeCduYfm68?mode=ac_t'
                const fitur = '83'

                const menu = `

🌐 *Bot WhatsApp Menu*

*SaluranWA*: ${saluranWa}

*Komunitas MARBOT*: ${grupwa}

*Owner*: wa.me/${nomorOwner}

*Facebook*: ${FB}

*GitHub*: ${githubLink}

*web*: ${situsweb}

📝 *NOTE*: _JANGAN TELPON BOT_

📌📌 *TOTAL FITUR*: ${fitur}

🪙 *𝗖𝗿𝘆𝗽𝘁𝗼*
→ .bandingkan
→ .cekcrypto
→ .cekcryptoall
→ .topharga
→ .infotix
→ .konvercrypto
→ .prediksi
→ .toplose
→ .topwin
→ .topcrypto

🎮 𝗠𝗼𝗯𝗶𝗹𝗲 𝗟𝗲𝗴𝗲𝗻𝗱𝘀
→ .mlhero
→ .mlcounter

📁 *𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 𝗧𝗼𝗼𝗹𝘀*
→ .ceklink
→ .convert
→ .fbmp4
→ .ssweb
→ .tiktok
→ .ytmp4
→ .ytmp3

🎨 *𝗚𝗮𝗺𝗯𝗮𝗿*
→ .bratvid
→ .brat
→ .bwtext
→ .blur
→ .cctv
→ .coffe
→ .cekpoto
→ .emoji
→ .emojimix
→ .gambar
→ .ktp
→ .anime
→ .sticker
→ .toimg
→ .walpaper

📡 *𝗜𝗻𝗳𝗼 & 𝗣𝗲𝗿𝗸𝗶𝗿𝗮𝗮𝗻*
→ .cuaca
→ .cekgempa
→ .cekemas
→ .cekfb
→ .cekip
→ .cekkalender
→ .cekkodam
→ .jadwalshalat
→ .wiki

🛠️ *𝗙𝗲𝗮𝘁𝘂𝗿 𝗔𝗹𝗮𝘁 𝗕𝗼𝘁*
→ .botinfo
→ .ping
→ .cekhuruf
→ .cekukuran
→ .ulang
→ .profil
→ .supertest
→ .tesfitur
→ .listfitur
→ .statkode
→ .spam
→ .spamvirtex
→ .reminder
→ .sendreminder
→ .sendmotivasi
→ .tts
→ gas spam
→ .kalkulator
→ .motivasi
→ .gombal
→ .jadibot
→ .tomp3
→ .toteks

🧑‍🤝‍🧑 *𝗚𝗿𝗼𝘂𝗽 𝗠𝗮𝗻𝗮𝗴𝗲𝗺𝗲𝗻𝘁*
→ .kick
→ .angkatadmin
→ .turunkanadmin
→ .join
→ .tutup
→ .buka
→ .setnamagrup
→ .setppgrup

🧑 *𝗔𝗸𝘂𝗻 / 𝗞𝗼𝗻𝘁𝗮𝗸*
→ .kirim
→ .kirimke
→ .kirimmedia
→ .lihatkontak
→ .savekontak
→ .listgroup
→ .stalk

🧩 *𝗢𝘁𝗼𝗺𝗮𝘁𝗶𝘀𝗮𝘀𝗶 / 𝗥𝗲𝘀𝗽𝗼𝗻*
→ .listrespon
→ .setrespon
→ .setpenutup

🔐 *𝗞𝗵𝘂𝘀𝘂𝘀 𝗢𝘄𝗻𝗲𝗿*
→ .add
→ .addowner
→ .setbiobot
→ .setnamabot
→ .setppbot
→ .unblock
→ .block
→ .hackfb


*Bot ini dibuat hanya semata mata untuk pembuktian kalau aku itu bener bener cinta sama  DIAN ANGGRAINI*

                `.trim()

                await sock.sendMessage(msg.key.remoteJid, { text: menu }, { quoted: msg })
        }
        if (body.startsWith('.bwtext')) {
                msg.reply('_Sedang membuat gambar hitam putih..._')

                const teks = body.split(' ').slice(1).join(' ')
                if (!teks) return msg.reply('⚠️ Masukkan teks setelah perintah.')

                const { exec } = require('child_process')
                const fs = require('fs')

                exec(`python3 py/bwtext.py "${teks}"`, async (err, stdout) => {
                        if (err) {
                                msg.reply('⚠️ Gagal membuat gambar.')
                                console.error(err)
                                return
                        }

                        const output = stdout.trim()
                        if (fs.existsSync(output)) {
                                await sock.sendMessage(msg.key.remoteJid, {
                                        image: fs.readFileSync(output),
                                        caption: '🖤 Gambar Hitam Putih dari Teks'
                                })
                                fs.unlinkSync(output)
                        } else {
                                msg.reply('⚠️ Gagal memuat gambar.')
                        }
                })
        }
        if (body === '.toteks') {
                if (!msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.audioMessage)
                        return sock.sendMessage(from, { text: '⚠️ Balas pesan suara dengan caption .toteks' }, { quoted: msg })

                const quoted = msg.message.extendedTextMessage.contextInfo.quotedMessage
                const mkey = msg.message.extendedTextMessage.contextInfo.stanzaId
                const sender = msg.message.extendedTextMessage.contextInfo.participant || msg.key.participant

                const audioPath = `./temp/${mkey}.opus`
                const stream = await downloadContentFromMessage(quoted.audioMessage, 'audio')
                let buffer = Buffer.from([])
                for await (const chunk of stream) {
                        buffer = Buffer.concat([buffer, chunk])
                }
                require('fs').writeFileSync(audioPath, buffer)

                exec(`python3 ./py/toteks.py ${audioPath}`, async (err, stdout) => {
                        if (err) {
                                return sock.sendMessage(from, { text: '❌ Gagal mengubah suara ke teks.' }, { quoted: msg })
                        }
                        const hasil = stdout.toString().trim()
                        if (!hasil || hasil.startsWith('[GAGAL]'))
                                return sock.sendMessage(from, { text: '❌ Tidak bisa mengenali suara.' }, { quoted: msg })
                        await sock.sendMessage(from, { text: `🗣️ *Hasil Teks:*\n${hasil}` }, { quoted: msg })
                })
        }
        if (body.toLowerCase() === 'gas spam') {
                const listSpam = [
                        'wlekwkwkwk🤣🤣🤣',
                        '🤡🤡🤡🤡🤡',
                        'KAMU MAU DISPAM YA?',
                        'SPAM DETECTED!!!',
                        'MAKAN NIH SPAM!!!',
                        '☠️☠️☠️☠️',
                        'GASSSSSSSSSS',
                        'WAKWAKAKAK',
                        '🗿🗿🗿🗿🗿🗿🗿',
                        'SPAM SPAM SPAM SPAM',
                        'LU KENA GASS BRO',
                        '🌪️🌪️🌪️🌪️🌪️',
                        '😎 LU MINTA SPAM YA 😎',
                        'DOSA LO MAKIN NUMPUK 😈',
                        '🤖 Aku bot... Aku spam kamu 😁',
                        '💣💣💣💣💣💣💣💣',
                        'LU NYAHA APA SI 🤣',
                        'GASSSSSSSS🔥🔥🔥🔥',
                        '⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡',
                        'AYO BANG, KUAT GAK NIH HP',
                        '🤣🤣🤣🤣🤣🤣🤣🤣🤣',
                        'MAMPUSSS KEBAKAR',
                        'KIRIM SPAM! KIRIM SPAM!',
                        '📣📣📣📣📣📣📣📣',
                        'LU BILANG GAS SPAM YA INI DIA!',
                        '🤣🔥💀🤡🗿☠️💥⚡📣🌪️'
                ]

                const target = msg.key.remoteJid.endsWith('@g.us') ? msg.key.remoteJid : msg.key.participant || msg.key.remoteJid

                for (let i = 0; i < 30; i++) {
                        const teks = listSpam[Math.floor(Math.random() * listSpam.length)]
                        await sock.sendMessage(target, { text: teks })
                        await new Promise(r => setTimeout(r, 1000)) // jeda biar gak keban
                }
        }
        if (body.startsWith('.profil')) {
                const sender = msg.key.participant || msg.key.remoteJid
                const nomor = sender.split('@')[0]
                const nama = msg.pushName || 'Tidak diketahui'
                const now = new Date().toISOString()

                const fs = require('fs')
                const path = './database/firstchat.json'
                if (!fs.existsSync(path)) fs.writeFileSync(path, '{}')

                const data = JSON.parse(fs.readFileSync(path))
                if (!data[sender]) data[sender] = now
                fs.writeFileSync(path, JSON.stringify(data, null, 2))

                const pertamaChat = new Date(data[sender]).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
                const terakhirChat = msg.messageTimestamp
                        ? new Date(msg.messageTimestamp * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
                        : 'Tidak diketahui'

                let pp
                try {
                        pp = await sock.profilePictureUrl(sender, 'image')
                } catch {
                        pp = 'https://i.ibb.co/jr9xg5M/default.jpg'
                }

                let groupCount = 0
                try {
                        const groups = await sock.groupFetchAllParticipating()
                        for (const jid in groups) {
                                const metadata = await sock.groupMetadata(jid)
                                if (metadata.participants.some(p => p.id === sender)) {
                                        groupCount++
                                }
                        }
                } catch (e) {
                        console.error('Gagal ambil data grup:', e)
                }

                const teks = `👤 *Profil Kamu*\n\n📛 Nama: ${nama}\n📱 Nomor: ${nomor}\n🕰️ Pertama kali chat: ${pertamaChat}\n⏱️ Terakhir chat: ${terakhirChat}\n👥 Grup bersama bot: ${groupCount}`

                await sock.sendMessage(from, {
                        image: { url: pp },
                        caption: teks
                }, { quoted: msg })
        }
        if (body.startsWith('.ulang')) {
                let teks = body.slice(6).trim()
                if (!teks) return sock.sendMessage(from, { text: '⚠️ Contoh: .ulang Aku lapar' }, { quoted: msg })
                await sock.sendMessage(from, { text: teks }, { quoted: msg })
        }
        if (body.startsWith('.supertest')) {
                await sock.sendMessage(from, { text: '✅ Bot merespons dengan baik!' }, { quoted: msg });
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
