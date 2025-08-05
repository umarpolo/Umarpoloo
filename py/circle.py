from PIL import Image, ImageDraw
import sys
import os

# Path input dan output
input_path = sys.argv[1]
output_path = os.path.expanduser('~/marbot/media/circle.png')

# Buka gambar
img = Image.open(input_path).convert("RGBA")
width, height = img.size
size = min(width, height)

# Crop ke tengah jadi persegi
left = (width - size) // 2
top = (height - size) // 2
right = left + size
bottom = top + size
img = img.crop((left, top, right, bottom))

# Masking lingkaran
mask = Image.new('L', (size, size), 0)
draw = ImageDraw.Draw(mask)
draw.ellipse((0, 0, size, size), fill=255)

# Gabungkan mask dengan gambar
result = Image.new('RGBA', (size, size))
result.paste(img, (0, 0), mask=mask)
result.save(output_path)

print(output_path)
