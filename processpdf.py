import pdfplumber
import time
import requests

def send_to_api(data, page_number):
    api_url = "http://127.0.0.1:8787/doc/add"
    payload = {"data": data}
    response = requests.post(api_url, json=payload)
    print(f"Sending page {page_number} to API..")
    print("Preview:", data[:100])

    if response.status_code == 200:
        print(f"Successfully sent page {page_number} to API.")
    else:
        print(f"Failed to send page {page_number} to API.")
    time.sleep(0.5)

def process_pdf(file_path):
    with pdfplumber.open(file_path) as pdf:
        for page_number, page in enumerate(pdf.pages, start=1):
            text = page.extract_text()
            if text:
                send_to_api(text, page_number)

if __name__ == "__main__":
    process_pdf("./masters-bot/data/instrument.pdf")