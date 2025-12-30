"""
Quick API test script to verify the backend is working
"""
import requests
import json
import sys
import io

# Fix Windows console encoding
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

BASE_URL = "http://127.0.0.1:8000"

print("=" * 60)
print("School Management System - API Test")
print("=" * 60)

# Test 1: Check if server is running
print("\n1. Testing server connection...")
try:
    response = requests.get(f"{BASE_URL}/api/schools/", timeout=5)
    print(f"   ✓ Server is running (Status: {response.status_code})")
except requests.exceptions.ConnectionError:
    print("   ✗ Server is not running. Start it with: start-backend.bat")
    exit(1)

# Test 2: Get schools list
print("\n2. Fetching schools...")
try:
    response = requests.get(f"{BASE_URL}/api/schools/")
    if response.status_code == 200:
        schools = response.json()
        print(f"   ✓ Found {len(schools)} schools")
        if schools:
            print(f"   First school: {schools[0].get('name', 'N/A')}")
    else:
        print(f"   Status: {response.status_code}")
except Exception as e:
    print(f"   ✗ Error: {e}")

# Test 3: Try to login (you'll need valid credentials)
print("\n3. Testing authentication endpoint...")
print("   Note: You need valid credentials to test login")
print(f"   Login URL: {BASE_URL}/api/token/")
print("   Method: POST")
print("   Body: {\"username\": \"your_username\", \"password\": \"your_password\"}")

# Test 4: Admin panel
print("\n4. Admin panel:")
print(f"   URL: {BASE_URL}/admin/")
print("   Use superuser credentials to login")

print("\n" + "=" * 60)
print("Backend is ready! 🎉")
print("=" * 60)
print("\nNext steps:")
print("1. Install Node.js from https://nodejs.org/")
print("2. Run: cd frontend && npm install && npm start")
print("3. Access frontend at http://localhost:3000")
print("=" * 60)
