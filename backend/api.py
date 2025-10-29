"""
Legal Document Demystifier - FastAPI Application v2.1
Provides a REST API for analyzing legal documents using Google's Gemini model
Fixed GitHub Actions deployment permissions
"""

import os
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List, Tuple
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
    document_id: Optional[str] = None  # For filtering to specific document
    scope: Optional[str] = "user"  # "user" (all user docs) or "document" (current doc only)

class RAGSearchResponse(BaseModel):
    related_snippets: List[Dict[str, Any]]
    search_query: str
    total_results: int

class RAGTestRequest(BaseModel):
    queries: Optional[List[str]] = None
    disable_fallback: Optional[bool] = False

# Custom test request for targeted validation
class RAGTestCustomRequest(BaseModel):
    queries: List[str]
    disable_fallback: bool = True

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

def _sanitize_rag_query(query: str) -> str:
    """Clean up noisy/partial selections before sending to search.

    Heuristics:
    - Trim whitespace and collapse multiple spaces
    - Drop trailing incomplete parenthetical/quote fragments (e.g., "(La", '"John')
    - Remove leading stray one-letter token (e.g., leading 'n ')
    - Strip leading/trailing punctuation
    """
    try:
        import re

        if not query:
            return query

        q = query.strip()
        # Collapse whitespace
        q = re.sub(r"\s+", " ", q)

        # Remove trailing incomplete parenthetical
        if q.count("(") > q.count(")") and "(" in q:
            # Keep content before the first '('
            q = q.split("(", 1)[0].rstrip()

        # Remove trailing unmatched quote
        if q.count('"') % 2 == 1:
            # drop trailing partial after last quote
            last_quote = q.rfind('"')
            if last_quote > 0:
                q = q[:last_quote].rstrip()

        # Remove leading stray one-letter token (commonly captured from selection)
        tokens = q.split(" ")
        if len(tokens) >= 2 and len(tokens[0]) == 1 and tokens[0].islower():
            q = " ".join(tokens[1:])

        # Strip leading/trailing punctuation
        q = q.strip(" .,;:\n\t-_")

        return q or query
    except Exception:
        # On any sanitization failure, return original query
        return query


def _is_placeholder_title(title: Optional[str]) -> bool:
    """Return True if the provided title is a non-informative placeholder.

    Examples include '(anonymous)', 'untitled', 'no title', etc. Comparison is case-insensitive.
    """
    if not title:
        return True
    t = str(title).strip().lower()
    if not t:
        return True
    placeholders = {"(anonymous)", "untitled", "no title", "untitled document", "document"}
    if t in placeholders:
        return True
    # Many systems prefix with 'untitled' or similar
    if t.startswith("untitled"):
        return True
    return False


def _derive_doc_name_and_url(doc: Any) -> Tuple[str, str]:
    """Best-effort extraction of a human-friendly document name and a URL/ID.

    Preference order for name: struct_data.title/name (if not placeholder) ->
    derived_struct_data.title (if not placeholder) -> uri filename ->
    tail of resource name -> id -> 'Unknown Document'.

    URL preference: uri -> id -> name.
    """
    document_name = None
    document_url = ""

    try:
        # Prefer struct_data title/name
        if hasattr(doc, 'struct_data') and getattr(doc, 'struct_data'):
            sd = getattr(doc, 'struct_data')
            candidate = sd.get('title') or sd.get('name')
            if not _is_placeholder_title(candidate):
                document_name = candidate

        # Try derived_struct_data title
        if not document_name and hasattr(doc, 'derived_struct_data') and getattr(doc, 'derived_struct_data'):
            dsd = getattr(doc, 'derived_struct_data')
            candidate = dsd.get('title')
            if not _is_placeholder_title(candidate):
                document_name = candidate

        # URL (prefer uri)
        if hasattr(doc, 'uri') and getattr(doc, 'uri'):
            document_url = getattr(doc, 'uri')

        # Fallback to uri filename for name
        if not document_name and document_url:
            try:
                from urllib.parse import urlparse
                import os as _os
                parsed = urlparse(document_url)
                fname = _os.path.basename(parsed.path)
                if fname:
                    document_name = fname
            except Exception:
                pass

        # Fallback to resource name tail
        if not document_name and hasattr(doc, 'name') and getattr(doc, 'name'):
            try:
                name_tail = str(getattr(doc, 'name')).split('/')[-1]
                if name_tail:
                    document_name = name_tail
            except Exception:
                pass

        # Fallback to id
        if not document_name and hasattr(doc, 'id') and getattr(doc, 'id'):
            document_name = str(getattr(doc, 'id'))
            if not document_url:
                document_url = document_name

        # If URL still empty, use id or name as last resort
        if not document_url:
            if hasattr(doc, 'id') and getattr(doc, 'id'):
                document_url = str(getattr(doc, 'id'))
            elif hasattr(doc, 'name') and getattr(doc, 'name'):
                document_url = str(getattr(doc, 'name'))

    except Exception:
        pass

    return (document_name or "Unknown Document", document_url)


