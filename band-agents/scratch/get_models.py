import httpx
import os
from dotenv import load_dotenv

load_dotenv()

BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.freetheai.xyz/v1")
API_KEY = os.getenv("OPENAI_API_KEY")

headers = {
    "Authorization": f"Bearer {API_KEY}"
}

def fetch_models():
    print(f"Fetching models from {BASE_URL}...")
    try:
        resp = httpx.get(f"{BASE_URL}/models", headers=headers)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 200:
            data = resp.json()
            models = [m["id"] for m in data.get("data", [])]
            models.sort()
            print("\nAvailable models:")
            for m in models:
                print(f" - {m}")
        else:
            print(f"Error response: {resp.text}")
    except Exception as e:
        print(f"Error fetching models: {e}")

if __name__ == "__main__":
    fetch_models()
