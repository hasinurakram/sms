import requests
import json

# Test the API response
response = requests.get('http://localhost:8000/api/fees/assignments/?student_id=1039&school=16')
print(f"Status: {response.status_code}")
print(f"Content-Type: {response.headers.get('content-type', 'unknown')}")

try:
    data = response.json()
    print(f"Response type: {type(data)}")
    
    if isinstance(data, dict):
        print(f"Keys: {list(data.keys())}")
        if 'results' in data:
            print(f"Results length: {len(data['results'])}")
            if data['results']:
                print("First result structure:")
                print(json.dumps(data['results'][0], indent=2, default=str))
        elif 'data' in data:
            print(f"Data length: {len(data['data'])}")
            if data['data']:
                print("First data item structure:")
                print(json.dumps(data['data'][0], indent=2, default=str))
        else:
            print("Full response:")
            print(json.dumps(data, indent=2, default=str)[:1000])
    elif isinstance(data, list):
        print(f"List length: {len(data)}")
        if data:
            print("First item structure:")
            print(json.dumps(data[0], indent=2, default=str))
    else:
        print(f"Raw response: {str(data)[:500]}")
        
except Exception as e:
    print(f"Error parsing JSON: {e}")
    print(f"Raw response: {response.text[:500]}")