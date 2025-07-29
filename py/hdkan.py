import cv2
import sys
import os

input_path = sys.argv[1]
output_path = '/data/data/com.termux/files/home/marbot/temp_image_hd.jpg'

# Pakai model bawaan dari OpenCV
sr = cv2.dnn_superres.DnnSuperResImpl_create()
model_path = '/data/data/com.termux/files/home/marbot/EDSR_x4.pb'

if not os.path.exists(model_path):
    print("❌ Model super resolution belum ada!")
    sys.exit(1)

sr.readModel(model_path)
sr.setModel("edsr", 4)

image = cv2.imread(input_path)
if image is None:
    print("❌ Gagal membaca gambar")
    sys.exit(1)

result = sr.upsample(image)
cv2.imwrite(output_path, result)
print("✅ HD sukses")
