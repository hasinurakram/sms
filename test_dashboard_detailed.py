import requests
import json

# Test the dashboard API to see the exact structure
def test_dashboard_detailed():
    # Test assignments
    assignments_response = requests.get('http://localhost:8000/api/fees/assignments/?student_id=1039&school=16')
    print(f"Assignments API: {assignments_response.status_code}")
    if assignments_response.status_code == 200:
        assignments_data = assignments_response.json()
        print(f"Assignments count: {len(assignments_data)}")
        if assignments_data:
            print("\nFirst assignment full structure:")
            print(json.dumps(assignments_data[0], indent=2, default=str))
            
            # Check fee structure details
            fee_structure = assignments_data[0].get('fee_structure', {})
            print(f"\nFee structure keys: {list(fee_structure.keys())}")
            print(f"Fee structure name: {fee_structure.get('name', 'NOT FOUND')}")
            print(f"Fee structure category: {fee_structure.get('category', 'NOT FOUND')}")

if __name__ == "__main__":
    test_dashboard_detailed()