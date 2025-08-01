from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import sys, os

# Ambil teks dari argumen
teks = sys.argv[1]
kalimat = [k.strip() for k in teks.split('.') if k.strip()]
if len(kalimat) > 5:
    print("MAX5")
    exit()

# Final teks multiline
text = "\n".join(kalimat)

# Gambar dasar
size = (1080, 1080)
margin = 80
font_path = "/data/data/com.termux/files/usr/share/fonts/TTF/DejaVuSans.ttf"
if not Path(font_path).exists():
    print("FONT_NOT_FOUND")
    exit()

# Buat gambar kosong dulu
img = Image.new("RGBA", size, (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Fungsi untuk cari ukuran font
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

# Ukuran maksimal teks
max_width = size[0] - margin * 2
max_height = size[1] - margin * 2
font_size = cari_font_terbesar(text, font_path, max_width, max_height)
font = ImageFont.truetype(font_path, font_size)

# Hitung posisi teks di tengah
bbox = draw.multiline_textbbox((0, 0), text, font=font, spacing=20)
tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
x = (size[0] - tw) // 2
y = (size[1] - th) // 2

# Buat frame berkedip merah
frames = []
colors = [(255, 0, 0), (255, 255, 255)] * 4  # 8 frame (merah-putih)

for col in colors:
    frame = Image.new("RGBA", size, (255, 255, 255, 0))
    d = ImageDraw.Draw(frame)
    d.multiline_text((x, y), text, font=font, fill=col, spacing=20, align="center")
    frames.append(frame)

# Simpan animasi
output_dir = "/data/data/com.termux/files/home/marbot/tmp"
os.makedirs(output_dir, exist_ok=True)
out = f"{output_dir}/bratvid.webp"
frames[0].save(out, save_all=True, append_images=frames[1:], duration=200, loop=0, format="WEBP")
print(out)
