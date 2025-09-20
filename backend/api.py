"""
Legal Document Demystifier - FastAPI Application v2.1
Provides a REST API for analyzing legal documents using Google's Gemini model
Fixed GitHub Actions deployment permissions
"""

import os
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, status
from fastapi.responses import JSONResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import authentication modules with error handling
try:
    from auth import (
        UserCreate, UserLogin, User, Token, 
        create_user, authenticate_user, create_access_token,
        get_current_active_user, require_auth, optional_auth,
        initialize_demo_users, ACCESS_TOKEN_EXPIRE_MINUTES
    )
    AUTH_ENABLED = True
    logger.info("Authentication module loaded successfully")
except ImportError as e:
    logger.error(f"Failed to import authentication module: {e}")
    AUTH_ENABLED = False
    # Define dummy functions to prevent startup failure
    def initialize_demo_users():
        pass

# Import comparison router
try:
    from comparison_router import router as comparison_router
    COMPARISON_ENABLED = True
    logger.info("Document comparison module loaded successfully")
except ImportError as e:
    logger.error(f"Failed to import comparison module: {e}")
    COMPARISON_ENABLED = False

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
    from google.oauth2 import service_account
    GCS_AVAILABLE = True
    logger.info("Google Cloud Storage is available")
except ImportError:
    GCS_AVAILABLE = False
    logger.warning("Google Cloud Storage not available. Upload functionality will be limited.")

# Google Cloud Discovery Engine (Vertex AI Search) imports
try:
    from google.cloud import discoveryengine
    DISCOVERY_ENGINE_AVAILABLE = True
    logger.info("Google Cloud Discovery Engine is available")
except ImportError:
    DISCOVERY_ENGINE_AVAILABLE = False
    logger.warning("Google Cloud Discovery Engine not available. RAG search functionality will be limited.")

# Pydantic models for request/response
class ExplainSelectionRequest(BaseModel):
    selected_text: str
    document_url: str

class ChatRequest(BaseModel):
    message: str
    document_text: str = ""  # Optional: full document text for context

class ExtractRequest(BaseModel):
    url: str

class RAGSearchRequest(BaseModel):
    query: str
    document_context: str = ""

class RAGSearchResponse(BaseModel):
    related_snippets: List[Dict[str, Any]]
    search_query: str
    total_results: int

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

# Include comparison router if available
if COMPARISON_ENABLED:
    app.include_router(comparison_router)
    logger.info("Document comparison router included")

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


