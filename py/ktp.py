from PIL import Image, ImageDraw, ImageFont
import sys
import os

# Ambil input dari argumen
nama = sys.argv[1]
nik = sys.argv[2]
ttl = sys.argv[3]
alamat = sys.argv[4]
pekerjaan = sys.argv[5]

# Buat canvas dasar KTP
ktp = Image.new('RGB', (1024, 640), (255, 255, 255))
draw = ImageDraw.Draw(ktp)

# Load font
font_bold = ImageFont.truetype('/system/fonts/DroidSans-Bold.ttf', 36)
font_reg = ImageFont.truetype('/system/fonts/DroidSans.ttf', 28)

# Tulis teks KTP
draw.text((40, 30), "PROVINSI ANIME INDONESIA", fill='black', font=font_bold)
draw.text((40, 90), "KABUPATEN OTAKU TIMUR", fill='black', font=font_bold)

draw.text((40, 160), f"NIK         : {nik}", fill='black', font=font_reg)
draw.text((40, 210), f"Nama        : {nama}", fill='black', font=font_reg)
draw.text((40, 260), f"TTL         : {ttl}", fill='black', font=font_reg)
draw.text((40, 310), f"Alamat      : {alamat}", fill='black', font=font_reg)
draw.text((40, 360), f"Pekerjaan   : {pekerjaan}", fill='black', font=font_reg)

# Masukkan foto anime
foto = Image.open(os.path.expanduser("~/marbot/py/fotoanime.jpg")).resize((200, 240))
ktp.paste(foto, (800, 160))

# Simpan hasil
output_path = os.path.expanduser("~/marbot/py/hasil_ktp.jpg")
ktp.save(output_path)
print("done")
