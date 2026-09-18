import os
import sys
import asyncio
import httpx
import json

async def test_model(model):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("Error: GEMINI_API_KEY environment variable is not set.")
        return False
        
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    params = {"key": api_key}
    
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": "Hello, respond in two words!"
                    }
                ]
            }
        ]
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, json=payload, params=params, timeout=10.0)
            if response.status_code == 200:
                print(f"✓ Working: {model}")
                return True
            else:
                return False
        except Exception:
            return False

async def main():
    models = [
        "gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.5-flash-preview-tts",
        "gemini-2.5-pro-preview-tts", "gemma-4-26b-a4b-it", "gemma-4-31b-it",
        "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-pro-latest",
        "gemini-2.5-flash-lite", "gemini-2.5-flash-image", "gemini-3-flash-preview",
        "gemini-3.1-pro-preview", "gemini-3.1-pro-preview-customtools",
        "gemini-3.1-flash-lite-preview", "gemini-3.1-flash-lite",
        "gemini-3-pro-image-preview", "gemini-3-pro-image", "nano-banana-pro-preview",
        "gemini-3.1-flash-image-preview", "gemini-3.1-flash-image",
        "gemini-3.1-flash-lite-image", "gemini-3.5-flash", "gemini-3.5-flash-lite",
        "gemini-omni-flash-preview", "gemini-3.6-flash", "gemini-3.7-flash",
        "lyria-3-clip-preview", "lyria-3-pro-preview", "gemini-3.1-flash-tts-preview",
        "gemini-robotics-er-1.6-preview", "gemini-robotics-er-2-preview",
        "gemini-2.5-computer-use-preview-10-2025", "antigravity-preview-05-2026",
        "deep-research-max-preview-04-2026", "deep-research-preview-04-2026",
        "deep-research-pro-preview-12-2025"
    ]
    
    # Run test on all models concurrently
    tasks = [test_model(m) for m in models]
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