def search_related_documents(query: str) -> Dict[str, Any]:
    """Search for related document snippets using Vertex AI Search"""
    if not DISCOVERY_ENGINE_AVAILABLE:
        # Return mock data for testing when Discovery Engine is not available
        mock_snippets = [
            {
                "text": "The tenant shall maintain the premises in good condition and repair, reasonable wear and tear excepted.",
                "source": "Service Agreement",
                "relevance_score": 0.95,
                "document_url": ""
            },
            {
                "text": "Security deposits shall be held in a separate interest-bearing account and returned within 30 days of lease termination.",
                "source": "Security_Deposit_Policy", 
                "relevance_score": 0.87,
                "document_url": ""
            },
            {
                "text": "All maintenance requests must be submitted in writing and will be addressed within 48 hours of receipt.",
                "source": "Privacy Policy",
                "relevance_score": 0.72,
                "document_url": ""
            }
        ]
        
        return {
            "success": True,
            "related_snippets": mock_snippets,
            "total_results": len(mock_snippets),
            "search_query": query,
            "note": "Using mock data - Vertex AI Search unavailable"
        }

    try:
        # Project configuration for Vertex AI Search
        project_id = "demystifier-ai"
        location = "global"  # Vertex AI Search typically uses global location
        engine_id = "synapseragengine_1758347548138"  # Your unique engine ID
        
        # Create the search client
        client = discoveryengine.SearchServiceClient()
        
        # The resource name of the search engine
        serving_config = f"projects/{project_id}/locations/{location}/collections/default_collection/engines/{engine_id}/servingConfigs/default_config"
        
        # Create the search request
        request = discoveryengine.SearchRequest(
            serving_config=serving_config,
            query=query,
            page_size=10,  # Number of results to return
            safe_search=False,
            content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
                snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
                    return_snippet=True,
                    max_snippet_count=3
                ),
                extractive_content_spec=discoveryengine.SearchRequest.ContentSearchSpec.ExtractiveContentSpec(
                    max_extractive_answer_count=1,
                    max_extractive_segment_count=3
                )
            )
        )
        
        # Perform the search
        response = client.search(request=request)
        
        # Process the results
        related_snippets = []
        for result in response.results:
            # Extract document info
            document_name = "Unknown Document"
            if hasattr(result.document, 'struct_data') and result.document.struct_data:
                # Try to get document name from metadata
                struct_data = result.document.struct_data
                if 'title' in struct_data:
                    document_name = struct_data['title']
                elif 'name' in struct_data:
                    document_name = struct_data['name']
            
            # Extract snippets
            snippets = []
            if hasattr(result.document, 'derived_struct_data') and result.document.derived_struct_data:
                derived_data = result.document.derived_struct_data
                if 'snippets' in derived_data:
                    for snippet in derived_data['snippets']:
                        if 'snippet' in snippet:
                            snippets.append(snippet['snippet'])
            
            # If no snippets from derived data, try to get content
            if not snippets and hasattr(result.document, 'struct_data') and result.document.struct_data:
                content = result.document.struct_data.get('content', '')
                if content:
                    # Take first 200 characters as snippet
                    snippets.append(content[:200] + "..." if len(content) > 200 else content)
            
            for snippet in snippets:
                related_snippets.append({
                    "text": snippet,
                    "source": document_name,
                    "relevance_score": 0.8,  # You might want to extract actual scores
                    "document_url": result.document.id if hasattr(result.document, 'id') else ""
                })
        
        return {
            "success": True,
            "related_snippets": related_snippets,
            "total_results": len(related_snippets),
            "search_query": query
        }
        
    except Exception as e:
        logger.error(f"Error searching related documents: {str(e)}")
        
        # Return mock data for testing
        mock_snippets = [
            {
                "text": "The tenant shall maintain the premises in good condition and repair, reasonable wear and tear excepted.",
                "source": "Service Agreement",
                "relevance_score": 0.95,
                "document_url": ""
            },
            {
                "text": "Security deposits shall be held in a separate interest-bearing account and returned within 30 days of lease termination.",
                "source": "Security_Deposit_Policy", 
                "relevance_score": 0.87,
                "document_url": ""
            },
            {
                "text": "All maintenance requests must be submitted in writing and will be addressed within 48 hours of receipt.",
                "source": "Privacy Policy",
                "relevance_score": 0.72,
                "document_url": ""
            }
        ]
        
        return {
            "success": True,
            "related_snippets": mock_snippets,
            "total_results": len(mock_snippets),
            "search_query": query,
            "note": "Using mock data - Vertex AI Search unavailable"
        }


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Legal Document Demystifier API",
        "version": "2.0.0",
        "auth_enabled": True,
        "comparison_enabled": COMPARISON_ENABLED,
        "endpoints": {
            "/register": "POST - Register a new user account",
            "/login": "POST - Login and get access token",
            "/me": "GET - Get current user profile (requires auth)",
            "/user-files": "GET - Get user's uploaded files (requires auth)",
            "/analyze-document": "POST - Upload a legal document for analysis (requires auth)",
            "/analyze-text": "POST - Analyze legal text directly (requires auth)",
            "/summarize": "POST - Summarize legal text in layman terms (requires auth)",
            "/summarize-upload": "POST - Upload and summarize a legal document (requires auth)",
            "/upload-pdf": "POST - Upload PDF to cloud storage (optional auth)",
            "/extract-pdf-text": "POST - Extract text from PDF URL (requires auth)",
            "/explain-selection": "POST - Explain selected text (requires auth)",
            "/rag-search": "POST - Search for related document snippets using Vertex AI Search (requires auth)",
            "/chat": "POST - Chat with AI about document (requires auth)",
            "/api/compare/compare-documents": "POST - Compare two PDF documents semantically (requires auth)",
            "/health": "GET - Check API health status"
        }
    }


