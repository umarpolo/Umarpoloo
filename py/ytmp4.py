import sys
import os
import yt_dlp

output_dir = os.path.expanduser('~/marbot/media/ytmp4')
os.makedirs(output_dir, exist_ok=True)

url = sys.argv[1]

ydl_opts = {
    'outtmpl': os.path.join(output_dir, '%(title)s.%(ext)s'),
    'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/mp4',
    'merge_output_format': 'mp4',
    'quiet': True,
    'no_warnings': True
}

try:
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        file_path = ydl.prepare_filename(info).replace('.webm', '.mp4').replace('.mkv', '.mp4')
        print(file_path)
except Exception as e:
    print(f"ERROR: {str(e)}")
