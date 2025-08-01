import sys
from PIL import Image, ImageFilter

if len(sys.argv) != 3:
    print("Usage: python blur.py input.jpg output.jpg")
    sys.exit(1)

input_path = sys.argv[1]
output_path = sys.argv[2]

try:
    image = Image.open(input_path)
    blurred = image.filter(ImageFilter.GaussianBlur(radius=15))
    blurred.save(output_path)
    print("Blur berhasil disimpan di", output_path)
except Exception as e:
    print("Gagal blur:", e)
    sys.exit(1)