# Authentication endpoints
@app.post("/register", response_model=Token)
async def register(user: UserCreate):
    """
    Register a new user account
    
    - **email**: User's email address (must be unique)
    - **password**: User's password (minimum 6 characters)
    - **full_name**: User's full name
    """
    if not AUTH_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service is not available"
        )
    
    try:
        # Validate password length
        if len(user.password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 6 characters long"
            )
        
        # Create the user
        new_user = create_user(user)
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": new_user.email},
            expires_delta=access_token_expires
        )
        
        logger.info(f"New user registered: {new_user.email}")
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # Convert to seconds
            user=new_user
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )


@app.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """
    Login with email and password
    
    - **email**: User's email address
    - **password**: User's password
    """
    try:
        # Authenticate user
        user_data = authenticate_user(credentials.email, credentials.password)
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user_data["email"]},
            expires_delta=access_token_expires
        )
        
        # Convert user data to User model
        user = User(
            id=user_data["id"],
            email=user_data["email"],
            full_name=user_data["full_name"],
            created_at=user_data["created_at"],
            is_active=user_data["is_active"]
        )
        
        logger.info(f"User logged in: {user.email}")
        
        return Token(
            access_token=access_token,
            token_type="bearer",
            expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,  # Convert to seconds
            user=user
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )


@app.get("/me", response_model=User)
async def get_current_user_profile(current_user: User = Depends(require_auth)):
    """
    Get current user profile (requires authentication)
    """
    return current_user


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
async def analyze_document_endpoint(file: UploadFile = File(...), current_user: User = Depends(require_auth)):
    """
    Analyze a legal document from file upload (requires authentication)
    
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
async def analyze_text_endpoint(request: Dict[str, str], current_user: User = Depends(require_auth)):
    """
    Analyze legal text directly (requires authentication)
    
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


