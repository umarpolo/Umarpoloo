import requests
import sys

def top_loser_crypto(jumlah_hari):
    try:
        jumlah_hari = int(jumlah_hari)
    except:
        print("Error: Gunakan format: .toplose <jumlahhari>")
        sys.exit()

    if jumlah_hari not in [1, 7, 14, 30, 90, 180, 365, 730]:
        print("Hanya mendukung: 1, 7, 14, 30, 90, 180, 365, 730 hari")
        sys.exit()

    url = 'https://api.coingecko.com/api/v3/coins/markets'
    params = {
        'vs_currency': 'usd',
        'order': 'market_cap_desc',
        'per_page': 250,
        'page': 1,
        'sparkline': 'false',
        'price_change_percentage': f'{jumlah_hari}d'
    }

    res = requests.get(url, params=params)
    data = res.json()

    persen_key = f'price_change_percentage_{jumlah_hari}d_in_currency'

    # Hanya coin dengan data perubahan harga yang valid
    filtered = [
        coin for coin in data
        if coin.get(persen_key) is not None
    ]

    sorted_coins = sorted(filtered, key=lambda x: x[persen_key])[:10]

    hasil = f'📉 *Top 10 Penurunan Crypto {jumlah_hari} Hari Terakhir*\n\n'
    for i, coin in enumerate(sorted_coins, 1):
        nama = coin['name']
        simbol = coin['symbol'].upper()
        harga = coin['current_price']
        turun = coin[persen_key]
        hasil += f"{i}. {nama} ({simbol})\n   ↓ {turun:.2f}% | ${harga:,.2f}\n"

    print(hasil)

# Contoh penggunaan di CLI: python toplose.py 30
if __name__ == '__main__':
    if len(sys.argv) == 2:
        top_loser_crypto(sys.argv[1])
    else:
        print("Gunakan: python toplose.py <jumlah_hari>")
