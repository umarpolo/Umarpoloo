# py/ytmp3.py
import sys
import os
from yt_dlp import YoutubeDL

if len(sys.argv) < 2:
    print("Link tidak ditemukan")
    sys.exit(1)

url = sys.argv[1]
output_path = "/data/data/com.termux/files/home/marbot/downloads/audio.mp3"

try:
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_path,
        'quiet': True,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
    }

    with YoutubeDL(ydl_opts) as ydl:
        ydl.download([url])
    print("SUKSES")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