@app.post("/upload-pdf")
async def upload_pdf(file: UploadFile = File(...), current_user: Optional[User] = Depends(optional_auth)):
    """
    Upload a PDF document to Google Cloud Storage and return a signed URL
    Requires authentication for file storage, but allows unauthenticated demo usage
    
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
            # Initialize GCS client with service account credentials
            service_account_path = "service-account-key.json"
            use_signed_urls = False
            
            if os.path.exists(service_account_path):
                # Use service account key file with proper scopes for signing
                credentials = service_account.Credentials.from_service_account_file(
                    service_account_path,
                    scopes=['https://www.googleapis.com/auth/cloud-platform']
                )
                client = storage.Client(credentials=credentials)
                use_signed_urls = True
                logger.info("Using service account credentials for GCS with signing scopes")
            else:
                # Fallback to default credentials (for Cloud Run environment)
                client = storage.Client()
                logger.info("Using default credentials for GCS (signed URLs not available)")
            
            bucket = client.bucket(bucket_name)
            
            # Generate unique filename with user-specific path
            file_extension = os.path.splitext(file.filename)[1] if file.filename else '.pdf'
            
            if current_user:
                # Authenticated user - store in user-specific folder
                unique_filename = f"documents/users/{current_user.id}/{uuid.uuid4()}{file_extension}"
                logger.info(f"Uploading file for authenticated user: {current_user.email}")
            else:
                # Unauthenticated user - store in temporary folder
                unique_filename = f"documents/temp/{uuid.uuid4()}{file_extension}"
                logger.info("Uploading file for unauthenticated user")
            
            # Create blob and upload content
            blob = bucket.blob(unique_filename)
            blob.upload_from_string(content, content_type='application/pdf')
            
            # Set metadata if user is authenticated
            if current_user:
                blob.metadata = {
                    "user_id": current_user.id,
                    "user_email": current_user.email,
                    "original_filename": file.filename,
                    "upload_timestamp": datetime.utcnow().isoformat()
                }
                blob.patch()
            
            # Make blob publicly readable for demo purposes (only for temp files)
            if not current_user:
                blob.make_public()
                file_url = blob.public_url
                logger.info(f"Made temporary file public: {file_url}")
            else:
                # For authenticated users, try to generate signed URL, fallback to proxy
                try:
                    if use_signed_urls:
                        file_url = blob.generate_signed_url(
                            expiration=datetime.utcnow() + timedelta(hours=1),
                            method='GET'
                        )
                        logger.info(f"Generated signed URL for authenticated user")
                    else:
                        raise ValueError("Service account credentials not available for signing")
                except Exception as e:
                    logger.warning(f"Failed to generate signed URL: {e}")
                    # Fallback to proxy URL - make it a full URL to the backend
                    backend_url = os.getenv("BACKEND_URL", "https://legal-backend-144935064473.asia-south1.run.app")
                    file_url = f"{backend_url}/proxy-gcs/{bucket_name}/{unique_filename}"
                    logger.info(f"Using full backend proxy URL for authenticated user: {file_url}")
            
            logger.info(f"Successfully uploaded {file.filename} to GCS as {unique_filename}")
            
            return JSONResponse(
                status_code=200,
                content={
                    "signed_url": file_url,
                    "filename": file.filename,
                    "blob_name": unique_filename,
                    "user_authenticated": current_user is not None,
                    "public_access": not current_user
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
        logger.error(f"Unexpected error in upload_pdf: {str(e)}")
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
async def summarize_text_endpoint(request: Dict[str, str], current_user: User = Depends(require_auth)):
    """
    Summarize legal text in layman-friendly terms (requires authentication)
    
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
async def summarize_document_endpoint(file: UploadFile = File(...), current_user: User = Depends(require_auth)):
    """
    Summarize a legal document from file upload in layman-friendly terms (requires authentication)
    
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
async def explain_selection(request: ExplainSelectionRequest, current_user: User = Depends(require_auth)):
    """
    Analyze selected text from a document and provide AI explanation (requires authentication)
    
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


@app.post("/rag-search")
async def rag_search_endpoint(request: RAGSearchRequest, current_user: User = Depends(require_auth)):
    """
    Search for related document snippets using Vertex AI Search (requires authentication)
    
    - **query**: The search query (selected text)
    - **document_context**: Optional context about the current document
    """
    try:
        query = request.query.strip()
        
        if not query:
            raise HTTPException(status_code=400, detail="No search query provided")
        
        if len(query) > 1000:  # Limit query size
            query = query[:1000]
            logger.warning("Query truncated to 1,000 characters")
        
        # Search for related documents
        search_result = search_related_documents(query)
        
        if search_result["success"]:
            return JSONResponse(
                status_code=200,
                content={
                    "related_snippets": search_result["related_snippets"],
                    "search_query": search_result["search_query"],
                    "total_results": search_result["total_results"],
                    "note": search_result.get("note", "")
                }
            )
        else:
            raise HTTPException(status_code=500, detail="Failed to search related documents")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"RAG search error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.post("/extract-pdf-text")
