import requests
import json

# Test the API response and simulate the frontend logic
response = requests.get('http://localhost:8000/api/fees/assignments/?student_id=1039&school=16')
data = response.json()

print(f"API Response: {len(data)} assignments")
print(f"First assignment structure:")
print(json.dumps(data[0], indent=2, default=str))

# Simulate the frontend logic
assignments = data
print(f"\nProcessing {len(assignments)} assignments...")

# Simulate the assignment processing logic from the frontend
rows = []
for a in assignments:
    aid = a.get('id') or a.get('_id')
    sObj = a.get('fee_structure') or a.get('fee') or {}
    
    # Get base amount (same logic as frontend)
    base_candidates = [
        a.get('custom_amount'),
        a.get('amount'),
        a.get('total_amount'),
        a.get('payable_amount'),
        a.get('payable'),
        a.get('price'),
        a.get('base_amount'),
        sObj.get('amount'),
        sObj.get('default_amount'),
        sObj.get('fee_amount'),
        sObj.get('price'),
        sObj.get('payable_amount')
    ]
    
    base = next((x for x in base_candidates if x is not None and x != ''), 0)
    
    # Get discount info
    discount_amt = float(a.get('discount_amount', 0))
    discount_pct = float(a.get('discount_percentage', a.get('discount_percent', a.get('discount', 0))))
    
    # Calculate final amount
    amount = max(0, float(base) - discount_amt - (float(base) * discount_pct / 100))
    
    # Get name
    name = (
        a.get('fee_structure', {}).get('name') if a.get('fee_structure') else None or
        (a.get('fee_structure', {}).get('category') or {}).get('name') if a.get('fee_structure') else None or
        a.get('fee', {}).get('name') if a.get('fee') else None or
        a.get('fee_type') or
        a.get('type') or
        a.get('name') or
        'Fee'
    )
    
    # Get frequency/type
    freq = str(sObj.get('frequency', '')).lower()
    rtype = 'tuition' if freq == 'monthly' else ('exam' if freq == 'one_time' else 'other')
    
    print(f"Assignment {aid}: {name} = {amount} ({rtype})")
    
    rows.append({
        'id': aid,
        'name': name,
        'amount': amount,
        'paid': 0,  # No payments fetched yet
        'due': amount,
        'type': rtype
    })

# Calculate totals
totals = {
    'amount': sum(r['amount'] for r in rows),
    'paid': sum(r['paid'] for r in rows),
    'due': sum(r['due'] for r in rows)
}

print(f"\nProcessed {len(rows)} fee rows")
print(f"Totals: {totals}")

# Check if this would show "No fees assigned"
if len(rows) == 0:
    print("\n❌ This would show 'কোনো ফি নির্ধারিত হয়নি।'")
else:
    print(f"\n✅ Should show {len(rows)} fee assignments")