import sys
import json
import os

# Path file counter.json
DATA_PATH = os.path.join(os.path.dirname(__file__), '../database/counter.json')

if len(sys.argv) < 2:
    print("Masukkan nama hero!\nContoh: python3 py/mlcounter.py miya")
    sys.exit()

hero = sys.argv[1].lower()

# Cek file ada
if not os.path.exists(DATA_PATH):
    print("❌ File counter.json tidak ditemukan.")
    sys.exit()

# Load data
with open(DATA_PATH, 'r') as f:
    data = json.load(f)

if hero not in data:
    print(f"❌ Counter untuk hero '{hero}' belum tersedia.")
    sys.exit()

info = data[hero]
countered_by = info.get("countered_by", [])
tips = info.get("tips", "-")

output = f"🛡️ *Counter untuk {hero.title()}*\n"
output += "\n".join([f"• {c}" for c in countered_by])
output += f"\n\n💡 Tips: {tips}"

print(output.strip())
