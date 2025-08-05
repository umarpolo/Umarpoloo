import os

FOLDER = os.path.expanduser('~/marbot')
total = 0
ext = {'.js': 0, '.py': 0}

for root, _, files in os.walk(FOLDER):
    for file in files:
        e = os.path.splitext(file)[1]
        if e in ext:
            try:
                with open(os.path.join(root, file), 'r', encoding='utf-8', errors='ignore') as f:
                    isi = f.read()
                    panjang = len(isi)
                    ext[e] += panjang
                    total += panjang
            except:
                pass

def persen(jumlah):
    return round((jumlah / total) * 100, 1) if total else 0.0

print(f"📊 *Statistik Kode Bot (folder marbot):*\n")
print(f"- JavaScript (.js): {persen(ext['.js'])}%")
print(f"- Python     (.py): {persen(ext['.py'])}%")
print(f"\nTotal: {total:,} karakter kode")
