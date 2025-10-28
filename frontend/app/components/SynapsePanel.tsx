"use client";

import { useState, useEffect, useRef } from "react";
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

type RiskSeverity = 'high' | 'medium' | 'low';

interface RiskFinding {
  id: string;
  type: string;
  severity: RiskSeverity;
  snippet: string;
  keyword: string;
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
  const [activeTab, setActiveTab] = useState<"snippets" | "analysis" | "chat" | "risks">("snippets");
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [documentText, setDocumentText] = useState("");
  
  // Search scope state: "all" (all user docs) or "current" (current doc only)
  const [searchScope, setSearchScope] = useState<"all" | "current">("all");
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState<string | null>(null);
  const [laymanSummary, setLaymanSummary] = useState<{
    title: string;
    summary: string;
    key_points: string[];
  } | null>(null);
  // Risk detection states
  const [riskFindings, setRiskFindings] = useState<RiskFinding[]>([]);
  const [isScanningRisks, setIsScanningRisks] = useState(false);
  
  // RAG search states
  const [relatedSnippets, setRelatedSnippets] = useState<RelatedSnippet[]>([]);
  const [isSearchingRAG, setIsSearchingRAG] = useState(false);
  const [ragSearchError, setRagSearchError] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState<string>("");
  const [ragNote, setRagNote] = useState<string | null>(null);
  // Track in-flight searches to avoid race conditions and allow cancellation
  const ragAbortRef = useRef<AbortController | null>(null);
  const ragRequestIdRef = useRef<number>(0);
  const debounceTimerRef = useRef<number | null>(null);

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

