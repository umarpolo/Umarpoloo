# konvercrypto.py
import sys, requests

def konversi(rupiah, symbol):
    try:
        url = f"https://api.coingecko.com/api/v3/simple/price?ids={symbol}&vs_currencies=idr"
        r = requests.get(url).json()
        harga = r[symbol]['idr']
        jumlah_koin = int(rupiah) / harga

        print(f"""
💱 Konversi Crypto

• Koin: {symbol.upper()}
• Jumlah Rupiah: Rp {int(rupiah):,}
• Harga 1 {symbol.upper()}: Rp {harga:,}
• Kamu dapat: {jumlah_koin:.10f} {symbol.upper()}
        """.strip())
    except:
        print("Gagal mengambil data. Pastikan nama koin valid dari CoinGecko.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Format: python3 konvercrypto.py <jumlah_rupiah> <symbol_koin>")
    else:
        konversi(sys.argv[1], sys.argv[2].lower())
