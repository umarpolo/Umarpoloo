import sys
import requests

url = sys.argv[1]
ss_url = f'https://image.thum.io/get/fullpage/{url}'
r = requests.get(ss_url)

if r.status_code == 200:
        with open('/data/data/com.termux/files/home/marbot/downloads/ssweb.png', 'wb') as f:
                f.write(r.content)
        print("sukses")
else:
        print("gagal")