  // Heuristic risk detector: scans text for common risky clauses
  const detectRisks = (text: string): RiskFinding[] => {
    if (!text) return [];
    const patterns: Array<{ type: string; severity: RiskSeverity; regex: RegExp[] }> = [
      {
        type: 'Auto-renewal', severity: 'medium',
        regex: [/auto[-\s]?renew/i, /automatic\s+renewal/i, /renews?\s+automatically/i]
      },
      {
        type: 'High penalties / liquidated damages', severity: 'high',
        regex: [/liquidated\s+damages?/i, /penalt(y|ies)/i, /late\s+fee/i, /(fee|penalty)\s+of\s+\$?\d{3,}/i, /\b(1\d{2}|[2-9]\d{2})%/]
      },
      {
        type: 'Waiver of rights', severity: 'high',
        regex: [/waive[sd]?\b/i, /waiver\b/i, /no\s+waiver\b/i]
      },
      {
        type: 'Indemnification', severity: 'high',
        regex: [/indemnif(y|ies|ication|y\s+and\s+hold\s+harmless)/i]
      },
      {
        type: 'Unilateral termination', severity: 'medium',
        regex: [/sole\s+discretion\b/i, /may\s+terminate\s+at\s+any\s+time/i]
      },
      {
        type: 'Arbitration/venue limitations', severity: 'medium',
        regex: [/binding\s+arbitration/i, /venue\s+shall\s+be/i, /exclusive\s+jurisdiction/i]
      },
      {
        type: 'Confidentiality overreach', severity: 'low',
        regex: [/confidential(ity)?\b/i, /trade\s+secret/i, /proprietary\s+information/i]
      }
    ];

    const findings: RiskFinding[] = [];
    const lower = text; // keep original casing for snippets

    const addFinding = (type: string, severity: RiskSeverity, keyword: string, index: number) => {
      const start = Math.max(0, index - 80);
      const end = Math.min(lower.length, index + keyword.length + 120);
      const snippet = lower.slice(start, end).replace(/\s+/g, ' ').trim();
      findings.push({ id: `${type}-${index}-${Math.random().toString(36).slice(2,7)}`, type, severity, keyword, snippet });
    };

    for (const p of patterns) {
      for (const r of p.regex) {
        let m: RegExpExecArray | null;
        const re = new RegExp(r.source, r.flags.includes('g') ? r.flags : r.flags + 'g');
        while ((m = re.exec(lower)) !== null) {
          addFinding(p.type, p.severity, m[0], m.index);
          // avoid infinite loops on zero-width matches
          if (m.index === re.lastIndex) re.lastIndex++;
        }
      }
    }

    // De-duplicate by overlapping ranges/type
    const unique: RiskFinding[] = [];
    const seen = new Set<string>();
    for (const f of findings) {
      const key = `${f.type}:${f.keyword}:${f.snippet.slice(0,60)}`;
      if (!seen.has(key)) { seen.add(key); unique.push(f); }
    }
    return unique.slice(0, 50); // cap to reasonable number
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
      const fullText = data.text || '';
      setDocumentText(fullText);
      // Kick off risk scanning
      try {
        setIsScanningRisks(true);
        const risks = detectRisks(fullText);
        setRiskFindings(risks);
      } finally {
        setIsScanningRisks(false);
      }
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
  const performRAGSearch = async (query: string, scope?: "all" | "current") => {
    const trimmed = (query || "").trim();
    if (!trimmed) {
      console.debug('[RAG] skip: empty query');
      return;
    }
    // Optional: avoid spamming the backend with extremely short or noisy fragments
    // Still allow short, meaningful legal terms like "tenant"
    const MIN_QUERY_LEN = 3;
    if (trimmed.length < MIN_QUERY_LEN) {
      console.debug('[RAG] skip: below min length', { len: trimmed.length, query: trimmed });
      return;
    }

    // Mark searching, but keep previous results visible until new ones arrive
    setIsSearchingRAG(true);
    setRagSearchError(null);
    setRagNote(null);
    setLastSearchQuery(trimmed);

    // Cancel any previous in-flight request
  try { ragAbortRef.current?.abort(); console.debug('[RAG] aborted previous request'); } catch { /* ignore */ }
    const controller = new AbortController();
    ragAbortRef.current = controller;
    const myReqId = ++ragRequestIdRef.current;

    try {
      console.log('Performing RAG search for:', query, 'Scope:', scope || searchScope);
      
      // Extract document ID from URL (pattern: .../filename.pdf or .../uuid.pdf)
      const extractDocumentId = (url: string): string | null => {
        try {
          const match = url.match(/\/([^/]+)\.pdf/i);
          return match ? match[1] : null;
        } catch {
          return null;
        }
      };
      
      const documentId = extractDocumentId(documentUrl);
      const effectiveScope = scope || searchScope;
      
      const headers = await withAuthHeaders({ 'Content-Type': 'application/json' });
      const requestBody: any = {
        query: query.trim(),
        document_context: documentUrl,
        scope: effectiveScope === "current" ? "document" : "user"
      };
      
      // Only add document_id if we're searching current document and we have an ID
      if (effectiveScope === "current" && documentId) {
        requestBody.document_id = documentId;
        console.log('Searching current document only:', documentId);
      } else {
        console.log('Searching all user documents');
      }
      
      console.debug('[RAG] fetch -> /rag-search', { requestBody });
      const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.RAG_SEARCH), {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`RAG search failed: ${response.status}`);
      }
      const data: RAGSearchResult = await response.json();
      console.log('RAG search results:', data);
      // Ignore outdated responses if a newer request has started
      if (myReqId !== ragRequestIdRef.current) {
        console.debug('[RAG] ignoring stale response');
        return;
      }
      // Capture any backend diagnostic note
      setRagNote(data?.note || null);
      // If backend returns nothing, keep it empty to show proper empty state
      const snippets = Array.isArray(data.related_snippets) ? data.related_snippets : [];
      // If new results are empty but we already have some, avoid clearing on likely transient/partial selections
      if (snippets.length === 0 && relatedSnippets.length > 0 && trimmed.length < 8) {
        console.log('Skipping overwrite with empty results for very short query; keeping previous snippets');
      } else {
        setRelatedSnippets(snippets);
      }
      
      // Switch to snippets tab to show results
      setActiveTab('snippets');
      
    } catch (error) {
      console.error('RAG search error:', error);
      setRagSearchError((error as Error).message || 'Failed to search related documents');
      // Ensure no stale snippets are displayed upon error
      // Keep existing results on error to avoid flicker unless none exist
      if (relatedSnippets.length === 0) setRelatedSnippets([]);
    } finally {
      setIsSearchingRAG(false);
    }
  };

  // Handle explained text from document viewer - trigger BOTH explain AND RAG search
  useEffect(() => {
    const run = async () => {
      const textToProcess = explainedText || ragSearchQuery || "";
      if (!textToProcess || textToProcess.trim() === "") return;
      
      const trimmed = textToProcess.trim();
      
      // Skip if this is the exact same query we just processed
      if (trimmed === lastSearchQuery) {
        console.debug('[Selection] Skipping duplicate', { trimmed });
        return;
      }
      
      console.log('[Selection] Processing:', trimmed);
      
      // Fire explain-selection
      if (explainedText && explainedText.trim()) {
        setIsAnalyzing(true);
        try {
          const headers = await withAuthHeaders({ 'Content-Type': 'application/json' });
          const resp = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.EXPLAIN_SELECTION), {
            method: 'POST',
            headers,
            body: JSON.stringify({ selected_text: explainedText, document_url: documentUrl })
          });
          if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            throw new Error(errText || `Explain-selection failed (${resp.status})`);
          }
          const data = await resp.json();
          const explanation = data?.explanation || 'No explanation returned.';
          const newAnalysis: Analysis = {
            id: Date.now().toString(),
            text: explainedText,
            explanation,
            timestamp: new Date().toLocaleTimeString(),
            type: 'explanation'
          };
          setAnalyses(prev => [newAnalysis, ...prev]);
          setActiveTab('analysis');
        } catch (e) {
          console.error('Explain-selection error:', e);
          const fallback: Analysis = {
            id: Date.now().toString(),
            text: explainedText,
            explanation: `I couldn't reach the explanation service. Here's a quick note: This clause may define obligations, timelines, or risks. If this keeps happening, check your API URL and auth.`,
            timestamp: new Date().toLocaleTimeString(),
            type: 'warning'
          };
          setAnalyses(prev => [fallback, ...prev]);
          setActiveTab('analysis');
        } finally {
          setIsAnalyzing(false);
        }
      }
      
      // Fire RAG search immediately (no debounce)
      console.log('[Selection] Triggering RAG search for:', trimmed);
      performRAGSearch(trimmed);
    };
    run();
  }, [explainedText, ragSearchQuery]);

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
            onClick={() => setActiveTab("risks")}
            className={`flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === "risks" 
                ? "bg-white text-gray-900 shadow-sm" 
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <AlertCircle className="w-4 h-4" />
            <span>Risks</span>
            {riskFindings.length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 px-1 flex items-center justify-center">
                {riskFindings.length}
              </span>
            )}
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
        {/* Risks Tab */}
        {activeTab === "risks" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Risk Flags</h3>
              {isScanningRisks && (
                <span className="text-xs text-gray-500">Scanning…</span>
              )}
            </div>

            {riskFindings.length === 0 && !isScanningRisks && (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No obvious risk clauses detected</p>
                <p className="text-xs text-gray-400 mt-1">This is a heuristic scan; always review with legal counsel.</p>
              </div>
            )}

            {riskFindings.map((r) => {
              const color = r.severity === 'high' ? 'bg-red-500' : r.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500';
              const badge = r.severity === 'high' ? 'text-red-700 bg-red-100' : r.severity === 'medium' ? 'text-yellow-700 bg-yellow-100' : 'text-green-700 bg-green-100';
              return (
                <div key={r.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${color}`}></div>
                      <span className="text-xs font-medium text-gray-700">{r.type}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${badge} uppercase tracking-wide`}>{r.severity}</span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {r.snippet}
                  </p>
                  <div className="mt-2 text-xs text-gray-500">Keyword: <span className="font-mono">{r.keyword}</span></div>
                </div>
              );
            })}
          </div>
        )}
        {/* Related Snippets Tab */}
        {activeTab === "snippets" && (
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Related Snippets</h3>
              <span className="text-xs text-gray-500">{relatedSnippets.length} found</span>
            </div>
            
            {/* Search Scope Toggle */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200">
              <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={searchScope === "current"}
                  onChange={(e) => {
                    const newScope = e.target.checked ? "current" : "all";
                    setSearchScope(newScope);
                    // Re-trigger search with new scope if we have a last query
                    if (lastSearchQuery) {
                      console.log('[Scope] Changed to:', newScope, '- re-running search');
                      performRAGSearch(lastSearchQuery, newScope);
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="select-none">Search current document only</span>
              </label>
              <div className="ml-auto flex items-center gap-1 text-xs text-gray-500">
                <span>{searchScope === "current" ? "📄 Current doc" : "📚 All my docs"}</span>
                {searchScope === "all" && (
                  <span className="text-xs text-amber-600" title="Cross-document search requires RAG_FILTER_METADATA backend configuration">
                    ⚠️
                  </span>
                )}
              </div>
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
            {!ragSearchError && ragNote && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-xs text-blue-700">
                  {ragNote}
                </div>
              </div>
            )}
            
            {relatedSnippets.length === 0 && !isSearchingRAG && !ragSearchError && (
              <div className="text-center py-8 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No related snippets found. Try toggling the scope to "Search current document only" or adjust your selection.</p>
                <div className="mt-3">
                  <button
                    className="px-3 py-1.5 text-xs rounded-md bg-gray-100 hover:bg-gray-200 border border-gray-200"
                    onClick={() => performRAGSearch(lastSearchQuery || ragSearchQuery || '', 'current')}
                  >
                    Try current document only
                  </button>
                </div>
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