# 🤖 Cara Cepat Pasang Bot WhatsApp (MARBOT) di Termux

```bash
# 1. Update & install semua paket yang dibutuhkan
pkg update && pkg upgrade -y
pkg install git nodejs ffmpeg imagemagick -y

# 2. Clone bot dari GitHub
git clone -b master https://github.com/umarpolo/Umarpoloo.git marbot
cd marbot

# 3. Install semua module
npm install

# 4. Jalankan bot
node bot.js

# ✅ Scan QR Code yang muncul pakai WhatsApp kamu
# 📌 Bot langsung aktif dan siap dipakai
