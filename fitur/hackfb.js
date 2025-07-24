// fitur/hackfb.js

module.exports = async (sock, msg, command, args) => {
    const from = msg.key.remoteJid;
    const namaTarget = args.join(' ').trim();

    if (!namaTarget) {
        return msg.reply('Masukkan nama target!\nContoh: .hackfb rehan');
    }

    // Daftar pola password tiruan
    const polaPassword = [
        '{nama}123',
        '{nama}1234',
        '{nama}ganteng',
        '{nama}gaming',
        '{nama}123456',
        '{nama}1122',
        '{nama}@fb',
        '{nama}2025',
        '{nama}lover',
        '{nama}xyz',
        'siganteng{nama}',
        '{nama}404',
        '{nama}070900',
        '{nama}007',
    ];

    // Ambil salah satu password acak
    const acak = polaPassword[Math.floor(Math.random() * polaPassword.length)];
    const password = acak.replace(/{nama}/g, namaTarget.toLowerCase());

    const teksBalasan = `*🕵️‍♂️ Hasil Hacking*:\n\nFB: ${namaTarget}\nPassword: ${password}\n\n📛 *Jangan disalahgunakan ya!*`;

    await sock.sendMessage(from, { text: teksBalasan }, { quoted: msg });
};
