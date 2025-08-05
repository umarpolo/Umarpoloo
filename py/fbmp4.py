import requests
import sys
import re
from bs4 import BeautifulSoup

def get_facebook_video(url):
    print("⏳ Mengambil link video...")

    try:
        session = requests.Session()
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Content-Type': 'application/x-www-form-urlencoded'
        }

        res = session.post("https://fdown.net/download.php", headers=headers, data={'URLz': url}, timeout=10)
        soup = BeautifulSoup(res.text, "html.parser")

        # Cari tag <a> yang mengandung .mp4
        link_tag = soup.find("a", href=re.compile(r"\.mp4"))
        if not link_tag:
            print("GAGAL: Tidak ditemukan video.")
            return

        print("✅ Link Video:")
        print(link_tag["href"])

    except Exception as e:
        print("GAGAL:", str(e))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Contoh: python fbmp4.py <link_facebook>")
    else:
        get_facebook_video(sys.argv[1])
