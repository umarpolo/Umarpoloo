import requests

def ambil_cctv():
        try:
                url = "https://images.drivebc.ca/bchighwaycam/pub/cameras/128.jpg"
                r = requests.get(url)
                if r.status_code == 200:
                        with open("temp_cctv.jpg", "wb") as f:
                                f.write(r.content)
                        print("sukses")
                else:
                        print("gagal")
        except:
                print("gagal")

if __name__ == "__main__":
        ambil_cctv()
