import os
import sys
import subprocess

def run_jadibot(nomor):
    session = f"session-jadibot-{nomor}"
    print(f"[•] Menjalankan jadibot untuk {nomor}...")
    os.makedirs(session, exist_ok=True)

    try:
        subprocess.Popen(["node", "bot.js", session])
        print("[✓] Jadibot sedang berjalan... QR akan muncul di Termux.")
    except Exception as e:
        print("[✗] Gagal menjalankan jadibot:", e)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("❗ Masukkan nomor pengguna (tanpa @s.whatsapp.net)")
    else:
        run_jadibot(sys.argv[1])
