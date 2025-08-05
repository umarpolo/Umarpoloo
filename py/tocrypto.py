# py/tocrypto.py
import requests

def ambil_1000_koin():
    url = "https://api.coingecko.com/api/v3/coins/markets"
    params = {
        'vs_currency': 'usd',
        'order': 'market_cap_desc',
        'per_page': 1000,
        'page': 1,
        'sparkline': 'false'
    }

    res = requests.get(url, params=params)
    data = res.json()

    hasil = []
    for i, coin in enumerate(data, start=1):
        nama = coin['name']                 # Nama coin (contoh: Bitcoin)
        simbol = coin['symbol'].upper()     # Simbol coin (contoh: BTC)
        perusahaan = coin['id']             # Nama unik coin di CoinGecko (contoh: bitcoin)

        hasil.append(f"{i}. {nama} ({simbol}) — ID: {perusahaan}")

    return "\n".join(hasil)

if __name__ == "__main__":
    try:
        print(ambil_1000_koin())
    except Exception as e:
        print("gagal:", e)
