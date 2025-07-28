# fiturpython/ssweb.py
import sys
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

def ambil_screenshot(url, output_file):
    options = Options()
    options.headless = True
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')

    driver = webdriver.Chrome(options=options)
    driver.set_window_size(1280, 720)
    driver.get(url)
    driver.save_screenshot(output_file)
    driver.quit()

if __name__ == "__main__":
    url = sys.argv[1]
    output_file = sys.argv[2]
    ambil_screenshot(url, output_file)
