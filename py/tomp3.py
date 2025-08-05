import sys
import os
import subprocess
from pydub import AudioSegment

def convert_to_mp3(video_path, output_path):
    audio = AudioSegment.from_file(video_path)
    audio.export(output_path, format="mp3", bitrate="64k")  # dikompres jadi lebih kecil

if __name__ == "__main__":
    video_path = sys.argv[1]
    output_path = sys.argv[2]

    try:
        convert_to_mp3(video_path, output_path)
        print("OK")
    except Exception as e:
        print("ERROR:", e)
