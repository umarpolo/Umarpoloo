# ~/marbot/py/cekdata.py

import sys
import requests
from bs4 import BeautifulSoup

def cek_data(email):
    headers = {
        'User-Agent': 'Mozilla/5.0'
    }
    url = f"https://monitor.firefox.com/search?q={email}"
    try:
        res = requests.get(url, headers=headers)
        if "We found your email" not in res.text:
            print("❌ Email tidak ditemukan di data bocor apa pun.")
            return
        soup = BeautifulSoup(res.text, "html.parser")
        breaches = soup.select("div.breach-info h3")
        if not breaches:
            print("✅ Aman, tidak ditemukan kebocoran data.")
            return
        print(f"⚠️ Email *{email}* ditemukan di *{len(breaches)}* kebocoran data:\n")
        for b in breaches:
            print(f"• {b.text.strip()}")
    except Exception as e:
        print("Gagal memeriksa email:", str(e))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Email belum diberikan.")
    else:
        cek_data(sys.argv[1])
