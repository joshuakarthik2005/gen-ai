"""
Legal Document Demystifier - FastAPI Ap        # Create the generative model instance - using the working model
        model = GenerativeModel("gemini-1.5-pro")ication
Provides a REST API for analyzing legal documents using Google's Gemini model
"""

import os
import logging
from typing import Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import vertexai
from vertexai.generative_models import GenerativeModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Legal Document Demystifier",
    description="An API that simplifies complex legal documents using AI",
    version="1.0.0"
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