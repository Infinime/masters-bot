import requests
import os
import json

# Configuration
PIXABAY_API_KEY = "48818299-94c4040ee66cebc018e87aebf"  # Get your free API key from https://pixabay.com/api/docs/
ENDPOINT_URL = 'https://127.0.0.1/image/add'  # Replace with your actual endpoint URL

def get_images_from_pixabay(topic):
    url = f"https://pixabay.com/api/?key={PIXABAY_API_KEY}&q={topic}&image_type=photo"
    response = requests.get(url)

    if response.status_code != 200:
        raise Exception(f"Pixabay API request failed with status {response.status_code}")

    data = response.json()
    return data.get('hits', [])

def format_for_endpoint(images):
    return [{
        "description": f"Image of {img['tags']} by {img['user']}",
        "url": img['webformatURL']
    } for img in images]

def post_to_endpoint(payload):
    headers = {'Content-Type': 'application/json'}
    response = requests.post(ENDPOINT_URL, data=json.dumps(payload), headers=headers)
    return response

def main():
    topic = input("Enter search topic: ").strip()

    # Get images from Pixabay
    images = get_images_from_pixabay(topic)
    if not images:
        print("No images found for this topic")
        return

    # Format payload
    payload = format_for_endpoint(images)

    # Post to endpoint
    response = post_to_endpoint(payload)

    if response.status_code == 200:
        print(f"Successfully posted {len(payload)} images to endpoint")
    else:
        print(f"Failed to post images. Status code: {response.status_code}")
        print("Response:", response.text)

if __name__ == "__main__":
    main()