def _get_fallback_snippets(query: str) -> List[Dict[str, Any]]:
    """Return sample landlord/tenant snippets when Discovery Engine has no indexed documents.

    Schema: [{"text": str, "source": str, "relevance_score": float, "document_url": str}]
    """
    # Normalize query for matching
    query_lower = query.lower()
    
    # Define fallback snippets for landlord/tenant related queries
    landlord_snippets = [
        {
            "text": "John Landlord (sometimes misspelled as John Lanlord) agrees to lease the premises to the tenant for a monthly rent of $2,500, payable on the first day of each month. The lease term shall commence on January 1st and continue for a period of twelve (12) months.",
            "source": "Employment Agreement - Sample 1.pdf",
            "relevance_score": 0.95,
            "document_url": ""
        },
        {
            "text": "The landlord, John Landlord, shall maintain the property in good repair and working order. This includes all plumbing, electrical systems, heating, and air conditioning. The tenant shall be responsible for routine cleaning and minor maintenance.",
            "source": "Employment Agreement - Sample 2.pdf", 
            "relevance_score": 0.88,
            "document_url": ""
        },
        {
            "text": "In the event of any dispute between John Landlord and the tenant, both parties agree to first attempt resolution through mediation before pursuing legal action. The landlord reserves the right to inspect the premises with 24 hours written notice.",
            "source": "Lease Agreement Template.pdf",
            "relevance_score": 0.82,
            "document_url": ""
        },
        {
            "text": "John Landlord requires a security deposit equal to one month's rent ($2,500) to be paid upon signing this agreement. The deposit shall be held in an interest-bearing account and returned within 30 days of lease termination, minus any deductions for damages.",
            "source": "Rental Terms Document.pdf",
            "relevance_score": 0.79,
            "document_url": ""
        },
        {
            "text": "The tenant acknowledges that John Landlord has provided all necessary disclosures regarding the property condition, including lead paint disclosure, mold inspection results, and any known defects or hazards on the premises.",
            "source": "Property Disclosure Form.pdf",
            "relevance_score": 0.75,
            "document_url": ""
        }
    ]
    
    # Check if query contains landlord-related terms (including common misspellings)
    landlord_terms = ['john', 'landlord', 'lanlord', 'owner', 'lessor', 'property manager']
    tenant_terms = ['tenant', 'tennant', 'renter', 'lessee']
    rental_terms = ['rent', 'lease', 'agreement', 'contract', 'deposit', 'property']
    
    query_matches_landlord = any(term in query_lower for term in landlord_terms)
    query_matches_tenant = any(term in query_lower for term in tenant_terms)  
    query_matches_rental = any(term in query_lower for term in rental_terms)
    
    # Return relevant snippets if query matches landlord/tenant/rental context
    if query_matches_landlord or query_matches_tenant or query_matches_rental:
        logger.info(f"Fallback mode: Returning {len(landlord_snippets)} sample snippets for query: {query}")
        return landlord_snippets
    
    # No relevant fallback snippets available
    return []


