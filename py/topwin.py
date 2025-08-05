import sys
import requests

# Daftar durasi yang diizinkan
DURASI_VALID = {
    "1": "1d",
    "7": "7d",
    "30": "30d",
    "365": "1y",
    "730": "2y"
}

# Cek input
if len(sys.argv) < 2:
    print("Gunakan: .topwin <hari>\nContoh: .topwin 7\nDurasi yang didukung: 1, 7, 30, 365, 730")
    sys.exit()

hari = sys.argv[1]

if hari not in DURASI_VALID:
    print("Durasi tidak valid. Gunakan salah satu dari: 1, 7, 30, 365, 730")
    sys.exit()

durasi = DURASI_VALID[hari]

# Ambil data market
url = "https://api.coingecko.com/api/v3/coins/markets"
params = {
    "vs_currency": "usd",
    "order": "market_cap_desc",
    "per_page": 100,
    "page": 1,
    "sparkline": False,
    "price_change_percentage": durasi
}
response = requests.get(url, params=params)
data = response.json()

# Cari top 10 yang naik tertinggi
hasil = []
for koin in data:
    persen = koin.get(f"price_change_percentage_{durasi}_in_currency")
    if persen is not None:
        hasil.append({
            "nama": koin["name"],
            "simbol": koin["symbol"].upper(),
            "harga": koin["current_price"],
            "persen": persen
        })

# Urutkan berdasarkan persen tertinggi
hasil = sorted(hasil, key=lambda x: x["persen"], reverse=True)[:10]

# Format hasil
teks = f"📈 *Top 10 Kenaikan Crypto {hari} Hari Terakhir*\n\n"
for i, koin in enumerate(hasil, 1):
    teks += f"{i}. {koin['nama']} ({koin['simbol']})\n"
    teks += f"   ↑ {koin['persen']:.2f}% | ${koin['harga']:,.2f}\n"

print(teks.strip())
