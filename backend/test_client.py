"""
Test client for the Legal Document Demystifier API
"""

import requests
import json


def test_health_endpoint():
    """Test the health check endpoint"""
    print("Testing health endpoint...")
    try:
        response = requests.get("http://127.0.0.1:8000/health")
        print(f"Status: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False


def test_analyze_text_endpoint():
    """Test the analyze text endpoint"""
    print("\nTesting analyze text endpoint...")
    
    sample_text = """
    TERMS OF SERVICE AGREEMENT
    
    1. ACCEPTANCE OF TERMS
    By accessing and using this service, you agree to be bound by the terms and conditions outlined in this agreement. If you do not agree to these terms, you must not use the service.
    
    2. LICENSE TO USE
    Subject to your compliance with these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to use the Service for your personal, non-commercial use only.
    
    3. USER OBLIGATIONS
    You agree to: (a) provide accurate information when creating an account; (b) maintain the security of your password; (c) comply with all applicable laws; and (d) not use the service for any unlawful purpose.
    
    4. LIMITATION OF LIABILITY
    IN NO EVENT SHALL THE COMPANY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
    
    5. TERMINATION
    We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
    """
    
    try:
        response = requests.post(
            "http://127.0.0.1:8000/analyze-text",
            json={"text": sample_text}
        )
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Analysis:\n{result['analysis']}")
        else:
            print(f"Error: {response.text}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False


def test_analyze_document_endpoint():
    """Test the analyze document endpoint"""
    print("\nTesting analyze document endpoint...")
    
    # Create a temporary test file
    test_content = """
    SOFTWARE LICENSE AGREEMENT
    
    This Software License Agreement ("Agreement") is entered into between the Licensor and the Licensee.
    
    1. GRANT OF LICENSE
    Subject to the terms of this Agreement, Licensor grants Licensee a non-exclusive, non-transferable license to use the Software.
    
    2. RESTRICTIONS
    Licensee shall not: (a) modify, adapt, or create derivative works; (b) reverse engineer or decompile; (c) distribute or transfer the Software.
    
    3. WARRANTY DISCLAIMER
    THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
    
    4. LIMITATION OF LIABILITY
    IN NO EVENT SHALL LICENSOR BE LIABLE FOR ANY DAMAGES ARISING OUT OF THE USE OF THE SOFTWARE.
    """
    
    try:
        # Write test file
        with open("test_document.txt", "w", encoding="utf-8") as f:
            f.write(test_content)
        
        # Upload and analyze
        with open("test_document.txt", "rb") as f:
            files = {"file": ("test_document.txt", f, "text/plain")}
            response = requests.post("http://127.0.0.1:8000/analyze-document", files=files)
        
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"Filename: {result['filename']}")
            print(f"Analysis:\n{result['analysis']}")
        else:
            print(f"Error: {response.text}")
        
        # Clean up
        import os
        if os.path.exists("test_document.txt"):
            os.remove("test_document.txt")
            
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False


def main():
    """Run all tests"""
    print("=== Legal Document Demystifier API Test Client ===")
    print("Make sure the API is running on http://127.0.0.1:8000")
    print("Start the API with: python api.py\n")
    
    # Test endpoints
    health_ok = test_health_endpoint()
    text_ok = test_analyze_text_endpoint()
    doc_ok = test_analyze_document_endpoint()
    
    print(f"\n=== Test Results ===")
    print(f"Health endpoint: {'✓' if health_ok else '✗'}")
    print(f"Text analysis: {'✓' if text_ok else '✗'}")
    print(f"Document upload: {'✓' if doc_ok else '✗'}")
    
    if all([health_ok, text_ok, doc_ok]):
        print("\n🎉 All tests passed!")
    else:
        print("\n⚠️  Some tests failed. Check your Google Cloud configuration.")


if __name__ == "__main__":
    main()