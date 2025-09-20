"use client";

import { useState, useEffect } from "react";
import { 
  MessageSquare, 
  Lightbulb, 
  BookOpen, 
  Clock, 
  ChevronDown, 
  ChevronUp,
  Send,
  Sparkles,
  FileText,
  AlertCircle,
  CheckCircle,
  Brain
} from "lucide-react";

interface SynapsePanelProps {
  explainedText: string;
  documentUrl: string;
  filename: string;
  ragSearchQuery?: string;
}

interface RelatedSnippet {
  text: string;
  source: string;
  relevance_score: number;
  document_url?: string;
}

interface RAGSearchResult {
  related_snippets: RelatedSnippet[];
  search_query: string;
  total_results: number;
  note?: string;
}

interface Analysis {
  id: string;
  text: string;
  explanation: string;
  timestamp: string;
  type: "explanation" | "insight" | "warning";
}

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

import { API_CONFIG, getApiUrl } from "../config/api";
import { withAuthHeaders } from "../utils/auth";

// Normalize any document URL to an absolute backend URL that the server can access.
// - If we receive a local relative path like "/api/proxy-gcs/<bucket>/<path>",
//   rewrite it to "<BACKEND_BASE>/proxy-gcs/<bucket>/<path>" so Cloud Run can fetch it.
const toAbsoluteBackendUrl = (input: string): string => {
  try {
    const u = new URL(input, window.location.origin);
    if (u.pathname.startsWith("/api/proxy-gcs/")) {
      const rest = u.pathname.replace(/^\/api\/proxy-gcs\//, "");
      return `${API_CONFIG.BASE_URL}/proxy-gcs/${rest}`;
    }
    if (u.pathname.startsWith("/proxy-gcs/")) {
      return `${API_CONFIG.BASE_URL}${u.pathname}`;
    }
    // Already absolute (external) or same-origin non-proxy path
    return u.toString();
  } catch {
    if (input.startsWith("/api/proxy-gcs/")) {
      const rest = input.replace(/^\/api\/proxy-gcs\//, "");
      return `${API_CONFIG.BASE_URL}/proxy-gcs/${rest}`;
    }
    if (input.startsWith("/proxy-gcs/")) {
      return `${API_CONFIG.BASE_URL}${input}`;
    }
    return input;
  }
};

const SynapsePanel = ({ explainedText, documentUrl, filename, ragSearchQuery }: SynapsePanelProps) => {
  const [activeTab, setActiveTab] = useState<"snippets" | "analysis" | "chat">("snippets");
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [documentText, setDocumentText] = useState("");
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);
  const [laymanSummary, setLaymanSummary] = useState<{
    title: string;
    summary: string;
    key_points: string[];
  } | null>(null);
  
  // RAG search states
  const [relatedSnippets, setRelatedSnippets] = useState<RelatedSnippet[]>([]);
  const [isSearchingRAG, setIsSearchingRAG] = useState(false);
  const [ragSearchError, setRagSearchError] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState<string>("");

  const normalizeSummaryResponse = (data: any) => {
    try {
      const candidate = typeof data === 'string' ? JSON.parse(data) : data;
      let root = candidate;
      if (candidate && typeof candidate === 'object') {
        if (candidate.result) root = candidate.result;
        else if (candidate.data) root = candidate.data;
      }
      if (typeof root === 'string') {
        try { root = JSON.parse(root); } catch { /* ignore */ }
      }
      const title = root?.title || filename || 'Summary';
      const summary = root?.summary || root?.content || root?.text || '';
      const key_points = Array.isArray(root?.key_points) ? root.key_points : [];
      return { title, summary, key_points };
    } catch {
      return { title: filename || 'Summary', summary: '', key_points: [] };
    }
  };

  const summarizeDocument = async () => {
    setIsSummarizing(true);
    setSummarizeError(null);
    try {
      // Ensure we have text to summarize
      let textToSummarize = documentText;
      if (!textToSummarize) {
        try {
          const headers = await withAuthHeaders({ 'Content-Type': 'application/json' });
          const absoluteUrl = toAbsoluteBackendUrl(documentUrl);
          const r = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.EXTRACT_PDF_TEXT), {
            method: 'POST',
            headers,
            body: JSON.stringify({ url: absoluteUrl }),
          });
          if (r.ok) {
            const j = await r.json();
            textToSummarize = j.text || '';
          }
        } catch {/* ignore extract failure here; we'll fallback to upload later */}
      }

      // Try simple local proxy first (same-origin) with text payload
      const authHeaders = await withAuthHeaders({ 'Content-Type': 'application/json' });
      let resp = await fetch('/api/summarize', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ text: textToSummarize || '' }),
      });
      // If proxy doesn't exist (404), fallback to direct backend URL
      if (resp.status === 404) {
        resp = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.SUMMARIZE), {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ text: textToSummarize || '' }),
        });
      }
      if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        throw new Error(errText || 'Summarize by URL failed');
      }
      const data = await resp.json();
      setLaymanSummary(normalizeSummaryResponse(data));
      setActiveTab('analysis');
    } catch (err) {
      try {
        // Fallback: fetch bytes (use proxy if cross-origin) and upload
        let fetchUrl = documentUrl;
        try {
          const u = new URL(documentUrl, window.location.origin);
          const isCrossOrigin = u.origin !== window.location.origin;
          if (isCrossOrigin) {
            fetchUrl = `/api/proxy-pdf?url=${encodeURIComponent(u.toString())}`;
          }
        } catch { /* ignore */ }
  const uploadFetchHeaders = await withAuthHeaders();
  const docResp = await fetch(fetchUrl, { headers: uploadFetchHeaders as any });
        if (!docResp.ok) throw new Error('Failed to fetch document');
  const blob = await docResp.blob();
  const file = new File([blob], filename || 'document.pdf', { type: blob.type || 'application/pdf' });
  const formData = new FormData();
  formData.append('file', file);
        const uploadHeaders = await withAuthHeaders();
        let resp2 = await fetch('/api/summarize-upload', {
          method: 'POST',
          headers: uploadHeaders as any,
          body: formData,
        });
        if (resp2.status === 404) {
          resp2 = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.SUMMARIZE_UPLOAD), {
            method: 'POST',
            headers: uploadHeaders as any,
            body: formData,
          });
        }
        if (!resp2.ok) {
          const errText2 = await resp2.text().catch(() => '');
          throw new Error(errText2 || 'Summarize upload failed');
        }
        const data2 = await resp2.json();
        setLaymanSummary(normalizeSummaryResponse(data2));
        setActiveTab('analysis');
      } catch (err2) {
        console.warn('Summarize endpoints failed, falling back to analyze-document:', err2);
        // Final fallback: use existing analyze-document to get analysis text and derive a summary client-side
        try {
          // Reuse the fetched blob if available; otherwise fetch again
          let fetchUrl = documentUrl;
          try {
            const u = new URL(documentUrl, window.location.origin);
            const isCrossOrigin = u.origin !== window.location.origin;
            if (isCrossOrigin) fetchUrl = `/api/proxy-pdf?url=${encodeURIComponent(u.toString())}`;
          } catch { /* ignore */ }
          const analyzeFetchHeaders = await withAuthHeaders();
          const docResp2 = await fetch(fetchUrl, { headers: analyzeFetchHeaders as any });
          if (!docResp2.ok) throw new Error('Failed to fetch document for analysis');
          const blob2 = await docResp2.blob();
          // Force content type to application/pdf to help backend detect PDFs
          const file2 = new File([blob2], filename || 'document.pdf', { type: blob2.type || 'application/pdf' });
          const formData2 = new FormData();
          formData2.append('file', file2);
          const analyzeResp = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.ANALYZE_DOCUMENT), {
            method: 'POST',
            headers: analyzeFetchHeaders as any,
            body: formData2,
          });
          if (!analyzeResp.ok) {
            const errText3 = await analyzeResp.text().catch(() => '');
            throw new Error(errText3 || 'Analyze endpoint failed');
          }
          const analysisData = await analyzeResp.json();
          const analysisText = analysisData?.analysis || '';
          const derived = deriveLaymanSummaryFromText(analysisText, filename);
          setLaymanSummary(derived);
          setActiveTab('analysis');
        } catch (err3) {
          console.error('All summarization fallbacks failed:', err3);
          const msg = (err3 as any)?.message || 'Failed to summarize document. Please try again.';
          setSummarizeError(msg);
        }
      }
    } finally {
      setIsSummarizing(false);
    }
  };

  // Extract document text for chat context
  const extractDocumentText = async () => {
    try {
      console.log('Extracting document text from:', documentUrl);
      const headers = await withAuthHeaders({ 'Content-Type': 'application/json' });
      // Ensure backend gets an absolute, publicly reachable URL
      const absoluteUrl = toAbsoluteBackendUrl(documentUrl);
      const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.EXTRACT_PDF_TEXT), {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: absoluteUrl }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Document text extracted:', data.text?.length || 0, 'characters');
      setDocumentText(data.text || '');
    } catch (error) {
      console.error('Error extracting document text:', error);
      // Set minimal context if extraction fails
      setDocumentText(`Document: ${filename}\nURL: ${documentUrl}`);
    }
  };

  // Send chat message with document context
  const sendChatMessage = async (message: string) => {
    if (!message.trim()) return;

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: message.trim(),
      isUser: true,
      timestamp: new Date().toLocaleTimeString(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatMessage("");
    setIsTyping(true);

    try {
      console.log('Sending chat message about document:', filename);
      const headers = await withAuthHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.CHAT), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: message.trim(),
          document_text: documentText,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Chat API response:', data);

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: data.response || 'I received your message but couldn\'t generate a response.',
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending chat message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
        timestamp: new Date().toLocaleTimeString(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  // Extract document text when component mounts or document changes
  useEffect(() => {
    if (documentUrl) {
      // Clear previous document's chat when switching documents
      setChatMessages([]);
      setDocumentText("");
      extractDocumentText();
    }
  }, [documentUrl, filename]);

  // Create a simple layman summary from a long analysis string
  const deriveLaymanSummaryFromText = (analysisText: string, fname: string) => {
    const title = fname || 'Summary';
    const clean = (analysisText || '').replace(/\s+/g, ' ').trim();
    // Take first ~3 sentences for summary
    const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
    const summary = sentences.slice(0, 3).join(' ');
    // Extract simple bullet points: lines that look like bullets or clauses
    const bullets: string[] = [];
    const lineCandidates = (analysisText || '').split(/\n|\r/);
    for (const line of lineCandidates) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (/^(?:[-*•]|\d+\.|\([a-zA-Z]\))\s+/.test(trimmed)) {
        bullets.push(trimmed.replace(/^(?:[-*•]|\d+\.|\([a-zA-Z]\))\s+/, ''));
      }
      if (bullets.length >= 5) break;
    }
    // If no explicit bullets found, fallback to short sentences
    if (bullets.length === 0) {
      bullets.push(...sentences.slice(0, 5));
    }
    return { title, summary: summary || clean.slice(0, 400), key_points: bullets };
  };

  // RAG search function
  const performRAGSearch = async (query: string) => {
    if (!query.trim()) return;
    
    setIsSearchingRAG(true);
    setRagSearchError(null);
    setLastSearchQuery(query);
    
    try {
      console.log('Performing RAG search for:', query);
      const headers = await withAuthHeaders({ 'Content-Type': 'application/json' });
      const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.RAG_SEARCH), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: query.trim(),
          document_context: documentUrl
        }),
      });

      if (!response.ok) {
        throw new Error(`RAG search failed: ${response.status}`);
      }

      const data: RAGSearchResult = await response.json();
      console.log('RAG search results:', data);
      
      setRelatedSnippets(data.related_snippets || []);
      
      // Switch to snippets tab to show results
      setActiveTab('snippets');
      
    } catch (error) {
      console.error('RAG search error:', error);
      setRagSearchError((error as Error).message || 'Failed to search related documents');
    } finally {
      setIsSearchingRAG(false);
    }
  };

  // Handle RAG search query from document viewer
  useEffect(() => {
    if (ragSearchQuery && ragSearchQuery.trim() !== "" && ragSearchQuery !== lastSearchQuery) {
      performRAGSearch(ragSearchQuery);
    }
  }, [ragSearchQuery]);

  // Handle explained text from document viewer
  useEffect(() => {
    if (explainedText && explainedText.trim() !== "") {
      setIsAnalyzing(true);
      
      // Simulate AI analysis
      setTimeout(() => {
        const newAnalysis: Analysis = {
          id: Date.now().toString(),
          text: explainedText,
          explanation: `This clause establishes specific terms and conditions. The selected text "${explainedText.substring(0, 50)}..." contains important legal implications regarding obligations and responsibilities.`,
          timestamp: new Date().toLocaleTimeString(),
          type: "explanation"
        };
        
        setAnalyses(prev => [newAnalysis, ...prev]);
        setIsAnalyzing(false);
        setActiveTab("analysis");
      }, 1500);
    }
  }, [explainedText]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "explanation":
        return <Brain className="w-4 h-4 text-blue-500" />;
      case "insight":
        return <Lightbulb className="w-4 h-4 text-yellow-500" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  const getSnippetTypeColor = (type: string) => {
    switch (type) {
      case "contract":
        return "bg-blue-100 text-blue-800";
      case "policy":
        return "bg-green-100 text-green-800";
      case "precedent":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Synapse</h2>
          </div>
          <button
            onClick={summarizeDocument}
            disabled={isSummarizing}
            className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors shadow-sm border ${isSummarizing ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600'}`}
            title="Generate a layman-friendly summary"
          >
            {isSummarizing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin mr-2"></span>
                Summarizing
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-1.5" />
                Summarize
              </>
            )}
          </button>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setActiveTab("snippets")}
            className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "snippets" 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Snippets</span>
          </button>
          
          <button
            onClick={() => setActiveTab("analysis")}
            className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "analysis" 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Brain className="w-4 h-4" />
            <span>Analysis</span>
            {analyses.length > 0 && (
              <span className="bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {analyses.length}
              </span>
            )}
          </button>
          
          <button
            onClick={() => setActiveTab("chat")}
            className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "chat" 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <span>Chat</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Related Snippets Tab */}
        {activeTab === "snippets" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Related Snippets</h3>
              <span className="text-xs text-gray-500">{relatedSnippets.length} found</span>
            </div>
            
            {isSearchingRAG && (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-sm text-gray-600">Searching related documents...</span>
              </div>
            )}
            
            {ragSearchError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center">
                  <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                  <span className="text-sm text-red-700">{ragSearchError}</span>
                </div>
              </div>
            )}
            
            {relatedSnippets.length === 0 && !isSearchingRAG && !ragSearchError && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Select text from the document to find related snippets</p>
              </div>
            )}
            
            {relatedSnippets.map((snippet, index) => (
              <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs px-2 py-1 rounded-full font-medium bg-blue-100 text-blue-800">
                    Document
                  </span>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-500">{Math.round((snippet.relevance_score || 0) * 100)}%</span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                  {snippet.text}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>From: {snippet.source}</span>
                  {snippet.document_url && (
                    <button 
                      onClick={() => window.open(snippet.document_url, '_blank')}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Source
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === "analysis" && (
          <div className="p-4 space-y-4">
            {laymanSummary && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-indigo-600 rounded-lg">
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900">Layman Summary</h3>
                  </div>
                  <div className="text-xs text-gray-500">{laymanSummary.title}</div>
                </div>
                <p className="text-sm leading-relaxed text-gray-700 mb-3">{laymanSummary.summary}</p>
                {Array.isArray(laymanSummary.key_points) && laymanSummary.key_points.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                    {laymanSummary.key_points.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {summarizeError && (
              <div className="text-sm text-red-600">{summarizeError}</div>
            )}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Analysis History</h3>
              {isAnalyzing && (
                <div className="flex items-center space-x-2 text-blue-600">
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs">Analyzing...</span>
                </div>
              )}
            </div>
            
            {analyses.length === 0 && !isAnalyzing && (
              <div className="text-center py-8">
                <Brain className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">No analysis yet</p>
                <p className="text-xs text-gray-400 mt-1">Select text in the document to get AI insights</p>
              </div>
            )}
            
            {analyses.map((analysis) => (
              <div key={analysis.id} className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="flex items-start space-x-3">
                  {getTypeIcon(analysis.type)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900 capitalize">{analysis.type}</h4>
                      <span className="text-xs text-gray-500">{analysis.timestamp}</span>
                    </div>
                    
                    <div className="bg-gray-50 rounded-md p-3 mb-3">
                      <p className="text-xs text-gray-600 font-medium mb-1">Selected Text:</p>
                      <p className="text-sm text-gray-800 italic">"{analysis.text}"</p>
                    </div>
                    
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {analysis.explanation}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === "chat" && (
          <div className="h-full flex flex-col">
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">Start a conversation about this document</p>
                  <p className="text-xs text-gray-400 mt-1">Ask questions about "{filename}"</p>
                </div>
              )}
              
              {chatMessages.map((message) => (
                <div key={message.id} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg p-3 ${message.isUser 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white border border-gray-200 text-gray-900'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                    <p className={`text-xs mt-1 ${message.isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                      {message.timestamp}
                    </p>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg p-3 max-w-[85%]">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder={`Ask about "${filename}"...`}
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChatMessage(chatMessage);
                    }
                  }}
                  disabled={isTyping}
                />
                <button 
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => sendChatMessage(chatMessage)}
                  disabled={!chatMessage.trim() || isTyping}
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              
              {/* Document status indicator */}
              <div className="mt-2 text-xs text-gray-500 flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${documentText ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                <span>
                  {documentText 
                    ? `Document loaded (${documentText.length} characters)` 
                    : 'Loading document context...'
                  }
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SynapsePanel;