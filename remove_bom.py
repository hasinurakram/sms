# remove_bom.py
with open("all_data.json", "rb") as f:
    content = f.read()

# BOM থাকলে সরানো
if content.startswith(b'\xef\xbb\xbf'):
    content = content[3:]

with open("clean_data_no_bom.json", "wb") as f:
    f.write(content)

print("BOM removed. File saved as clean_data_no_bom.json")
