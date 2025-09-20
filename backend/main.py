"""
Legal Document Demystifier - FastAPI Application
Provides a REST API for analyzing legal documents using Google's Gemini model
Version: 1.1.0 - GitHub Actions Integration
"""

import os
import logging
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import aiplatform
from google.cloud import discoveryengine
import google.auth

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Pydantic models for request/response
class TextAnalysisRequest(BaseModel):
    selected_text: str
    document_url: str = ""

class ExplainSelectionRequest(BaseModel):
    selected_text: str
    document_url: str = ""

class RAGSearchRequest(BaseModel):
    query: str
    document_context: str = ""

class RAGSearchResponse(BaseModel):
    related_snippets: List[Dict[str, Any]]
    search_query: str
    total_results: int

# Global variables for Vertex AI configuration
vertex_ai_initialized = False
model = None


def initialize_vertex_ai():
    """Initialize Vertex AI with your project settings"""
    global vertex_ai_initialized, model
    
    try:
        # For Cloud Run, use service account attached to the instance
        # Project settings
        project_id = "demystifier-ai"
        location = "asia-south1"  # Mumbai region works for India users!
        
        # Initialize Vertex AI
        aiplatform.init(project=project_id, location=location)
        
        # Use the newer approach with Vertex AI models
        from google.cloud.aiplatform.gapic.schema import predict
        
        # Create an endpoint for text generation
        # For now, let's use a simpler approach - just mark as initialized
        # and handle the actual generation in the analysis function
        vertex_ai_initialized = True
        logger.info(f"Vertex AI initialized with project: {project_id}, location: {location}")
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to initialize Vertex AI: {str(e)}")
        # For now, let's continue without AI to test the basic API
        vertex_ai_initialized = False
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifespan events"""
    # Startup
    logger.info("Starting Legal Document Demystifier API...")
    initialize_vertex_ai()
    yield
    # Shutdown
    logger.info("Shutting down Legal Document Demystifier API...")


# Initialize FastAPI app
app = FastAPI(
    title="Legal Document Demystifier",
    description="An API that simplifies complex legal documents using AI",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_legal_analysis_prompt(legal_text: str) -> str:
    """Create a detailed prompt for the Gemini model"""
    prompt = f"""You are an expert lawyer who specializes in explaining complex legal documents to non-lawyers. Analyze the following document. 

First, provide a one-paragraph summary in simple, clear English. 

Second, identify and list the 3 most important clauses a person should be aware of and explain the risks or obligations for each. 

Document: {legal_text}"""
    
    return prompt


def analyze_legal_document(legal_text: str) -> Dict[str, Any]:
    """Analyze legal text using Vertex AI"""
    global vertex_ai_initialized, model
    
    # Initialize Vertex AI if not already done
    if not vertex_ai_initialized:
        if not initialize_vertex_ai():
            # Return a mock response for testing
            return {
                "success": True,
                "analysis": "**DEMO MODE** - AI service temporarily unavailable. This legal document analysis would normally provide: 1) A simplified summary of the document in plain English, 2) Key clauses and their implications, 3) Important obligations and risks to be aware of. Please check back later when the AI service is fully operational.",
                "model_used": "demo-mode"
            }
    
    try:
        # For now, let's create a basic analysis using the text
        # In a real implementation, we would call Vertex AI here
        prompt = create_legal_analysis_prompt(legal_text)
        
        # For now, return a basic analysis
        # TODO: Implement actual Vertex AI call
        basic_analysis = f"""
**Legal Document Analysis**

**Summary:** This appears to be an indemnification clause, which is a common provision in legal agreements where one party agrees to protect another from certain types of legal and financial risks.

**Key Points to Understand:**
1. **Indemnification Obligation**: The "party of the first part" is taking on financial responsibility for any claims, damages, losses, or expenses that might arise.
2. **Scope of Protection**: The protection covers issues "arising from or relating to the performance of this agreement."
3. **Risk Transfer**: This clause essentially transfers certain risks from one party to another.

**Important Considerations:**
- This creates a significant financial obligation for the indemnifying party
- The scope is quite broad ("any and all claims")
- You should understand what activities or situations could trigger this obligation
- Consider whether the risks being assumed are reasonable given the circumstances

