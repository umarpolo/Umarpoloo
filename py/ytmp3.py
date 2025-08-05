import yt_dlp
import sys

if len(sys.argv) < 2:
    print("Masukkan link YouTube!")
    sys.exit()

url = sys.argv[1]

ydl_opts = {
    'format': 'bestaudio/best',
    'outtmpl': '/data/data/com.termux/files/home/marbot/downloads/%(title)s.%(ext)s',
    'postprocessors': [{
        'key': 'FFmpegExtractAudio',
        'preferredcodec': 'mp3',
        'preferredquality': '192',
    }],
    'quiet': True,
    'no_warnings': True
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    try:
        ydl.download([url])
        print("✅ Berhasil download audio.")
    except Exception as e:
        print("❌ Gagal:", str(e))
