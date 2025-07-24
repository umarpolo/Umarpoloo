const { proto } = require('@whiskeysockets/baileys');

// ✅ Daftar kalimat menyebalkan (bisa kamu tambah sendiri)
const spamTexts = [
  "Anak dukun gak usah banyak gaya!",
  "Pake WA tapi gak tau adab 😹",
  "Numpang lewat, bawa malu buat kamu 🤡",
  "Halo halo, sini aku bacotin 💩",
  "Kamu tuh kaya iklan — muncul terus, ganggu doang 😴",
  "Bercanda mulu hidupmu, serius dong dikit 🙄",
  "Main bot aja gak becus, apalagi main hati 😘",
  "Malu gak sih? Harusnya malu 🙈",
  "Kalau kamu cakep, aku udah block dari tadi 😜",
  "Spesialis pengganggu waktu orang 😇"
];

function getRandomSpamText() {
  return spamTexts[Math.floor(Math.random() * spamTexts.length)];
}

module.exports = async (sock, msg, command, args) => {
  if (!command.startsWith('.spam')) return;

  const sender = msg.key.remoteJid;
  const [nomor, jumlah, jeda] = args;

  // Cek validasi input
  if (!nomor || !jumlah || !jeda) {
    return sock.sendMessage(sender, { text: '⚠️ Format salah!\n\nGunakan:\n.spam <nomor> <jumlah> <milidetik>' });
  }

  const target = nomor.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  const total = parseInt(jumlah);
  const delay = parseInt(jeda);

  if (isNaN(total) || isNaN(delay) || total > 100) {
    return sock.sendMessage(sender, { text: '⚠️ Jumlah terlalu banyak atau delay tidak valid! (maks 100)' });
  }

  sock.sendMessage(sender, { text: `⏳ Mengirim spam ke ${nomor} sebanyak ${jumlah}x setiap ${delay}ms...` });

  for (let i = 0; i < total; i++) {
    await sock.sendMessage(target, { text: getRandomSpamText() });
    await new Promise(r => setTimeout(r, delay));
  }

  sock.sendMessage(sender, { text: `✅ Selesai spam ke ${nomor}` });
};
