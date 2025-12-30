#!/usr/bin/env python
import requests
import json

try:
    response = requests.get('http://localhost:8000/api/fees/assignments/?student_id=1039')
    print(f'Status: {response.status_code}')
    if response.status_code == 200:
        data = response.json()
        if isinstance(data, list):
            print(f'Found {len(data)} assignments')
            for item in data[:3]:  # Show first 3
                print(f'  - Assignment ID: {item.get("id", "unknown")}')
                print(f'    Student: {item.get("student", "unknown")}')
                print(f'    Fee Structure: {item.get("fee_structure", "unknown")}')
        else:
            print(f'Data (first 200 chars): {str(data)[:200]}...')
    else:
        print(f'Error response: {response.text[:200]}')
except Exception as e:
    print(f'Error: {e}')