import json
import random
import os

file_path = os.path.expanduser('~/marbot/database/ceritahoror.json')

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        cerita = random.choice(data)
        print(f"👻 *{cerita['judul']}*\n\n{cerita['cerita']}")
except Exception as e:
    print("❌ Gagal mengambil cerita horor.")
