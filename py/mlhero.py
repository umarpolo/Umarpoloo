import sys
import requests
from bs4 import BeautifulSoup

if len(sys.argv) < 2:
    print('err|Hero tidak boleh kosong')
    sys.exit()

hero = sys.argv[1].capitalize()
url = f"https://mobile-legends.fandom.com/wiki/{hero}"

headers = {
    "User-Agent": "Mozilla/5.0"
}

res = requests.get(url, headers=headers)
if res.status_code != 200:
    print(f'err|Hero "{hero}" tidak ditemukan.')
    sys.exit()

soup = BeautifulSoup(res.text, 'html.parser')
infobox = soup.select_one('.portable-infobox')
if not infobox:
    print(f'err|Data hero "{hero}" tidak ditemukan.')
    sys.exit()

# Ambil gambar
gambar = ''
img = infobox.select_one('img')
if img and img.get('src'):
    gambar = img['src']

# Ambil detail
role, specialty, difficulty = '-', '-', '-'
lane = []

for item in infobox.select('.pi-item'):
    label = item.select_one('.pi-data-label')
    value = item.select_one('.pi-data-value')
    if label and value:
        label = label.text.strip().lower()
        value = value.text.strip()
        if 'role' in label:
            role = value
        elif 'specialty' in label:
            specialty = value
        elif 'difficulty' in label:
            difficulty = value
        elif 'lane' in label:
            lane.append(value)

# Cetak dengan pemisah
print(f'ok|{hero}|{role}|{specialty}|{", ".join(lane) or "-"}|{difficulty}|{gambar}')
