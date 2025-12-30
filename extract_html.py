#!/usr/bin/env python3
"""
Extract HTML from Base44 Landing Page
Removes dynamic elements that change constantly
"""

import requests
from bs4 import BeautifulSoup
import re

def extract_clean_html(url):
    """Extract HTML and remove dynamic elements"""
    
    # Fetch the page
    response = requests.get(url)
    response.raise_for_status()
    
    # Parse HTML
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Remove dynamic elements
    # Remove base44-edit-badge
    for element in soup.find_all(id='base44-edit-badge'):
        element.decompose()
    
    # Remove any elements with dynamic styles that change
    for element in soup.find_all(attrs={'style': re.compile(r'transform: translateY')}):
        # Keep the element but remove the dynamic style
        if element.get('style'):
            style = element['style']
            # Remove translateY from style
            new_style = re.sub(r'transform:\s*translateY\([^)]+\);?\s*', '', style)
            if new_style.strip():
                element['style'] = new_style
            else:
                del element['style']
    
    # Remove any script tags that might be dynamic
    for script in soup.find_all('script'):
        if 'base44' in str(script).lower() or 'edit' in str(script).lower():
            script.decompose()
    
    # Get clean HTML
    clean_html = str(soup)
    
    return clean_html

def main():
    url = "https://coin-navigator-9cc11b2e.base44.app/"
    
    print("Extracting HTML from Base44 Landing Page...")
    print(f"URL: {url}\n")
    
    try:
        html = extract_clean_html(url)
        
        # Save to file
        output_file = "landing-page-clean.html"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html)
        
        print(f"✅ HTML extracted and saved to: {output_file}")
        print(f"📄 File size: {len(html)} characters")
        print("\nNext steps:")
        print("1. Open the HTML file")
        print("2. Copy the content")
        print("3. Paste into WordPress Custom HTML block")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\nAlternative method:")
        print("1. Open the page in browser")
        print("2. Right-click > View Page Source")
        print("3. Copy all HTML")
        print("4. Remove the base44-edit-badge div manually")

if __name__ == "__main__":
    main()






