"""
Legal Document Demystifier - FastAPI Application v2.1
Provides a REST API for analyzing legal documents using Google's Gemini model
Fixed GitHub Actions deployment permissions
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

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import Vertex AI with error handling
try:
    import vertexai
    from vertexai.generative_models import GenerativeModel
    VERTEX_AI_AVAILABLE = True
    logger.info("Vertex AI imports successful")
except ImportError as e:
    logger.warning(f"Direct Vertex AI import failed: {e}")
    # Try alternative approach
    try:
        from google.cloud import aiplatform
        import vertexai
        # Set up for alternative model usage
        VERTEX_AI_AVAILABLE = True
        GenerativeModel = None
        logger.info("Using alternative Google Cloud AI Platform import")
    except ImportError as e2:
        logger.error(f"All Vertex AI imports failed: {e2}")
        VERTEX_AI_AVAILABLE = False
        vertexai = None
        GenerativeModel = None

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

class ChatRequest(BaseModel):
    message: str
    document_text: str = ""  # Optional: full document text for context

class ExtractRequest(BaseModel):
    url: str

# Initialize FastAPI app
app = FastAPI(
    title="Legal Document Demystifier",
    description="An API that simplifies complex legal documents using AI",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for Cloud Run deployment
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
    
    if not VERTEX_AI_AVAILABLE:
        logger.error("Vertex AI modules not available - check dependencies")
        return False
    
    try:
        # For Cloud Run, don't set GOOGLE_APPLICATION_CREDENTIALS
        # Cloud Run automatically provides service account authentication
        
        # Project settings
        project_id = "demystifier-ai"
        location = "asia-south1"  # Mumbai region works for India users!
        
        # Initialize Vertex AI
        vertexai.init(project=project_id, location=location)
        
        # Create the generative model instance if available
        if GenerativeModel:
            model = GenerativeModel("gemini-1.5-pro")
        else:
            # Alternative model setup
            logger.warning("Using alternative model initialization")
            model = None  # Will handle in analyze function
        
        vertex_ai_initialized = True
        logger.info(f"Vertex AI initialized with project: {project_id}, location: {location}")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to initialize Vertex AI: {str(e)}")
        return False


def create_legal_analysis_prompt(legal_text: str) -> str:
    """Create a detailed prompt for the Gemini model"""
    prompt = f"""You are an expert lawyer who specializes in explaining complex legal documents to non-lawyers. Analyze the following document using proper markdown formatting.

Format your response EXACTLY as follows:

# Document Analysis - Plain English Explanation

## **Summary:**
Provide a clear one-paragraph summary in simple, everyday language.

## **Key Clauses & Important Points:**

### **1. [Clause Name/Topic]:**
- **What it means:** [Simple explanation]
- **Your obligations:** [What you must do]
- **Risks/Consequences:** [What happens if violated]

### **2. [Clause Name/Topic]:**
- **What it means:** [Simple explanation]
- **Your obligations:** [What you must do]
- **Risks/Consequences:** [What happens if violated]

### **3. [Clause Name/Topic]:**
- **What it means:** [Simple explanation]
- **Your obligations:** [What you must do]
- **Risks/Consequences:** [What happens if violated]

## **Bottom Line:**
Provide a brief, practical takeaway in one or two sentences.

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
            "/summarize": "POST - Summarize legal text in layman terms",
            "/summarize-upload": "POST - Upload and summarize a legal document",
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
        bucket_name = "demystifier-ai_cloudbuild"  # Updated to use existing bucket
        
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


def create_summary_prompt(legal_text: str) -> str:
    """Create a prompt for summarizing legal documents in layman terms"""
    prompt = f"""You are an expert lawyer who specializes in explaining complex legal documents to non-lawyers. 

Provide a clear, well-formatted summary using proper markdown formatting. Format your response EXACTLY as follows:

# [Document Type] - Plain English Explanation

[Brief introductory sentence about what this document is]

## **What it's about:**
[Main purpose and scope of the document]

## **Who's involved:**
[Parties involved and their roles]

## **Your rights and responsibilities:**
[What you're entitled to and what you must do]
* [Specific responsibility 1]
* [Specific responsibility 2]
* [Specific responsibility 3]

## **Other party's rights and responsibilities:**
[What the other party can do and must do]

## **Important deadlines:**
[Any time-sensitive elements or deadlines]

## **Risks/Consequences of violating the agreement:**
[What happens if terms are not met]

## **Important conditions:**
[Key conditions or requirements that must be met]

## **Bottom Line:**
[Practical takeaway in simple terms]

Write this as if you're explaining it to a friend who has no legal background. Avoid legal jargon and use plain English.

Document: {legal_text}"""
    
    return prompt


