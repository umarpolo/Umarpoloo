const axios = require('axios')

module.exports = async (sock, msg, command, args) => {
    const coin = args[0]?.toLowerCase()
    if (!coin) {
        return sock.sendMessage(msg.key.remoteJid, { text: 'Contoh: .cekcrypto btc' }, { quoted: msg })
    }

    try {
        const { data } = await axios.get(`https://api.coingecko.com/api/v3/coins/markets`, {
            params: {
                vs_currency: 'usd',
                ids: '',
                order: 'market_cap_desc',
                per_page: 250,
                page: 1,
                sparkline: false
            }
        })

        // Cari berdasarkan symbol
        const result = data.find(c => c.symbol.toLowerCase() === coin)

        if (!result) {
            return sock.sendMessage(msg.key.remoteJid, { text: 'Koin tidak ditemukan!' }, { quoted: msg })
        }

        // Ambil juga harga dalam IDR
        const idrData = await axios.get(`https://api.coingecko.com/api/v3/simple/price`, {
            params: {
                ids: result.id,
                vs_currencies: 'idr'
            }
        })

        const text = `💹 *Info Crypto: ${result.name} (${result.symbol.toUpperCase()})*
💵 Harga USD: $${result.current_price.toLocaleString()}
🇮🇩 Harga IDR: Rp${idrData.data[result.id].idr.toLocaleString()}
📈 24h: ${result.price_change_percentage_24h?.toFixed(2)}%
💰 Market Cap: $${(result.market_cap / 1e9).toFixed(2)}B
🔄 Volume 24h: $${(result.total_volume / 1e9).toFixed(2)}B
🌐 Powered by CoinGecko`

        await sock.sendMessage(msg.key.remoteJid, { text }, { quoted: msg })

    } catch (e) {
        console.error(e)
        await sock.sendMessage(msg.key.remoteJid, { text: 'Gagal mengambil data crypto!' }, { quoted: msg })
    }
}
