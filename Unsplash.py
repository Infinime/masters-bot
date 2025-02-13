import requests
from bs4 import BeautifulSoup
import json

# Function to search for images based on topic
def fetch_image_urls(topic, num_images=5):
    # We'll use Unsplash's search functionality (it has biology-related images)
    base_url = f"https://unsplash.com/s/photos/{topic}"
    response = requests.get(base_url)

    # If the request was successful, parse the HTML content
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, 'html.parser')
        images = []

        # Extract all the image URLs from the 'srcset' attribute of <img> tags
        for img_tag in soup.find_all('img', {'srcset': True}):
            img_url = img_tag['srcset'].split(',')[0].split(' ')[0]
            description = img_tag.get('alt', 'No description')  # Using alt text as the description

            if img_url and len(images) < num_images:
                images.append({'description': description, 'url': img_url})

        return images
    else:
        print(f"Failed to fetch images for {topic}")
        return []

# Function to post the image URL to the endpoint
def post_image_to_endpoint(image_data, endpoint_url):
    headers = {'Content-Type': 'application/json'}
    # Construct the JSON payload
    payload = json.dumps({
        'description': image_data['description'],
        'url': image_data['url']
    })

    response = requests.post(endpoint_url, headers=headers, data=payload)

    if response.status_code == 200:
        print(f"Image data posted successfully: {image_data['url']}")
    else:
        print(f"Failed to post image data. Status code: {response.status_code}")

# Example usage:
def main():
    topic = "biology"  # Topic for image search
    endpoint_url = "http://your-api-endpoint.com/api/images"  # Replace with your API endpoint

    images = fetch_image_urls(topic)

    # For each image found, post the data to the endpoint
    for image in images:
        post_image_to_endpoint(image, endpoint_url)

if __name__ == '__main__':
    main()
