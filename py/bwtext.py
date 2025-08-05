from PIL import Image, ImageDraw, ImageFont
import sys
import os

try:
    text = sys.argv[1]
except:
    print("Teks tidak ditemukan!")
    sys.exit(1)

# Font path sesuai Termux
font_path = "/data/data/com.termux/files/usr/share/fonts/TTF/DejaVuSans-Bold.ttf"

# Ukuran dan setup gambar
width = 1080
height = 1080
bg_color = "white"
text_color = "black"
font_size = 60

try:
    font = ImageFont.truetype(font_path, font_size)
except:
    print("Font tidak ditemukan!")
    sys.exit(1)

image = Image.new("RGB", (width, height), bg_color)
draw = ImageDraw.Draw(image)

# Biar teks rapi di tengah
lines = []
words = text.split(" ")
line = ""
for word in words:
    test_line = line + word + " "
    if draw.textlength(test_line, font=font) <= width - 100:
        line = test_line
    else:
        lines.append(line)
        line = word + " "
lines.append(line)

y_text = (height - (len(lines) * font_size)) // 2
for line in lines:
    text_width = draw.textlength(line, font=font)
    draw.text(((width - text_width) / 2, y_text), line, font=font, fill=text_color)
    y_text += font_size + 10

output_path = "bwtext_output.jpg"
image.save(output_path)
print(output_path)