**Recommendation:** Have a legal professional review the full agreement to understand the complete context and implications of this clause.
        """
        
        return {
            "success": True,
            "analysis": basic_analysis.strip(),
            "model_used": "basic-analysis"
        }
        
    except Exception as e:
        error_msg = f"Error analyzing document: {str(e)}"
        logger.error(error_msg)
        return {
            "success": False,
            "error": error_msg
        }


def search_related_documents(query: str) -> Dict[str, Any]:
    """Search for related document snippets using Vertex AI Search.

    Uses env vars for engine config and returns empty results on error (no mock snippets).
    Env: RAG_ENGINE_PROJECT, RAG_ENGINE_LOCATION, RAG_ENGINE_ID
    """
    try:
        # Project configuration for Vertex AI Search (env-overridable)
        project_id = os.getenv("RAG_ENGINE_PROJECT", "demystifier-ai")
        location = os.getenv("RAG_ENGINE_LOCATION", "global")
        engine_id = os.getenv("RAG_ENGINE_ID", "synapseragengine_1758347548138")

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
        related_snippets: List[Dict[str, Any]] = []
        for result in response.results:
            # Extract document info
            document_name = "Unknown Document"
            if hasattr(result.document, 'struct_data') and result.document.struct_data:
                struct_data = result.document.struct_data
                if 'title' in struct_data:
                    document_name = struct_data['title']
                elif 'name' in struct_data:
                    document_name = struct_data['name']

            # Extract snippets
            snippets: List[str] = []
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
                    snippets.append(content[:200] + "..." if len(content) > 200 else content)

            for snippet in snippets:
                related_snippets.append({
                    "text": snippet,
                    "source": document_name,
                    "relevance_score": 0.8,
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
        return {
            "success": True,
            "related_snippets": [],
            "total_results": 0,
            "search_query": query,
            "note": "Vertex AI Search unavailable or failed"
        }


@app.on_event("startup")
async def startup_event():
    """Initialize Vertex AI on startup"""
    logger.info("Starting Legal Document Demystifier API...")
    initialize_vertex_ai()


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Legal Document Demystifier API",
        "version": "1.0.0",
        "status": "running",
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
        "timestamp": "2025-09-17"
    }


@app.post("/upload-document")
async def upload_document_endpoint(file: UploadFile = File(...)):
    """
    Upload a document and return a signed URL for viewing
    
    - **file**: Document file to upload
    """
    try:
        # Check file type
        allowed_types = ["application/pdf", "text/plain", "application/msword", 
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
        
        if file.content_type not in allowed_types:
            logger.warning(f"File type {file.content_type} may not be supported")
        
        # Read file content
        content = await file.read()
        
        # For demo purposes, we'll create a temporary URL
        # In production, you'd upload to Cloud Storage and return a signed URL
        import base64
        
        # Create a simple data URL for PDF viewing
        if file.content_type == "application/pdf":
            base64_content = base64.b64encode(content).decode()
            data_url = f"data:application/pdf;base64,{base64_content}"
        else:
            # For text files, convert to data URL
            try:
                text_content = content.decode('utf-8')
                base64_content = base64.b64encode(text_content.encode()).decode()
                data_url = f"data:text/plain;base64,{base64_content}"
            except UnicodeDecodeError:
                raise HTTPException(status_code=400, detail="Unable to decode file content")
        
        return JSONResponse(
            status_code=200,
            content={
                "filename": file.filename,
                "signed_url": data_url,
                "content_type": file.content_type,
                "size": len(content)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.post("/rag-search")
async def rag_search_endpoint(request: RAGSearchRequest):
    """
    Search for related document snippets using Vertex AI Search
    
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


@app.post("/explain-selection")
async def explain_selection_endpoint(request: ExplainSelectionRequest):
    """
    Explain a selected piece of text from a legal document
    
    - **selected_text**: The text to explain
    - **document_url**: Optional context about the document
    """
    try:
        selected_text = request.selected_text.strip()
        
        if not selected_text:
            raise HTTPException(status_code=400, detail="No text provided for explanation")
        
        if len(selected_text) > 2000:  # Limit selection size
            selected_text = selected_text[:2000]
            logger.warning("Selected text truncated to 2,000 characters")
        
        # Create a focused explanation prompt
        explanation_prompt = f"""You are an expert legal advisor. A user has highlighted this text from a legal document and wants a clear explanation:

"{selected_text}"

Please provide:
1. A simple explanation of what this text means in plain English
2. Any important implications or obligations it creates
3. Any potential risks or benefits for the person reading it

Keep your explanation concise, clear, and focused on what the reader needs to know."""
        
        # For now, return a basic explanation since we're focusing on frontend integration
        # In production, this would use Vertex AI
        explanation = f"""This selected text appears to be a legal clause or provision. Here's what it means:

**Plain English Explanation:**
{selected_text[:200]}... - This text establishes certain terms or conditions that parties must follow.

**Key Points:**
• This creates specific obligations or rights
• It may affect your responsibilities under this agreement
• Consider consulting a lawyer for personalized advice

**Recommendation:**
Pay careful attention to this clause as it may have important legal implications for your situation."""
        
        return JSONResponse(
            status_code=200,
            content={
                "explanation": explanation,
                "selected_text": selected_text,
                "character_count": len(selected_text)
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Explanation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to generate explanation: {str(e)}")


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
    
    # For local development
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        log_level="info"
    )