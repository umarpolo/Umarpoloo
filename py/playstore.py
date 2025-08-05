# py/playstore.py
import sys
import requests
import re
import os

def download_apk(package_name):
    info_url = f'https://apkcombo.com/id/apk-downloader/?device=&arch=arm64-v8a&android=default&package={package_name}'
    headers = {
        'User-Agent': 'Mozilla/5.0'
    }

    res = requests.get(info_url, headers=headers)
    if res.status_code != 200:
        print("gagal")
        return

    # Cari link download langsung dari HTML
    match = re.search(r'href="(https://download\.apkcombo\.com/[^"]+\.apk[^"]*)"', res.text)
    if not match:
        print("gagal")
        return

    download_url = match.group(1)
    file_name = f"{package_name}.apk"

    try:
        r = requests.get(download_url, headers=headers, stream=True)
        with open(file_name, 'wb') as f:
            for chunk in r.iter_content(chunk_size=8192):
                f.write(chunk)
        print(file_name)
    except:
        print("gagal")

if __name__ == "__main__":
    try:
        link = sys.argv[1]
        match = re.search(r'id=([a-zA-Z0-9._]+)', link)
        if not match:
            print("gagal")
            sys.exit()
        package = match.group(1)
        download_apk(package)
    except:
        print("gagal")

