#!/usr/bin/env python3
"""
Simple script to test RAG functionality and diagnose indexing issues.
Run this to check if your Discovery Engine has documents indexed.
"""

import os
import sys
import requests
import json

def test_backend_connectivity():
    """Test if backend is running and accessible."""
    print("🔍 Testing backend connectivity...")
    try:
        response = requests.get("http://localhost:8080/health", timeout=5)
        if response.status_code == 200:
            print("✅ Backend is running")
            return True
        else:
            print(f"❌ Backend returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Is it running on port 8080?")
        return False
    except Exception as e:
        print(f"❌ Error connecting to backend: {e}")
        return False

def test_rag_health():
    """Test RAG health endpoint."""
    print("\n🔍 Testing RAG engine health...")
    try:
        response = requests.get("http://localhost:8080/rag-health", timeout=10)
        if response.status_code == 200:
            data = response.json()
            print("✅ RAG health check successful")
            print(f"   Discovery Engine Available: {data.get('discovery_engine_available', False)}")
            print(f"   Client Init: {data.get('client_init', False)}")
            
            engine = data.get('engine', {})
            print(f"   Project: {engine.get('project', 'unknown')}")
            print(f"   Location: {engine.get('location', 'unknown')}")
            print(f"   Engine ID: {engine.get('id', 'unknown')}")
            
            test_search = data.get('test_search', {})
            if test_search:
                if 'error' in test_search:
                    print(f"   ❌ Test search failed: {test_search['error']}")
                else:
                    print(f"   Test search for 'landlord': {test_search.get('results_found', 0)} results")
                    print(f"   Documents indexed: {test_search.get('has_documents', False)}")
            
            return data
        else:
            print(f"❌ RAG health check failed with status {response.status_code}")
            return None
    except Exception as e:
        print(f"❌ Error testing RAG health: {e}")
        return None

def test_rag_search():
    """Test RAG search endpoint with various queries."""
    print("\n🔍 Testing RAG search functionality...")
    
    test_queries = [
        "John Landlord",
        "John Lanlord",  # Intentional typo
        "landlord",
        "tenant", 
        "rental agreement",
        "contract"
    ]
    
    for query in test_queries:
        print(f"\n   Testing query: '{query}'")
        try:
            response = requests.post(
                "http://localhost:8080/rag-search",
                json={"query": query, "document_context": ""},
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                total_results = data.get('total_results', 0)
                snippets = data.get('related_snippets', [])
                
                print(f"     ✅ Found {total_results} results")
                
                if snippets:
                    for i, snippet in enumerate(snippets[:2]):  # Show first 2
                        text_preview = snippet['text'][:80] + "..." if len(snippet['text']) > 80 else snippet['text']
                        print(f"       {i+1}. {text_preview} (from: {snippet.get('source', 'Unknown')})")
                else:
                    print("       No snippets returned")
                    
            elif response.status_code == 401:
                print("     ❌ Authentication required - this endpoint needs auth")
            else:
                print(f"     ❌ Search failed with status {response.status_code}")
                print(f"       Response: {response.text[:200]}")
                
        except Exception as e:
            print(f"     ❌ Error testing query '{query}': {e}")

def test_rag_comprehensive():
    """Test the comprehensive RAG test endpoint."""
    print("\n🔍 Running comprehensive RAG test...")
    try:
        response = requests.post("http://localhost:8080/rag-test", json={}, timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            summary = data.get('summary', {})
            
            print(f"   Total test queries: {summary.get('total_queries', 0)}")
            print(f"   Queries with results: {summary.get('queries_with_results', 0)}")
            print(f"   Documents seem indexed: {summary.get('documents_seem_indexed', False)}")
            
            if summary.get('documents_seem_indexed', False):
                print("   ✅ RAG system appears to be working with indexed documents")
            else:
                print("   ❌ No documents found in index - this is likely the problem")
                
            # Show sample results
            test_results = data.get('test_results', {})
            for query, result in test_results.items():
                if result.get('total_results', 0) > 0:
                    print(f"   📄 '{query}': {result['total_results']} results")
                    
        else:
            print(f"   ❌ Comprehensive test failed with status {response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Error running comprehensive test: {e}")

def main():
    print("🚀 RAG System Diagnostic Tool")
    print("=" * 50)
    
    # Test backend connectivity
    if not test_backend_connectivity():
        print("\n💡 Start your backend first:")
        print("   cd backend")
        print("   uvicorn api:app --host 0.0.0.0 --port 8080 --reload")
        sys.exit(1)
    
    # Test RAG health
    rag_health = test_rag_health()
    
    # Test RAG search
    test_rag_search()
    
    # Comprehensive test
    test_rag_comprehensive()
    
    print("\n" + "=" * 50)
    print("🔍 DIAGNOSIS:")
    
    if rag_health:
        if rag_health.get('discovery_engine_available', False) and rag_health.get('client_init', False):
            test_search = rag_health.get('test_search', {})
            if test_search.get('has_documents', False):
                print("✅ RAG system is properly configured and has indexed documents")
                print("   If you're still not seeing results, check:")
                print("   - Are you logged in? The /rag-search endpoint requires authentication")
                print("   - Try different search terms")
                print("   - Check if documents are filtered by user metadata")
            else:
                print("❌ RAG system is configured but NO DOCUMENTS ARE INDEXED")
                print("   This is likely your main issue. You need to:")
                print("   1. Upload your PDFs to Google Cloud Storage")
                print("   2. Index them in your Discovery Engine")
                print("   3. Or use a different engine ID that has your documents")
        else:
            print("❌ RAG system configuration issues detected")
            print("   Check your Google Cloud credentials and engine configuration")
    else:
        print("❌ Cannot determine RAG system status")
    
    print("\n💡 Next steps:")
    print("   1. If documents aren't indexed: Index your PDFs in Discovery Engine")
    print("   2. If auth issues: Make sure you're logged into the frontend")
    print("   3. If still failing: Check Google Cloud console for Discovery Engine status")

if __name__ == "__main__":
    main()