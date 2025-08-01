import sys
import requests
from bs4 import BeautifulSoup
import random

query = ' '.join(sys.argv[1:]).strip()
if not query:
    print('Tema kosong')
    exit()

headers = {
    'User-Agent': 'Mozilla/5.0'
}
url = f'https://www.google.com/search?tbm=isch&q={query}'
res = requests.get(url, headers=headers)

soup = BeautifulSoup(res.text, 'html.parser')
img_tags = soup.find_all('img')
img_links = [img['src'] for img in img_tags if 'src' in img.attrs and img['src'].startswith('http')]

if not img_links:
    print('Gagal')
    exit()

print(random.choice(img_links))
