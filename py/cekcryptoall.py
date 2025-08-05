import requests

def format_rupiah(amount):
    return f"Rp {amount:,.0f}".replace(",", ".")

def format_dollar(amount):
    return f"${amount:,.2f}"

def cek_crypto_all():
    try:
        url = 'https://api.coingecko.com/api/v3/global'
        data = requests.get(url).json()['data']

        total_coins = data['active_cryptocurrencies']
        total_market_cap_usd = data['total_market_cap']['usd']
        total_volume_usd = data['total_volume']['usd']

        kurs = requests.get('https://api.coingecko.com/api/v3/exchange_rates').json()
        usd_to_idr = kurs['rates']['idr']['value']

        total_market_cap_idr = total_market_cap_usd * usd_to_idr
        total_volume_idr = total_volume_usd * usd_to_idr

        hasil = f"""📊 𝗦𝘁𝗮𝘁𝗶𝘀𝘁𝗶𝗸 𝗖𝗿𝘆𝗽𝘁𝗼 𝗛𝗮𝗿𝗶 𝗜𝗻𝗶

🪙 Jumlah Koin     : {total_coins:,}
💰 Market Cap Dunia:
    • USD : *{format_dollar(total_market_cap_usd)}*
    • IDR : *{format_rupiah(total_market_cap_idr)}*

📈 Volume 24 Jam   :
    • USD : *{format_dollar(total_volume_usd)}*
    • IDR : *{format_rupiah(total_volume_idr)}*"""

        print(hasil)

    except Exception as e:
        print("Gagal mengambil data:", e)

if __name__ == "__main__":
    cek_crypto_all()
