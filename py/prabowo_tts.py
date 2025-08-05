from gtts import gTTS
from pydub import AudioSegment
import sys

teks = sys.argv[1]
tts = gTTS(teks, lang='id')
tts.save("temp.mp3")

# efek suara berat ala Prabowo (pitch diturunkan, tempo diperlambat)
audio = AudioSegment.from_file("temp.mp3")
audio = audio._spawn(audio.raw_data, overrides={
    "frame_rate": int(audio.frame_rate * 0.85)  # pelan dan berat
})
audio = audio.set_frame_rate(44100)
audio.export("prabowo.mp3", format="mp3", bitrate="64k")
print("OK")
