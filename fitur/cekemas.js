module.exports = async (sock, msg, command, args) => {
    const hargaJual = 'Rp 1.927.000'
    const hargaBeli = 'Rp 1.773.000'
    const tanggal = '21 juli 2025' // Ubah ini manual tiap hari

    const teks = `💰 *Harga Emas Hari Ini*\n\n` +
                 `📅 Tanggal: ${tanggal}\n` +
                 `📤 Harga Jual: ${hargaJual}\n` +
                 `📥 Harga Beli: ${hargaBeli}\n\n` +
                 `🔁 Update manual setiap pagi.\n` +
                 `Sumber: marpolo.com`

    await sock.sendMessage(msg.key.remoteJid, { text: teks }, { quoted: msg })
}