def summarize_legal_document(legal_text: str) -> Dict[str, Any]:
    """Summarize legal text using Gemini model with layman-friendly output"""
    global vertex_ai_initialized, model
    
    # Initialize Vertex AI if not already done
    if not vertex_ai_initialized:
        if not initialize_vertex_ai():
            return {
                "success": False,
                "error": "Failed to initialize Vertex AI. Please check your configuration."
            }
    
    try:
        # Create the summary prompt
        prompt = create_summary_prompt(legal_text)
        
        # Generate response
        logger.info("Sending summarization request to Gemini...")
        response = model.generate_content(prompt)
        
        return {
            "success": True,
            "summary": response.text,
            "model_used": "gemini-1.5-pro"
        }
        
    except Exception as e:
        error_msg = f"Error summarizing document: {str(e)}"
        logger.error(error_msg)
        return {
            "success": False,
            "error": error_msg
        }


@app.post("/summarize")
async def summarize_text_endpoint(request: Dict[str, str]):
    """
    Summarize legal text in layman-friendly terms
    
    - **text**: The legal text to summarize
    """
    try:
        legal_text = request.get("text", "").strip()
        
        if not legal_text:
            raise HTTPException(status_code=400, detail="No text provided")
        
        if len(legal_text) > 50000:  # Limit to ~50KB of text for summarization
            legal_text = legal_text[:50000]
            logger.warning("Text truncated to 50,000 characters for summarization")
        
        # Summarize the text
        result = summarize_legal_document(legal_text)
        
        if result["success"]:
            return JSONResponse(
                status_code=200,
                content={
                    "summary": result["summary"],
                    "model_used": result["model_used"],
                    "character_count": len(legal_text)
                }
            )
        else:
            raise HTTPException(status_code=500, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in summarize_text_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.post("/summarize-upload")
async def summarize_document_endpoint(file: UploadFile = File(...)):
    """
    Summarize a legal document from file upload in layman-friendly terms
    
    - **file**: Legal document file (txt, pdf, doc, etc.)
    """
    try:
        # Check file type
        allowed_types = ["text/plain", "application/pdf", "application/msword", 
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
        
        if file.content_type not in allowed_types:
            logger.warning(f"Unsupported file type: {file.content_type}, attempting to read anyway")
        
        # Read file content
        content = await file.read()
        
        # Handle different file types
        if file.content_type == "application/pdf":
            try:
                # Import PyPDF2 for PDF processing
                import PyPDF2
                import io
                
                # Create PDF reader object
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(content))
                
                # Extract text from all pages
                legal_text = ""
                for page in pdf_reader.pages:
                    legal_text += page.extract_text() + "\n"
                
                if not legal_text.strip():
                    raise HTTPException(status_code=400, detail="Could not extract text from PDF. The PDF might be image-based or corrupted.")
                    
            except ImportError:
                raise HTTPException(status_code=500, detail="PDF processing not available. Please upload a text file instead.")
            except Exception as pdf_error:
                logger.error(f"PDF processing error: {str(pdf_error)}")
                raise HTTPException(status_code=400, detail=f"Error processing PDF: {str(pdf_error)}")
        else:
            # Handle text files
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
        
        if len(legal_text) > 50000:  # Limit to ~50KB of text for summarization
            legal_text = legal_text[:50000]
            logger.warning("Document truncated to 50,000 characters for summarization")
        
        # Summarize the document
        result = summarize_legal_document(legal_text)
        
        if result["success"]:
            return JSONResponse(
                status_code=200,
                content={
                    "filename": file.filename,
                    "summary": result["summary"],
                    "model_used": result["model_used"],
                    "character_count": len(legal_text)
                }
            )
        else:
            raise HTTPException(status_code=500, detail=result["error"])
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in summarize_document_endpoint: {str(e)}")
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


@app.post("/extract-pdf-text")
async def extract_pdf_text(request: ExtractRequest):
    """
    Server-side extraction of text from a PDF URL to avoid CORS and provide chat context.

    - **url**: Publicly accessible URL to a PDF
    """
    try:
        import io
        import requests
        try:
            from PyPDF2 import PdfReader
        except Exception as e:
            logger.error(f"PyPDF2 import failed: {e}")
            raise HTTPException(status_code=500, detail="PDF processing not available on server")

        url = (request.url or "").strip()
        if not url:
            raise HTTPException(status_code=400, detail="Missing 'url'")

        # Fetch the PDF bytes
        resp = requests.get(url, timeout=20)
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to fetch PDF (status {resp.status_code})")

        # Basic content-type check (not strictly required)
        ctype = resp.headers.get("content-type", "")
        if "pdf" not in ctype.lower():
            logger.warning(f"Content-Type not PDF: {ctype}. Attempting to parse anyway.")

        # Extract text
        try:
            reader = PdfReader(io.BytesIO(resp.content))
            text_parts = []
            for page in reader.pages:
                try:
                    page_text = page.extract_text() or ""
                except Exception:
                    page_text = ""
                if page_text:
                    text_parts.append(page_text)
            full_text = "\n".join(text_parts)
        except Exception as e:
            logger.error(f"PDF extraction error: {e}")
            raise HTTPException(status_code=400, detail="Unable to extract text from PDF. It may be scanned or encrypted.")

        if not full_text.strip():
            raise HTTPException(status_code=400, detail="No extractable text found in PDF.")

        # Truncate to a manageable size for chat context
        max_chars = 50000
        truncated = full_text[:max_chars]

        return JSONResponse(status_code=200, content={
            "text": truncated,
            "length": len(truncated)
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in extract_pdf_text: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    """
    Chat with AI about the document
    
    - **message**: User's question about the document
    - **document_text**: Optional full document text for context
    """
    try:
        message = request.message.strip()
        document_text = request.document_text.strip()
        
        if not message:
            raise HTTPException(status_code=400, detail="No message provided")
        
        # Initialize Vertex AI if not already done
        global vertex_ai_initialized, model
        if not vertex_ai_initialized:
            if not initialize_vertex_ai():
                return JSONResponse(
                    status_code=200,
                    content={
                        "response": "I'm sorry, but I'm currently unable to access the AI service. Please try again later.",
                        "model_used": "fallback"
                    }
                )
        
        # Create a contextual prompt for the chat
        if document_text:
            # Include document context in the prompt
            prompt = f"""You are a helpful legal assistant. A user is asking questions about a legal document. 
Please provide clear, helpful answers in plain English, avoiding legal jargon when possible.

Document context (first 5000 characters):
{document_text[:5000]}

User question: {message}

Please provide a helpful response about the document or legal concepts mentioned."""
        else:
            # General legal assistance without document context
            prompt = f"""You are a helpful legal assistant. Please answer the user's question about legal matters in plain English, avoiding jargon when possible.

User question: {message}

Please provide a helpful, informative response."""
        
        try:
            # Generate response using Gemini
            logger.info("Sending chat request to Gemini...")
            response = model.generate_content(prompt)
            
            return JSONResponse(
                status_code=200,
                content={
                    "response": response.text,
                    "model_used": "gemini-1.5-pro"
                }
            )
            
        except Exception as e:
            logger.error(f"Error generating chat response: {str(e)}")
            # Provide a helpful fallback response
            fallback_response = f"I understand you're asking about: '{message}'. While I'm experiencing technical difficulties right now, I'd recommend consulting with a legal professional for specific advice about your document or situation."
            
            return JSONResponse(
                status_code=200,
                content={
                    "response": fallback_response,
                    "model_used": "fallback"
                }
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in chat_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    
    # Get port from environment variable (Cloud Run provides this)
    port = int(os.environ.get("PORT", 8000))
    
    logger.info(f"Starting Legal Document Demystifier API on port {port}...")
    
    # Try to initialize Vertex AI but don't block startup
    try:
        initialize_vertex_ai()
        logger.info("Vertex AI initialized successfully")
    except Exception as e:
        logger.warning(f"Vertex AI initialization failed (will retry on first request): {e}")
    
    # Run the application
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )