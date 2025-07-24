import cv2
import os

# Buka gambar
img = cv2.imread('temp_image.jpg')
if img is None:
    print("error: gambar tidak ditemukan")
    exit()

# Deteksi wajah
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
faces = face_cascade.detectMultiScale(gray, 1.3, 5)

# Folder output
output_folder = 'hasil_wajah'
if not os.path.exists(output_folder):
    os.makedirs(output_folder)

if len(faces) == 0:
    print("error: tidak ada wajah terdeteksi")
    exit()

# Simpan masing-masing wajah sebagai gambar baru
for i, (x, y, w, h) in enumerate(faces):
    face_img = img[y:y+h, x:x+w]
    filename = f"{output_folder}/face_{i}.jpg"
    cv2.imwrite(filename, face_img)

print("done")
