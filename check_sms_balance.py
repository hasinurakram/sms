
import os
import django
import requests
import sys

# Set stdout to UTF-8
sys.stdout.reconfigure(encoding='utf-8')

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.conf import settings

def check_sms_balance():
    provider = getattr(settings, 'SMS_PROVIDER', 'console')
    api_key = getattr(settings, 'SMS_API_KEY', '')
    sender_id = getattr(settings, 'SMS_SENDER_ID', 'School')
    
    print(f"SMS Provider: {provider}")
    print(f"Sender ID: {sender_id}")
    
    if not api_key:
        print("Error: SMS_API_KEY is not configured in settings or environment variables.")
        return

    if provider == 'bulksms':
        url = "http://bulksmsbd.net/api/balanceapi"
        params = {'api_key': api_key}
        try:
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                result = response.json()
                print(f"BulkSMS BD Balance: {result.get('balance', 'N/A')}")
                print(f"Response: {result}")
            else:
                print(f"Error checking balance: HTTP {response.status_code}")
        except Exception as e:
            print(f"Error checking balance: {str(e)}")
    elif provider == 'ssl_wireless':
        # SSL Wireless balance check might require a different endpoint
        print("SSL Wireless balance check not implemented in this script.")
    elif provider == 'twilio':
        print("Twilio balance check requires account SID and auth token.")
    elif provider == 'console':
        print("Console mode: No real balance to check.")
    else:
        print(f"Balance check not implemented for provider: {provider}")

if __name__ == "__main__":
    check_sms_balance()