async def extract_pdf_text(request: ExtractRequest, current_user: User = Depends(require_auth)):
    """
    Server-side extraction of text from a PDF URL to avoid CORS and provide chat context (requires authentication).

    - **url**: Publicly accessible URL to a PDF
    """
    try:
        import io
        import requests
        from urllib.parse import urlparse
        try:
            from PyPDF2 import PdfReader
        except Exception as e:
            logger.error(f"PyPDF2 import failed: {e}")
            raise HTTPException(status_code=500, detail="PDF processing not available on server")

        url = (request.url or "").strip()
        if not url:
            raise HTTPException(status_code=400, detail="Missing 'url'")

        # Determine how to fetch the PDF bytes
        pdf_bytes: bytes
        try:
            parsed = urlparse(url)
            path = parsed.path or ""
        except Exception:
            parsed = None
            path = ""

        # If the URL points to our backend proxy-gcs route, fetch directly from GCS
        if path.startswith("/proxy-gcs/") and GCS_AVAILABLE:
            try:
                parts = path[len("/proxy-gcs/"):].split("/", 1)
                if len(parts) != 2:
                    raise ValueError("Invalid proxy-gcs path")
                bucket_name, file_path = parts[0], parts[1]
                client = storage.Client()
                bucket = client.bucket(bucket_name)
                blob = bucket.blob(file_path)
                if not blob.exists():
                    raise HTTPException(status_code=404, detail="File not found in storage")
                pdf_bytes = blob.download_as_bytes()
                ctype = blob.content_type or "application/pdf"
            except HTTPException:
                raise
            except Exception as ge:
                logger.error(f"GCS fetch in extract_pdf_text failed: {ge}")
                raise HTTPException(status_code=500, detail=f"GCS access failed: {str(ge)}")
        else:
            # Fallback to HTTP(S) fetch
            resp = requests.get(url, timeout=20)
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to fetch PDF (status {resp.status_code})")
            pdf_bytes = resp.content
            # Basic content-type check (not strictly required)
            ctype = resp.headers.get("content-type", "")
            if "pdf" not in ctype.lower():
                logger.warning(f"Content-Type not PDF: {ctype}. Attempting to parse anyway.")

        # Extract text
        try:
            reader = PdfReader(io.BytesIO(pdf_bytes))
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


