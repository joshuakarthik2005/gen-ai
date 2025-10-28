"""
Test script to verify login functionality
"""
import requests
import json

BASE_URL = "http://localhost:8080"

def test_login():
    """Test login with demo credentials"""
    login_data = {
        "email": "demo@example.com",
        "password": "demo123"
    }
    
    print(f"Testing login with: {login_data['email']}")
    
    try:
        response = requests.post(f"{BASE_URL}/login", json=login_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 200:
            print("\n✓ Login successful!")
        else:
            print("\n✗ Login failed!")
            
    except Exception as e:
        print(f"Error: {e}")

def test_register():
    """Test if demo user exists by trying to register"""
    register_data = {
        "email": "demo@example.com",
        "password": "demo123",
        "full_name": "Demo User"
    }
    
    print(f"\nTesting if user exists by trying to register: {register_data['email']}")
    
    try:
        response = requests.post(f"{BASE_URL}/register", json=register_data)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        
        if response.status_code == 400 and "already registered" in response.text.lower():
            print("\n✓ User exists!")
        elif response.status_code == 200:
            print("\n✓ User was created (didn't exist before)")
        else:
            print("\n? Unexpected response")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("=" * 60)
    print("Testing Authentication")
    print("=" * 60)
    
    test_register()
    test_login()
