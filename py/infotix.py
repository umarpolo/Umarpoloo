# py/infotix.py
import requests
import locale

locale.setlocale(locale.LC_ALL, '')

def format_idr(rupiah):
    return f"Rp {rupiah:,.0f}".replace(",", ".")

def get_top_tokens():
    url = "https://api.coingecko.com/api/v3/coins/markets"
    params = {
        'vs_currency': 'usd',
        'order': 'market_cap_desc',
        'per_page': 7,
        'page': 1,
        'sparkline': 'false'
    }

    res = requests.get(url, params=params)
    data = res.json()

    hasil = []
    for i, coin in enumerate(data, start=1):
        nama = coin['name']
        simbol = coin['symbol'].upper()
        harga_usd = coin['current_price']
        harga_idr = harga_usd * 16000
        marketcap = coin['market_cap']
        volume = coin['total_volume']
        persen = coin['price_change_percentage_24h']
        logo = coin['image']

        arah = "📈" if persen >= 0 else "📉"

        hasil.append(f"""{i}. {nama} ({simbol}) {arah}
🪙 Harga: ${harga_usd:,.2f} ({format_idr(harga_idr)})
🏷️ Market Cap: ${marketcap:,.0f}
📊 Volume 24h: ${volume:,.0f}
📉 24h Change: {persen:.2f}%
🖼️ Logo: {logo}
""")
    return "\n".join(hasil)

if __name__ == "__main__":
    try:
        print(get_top_tokens())
    except:
        print("gagal")
