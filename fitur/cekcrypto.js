const axios = require('axios')

module.exports = async (sock, msg, command, args) => {
        const coin = args[0]?.toLowerCase()
        if (!coin) {
                return sock.sendMessage(msg.key.remoteJid, { text: 'Contoh: .cekcrypto btc' }, { quoted: msg })
        }

        try {
                const { data } = await axios.get('https://api.coingecko.com/api/v3/coins/markets', {
                        params: {
                                vs_currency: 'usd',
                                order: 'market_cap_desc',
                                per_page: 250,
                                page: 1,
                                sparkline: false,
                                price_change_percentage: '24h,7d,30d,1y'
                        }
                })

                const result = data.find(c => c.symbol.toLowerCase() === coin)
                if (!result) {
                        return sock.sendMessage(msg.key.remoteJid, { text: 'Koin tidak ditemukan!' }, { quoted: msg })
                }

                const idrData = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                        params: {
                                ids: result.id,
                                vs_currencies: 'idr'
                        }
                })

                const text = `💹 *Info Crypto: ${result.name} (${result.symbol.toUpperCase()})*
💵 Harga USD: $${result.current_price.toLocaleString()}
🇮🇩 Harga IDR: Rp${idrData.data[result.id].idr.toLocaleString()}
📈 Perubahan Harga:
  • 1 Hari: ${result.price_change_percentage_24h?.toFixed(2)}%
  • 7 Hari: ${result.price_change_percentage_7d_in_currency?.toFixed(2) || 'N/A'}%
  • 30 Hari: ${result.price_change_percentage_30d_in_currency?.toFixed(2) || 'N/A'}%
  • 1 Tahun: ${result.price_change_percentage_1y_in_currency?.toFixed(2) || 'N/A'}%
  • 5 Tahun: N/A (CoinGecko tidak menyediakan data ini)
💰 Market Cap: $${(result.market_cap / 1e9).toFixed(2)}B
🔄 Volume 24h: $${(result.total_volume / 1e9).toFixed(2)}B
🌐 Powered by CoinGecko`

                await sock.sendMessage(msg.key.remoteJid, {
                        image: { url: result.image },
                        caption: text
                }, { quoted: msg })

        } catch (e) {
                console.error(e)
                await sock.sendMessage(msg.key.remoteJid, { text: 'Gagal mengambil data crypto!' }, { quoted: msg })
        }
}
