import os
import django
from django.conf import settings

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.ai_engine import SoftwareAI

def test_ai():
    print("Testing AI Engine with the new API key...")
    # Using a dummy school_id for testing
    ai = SoftwareAI(school_id=1)
    
    if not ai.api_key:
        print("Error: GEMINI_API_KEY not found in environment or settings.")
        return

    test_query = "Hello, can you hear me? Answer in one short sentence in Bengali."
    print(f"Query: {test_query}")
    
    try:
        response = ai.ask(test_query)
        print("\nAI Response:")
        print(response.get('text'))
        print("\nTest Successful!")
    except Exception as e:
        print(f"\nTest Failed: {str(e)}")

if __name__ == "__main__":
    test_ai()