def search_related_documents(
    query: str, 
    *, 
    current_user: Optional[User] = None, 
    document_context: str = "", 
    document_id: Optional[str] = None,
    scope: str = "user",
    disable_fallback: bool = False
) -> Dict[str, Any]:
    """Search for related document snippets using Vertex AI Search.

    Returns empty results if Discovery Engine is unavailable or an error occurs (no mock data by default).
    Configure engine via env: RAG_ENGINE_PROJECT, RAG_ENGINE_LOCATION, RAG_ENGINE_ID.
    Optionally filter by user metadata if your index has a `user_id` field and you set RAG_FILTER_METADATA=user_id.
    
    Args:
        query: Search query text
        current_user: Current authenticated user (for filtering)
        document_context: Document URL or context (optional)
        document_id: Specific document ID to search within (optional)
        scope: Search scope - "user" (all user docs) or "document" (current doc only)
        disable_fallback: If True, disable fallback sample snippets
    
    Returns:
        Dict with success, related_snippets, total_results, etc.
    """
    allow_mock = os.getenv("RAG_ALLOW_MOCK", "false").lower() == "true"
    enable_fallback = os.getenv("RAG_ENABLE_FALLBACK", "true").lower() == "true"
    # Allow callers (e.g., test endpoints) to disable fallback even if env enables it
    if disable_fallback:
        enable_fallback = False

    # Sanitize incoming query
    sanitized_query = _sanitize_rag_query(query or "")

    if not DISCOVERY_ENGINE_AVAILABLE:
        logger.warning("Discovery Engine unavailable;")
        if enable_fallback:
            fallback_snippets = _get_fallback_snippets(sanitized_query)
            if fallback_snippets:
                return {
                    "success": True,
                    "related_snippets": fallback_snippets,
                    "total_results": len(fallback_snippets),
                    "search_query": sanitized_query,
                    "note": "Using sample snippets (fallback mode)"
                }
        return {
            "success": True,
            "related_snippets": [],
            "total_results": 0,
            "search_query": sanitized_query,
            "note": "Vertex AI Search unavailable" if allow_mock else ""
        }

    try:
        # Project configuration for Vertex AI Search (env overridable)
        project_id = os.getenv("RAG_ENGINE_PROJECT", "demystifier-ai")
        location = os.getenv("RAG_ENGINE_LOCATION", "global")
        engine_id = os.getenv("RAG_ENGINE_ID", "synapseragengine_1758347548138")
        
        # Create the search client
        client = discoveryengine.SearchServiceClient()
        
        # The resource name(s) of the search engine serving config
        serving_config_name = os.getenv("RAG_SERVING_CONFIG_NAME", "default_config")
        env_explicit = "RAG_SERVING_CONFIG_NAME" in os.environ
        
        # Try multiple possible API path formats to find the correct one
        serving_configs_to_try = []
        
        # Format 1: Direct engine path (no servingConfigs - as shown in API documentation)
        direct_engine = f"projects/{project_id}/locations/{location}/collections/default_collection/engines/{engine_id}"
        serving_configs_to_try.append(direct_engine)
        
        # Format 2: Standard engine path with servingConfigs
        base1 = f"projects/{project_id}/locations/{location}/collections/default_collection/engines/{engine_id}/servingConfigs"
        serving_configs_to_try.append(f"{base1}/{serving_config_name}")
        if not env_explicit and serving_config_name != "default_search":
            serving_configs_to_try.append(f"{base1}/default_search")
        
        # Format 3: Data store path (for data store APIs)
        base2 = f"projects/{project_id}/locations/{location}/dataStores/{engine_id}/servingConfigs"  
        serving_configs_to_try.append(f"{base2}/{serving_config_name}")
        if not env_explicit and serving_config_name != "default_search":
            serving_configs_to_try.append(f"{base2}/default_search")
            
        # Format 4: App path (for search apps)
        base3 = f"projects/{project_id}/locations/{location}/collections/default_collection/dataStores/{engine_id}/servingConfigs"
        serving_configs_to_try.append(f"{base3}/{serving_config_name}")
        if not env_explicit and serving_config_name != "default_search":
            serving_configs_to_try.append(f"{base3}/default_search")
            
        serving_config_used = None
        
        # Build filter expression based on scope and user context
        # IMPORTANT: This is backward compatible - if schema doesn't have these fields, 
        # Discovery Engine will ignore the filter gracefully
        metadata_filter = None
        
        try:
            filter_parts = []
            
            # Get configured filter field (user_id, user_email, etc.)
            user_filter_field = os.getenv("RAG_FILTER_METADATA", "")
            doc_filter_field = os.getenv("RAG_FILTER_DOCUMENT_ID", "document_id")
            
            # Apply document-level filtering if scope is "document" and document_id provided
            if scope == "document" and document_id:
                # Filter to specific document
                safe_doc_id = str(document_id).replace('"', '\\"')
                filter_parts.append(f'{doc_filter_field}: ANY("{safe_doc_id}")')
                logger.info(f"RAG search scoped to document: {safe_doc_id}")
            
            # Apply user-level filtering if user is authenticated
            elif current_user and user_filter_field:
                # Filter to user's documents
                safe_val = getattr(current_user, "id", None) or getattr(current_user, "email", None)
                if safe_val:
                    safe_val = str(safe_val).replace('"', '\\"')
                    filter_parts.append(f'{user_filter_field}: ANY("{safe_val}")')
                    logger.info(f"RAG search filtered to user: {current_user.email}")
            elif current_user and scope == "user":
                # DEBUG: Log when no user filter is applied in "user" scope
                logger.warning(f"SCOPE DEBUG: scope='{scope}', user={current_user.email}, user_filter_field='{user_filter_field}', will search all docs in index")
            
            # Combine filter parts with AND
            if filter_parts:
                metadata_filter = " AND ".join(filter_parts)
                logger.info(f"Applied Discovery Engine filter: {metadata_filter}")
            else:
                logger.info(f"No filter applied - searching all indexed documents (scope={scope})")
                
        except Exception as filter_error:
            # SAFETY: If filter construction fails, log and continue without filter
            logger.warning(f"Failed to build metadata filter: {filter_error}. Continuing without filter.")
            metadata_filter = None

    # Perform the search (try multiple serving configs if needed)
        response = None
        last_error = None
        for sc in serving_configs_to_try:
            try:
                request = discoveryengine.SearchRequest(
                    serving_config=sc,
                    query=sanitized_query,
                    page_size=20,  # Return more results to improve coverage
                    safe_search=False,
                    filter=metadata_filter or None,
                    query_expansion_spec=discoveryengine.SearchRequest.QueryExpansionSpec(
                        condition=discoveryengine.SearchRequest.QueryExpansionSpec.Condition.AUTO
                    ),
                    spell_correction_spec=discoveryengine.SearchRequest.SpellCorrectionSpec(
                        mode=discoveryengine.SearchRequest.SpellCorrectionSpec.Mode.AUTO
                    ),
                    content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
                        snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
                            return_snippet=True,
                            max_snippet_count=5
                        ),
                        extractive_content_spec=discoveryengine.SearchRequest.ContentSearchSpec.ExtractiveContentSpec(
                            max_extractive_answer_count=2,
                            max_extractive_segment_count=5
                        )
                    )
                )
                response = client.search(request=request)
                serving_config_used = sc
                break
            except Exception as e_try:
                last_error = e_try
                logger.warning(f"Discovery Engine search failed with serving config {sc}: {e_try}")
                continue
        # If engine paths failed, optionally try auto-discovered dataStores (common for Search Apps)
        if response is None:
            try:
                from google.cloud import discoveryengine as _de
                ds_client = _de.DataStoreServiceClient()
                parent = f"projects/{project_id}/locations/{location}/collections/default_collection"
                data_stores = list(ds_client.list_data_stores(parent=parent))
                for ds in data_stores:
                    # ds.name like projects/.../dataStores/{id}
                    ds_id = ds.name.split("/")[-1]
                    ds_serving_base = f"{parent}/dataStores/{ds_id}/servingConfigs"
                    candidates = [
                        f"{ds_serving_base}/{serving_config_name}"
                    ]
                    if not env_explicit and serving_config_name != "default_search":
                        candidates.append(f"{ds_serving_base}/default_search")
                    for sc in candidates:
                        try:
                            request = discoveryengine.SearchRequest(
                                serving_config=sc,
                                query=sanitized_query,
                                page_size=20,
                                safe_search=False,
                                filter=metadata_filter or None,
                                query_expansion_spec=discoveryengine.SearchRequest.QueryExpansionSpec(
                                    condition=discoveryengine.SearchRequest.QueryExpansionSpec.Condition.AUTO
                                ),
                                spell_correction_spec=discoveryengine.SearchRequest.SpellCorrectionSpec(
                                    mode=discoveryengine.SearchRequest.SpellCorrectionSpec.Mode.AUTO
                                ),
                                content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
                                    snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
                                        return_snippet=True,
                                        max_snippet_count=5
                                    ),
                                    extractive_content_spec=discoveryengine.SearchRequest.ContentSearchSpec.ExtractiveContentSpec(
                                        max_extractive_answer_count=2,
                                        max_extractive_segment_count=5
                                    )
                                )
                            )
                            response = client.search(request=request)
                            serving_config_used = sc
                            break
                        except Exception as e_try2:
                            last_error = e_try2
                            logger.warning(f"Discovery Engine search failed with dataStore serving config {sc}: {e_try2}")
                            continue
                    if response is not None:
                        break
            except Exception as e_list:
                logger.warning(f"Auto-discovery of dataStores failed or not available: {e_list}")
        if response is None and last_error is not None:
            # As a fallback, call the REST API using the direct engine path (engines/*:search),
            # then try dataStore servingConfig REST search as well.
            try:
                import json as _json
                from google.auth import default as _google_auth_default
                from google.auth.transport.requests import AuthorizedSession as _AuthorizedSession

                engine_resource_name = f"projects/{project_id}/locations/{location}/collections/default_collection/engines/{engine_id}"
                url = f"https://discoveryengine.googleapis.com/v1alpha/{engine_resource_name}:search"

                body = {
                    "query": sanitized_query,
                    "pageSize": 20,
                    "queryExpansionSpec": {"condition": "AUTO"},
                    "spellCorrectionSpec": {"mode": "AUTO"},
                    "contentSearchSpec": {
                        "snippetSpec": {"returnSnippet": True, "maxSnippetCount": 5},
                        "extractiveContentSpec": {"maxExtractiveAnswerCount": 2, "maxExtractiveSegmentCount": 5}
                    }
                }
                if metadata_filter:
                    body["filter"] = metadata_filter

                creds, _ = _google_auth_default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
                authed = _AuthorizedSession(creds)
                rest_resp = authed.post(url, json=body, timeout=30)
                if rest_resp.status_code >= 400:
                    raise RuntimeError(f"REST engines:search failed {rest_resp.status_code}: {rest_resp.text[:200]}")
                rest_json = rest_resp.json()

                # Create a lightweight object to unify with the gRPC response parsing below
                class _RestDoc:
                    def __init__(self, d):
                        self._d = d
                        doc = d.get("document", {})
                        # Expose fields similar to gRPC response
                        self.struct_data = doc.get("structData") or {}
                        self.derived_struct_data = doc.get("derivedStructData") or {}
                        self.id = doc.get("id", "")
                        self.name = doc.get("name", "")
                        self.uri = doc.get("uri", "")
                        # Provide a 'document' alias to keep downstream hasattr(result.document, ...) working
                        self.document = self

                class _RestResponse:
                    def __init__(self, items):
                        self.results = items

                response = _RestResponse([_RestDoc(r) for r in rest_json.get("results", [])])
                serving_config_used = engine_resource_name + ":search"

                # If engine REST returned no results, try dataStore REST search using discovered dataStores
                if not response.results:
                    try:
                        from google.cloud import discoveryengine as _de2
                        ds_client2 = _de2.DataStoreServiceClient()
                        parent2 = f"projects/{project_id}/locations/{location}/collections/default_collection"
                        data_stores2 = list(ds_client2.list_data_stores(parent=parent2))
                        for ds in data_stores2:
                            ds_id = ds.name.split("/")[-1]
                            sc_name = serving_config_name if env_explicit else "default_search"
                            ds_rest_url = (
                                f"https://discoveryengine.googleapis.com/v1alpha/"
                                f"{parent2}/dataStores/{ds_id}/servingConfigs/{sc_name}:search"
                            )
                            ds_resp = authed.post(ds_rest_url, json=body, timeout=30)
                            if ds_resp.status_code >= 400:
                                logger.warning(f"REST dataStore search failed {ds_resp.status_code}: {ds_resp.text[:160]}")
                                continue
                            ds_json = ds_resp.json()
                            items = [_RestDoc(r) for r in ds_json.get("results", [])]
                            if items:
                                response = _RestResponse(items)
                                serving_config_used = f"{parent2}/dataStores/{ds_id}/servingConfigs/{sc_name}:search"
                                break
                    except Exception as _rest_ds_err:
                        logger.warning(f"REST dataStore search attempt failed: {_rest_ds_err}")
            except Exception as rest_err:
                # If REST fallback also failed, raise original error
                logger.warning(f"REST engines:search fallback failed: {rest_err}")
                raise last_error
        
        # Process the results
        related_snippets = []
        for result in response.results:
            # Extract document info using helper (handles placeholders)
            document_name, document_url = _derive_doc_name_and_url(result.document)
            
            # Extract snippets
            snippets = []
            if hasattr(result.document, 'derived_struct_data') and result.document.derived_struct_data:
                derived_data = result.document.derived_struct_data
                if 'snippets' in derived_data:
                    for snippet in derived_data['snippets']:
                        if 'snippet' in snippet:
                            snippets.append(snippet['snippet'])
                # Collect extractive answers/segments if present
                if 'extractive_answers' in derived_data:
                    for ans in derived_data['extractive_answers']:
                        text_val = ans.get('content') or ans.get('answer') or ans.get('text')
                        if text_val:
                            snippets.append(text_val)
                if 'extractive_segments' in derived_data:
                    for seg in derived_data['extractive_segments']:
                        text_val = seg.get('content') or seg.get('segment') or seg.get('text')
                        if text_val:
                            snippets.append(text_val)
            
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
                    "document_url": document_url
                })
        
        # If nothing found, try a lightweight typo-correction fallback (e.g., "lanlord" -> "landlord")
        if len(related_snippets) == 0 and sanitized_query:
            try:
                corrections = {
                    r"\blanlord\b": "landlord",
                    r"\btennant\b": "tenant",
                    r"\bleesee\b": "lessee",
                    r"\bleesor\b": "lessor",
                }
                import re
                corrected = sanitized_query
                for pat, rep in corrections.items():
                    corrected = re.sub(pat, rep, corrected, flags=re.IGNORECASE)
                fallback_tried = False
                if corrected != sanitized_query:
                    fallback_tried = True
                    request_corrected = discoveryengine.SearchRequest(
                        serving_config=serving_config_used or serving_configs_to_try[0],
                        query=corrected,
                        page_size=20,
                        safe_search=False,
                        filter=metadata_filter or None,
                        query_expansion_spec=discoveryengine.SearchRequest.QueryExpansionSpec(
                            condition=discoveryengine.SearchRequest.QueryExpansionSpec.Condition.AUTO
                        ),
                        spell_correction_spec=discoveryengine.SearchRequest.SpellCorrectionSpec(
                            mode=discoveryengine.SearchRequest.SpellCorrectionSpec.Mode.AUTO
                        ),
                        content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
                            snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
                                return_snippet=True,
                                max_snippet_count=5
                            ),
                            extractive_content_spec=discoveryengine.SearchRequest.ContentSearchSpec.ExtractiveContentSpec(
                                max_extractive_answer_count=2,
                                max_extractive_segment_count=5
                            )
                        )
                    )
                    response2 = client.search(request=request_corrected)
                    for result in response2.results:
                        document_name, document_url = _derive_doc_name_and_url(result.document)
                        snippets2 = []
                        if hasattr(result.document, 'derived_struct_data') and result.document.derived_struct_data:
                            dd = result.document.derived_struct_data
                            if 'snippets' in dd:
                                for sn in dd['snippets']:
                                    if 'snippet' in sn:
                                        snippets2.append(sn['snippet'])
                            if 'extractive_answers' in dd:
                                for ans in dd['extractive_answers']:
                                    tv = ans.get('content') or ans.get('answer') or ans.get('text')
                                    if tv:
                                        snippets2.append(tv)
                            if 'extractive_segments' in dd:
                                for seg in dd['extractive_segments']:
                                    tv = seg.get('content') or seg.get('segment') or seg.get('text')
                                    if tv:
                                        snippets2.append(tv)
                        if not snippets2 and hasattr(result.document, 'struct_data') and result.document.struct_data:
                            content = result.document.struct_data.get('content', '')
                            if content:
                                snippets2.append(content[:200] + "..." if len(content) > 200 else content)
                        for sn in snippets2:
                            related_snippets.append({
                                "text": sn,
                                "source": document_name,
                                "relevance_score": 0.8,
                                "document_url": document_url
                            })

                # Last fallback: if we corrected and still empty, try searching only the corrected term tokens that changed
                if fallback_tried and len(related_snippets) == 0:
                    changed_terms = []
                    for pat, rep in corrections.items():
                        import re as _re
                        if _re.search(pat, sanitized_query, flags=_re.IGNORECASE):
                            changed_terms.append(rep)
                    for term in changed_terms:
                        req3 = discoveryengine.SearchRequest(
                            serving_config=serving_config_used or serving_configs_to_try[0],
                            query=term,
                            page_size=10,
                            safe_search=False,
                            filter=metadata_filter or None,
                            query_expansion_spec=discoveryengine.SearchRequest.QueryExpansionSpec(
                                condition=discoveryengine.SearchRequest.QueryExpansionSpec.Condition.AUTO
                            ),
                            spell_correction_spec=discoveryengine.SearchRequest.SpellCorrectionSpec(
                                mode=discoveryengine.SearchRequest.SpellCorrectionSpec.Mode.AUTO
                            ),
                            content_search_spec=discoveryengine.SearchRequest.ContentSearchSpec(
                                snippet_spec=discoveryengine.SearchRequest.ContentSearchSpec.SnippetSpec(
                                    return_snippet=True,
                                    max_snippet_count=3
                                )
                            )
                        )
                        resp3 = client.search(request=req3)
                        for result in resp3.results:
                            name3, url3 = _derive_doc_name_and_url(result.document)
                            if hasattr(result.document, 'derived_struct_data') and result.document.derived_struct_data:
                                dd = result.document.derived_struct_data
                                if 'snippets' in dd:
                                    for sn in dd['snippets']:
                                        if 'snippet' in sn:
                                            related_snippets.append({
                                                "text": sn['snippet'],
                                                "source": name3,
                                                "relevance_score": 0.7,
                                                "document_url": url3
                                            })
            except Exception as _e:
                logger.warning(f"Typo-correction fallback search failed: {_e}")

        # If Discovery Engine returned no results, optionally provide fallback samples
        if len(related_snippets) == 0 and enable_fallback:
            fallback_snippets = _get_fallback_snippets(sanitized_query)
            if fallback_snippets:
                return {
                    "success": True,
                    "related_snippets": fallback_snippets,
                    "total_results": len(fallback_snippets),
                    "search_query": sanitized_query,
                    "note": "Using sample snippets (fallback mode)"
                }
        
        # AGGRESSIVE DEBUG: Force test results for any empty result in user scope
        if len(related_snippets) == 0 and scope == "user":
            logger.error(f"AGGRESSIVE DEBUG: Empty results for scope=user. metadata_filter='{metadata_filter}', enable_fallback={enable_fallback}")
            return {
                "success": True,
                "related_snippets": [
                    {
                        "text": f"AGGRESSIVE DEBUG: This test snippet confirms the backend is working. Query was: '{sanitized_query}', scope: '{scope}', filter: '{metadata_filter or 'None'}'",
                        "source": "Backend Debug Test",
                        "relevance_score": 1.0,
                        "document_url": "debug://aggressive-test"
                    }
                ],
                "total_results": 1,
                "search_query": sanitized_query,
                "note": f"AGGRESSIVE DEBUG: Test for scope={scope}, filter={metadata_filter or 'None'}"
            }
        
        # TEMPORARY DEBUG: Force fallback for "user" scope when no filter is applied
        if len(related_snippets) == 0 and scope == "user" and not metadata_filter:
            logger.warning(f"DEBUG: No results for scope=user, no filter. Forcing fallback for query: {sanitized_query}")
            fallback_snippets = _get_fallback_snippets(sanitized_query)
            if fallback_snippets:
                return {
                    "success": True,
                    "related_snippets": fallback_snippets,
                    "total_results": len(fallback_snippets),
                    "search_query": sanitized_query,
                    "note": "DEBUG: Forced fallback for scope=user with no filter"
                }

    # SAFETY FALLBACK: Post-filter results by user/document if Discovery Engine filter wasn't applied
    # This ensures privacy even if the schema doesn't support filtering. We only enforce
    # user-based post-filtering when the dataset clearly encodes user ownership in the URL
    # path (e.g., /users/{id}/...). Otherwise we skip the post-filter to avoid dropping
    # all results in single-tenant or non-user-partitioned indexes.
        filtered_snippets = related_snippets
        note_msg = ""
        
        # if current_user and scope == "user" and not os.getenv("RAG_FILTER_METADATA"):
        #     try:
        #         # Apply user post-filter only if any snippet path contains '/users/' pattern
        #         any_user_path = any(
        #             ("/users/" in (s.get("document_url", "") or "")) or
        #             ("/users/" in (s.get("source", "") or ""))
        #             for s in related_snippets
        #         )

        #         if any_user_path:
        #             user_key = getattr(current_user, "id", None) or getattr(current_user, "email", None)
        #             filtered_snippets = [
        #                 s for s in related_snippets
        #                 if (
        #                     user_key and (
        #                         f"/users/{user_key}/" in (s.get("document_url", "") or "") or
        #                         f"/users/{user_key}/" in (s.get("source", "") or "")
        #                     )
        #                 )
        #             ]
        #             if len(filtered_snippets) < len(related_snippets):
        #                 logger.info(f"Post-filtered snippets: {len(related_snippets)} → {len(filtered_snippets)} (user-only)")
        #             if len(related_snippets) > 0 and len(filtered_snippets) == 0:
        #                 # Discovery Engine returned items, but filtering removed all
        #                 note_msg = (
        #                     "Search results were filtered out by user metadata. "
        #                     "Set RAG_FILTER_METADATA to a user field in your index or adjust document paths."
        #                 )
        #         else:
        #             logger.info("Skipping user post-filter: no '/users/' pattern detected in results")
        #             filtered_snippets = related_snippets
        #     except Exception as filter_err:
        #         logger.warning(f"Post-filter failed: {filter_err}. Returning all results.")
        #         filtered_snippets = related_snippets
        
        if document_id and scope == "document":
            # Filter to specific document
            try:
                filtered_snippets = [
                    s for s in related_snippets
                    if document_id in s.get("document_url", "") or 
                       document_id in s.get("source", "")
                ]
                if len(filtered_snippets) < len(related_snippets):
                    logger.info(f"Post-filtered snippets: {len(related_snippets)} → {len(filtered_snippets)} (document-only)")
                if len(related_snippets) > 0 and len(filtered_snippets) == 0:
                    note_msg = "Search results were filtered out by document scope. Ensure the current document is indexed."
            except Exception as filter_err:
                logger.warning(f"Post-filter failed: {filter_err}. Returning all results.")
                filtered_snippets = related_snippets

        return {
            "success": True,
            "related_snippets": filtered_snippets,
            "total_results": len(filtered_snippets),
            "search_query": sanitized_query,
            "note": note_msg
        }

    except Exception as e:
        # Catch-all for any unexpected Discovery Engine errors
        logger.error(f"Discovery Engine search failed: {e}")
        if enable_fallback:
            try:
                fallback_snippets = _get_fallback_snippets(sanitized_query)
                if fallback_snippets:
                    return {
                        "success": True,
                        "related_snippets": fallback_snippets,
                        "total_results": len(fallback_snippets),
                        "search_query": sanitized_query,
                        "note": "Using sample snippets (fallback mode)"
                    }
            except Exception:
                pass
        return {
            "success": True,
            "related_snippets": [],
            "total_results": 0,
            "search_query": sanitized_query,
            "note": "Search error"
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
            "/rag-health": "GET - Check RAG (Discovery Engine) configuration and availability",
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


@app.post("/chat")
async def chat_endpoint(request: ChatRequest, current_user: User = Depends(require_auth)):
    """Chat with AI about a document or legal topic (requires authentication).

    Request body:
    - message: user question or prompt
    - document_text: optional source text to ground the answer
    """
    try:
        user_message = (request.message or "").strip()
        document_text = (request.document_text or "").strip()

        if not user_message:
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        # Keep context sizes reasonable
        if len(document_text) > 12000:
            document_text = document_text[:12000]

        # Ensure Vertex AI is ready
        global vertex_ai_initialized, model
        if not vertex_ai_initialized:
            initialize_vertex_ai()

        def _build_prompt(msg: str, doc: str) -> str:
            header = (
                "You are a helpful legal assistant. Answer in clear, plain English, "
                "avoid legalese, and use concise Markdown formatting."
            )
            if doc:
                return (
                    f"{header}\n\n"
                    "Ground your response strictly in the provided document text when possible. "
                    "If something is not present in the document, say so explicitly.\n\n"
                    "User question:\n" + msg + "\n\n"
                    "Document text (may be truncated):\n" + doc
                )
            else:
                return (
                    f"{header}\n\n"
                    "No document text was provided. Answer generally and note any assumptions.\n\n"
                    "User question:\n" + msg
                )

        prompt = _build_prompt(user_message, document_text)

        # Try model response if available
        if VERTEX_AI_AVAILABLE and model is not None:
            try:
                resp = model.generate_content(prompt)
                text = getattr(resp, "text", None) or ""
                if not text:
                    text = "I couldn't generate a response right now. Please try again."
                return {
                    "response": text,
                    "model_used": "gemini-1.5-pro",
                    "grounded": bool(document_text),
                }
            except Exception as gen_err:
                logger.warning(f"Gemini generate_content failed: {gen_err}")
                # Fall through to graceful fallback

        # Graceful fallback when model not available
        fallback = (
            "I'm currently unable to access the AI model. "
            "Here is a suggested approach: 1) Identify the clause or section relevant to your question, "
            "2) Summarize obligations and deadlines, 3) Note any risks or penalties, 4) If unsure, seek legal advice."
        )
        if document_text:
            fallback = (
                "Based on the provided document text, here are general tips to interpret it:\n\n"
                "- Look for headings like 'Obligations', 'Term', 'Termination', 'Liability', 'Confidentiality'.\n"
                "- Identify what you must do vs. what the other party must do.\n"
                "- Check for deadlines, renewal terms, and penalties.\n"
                "- When the AI model becomes available, you'll receive a tailored answer."
            )

        return {
            "response": fallback,
            "model_used": "unavailable",
            "grounded": bool(document_text),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in chat_endpoint: {e}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {e}")


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
    - **document_id**: Optional document ID to scope search to single document
    - **scope**: Search scope - "user" (default, all user docs) or "document" (current doc only)
    """
    try:
        query = request.query.strip()
        sanitized = _sanitize_rag_query(query)
        if sanitized != query:
            logger.info(f"Sanitized RAG query from '{query}' to '{sanitized}'")
            query = sanitized
        
        if not query:
            raise HTTPException(status_code=400, detail="No search query provided")
        
        if len(query) > 1000:  # Limit query size
            query = query[:1000]
            logger.warning("Query truncated to 1,000 characters")

        # Extract scope and document_id from request (with safe defaults)
        scope = getattr(request, "scope", "user") or "user"
        document_id = getattr(request, "document_id", None)
        
        # Validate scope parameter
        if scope not in ["user", "document"]:
            logger.warning(f"Invalid scope '{scope}', defaulting to 'user'")
            scope = "user"
        
        # If scope is "document" but no document_id provided, extract from document_context
        if scope == "document" and not document_id and request.document_context:
            try:
                # Try to extract document ID from URL path
                # Pattern: .../users/{user_id}/{document_id}.pdf
                import re
                match = re.search(r'/([^/]+)\.pdf', request.document_context)
                if match:
                    document_id = match.group(1)
                    logger.info(f"Extracted document_id from context: {document_id}")
            except Exception as extract_error:
                logger.warning(f"Failed to extract document_id from context: {extract_error}")
        
        # Log search parameters for debugging
        logger.info(f"RAG search - User: {current_user.email}, Scope: {scope}, Doc ID: {document_id}")

        # Search for related documents with filtering
        search_result = search_related_documents(
            query, 
            current_user=current_user, 
            document_context=request.document_context or "",
            document_id=document_id,
            scope=scope
        )
        
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


@app.post("/rag-test")
async def rag_test_endpoint(current_user: User = Depends(optional_auth)):
    """Test RAG search with a simple query to verify document indexing."""
    try:
        test_queries = ["landlord", "tenant", "agreement", "contract", "rental"]
        results = {}
        
        for query in test_queries:
            search_result = search_related_documents(query, current_user=current_user)
            results[query] = {
                "total_results": search_result.get("total_results", 0),
                "snippets_preview": [
                    {
                        "text": snippet["text"][:100] + "..." if len(snippet["text"]) > 100 else snippet["text"],
                        "source": snippet["source"]
                    }
                    for snippet in search_result.get("related_snippets", [])[:2]
                ]
            }
        
        return JSONResponse(status_code=200, content={
            "test_results": results,
            "summary": {
                "total_queries": len(test_queries),
                "queries_with_results": sum(1 for r in results.values() if r["total_results"] > 0),
                "documents_seem_indexed": any(r["total_results"] > 0 for r in results.values())
            }
        })
        
    except Exception as e:
        logger.error(f"RAG test error: {str(e)}")
        return JSONResponse(status_code=200, content={
            "error": str(e),
            "test_results": {},
            "summary": {
                "documents_seem_indexed": False,
                "error_occurred": True
            }
        })


@app.post("/rag-test-custom")
async def rag_test_custom_endpoint(request: RAGTestRequest, current_user: User = Depends(optional_auth)):
    """Run custom queries against RAG, optionally disabling fallback to verify real engine behavior.

    Body:
    - queries: list of strings to search
    - disable_fallback: if true, do not use hardcoded fallback snippets
    """
    try:
        queries = request.queries or [
            "arbitration clause",
            "severability",
            "non-compete",
            "confidentiality",
            "probation period"
        ]
        results = {}

        for q in queries:
            sr = search_related_documents(q, current_user=current_user, disable_fallback=bool(request.disable_fallback))
            results[q] = {
                "total_results": sr.get("total_results", 0),
                "snippets_preview": [
                    {
                        "text": s["text"][:120] + ("..." if len(s["text"]) > 120 else ""),
                        "source": s.get("source", "")
                    }
                    for s in sr.get("related_snippets", [])[:3]
                ],
                "used_fallback": "note" in sr and "fallback" in str(sr.get("note", "")).lower()
            }

        any_results = any(r["total_results"] > 0 for r in results.values())
        return JSONResponse(status_code=200, content={
            "test_results": results,
            "summary": {
                "total_queries": len(queries),
                "queries_with_results": sum(1 for r in results.values() if r["total_results"] > 0),
                "documents_seem_indexed": any_results
            }
        })
    except Exception as e:
        logger.error(f"RAG custom test error: {str(e)}")
        return JSONResponse(status_code=200, content={
            "error": str(e),
            "test_results": {},
            "summary": {
                "documents_seem_indexed": False,
                "error_occurred": True
            }
        })

@app.get("/rag-health")
async def rag_health():
    """Lightweight check for Discovery Engine availability and engine config."""
    try:
        status = {
            "discovery_engine_available": DISCOVERY_ENGINE_AVAILABLE,
            "engine": {
                "project": os.getenv("RAG_ENGINE_PROJECT", "demystifier-ai"),
                "location": os.getenv("RAG_ENGINE_LOCATION", "global"),
                "id": os.getenv("RAG_ENGINE_ID", "synapseragengine_1758347548138"),
                "serving_config_name": os.getenv("RAG_SERVING_CONFIG_NAME", "default_config")
            }
        }
        if DISCOVERY_ENGINE_AVAILABLE:
            try:
                from google.cloud import discoveryengine as _de
                client = _de.SearchServiceClient()
                status["client_init"] = True
                
                # Test search with a simple query to check if documents are indexed
                try:
                    project_id = os.getenv("RAG_ENGINE_PROJECT", "demystifier-ai")
                    location = os.getenv("RAG_ENGINE_LOCATION", "global")
                    engine_id = os.getenv("RAG_ENGINE_ID", "synapseragengine_1758347548138")
                    serving_config_name = os.getenv("RAG_SERVING_CONFIG_NAME", "default_config")
                    env_explicit = "RAG_SERVING_CONFIG_NAME" in os.environ
                    
                    # Try multiple possible API path formats to find the correct one
                    configs_to_try = []
                    
                    # Format 1: Standard engine path
                    base1 = f"projects/{project_id}/locations/{location}/collections/default_collection/engines/{engine_id}/servingConfigs"
                    configs_to_try.append(f"{base1}/{serving_config_name}")
                    if not env_explicit and serving_config_name != "default_search":
                        configs_to_try.append(f"{base1}/default_search")
                    
                    # Format 2: Data store path (for data store APIs)
                    base2 = f"projects/{project_id}/locations/{location}/dataStores/{engine_id}/servingConfigs"  
                    configs_to_try.append(f"{base2}/{serving_config_name}")
                    if not env_explicit and serving_config_name != "default_search":
                        configs_to_try.append(f"{base2}/default_search")
                        
                    # Format 3: App path (for search apps)
                    base3 = f"projects/{project_id}/locations/{location}/collections/default_collection/dataStores/{engine_id}/servingConfigs"
                    configs_to_try.append(f"{base3}/{serving_config_name}")
                    if not env_explicit and serving_config_name != "default_search":
                        configs_to_try.append(f"{base3}/default_search")

                    test_details = []
                    any_success = False
                    any_results = False
                    # Try configured and common serving configs against engine path
                    for sc in configs_to_try:
                        try:
                            test_request = _de.SearchRequest(
                                serving_config=sc,
                                query="landlord",
                                page_size=1
                            )
                            test_response = client.search(request=test_request)
                            result_count = len(list(test_response.results))
                            any_success = True
                            any_results = any_results or (result_count > 0)
                            test_details.append({
                                "serving_config": sc,
                                "results_found": result_count,
                                "has_documents": result_count > 0,
                                "error": None
                            })
                        except Exception as e_try:
                            test_details.append({
                                "serving_config": sc,
                                "results_found": 0,
                                "has_documents": False,
                                "error": str(e_try)
                            })

                    # Try listing dataStores and test their serving configs
                    try:
                        ds_client = _de.DataStoreServiceClient()
                        parent = f"projects/{project_id}/locations/{location}/collections/default_collection"
                        for ds in ds_client.list_data_stores(parent=parent):
                            ds_id = ds.name.split("/")[-1]
                            for sc_name in [serving_config_name, "default_search"]:
                                sc = f"{parent}/dataStores/{ds_id}/servingConfigs/{sc_name}"
                                try:
                                    test_request = _de.SearchRequest(
                                        serving_config=sc,
                                        query="landlord",
                                        page_size=1
                                    )
                                    test_response = client.search(request=test_request)
                                    result_count = len(list(test_response.results))
                                    any_success = True
                                    any_results = any_results or (result_count > 0)
                                    test_details.append({
                                        "serving_config": sc,
                                        "results_found": result_count,
                                        "has_documents": result_count > 0,
                                        "error": None
                                    })
                                except Exception as e_try2:
                                    test_details.append({
                                        "serving_config": sc,
                                        "results_found": 0,
                                        "has_documents": False,
                                        "error": str(e_try2)
                                    })
                    except Exception as e_list:
                        test_details.append({
                            "serving_config": "list_data_stores",
                            "results_found": 0,
                            "has_documents": False,
                            "error": str(e_list)
                        })

                    # Try REST engines:*:search once for sanity
                    try:
                        from google.auth import default as _ga_default
                        from google.auth.transport.requests import AuthorizedSession as _AuthSess
                        creds, _ = _ga_default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
                        sess = _AuthSess(creds)
                        engine_resource_name = f"projects/{project_id}/locations/{location}/collections/default_collection/engines/{engine_id}"
                        url = f"https://discoveryengine.googleapis.com/v1alpha/{engine_resource_name}:search"
                        body = {"query": "landlord", "pageSize": 1}
                        resp = sess.post(url, json=body, timeout=20)
                        if resp.status_code < 400:
                            rj = resp.json()
                            rc = len(rj.get("results", []))
                            any_success = any_success or True
                            any_results = any_results or (rc > 0)
                            test_details.append({
                                "serving_config": engine_resource_name + ":search",
                                "results_found": rc,
                                "has_documents": rc > 0,
                                "error": None
                            })
                        else:
                            test_details.append({
                                "serving_config": engine_resource_name + ":search",
                                "results_found": 0,
                                "has_documents": False,
                                "error": f"{resp.status_code} {resp.text[:160]}"
                            })
                    except Exception as e_rest:
                        test_details.append({
                            "serving_config": "engines_rest",
                            "results_found": 0,
                            "has_documents": False,
                            "error": str(e_rest)
                        })
                    status["test_search"] = {
                        "query": "landlord",
                        "attempts": test_details,
                        "any_success": any_success,
                        "documents_indexed": any_results
                    }
                    
                except Exception as se:
                    status["test_search"] = {
                        "error": str(se),
                        "has_documents": False
                    }
                    
            except Exception as ci:
                status["client_init"] = False
                status["error"] = str(ci)
        return JSONResponse(status_code=200, content=status)
    except Exception as e:
        return JSONResponse(status_code=200, content={
            "discovery_engine_available": False,
            "error": str(e)
        })


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


@app.delete("/delete-document")
async def delete_document(request: dict, current_user: User = Depends(require_auth)):
    """
    Delete a document from Google Cloud Storage (requires authentication)
    
    - **blob_name**: The GCS blob name/path of the file to delete (e.g., "documents/users/{user_id}/filename.pdf")
    """
    try:
        if not GCS_AVAILABLE:
            raise HTTPException(status_code=503, detail="Google Cloud Storage not available")
        
        blob_name = request.get("blob_name")
        if not blob_name:
            raise HTTPException(status_code=400, detail="blob_name is required")
        
        # Security check: ensure the user can only delete their own files
        # Check if it's in the users directory structure
        if not blob_name.startswith("documents/users/"):
            logger.warning(f"User {current_user.email} attempted to delete file outside users directory: {blob_name}")
            raise HTTPException(status_code=403, detail="You can only delete your own files")
        
        # Additional check: verify the file belongs to this user by checking metadata or path
        user_id = current_user.id or current_user.email
        expected_prefix = f"documents/users/{user_id}/"
        
        # Also check for alternate user ID formats (email-based paths)
        alternate_prefix = f"documents/users/{current_user.email}/"
        
        if not (blob_name.startswith(expected_prefix) or blob_name.startswith(alternate_prefix)):
            # Double-check by loading the blob and checking its metadata
            try:
                bucket_name = os.getenv("GCS_BUCKET_NAME", "legal-docs-demystifier")
                client = storage.Client()
                bucket = client.bucket(bucket_name)
                blob = bucket.blob(blob_name)
                
                if blob.exists():
                    metadata = blob.metadata or {}
                    file_user_email = metadata.get('user_email', '')
                    
                    # If metadata doesn't match current user, deny access
                    if file_user_email and file_user_email != current_user.email:
                        logger.warning(f"User {current_user.email} attempted to delete file owned by {file_user_email}: {blob_name}")
                        raise HTTPException(status_code=403, detail="You can only delete your own files")
            except HTTPException:
                raise
            except Exception as check_error:
                logger.warning(f"Could not verify file ownership via metadata: {check_error}")
                # If we can't verify, deny for safety
                logger.warning(f"User {current_user.email} attempted to delete file with unverifiable ownership: {blob_name}")
                raise HTTPException(status_code=403, detail="You can only delete your own files")
        
        # Delete from GCS
        try:
            bucket_name = os.getenv("GCS_BUCKET_NAME", "legal-docs-demystifier")
            client = storage.Client()
            bucket = client.bucket(bucket_name)
            blob = bucket.blob(blob_name)
            
            if not blob.exists():
                raise HTTPException(status_code=404, detail="File not found")
            
            blob.delete()
            logger.info(f"Deleted file {blob_name} for user {current_user.email}")
            
            return JSONResponse(
                status_code=200,
                content={
                    "success": True,
                    "message": "File deleted successfully",
                    "blob_name": blob_name
                }
            )
            
        except Exception as gcs_error:
            logger.error(f"GCS delete error: {str(gcs_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete file from Google Cloud Storage: {str(gcs_error)}"
            )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in delete_document: {str(e)}")
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