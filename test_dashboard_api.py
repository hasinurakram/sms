import requests

# Test the dashboard API to see if it's working
def test_dashboard():
    # Test student info
    student_response = requests.get('http://localhost:8000/api/students/1039/')
    print(f"Student API: {student_response.status_code}")
    if student_response.status_code == 200:
        student_data = student_response.json()
        print(f"Student: {student_data.get('user', {}).get('first_name', 'Unknown')}")
        print(f"Class: {student_data.get('classroom', {}).get('name', 'Unknown')}")
        print(f"School: {student_data.get('school', {}).get('name', 'Unknown')}")
    
    # Test assignments
    assignments_response = requests.get('http://localhost:8000/api/fees/assignments/?student_id=1039&school=16')
    print(f"\nAssignments API: {assignments_response.status_code}")
    if assignments_response.status_code == 200:
        assignments_data = assignments_response.json()
        print(f"Assignments count: {len(assignments_data)}")
        if assignments_data:
            print(f"First assignment: {assignments_data[0].get('fee_structure', {}).get('name', 'Unknown')}")
            print(f"Amount: {assignments_data[0].get('fee_structure', {}).get('amount', 'Unknown')}")

if __name__ == "__main__":
    test_dashboard()