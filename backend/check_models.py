"""
Check Available Models in Vertex AI
This script helps diagnose what models are available in your project/region
"""

import os
import vertexai
from google.cloud import aiplatform

def check_available_models():
    """Check what models are available in different regions"""
    # Set up authentication
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account-key.json"
    
    project_id = "demystifier-ai"
    regions_to_try = ["us-central1", "us-east1", "asia-south1", "asia-southeast1", "europe-west1"]
    
    for region in regions_to_try:
        print(f"\n=== Checking region: {region} ===")
        try:
            # Initialize Vertex AI for this region
            vertexai.init(project=project_id, location=region)
            
            # Initialize the AI Platform client
            client = aiplatform.gapic.ModelServiceClient(
                client_options={"api_endpoint": f"{region}-aiplatform.googleapis.com"}
            )
            
            # List models
            parent = f"projects/{project_id}/locations/{region}"
            request = aiplatform.gapic.ListModelsRequest(parent=parent)
            
            models = client.list_models(request=request)
            
            print("Available models:")
            model_count = 0
            for model in models:
                print(f"  - {model.name}")
                model_count += 1
                if model_count > 10:  # Limit output
                    print("  ... (more models available)")
                    break
            
            if model_count == 0:
                print("  No models found")
                
        except Exception as e:
            print(f"  Error: {str(e)}")

def check_gemini_specifically():
    """Check specifically for Gemini models"""
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account-key.json"
    
    project_id = "demystifier-ai"
    regions_to_try = ["us-central1", "us-east1", "asia-south1"]
    
    gemini_models = [
        "gemini-pro",
        "gemini-1.0-pro", 
        "gemini-1.5-pro",
        "gemini-1.5-flash",
        "text-bison",
        "text-bison@001"
    ]
    
    for region in regions_to_try:
        print(f"\n=== Testing Gemini models in {region} ===")
        try:
            vertexai.init(project=project_id, location=region)
            
            for model_name in gemini_models:
                try:
                    from vertexai.generative_models import GenerativeModel
                    model = GenerativeModel(model_name)
                    print(f"  ✓ {model_name} - Available")
                    
                    # Try a simple test
                    response = model.generate_content("Say hello")
                    print(f"    Test response: {response.text[:50]}...")
                    break  # If one works, we're good
                    
                except Exception as e:
                    print(f"  ✗ {model_name} - Error: {str(e)[:100]}...")
                    
        except Exception as e:
            print(f"  Region error: {str(e)}")

if __name__ == "__main__":
    print("=== Vertex AI Model Availability Checker ===")
    print("This will help diagnose what's available in your project.\n")
    
    try:
        check_gemini_specifically()
    except Exception as e:
        print(f"Error in Gemini check: {e}")
        
    print("\n" + "="*50)
    print("If no models work, you may need to:")
    print("1. Enable Vertex AI API in Google Cloud Console")
    print("2. Enable billing on your project") 
    print("3. Wait for API activation (can take a few minutes)")
    print("4. Try different regions")
    print("5. Check service account permissions")