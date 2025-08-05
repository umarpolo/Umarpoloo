const axios = require('axios')

module.exports = async (sock, msg, command, args) => {
    const cari = args.join(' ').toLowerCase()

    if (!cari) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: '⚠️ Contoh penggunaan:\n.cekgempa sukabumi\n.cekgempa malang'
        }, { quoted: msg })
    }

    try {
        const res = await axios.get('https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json')
        const list = res.data.Infogempa.gempa

        const hasil = list.filter(gempa =>
            gempa.Wilayah.toLowerCase().includes(cari)
        )

        if (hasil.length === 0) {
            return sock.sendMessage(msg.key.remoteJid, {
                text: `❌ Tidak ditemukan gempa untuk wilayah *${cari}* dalam data BMKG terbaru.`
            }, { quoted: msg })
        }

        const teks = hasil.slice(0, 3).map((g, i) => (
            `📍 *${g.Wilayah}*\n` +
            `📅 ${g.Tanggal} - 🕒 ${g.Jam}\n` +
            `🌋 Magnitudo: ${g.Magnitude} | Kedalaman: ${g.Kedalaman}\n` +
            `📌 Lokasi: ${g.Lintang}, ${g.Bujur}\n` +
            `💢 Potensi: ${g.Potensi}`
        )).join('\n\n')

        await sock.sendMessage(msg.key.remoteJid, {
            text: `📡 *Hasil Pencarian Gempa di: ${cari.toUpperCase()}*\n\n${teks}`
        }, { quoted: msg })

    } catch (err) {
        console.error('❌ Gagal ambil data gempa:', err.message)
        await sock.sendMessage(msg.key.remoteJid, {
            text: '❌ Gagal mengambil data gempa dari BMKG. Coba lagi nanti.'
        }, { quoted: msg })
    }
}

