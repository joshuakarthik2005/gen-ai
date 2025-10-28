"""
Debug script to check user data
"""
import sys
sys.path.insert(0, '.')

from auth import get_user_by_email, verify_password

email = "demo@example.com"
password = "demo123"

print(f"Checking user: {email}")
user = get_user_by_email(email)

if user:
    print(f"\nUser found!")
    print(f"  ID: {user.get('id')}")
    print(f"  Email: {user.get('email')}")
    print(f"  Full Name: {user.get('full_name')}")
    print(f"  Has hashed_password: {'hashed_password' in user}")
    
    if 'hashed_password' in user:
        print(f"\nTesting password verification...")
        result = verify_password(password, user['hashed_password'])
        print(f"  Password '{password}' matches: {result}")
        
        # Try to show hash (first 50 chars)
        print(f"  Hash starts with: {user['hashed_password'][:50]}...")
else:
    print("User NOT found!")
