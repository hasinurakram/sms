import os
import django
import json

from dotenv import load_dotenv
load_dotenv()
# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from users.ai_engine import SoftwareAI

def test_ai():
    with open('ai_test_output.txt', 'w', encoding='utf-8') as f:
        f.write("Testing AI Engine...\n")
        ai = SoftwareAI(school_id=19)
        f.write(f"API Key present: {bool(ai.api_key)}\n")
        
        try:
            response = ai.ask("Hello, tell me a short joke in Bengali")
            f.write("AI Response:\n")
            f.write(json.dumps(response, ensure_ascii=False, indent=2))
            f.write("\nTest Successful!\n")
        except Exception as e:
            f.write(f"\nTest Failed: {str(e)}\n")

if __name__ == "__main__":
    test_ai()
