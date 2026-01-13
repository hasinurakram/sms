import requests
import json

BASE_URL = "http://localhost:8000/api/academics/sections/"

def check_sections(school_id=None):
    params = {}
    if school_id:
        params['school'] = school_id
    
    try:
        response = requests.get(BASE_URL, params=params)
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, dict) and 'results' in data:
                results = data['results']
            else:
                results = data
            
            print(f"Total Sections (school={school_id}): {len(results)}")
            # Verify if filtered correctly
            if school_id:
                mismatch_count = 0
                for s in results:
                    # s['classroom'] is object with school inside?
                    # SectionSerializer: classroom = ClassRoomSerializer(read_only=True)
                    # ClassRoomSerializer: school = SchoolSerializer(read_only=True)
                    
                    s_school_id = s.get('classroom', {}).get('school', {}).get('id')
                    if str(s_school_id) != str(school_id):
                        mismatch_count += 1
                        print(f"Mismatch: Section {s['id']} has school {s_school_id}")
                
                if mismatch_count == 0:
                    print("Verification PASSED: All sections belong to school", school_id)
                else:
                    print(f"Verification FAILED: {mismatch_count} mismatches found.")
            else:
                print("No school filter applied.")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("Checking WITHOUT school filter...")
    check_sections(None)
    
    print("\nChecking WITH school filter (school=19)...")
    check_sections(19)
