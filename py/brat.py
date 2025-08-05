from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import sys
import os

# Ambil input dari argumen
teks = sys.argv[1]
kalimat = [k.strip() for k in teks.split('.') if k.strip()]
if len(kalimat) > 5:
    print("MAX5")
    exit()

# Buat teks final, setiap kalimat baris baru
text = "\n".join(kalimat)

# Ukuran gambar
img_size = (1080, 1080)
margin = 80  # margin dari pinggir
img = Image.new('RGBA', img_size, (255, 255, 255, 0))
draw = ImageDraw.Draw(img)

# Font reguler (tidak tebal)
font_path = "/data/data/com.termux/files/usr/share/fonts/TTF/DejaVuSans.ttf"
if not Path(font_path).exists():
    print("FONT_NOT_FOUND")
    exit()

# Fungsi untuk cari ukuran font terbesar yang muat
def cari_font_terbesar(text, font_path, max_w, max_h):
    size = 10
    while size < 300:
        font = ImageFont.truetype(font_path, size)
        bbox = draw.multiline_textbbox((0, 0), text, font=font, spacing=20)
        w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        if w >= max_w or h >= max_h:
            return size - 2
        size += 2
    return size

# Hitung font optimal
max_width = img_size[0] - margin * 2
max_height = img_size[1] - margin * 2
font_size = cari_font_terbesar(text, font_path, max_width, max_height)
font = ImageFont.truetype(font_path, font_size)

# Hitung posisi agar teks di tengah
bbox = draw.multiline_textbbox((0, 0), text, font=font, spacing=20)
text_width = bbox[2] - bbox[0]
text_height = bbox[3] - bbox[1]
x = (img_size[0] - text_width) // 2
y = (img_size[1] - text_height) // 2

# Gambar teks ke gambar
draw.multiline_text((x, y), text, font=font, fill=(0, 0, 0), spacing=20, align="center")

# Simpan file ke folder tmp
output_dir = "/data/data/com.termux/files/home/marbot/tmp"
os.makedirs(output_dir, exist_ok=True)
output_path = f"{output_dir}/brat.webp"
img.save(output_path, "WEBP")
print(output_path)
