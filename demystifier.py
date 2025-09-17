"""
Legal Document Demystifier - Core Script
Analyzes legal text using Google's Gemini model via Vertex AI
"""

import os
import vertexai
from vertexai.generative_models import GenerativeModel


def initialize_vertex_ai():
    """Initialize Vertex AI with your project settings"""
    # Set up authentication using the service account key
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account-key.json"
    
    # Project settings from the service account
    project_id = "demystifier-ai"
    location = "asia-south1"  # Mumbai region works for India users!
    
    # Initialize Vertex AI
    vertexai.init(project=project_id, location=location)
    
    return project_id, location


def create_legal_analysis_prompt(legal_text):
    """Create a detailed prompt for the Gemini model"""
    prompt = f"""You are an expert lawyer who specializes in explaining complex legal documents to non-lawyers. Analyze the following document. 

First, provide a one-paragraph summary in simple, clear English. 

Second, identify and list the 3 most important clauses a person should be aware of and explain the risks or obligations for each. 

Document: {legal_text}"""
    
    return prompt


def analyze_legal_document(legal_text):
    """Analyze legal text using Gemini model"""
    try:
        # Initialize Vertex AI
        project_id, location = initialize_vertex_ai()
        print(f"Using project: {project_id} in location: {location}")
        
        # Create the generative model instance - using the working model
        print("Using gemini-1.5-pro model in asia-south1...")
        model = GenerativeModel("gemini-1.5-pro")
        
        # Create the prompt
        prompt = create_legal_analysis_prompt(legal_text)
        
        # Generate response
        print("Sending request to Gemini...")
        response = model.generate_content(prompt)
        
        return response.text
        
    except Exception as e:
        print(f"Error analyzing document: {str(e)}")
        return None


def main():
    """Main function to test the demystifier"""
    # Sample legal text for testing
    sample_legal_text = """
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
    
    print("=== Legal Document Demystifier ===")
    print("Analyzing sample legal document...\n")
    
    # Analyze the document
    result = analyze_legal_document(sample_legal_text)
    
    if result:
        print("=== ANALYSIS RESULT ===")
        print(result)
    else:
        print("Failed to analyze the document. Please check your Vertex AI configuration.")


if __name__ == "__main__":
    main()