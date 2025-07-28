# py/tiktok.py
import sys
import yt_dlp

url = sys.argv[1]

ydl_opts = {
    'outtmpl': 'video.mp4',
    'format': 'mp4',
    'quiet': True,
    'no_warnings': True,
}

with yt_dlp.YoutubeDL(ydl_opts) as ydl:
    info = ydl.extract_info(url, download=True)
    print("SUKSES")
