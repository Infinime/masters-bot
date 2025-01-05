from PyPDF2 import PdfReader

def get_pdf_text(docs:list):
    text = ""
    for pdf in docs:
        pdf_reader = PdfReader(pdf)
        for page in pdf_reader.pages:
            extracted_text = page.extract_text()
            if extracted_text:  # Check if text is not None
                text += extracted_text + "\n"
    return text

print(get_pdf_text(["./data/instrument.pdf"])[:1000])
