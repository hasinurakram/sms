#!/usr/bin/env python3
"""
Script to automatically fix MUI Grid v2 migration issues across the project.
Converts old Grid syntax to new Grid v2 syntax.
"""

import os
import re
from pathlib import Path

def fix_grid_v2(file_path):
    """Fix Grid v2 issues in a single file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    changes_made = []
    
    # Pattern 1: <Grid item xs={...} ...> -> <Grid size={{ xs: ... }} ...>
    # This handles various combinations of xs, sm, md, lg, xl
    
    # Find all Grid item patterns
    grid_pattern = r'<Grid\s+item\s+([^>]+)>'
    
    def replace_grid(match):
        attrs = match.group(1)
        
        # Extract size props
        size_props = {}
        for prop in ['xs', 'sm', 'md', 'lg', 'xl']:
            prop_pattern = rf'{prop}=\{{([^}}]+)\}}'
            prop_match = re.search(prop_pattern, attrs)
            if prop_match:
                size_props[prop] = prop_match.group(1)
                # Remove the prop from attrs
                attrs = re.sub(rf'\s*{prop}=\{{[^}}]+\}}', '', attrs)
        
        # Remove 'item' prop
        attrs = re.sub(r'\s*item\s*', ' ', attrs)
        
        # Build size object
        if size_props:
            size_str = ', '.join([f'{k}: {v}' for k, v in size_props.items()])
            size_attr = f'size={{{{ {size_str} }}}}'
            
            # Add size attribute
            attrs = f'{size_attr} {attrs}'.strip()
        
        return f'<Grid {attrs}>'
    
    new_content = re.sub(grid_pattern, replace_grid, content)
    
    if new_content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    
    return False

def main():
    """Main function to process all JSX files"""
    frontend_src = Path('d:/SchoolManagementSoftware/frontend/src')
    
    if not frontend_src.exists():
        print(f"Error: {frontend_src} does not exist")
        return
    
    # Find all JSX and JS files
    files_to_process = []
    for ext in ['*.jsx', '*.js']:
        files_to_process.extend(frontend_src.rglob(ext))
    
    # Exclude node_modules
    files_to_process = [f for f in files_to_process if 'node_modules' not in str(f)]
    
    print(f"Found {len(files_to_process)} files to process")
    
    fixed_count = 0
    for file_path in files_to_process:
        if fix_grid_v2(file_path):
            print(f"[OK] Fixed: {file_path.relative_to(frontend_src)}")
            fixed_count += 1
    
    print(f"\n[DONE] Fixed {fixed_count} files")

if __name__ == '__main__':
    main()