@app.get("/user-files")
async def get_user_files(current_user: User = Depends(require_auth)):
    """
    Get list of files uploaded by the current user (requires authentication)
    """
    try:
        if not GCS_AVAILABLE:
            # Return mock data for development
            mock_files = [
                {
                    "id": "mock-file-1",
                    "name": "Employment_Agreement.pdf",
                    "url": "https://storage.googleapis.com/mock-bucket/mock-file-1.pdf",
                    "upload_date": "2024-01-15T10:30:00Z",
                    "size": 245760
                },
                {
                    "id": "mock-file-2", 
                    "name": "Service_Contract.pdf",
                    "url": "https://storage.googleapis.com/mock-bucket/mock-file-2.pdf",
                    "upload_date": "2024-01-14T15:45:00Z",
                    "size": 189440
                }
            ]
            
            return JSONResponse(
                status_code=200,
                content={
                    "files": mock_files,
                    "total": len(mock_files),
                    "message": "Mock data - GCS not configured"
                }
            )

        # Google Cloud Storage configuration
        bucket_name = "demystifier-ai_cloudbuild"
        strict_isolation = os.getenv("STRICT_USER_ISOLATION", "true").lower() == "true"

        try:
            # Initialize GCS client with service account credentials
            service_account_path = "service-account-key.json"
            
            if os.path.exists(service_account_path):
                # Use service account key file with proper scopes for signing
                credentials = service_account.Credentials.from_service_account_file(
                    service_account_path,
                    scopes=['https://www.googleapis.com/auth/cloud-platform']
                )
                client = storage.Client(credentials=credentials)
                logger.info("Using service account credentials for GCS with signing scopes")
            else:
                # Fallback to default credentials (for Cloud Run environment)
                client = storage.Client()
                logger.info("Using default credentials for GCS")
            
            bucket = client.bucket(bucket_name)
            
            # List blobs in user's folder
            user_prefix = f"documents/users/{current_user.id}/"
            blobs = list(bucket.list_blobs(prefix=user_prefix))

            user_files = []
            for blob in blobs:
                # Skip directory markers
                if blob.name.endswith('/'):
                    continue
                
                # Extract filename from path
                filename = blob.name.split('/')[-1]
                original_filename = blob.metadata.get('original_filename', filename) if blob.metadata else filename
                
                # Generate signed URL (valid for 1 hour)
                try:
                    # Check if we can generate signed URLs
                    signed_url = blob.generate_signed_url(
                        expiration=datetime.utcnow() + timedelta(hours=1),
                        method='GET'
                    )
                except Exception as url_error:
                    logger.warning(f"Failed to generate signed URL for {blob.name}: {url_error}")
                    # Fallback to proxy URL or public URL
                    signed_url = f"/api/proxy-gcs/{bucket_name}/{blob.name}"
                
                file_info = {
                    "id": blob.name,
                    "name": original_filename,
                    "url": signed_url,
                    "upload_date": blob.time_created.isoformat() if blob.time_created else None,
                    "size": blob.size,
                    "type": "pdf"
                }
                
                user_files.append(file_info)

            # Backward-compat: if none found (due to older user IDs), optionally scan all docs and filter by user email
            if not user_files and not strict_isolation:
                try:
                    logger.info("No files under stable ID path; scanning all user documents for this email")
                    all_blobs = bucket.list_blobs(prefix="documents/users/")
                    for blob in all_blobs:
                        if blob.name.endswith('/'):
                            continue
                        meta = blob.metadata or {}
                        if meta.get('user_email') != current_user.email:
                            continue
                        filename = meta.get('original_filename', blob.name.split('/')[-1])
                        try:
                            signed_url = blob.generate_signed_url(
                                expiration=datetime.utcnow() + timedelta(hours=1),
                                method='GET'
                            )
                        except Exception as url_error:
                            logger.warning(f"Failed to generate signed URL for {blob.name}: {url_error}")
                            signed_url = f"/api/proxy-gcs/{bucket_name}/{blob.name}"
                        user_files.append({
                            "id": blob.name,
                            "name": filename,
                            "url": signed_url,
                            "upload_date": blob.time_created.isoformat() if blob.time_created else None,
                            "size": blob.size,
                            "type": "pdf"
                        })
                except Exception as scan_err:
                    logger.warning(f"Fallback scan for user documents failed: {scan_err}")
            
            # Sort by upload date (newest first)
            user_files.sort(key=lambda x: x['upload_date'] or '', reverse=True)
            
            logger.info(f"Retrieved {len(user_files)} files for user {current_user.email}")
            
            return JSONResponse(
                status_code=200,
                content={
                    "files": user_files,
                    "total": len(user_files)
                }
            )
            
        except Exception as gcs_error:
            logger.error(f"GCS list files error: {str(gcs_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve files from Google Cloud Storage: {str(gcs_error)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in get_user_files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


@app.get("/proxy-gcs/{bucket_name}/{file_path:path}")
async def proxy_gcs_file(bucket_name: str, file_path: str, current_user: dict = Depends(get_current_active_user)):
    """Proxy to serve files from Google Cloud Storage when signed URLs don't work"""
    try:
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(file_path)
        
        if not blob.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        # Download the file content
        content = blob.download_as_bytes()
        
        # Get content type from blob metadata or infer from extension
        content_type = blob.content_type or "application/octet-stream"
        
        return Response(content=content, media_type=content_type)
        
    except Exception as e:
        logger.error(f"Error proxying GCS file {file_path}: {e}")
        raise HTTPException(status_code=500, detail=f"Error accessing file: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    
    # Get port from environment variable (Cloud Run provides this automatically)
    port = int(os.environ.get("PORT", 8000))
    
    logger.info(f"Starting Legal Document Demystifier API on port {port}...")
    
    # Initialize demo users for testing (non-blocking)
    try:
        initialize_demo_users()
        logger.info("Demo users initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize demo users: {e}")
    
    # Try to initialize Vertex AI but don't block startup
    try:
        initialize_vertex_ai()
        logger.info("Vertex AI initialized successfully")
    except Exception as e:
        logger.warning(f"Vertex AI initialization failed (will retry on first request): {e}")
    
    # Run the application with improved configuration for Cloud Run
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
        access_log=True,
        loop="auto"
    )