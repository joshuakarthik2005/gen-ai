"""
Legal Document Demystifier - FastAPI Ap        # Create the generative model instance - using the working model
        model = GenerativeModel("gemini-1.5-pro")ication
Provides a REST API for analyzing legal documents using Google's Gemini model
"""

import os
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import vertexai
from vertexai.generative_models import GenerativeModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Google Cloud Storage imports (will be imported when available)
try:
    from google.cloud import storage
    GCS_AVAILABLE = True
    logger.info("Google Cloud Storage is available")
except ImportError:
    GCS_AVAILABLE = False
    logger.warning("Google Cloud Storage not available. Upload functionality will be limited.")

# Pydantic models for request/response
class ExplainSelectionRequest(BaseModel):
    selected_text: str
    document_url: str

# Initialize FastAPI app
app = FastAPI(
    title="Legal Document Demystifier",
    description="An API that simplifies complex legal documents using AI",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables for Vertex AI configuration
vertex_ai_initialized = False
model = None


def initialize_vertex_ai():
    """Initialize Vertex AI with your project settings"""
    global vertex_ai_initialized, model
    
    try:
        # Set up authentication using the service account key
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "service-account-key.json"
        
        # Project settings from the service account
        project_id = "demystifier-ai"
        location = "asia-south1"  # Mumbai region works for India users!
        
        # Initialize Vertex AI
        vertexai.init(project=project_id, location=location)
        
        # Create the generative model instance
        model = GenerativeModel("gemini-1.5-pro")
        
        vertex_ai_initialized = True
        logger.info(f"Vertex AI initialized with project: {project_id}, location: {location}")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to initialize Vertex AI: {str(e)}")
        return False


def create_legal_analysis_prompt(legal_text: str) -> str:
    """Create a detailed prompt for the Gemini model"""
    prompt = f"""You are an expert lawyer who specializes in explaining complex legal documents to non-lawyers. Analyze the following document. 

First, provide a one-paragraph summary in simple, clear English. 

Second, identify and list the 3 most important clauses a person should be aware of and explain the risks or obligations for each. 

Document: {legal_text}"""
    
    return prompt


def analyze_legal_document(legal_text: str) -> Dict[str, Any]:
    """Analyze legal text using Gemini model"""
    global vertex_ai_initialized, model
    
    # Initialize Vertex AI if not already done
    if not vertex_ai_initialized:
        if not initialize_vertex_ai():
            return {
                "success": False,
                "error": "Failed to initialize Vertex AI. Please check your configuration."
            }
    
    try:
        # Create the prompt
        prompt = create_legal_analysis_prompt(legal_text)
        
        # Generate response
        logger.info("Sending request to Gemini...")
        response = model.generate_content(prompt)
        
        return {
            "success": True,
            "analysis": response.text,
            "model_used": "gemini-pro"
        }
        
    except Exception as e:
        error_msg = f"Error analyzing document: {str(e)}"
        logger.error(error_msg)
        return {
            "success": False,
            "error": error_msg
        }


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Legal Document Demystifier API",
        "version": "1.0.0",
        "endpoints": {
            "/analyze-document": "POST - Upload a legal document for analysis",
            "/analyze-text": "POST - Analyze legal text directly",
            "/health": "GET - Check API health status"
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    global vertex_ai_initialized
    
    return {
        "status": "healthy",
        "vertex_ai_initialized": vertex_ai_initialized,
        "timestamp": "2025-09-16"
    }


@app.post("/analyze-document")
async def analyze_document_endpoint(file: UploadFile = File(...)):
    """
    Analyze a legal document from file upload
    
    - **file**: Legal document file (txt, pdf, doc, etc.)
    """
    try:
        # Check file type
        allowed_types = ["text/plain", "application/pdf", "application/msword", 
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
        
        if file.content_type not in allowed_types:
            # For now, we'll be lenient and try to read as text
            logger.warning(f"Unsupported file type: {file.content_type}, attempting to read as text")
        
        # Read file content
        content = await file.read()
        
        # For now, assume it's text content
        # In a production app, you'd want proper file parsing for PDF, DOC, etc.
        try:
            legal_text = content.decode('utf-8')
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=400, 
                detail="Unable to decode file content. Please ensure the file is in text format."
            )
        
        # Validate content length
        if len(legal_text.strip()) == 0:
            raise HTTPException(status_code=400, detail="File appears to be empty")
        
        if len(legal_text) > 10000:  # Limit to ~10KB of text
            legal_text = legal_text[:10000]
            logger.warning("Document truncated to 10,000 characters")
        
        # Analyze the document
        result = analyze_legal_document(legal_text)
        
        if result["success"]:
            return JSONResponse(
                status_code=200,
                content={
                    "filename": file.filename,
                    "analysis": result["analysis"],
                    "model_used": result["model_used"],
                    "character_count": len(legal_text)
                }
            )
        else:
            raise HTTPException(status_code=500, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in analyze_document_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.post("/analyze-text")
async def analyze_text_endpoint(request: Dict[str, str]):
    """
    Analyze legal text directly
    
    - **text**: The legal text to analyze
    """
    try:
        legal_text = request.get("text", "").strip()
        
        if not legal_text:
            raise HTTPException(status_code=400, detail="No text provided")
        
        if len(legal_text) > 10000:  # Limit to ~10KB of text
            legal_text = legal_text[:10000]
            logger.warning("Text truncated to 10,000 characters")
        
        # Analyze the text
        result = analyze_legal_document(legal_text)
        
        if result["success"]:
            return JSONResponse(
                status_code=200,
                content={
                    "analysis": result["analysis"],
                    "model_used": result["model_used"],
                    "character_count": len(legal_text)
                }
            )
        else:
            raise HTTPException(status_code=500, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in analyze_text_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.post("/upload-document")
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a PDF document to Google Cloud Storage and return a signed URL
    
    - **file**: PDF document file to upload
    """
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('application/pdf'):
            raise HTTPException(
                status_code=400, 
                detail="Only PDF files are supported"
            )
        
        # Check file size (limit to 10MB)
        content = await file.read()
        if len(content) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=400,
                detail="File size must be less than 10MB"
            )
        
        if not GCS_AVAILABLE:
            # Fallback: return a mock URL for development
            mock_url = f"https://storage.googleapis.com/mock-bucket/{uuid.uuid4()}.pdf"
            logger.warning("Using mock URL - Google Cloud Storage not available")
            return JSONResponse(
                status_code=200,
                content={
                    "signed_url": mock_url,
                    "filename": file.filename,
                    "message": "Mock upload successful (GCS not configured)"
                }
            )
        
        # Google Cloud Storage configuration
        bucket_name = "clarirylegal-documents"  # Change to your bucket name
        
        try:
            # Initialize GCS client
            client = storage.Client()
            bucket = client.bucket(bucket_name)
            
            # Generate unique filename
            file_extension = os.path.splitext(file.filename)[1] if file.filename else '.pdf'
            unique_filename = f"documents/{uuid.uuid4()}{file_extension}"
            
            # Create blob and upload content
            blob = bucket.blob(unique_filename)
            blob.upload_from_string(content, content_type='application/pdf')
            
            # Generate signed URL (valid for 1 hour)
            signed_url = blob.generate_signed_url(
                expiration=datetime.utcnow() + timedelta(hours=1),
                method='GET'
            )
            
            logger.info(f"Successfully uploaded {file.filename} to GCS as {unique_filename}")
            
            return JSONResponse(
                status_code=200,
                content={
                    "signed_url": signed_url,
                    "filename": file.filename,
                    "blob_name": unique_filename
                }
            )
            
        except Exception as gcs_error:
            logger.error(f"GCS upload error: {str(gcs_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload to Google Cloud Storage: {str(gcs_error)}"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in upload_document: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.post("/explain-selection")
async def explain_selection(request: ExplainSelectionRequest):
    """
    Analyze selected text from a document and provide AI explanation
    
    - **selected_text**: The text that was highlighted/selected
    - **document_url**: The URL of the document (for context)
    """
    try:
        selected_text = request.selected_text.strip()
        document_url = request.document_url
        
        if not selected_text:
            raise HTTPException(status_code=400, detail="No text selected")
        
        if len(selected_text) > 1000:  # Limit selection length
            selected_text = selected_text[:1000]
            logger.warning("Selected text truncated to 1000 characters")
        
        # For now, provide a mock explanation
        # In production, you would:
        # 1. Optionally fetch the full document from the document_url
        # 2. Use the Gemini API to analyze the selected text in context
        # 3. Return a comprehensive explanation
        
        # Mock explanation based on text content
        explanation = generate_mock_explanation(selected_text)
        
        logger.info(f"Provided explanation for selection: '{selected_text[:50]}...'")
        
        return JSONResponse(
            status_code=200,
            content={
                "explanation": explanation,
                "selected_text": selected_text,
                "document_url": document_url
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in explain_selection: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


def generate_mock_explanation(text: str) -> str:
    """Generate a mock explanation for selected text"""
    lower_text = text.lower()
    
    if any(word in lower_text for word in ['termination', 'terminate', 'fired', 'dismissed']):
        return f"This clause deals with employment termination. **Key points:** The selected text '{text[:100]}...' outlines the conditions under which employment can be ended. This could include immediate termination for cause, notice periods, or severance requirements. Pay attention to what constitutes 'cause' and whether you're entitled to notice or severance pay."
    
    elif any(word in lower_text for word in ['non-compete', 'compete', 'competition', 'competitor']):
        return f"This appears to be a non-compete clause. **Important:** The text '{text[:100]}...' likely restricts your ability to work for competitors after leaving this job. These clauses vary in enforceability by state and should be carefully reviewed for geographic scope, duration, and what constitutes 'competing' work."
    
    elif any(word in lower_text for word in ['confidential', 'proprietary', 'trade secret', 'non-disclosure']):
        return f"This is a confidentiality/non-disclosure provision. **What it means:** The selected text '{text[:100]}...' requires you to keep certain company information private. This typically continues even after you leave the company. Make sure the definition of 'confidential information' is reasonable and doesn't prevent you from using general skills and knowledge."
    
    elif any(word in lower_text for word in ['salary', 'compensation', 'pay', 'wage', 'bonus']):
        return f"This clause covers compensation details. **Key information:** The text '{text[:100]}...' outlines your pay structure. Look for details about base salary, bonus eligibility, pay frequency, and any conditions that might affect your compensation. Bonuses are often discretionary unless specifically guaranteed."
    
    elif any(word in lower_text for word in ['benefits', 'insurance', 'health', 'vacation', 'pto']):
        return f"This section discusses employee benefits. **What to know:** The selected text '{text[:100]}...' describes benefit entitlements. These often reference separate benefit documents, so ask for the complete benefits summary. Pay attention to waiting periods, eligibility requirements, and what happens to benefits if you leave."
    
    else:
        return f"This is a standard legal provision. **Explanation:** The selected text '{text[:100]}...' appears to be a typical contractual clause. Legal documents often use formal language that can be confusing. If you have specific concerns about how this clause might affect you, consider asking for clarification or consulting with a legal professional."


if __name__ == "__main__":
    import uvicorn
    
    # Initialize Vertex AI on startup
    logger.info("Starting Legal Document Demystifier API...")
    initialize_vertex_ai()
    
    # Run the application
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        log_level="info"
    )