"use client";

import { useState, useEffect, useRef, useId } from "react";
import ReactDOM from "react-dom";
import { FileText, MessageSquare, X, Send, Bot, User } from "lucide-react";
import { API_CONFIG, getApiUrl } from "../config/api";
import { withAuthHeaders } from "../utils/auth";

// Adobe PDF Embed API Configuration
const ADOBE_API_KEY =
  (process.env.NEXT_PUBLIC_ADOBE_CLIENT_ID as string) ||
  "e3b008974ccc4ac5aacabe3252c01c67";

interface DocumentViewerProps {
  documentUrl: string;
  filename: string;
  onExplainText: (text: string) => void;
  onRagSearch?: (query: string) => void;
}

interface ExplainTooltipProps {
  x: number;
  y: number;
  selectedText: string;
  onExplain: (text: string) => void;
  onClose: () => void;
  position?: "fixed" | "absolute";
  bounds?: { width: number; height: number };
}

interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

declare global {
  interface Window {
    AdobeDC: any;
  }
}

function ExplainTooltip({ x, y, selectedText, onExplain, onClose, position = "fixed", bounds }: ExplainTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Compute safe positions (avoid edges)
  const maxW = bounds?.width ?? window.innerWidth;
  const maxH = bounds?.height ?? window.innerHeight;
  const safeLeft = Math.max(12, Math.min(x, maxW - 12));
  const safeTop = Math.max(12, Math.min(y + 8, maxH - 12));

  return (
    <div 
      ref={tooltipRef}
      className={`${position === 'absolute' ? 'absolute' : 'fixed'} z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs animate-in fade-in duration-200 transform -translate-x-1/2`}
      style={{ left: safeLeft, top: safeTop }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-gray-600 line-clamp-3 pr-2">
          "{selectedText.length > 100 ? selectedText.substring(0, 100) + "..." : selectedText}"
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => {
            onExplain(selectedText);
            onClose();
          }}
          className="flex items-center space-x-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
        >
          <MessageSquare className="w-3 h-3" />
          <span>Explain this</span>
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 rounded-md text-sm transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const DocumentViewer = ({ documentUrl, filename, onExplainText, onRagSearch }: DocumentViewerProps) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [adobeView, setAdobeView] = useState<any>(null);
  const [selectedText, setSelectedText] = useState("");
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [adobeViewer, setAdobeViewer] = useState<any>(null);
  
  // Chat-related states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [documentText, setDocumentText] = useState(""); // Store document text for context

  // Debug: Add a test message to verify UI rendering
  useEffect(() => {
    console.log('Current chat messages:', chatMessages);
    console.log('Chat open:', isChatOpen);
  }, [chatMessages, isChatOpen]);
  
  const reactId = useId();
  const viewerId = `adobe-dc-view-${reactId}`;
  const sdkReadyRef = useRef(false);
  const selectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastExplainedRef = useRef<string>("");

  const closeTooltip = () => {
    setTooltipPosition(null);
    setSelectedText("");
  };

  const handleExplainText = (text: string) => {
    onExplainText(text);
    // Also kick off a RAG search for related snippets if callback provided
    try {
      if (typeof (onRagSearch) === 'function' && text && text.trim()) {
        onRagSearch(text.trim());
      }
    } catch (e) {
      // non-fatal
      console.warn('onRagSearch callback failed:', e);
    }
    closeTooltip();
  };

  const extractDocumentText = async () => {
    try {
      // Normalize URL so backend can fetch it successfully
      const toAbsoluteBackendUrl = (input: string): string => {
        try {
          const u = new URL(input, window.location.origin);
          // If it's our frontend-relative proxy route, rewrite to backend absolute
          if (u.pathname.startsWith('/api/proxy-gcs/')) {
            const rest = u.pathname.replace(/^\/api\/proxy-gcs\//, '');
            return `${API_CONFIG.BASE_URL}/proxy-gcs/${rest}`;
          }
          // If it's a bare relative backend proxy path
          if (u.pathname.startsWith('/proxy-gcs/')) {
            const rest = u.pathname.replace(/^\/proxy-gcs\//, '');
            return `${API_CONFIG.BASE_URL}/proxy-gcs/${rest}`;
          }
          return u.toString();
        } catch {
          // Fallback best-effort
          if (input.startsWith('/api/proxy-gcs/')) {
            const rest = input.replace(/^\/api\/proxy-gcs\//, '');
            return `${API_CONFIG.BASE_URL}/proxy-gcs/${rest}`;
          }
          if (input.startsWith('/proxy-gcs/')) {
            const rest = input.replace(/^\/proxy-gcs\//, '');
            return `${API_CONFIG.BASE_URL}/proxy-gcs/${rest}`;
          }
          return input;
        }
      };

      const absoluteUrl = toAbsoluteBackendUrl(documentUrl);
      console.log('Extracting document text from:', absoluteUrl);
      const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.EXTRACT_PDF_TEXT), {
        method: 'POST',
        headers: await withAuthHeaders({ 'Content-Type': 'application/json' }),
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
    }
  };

  const sendChatMessage = async (message: string) => {
    console.log('sendChatMessage called with:', message);
    
    if (!message.trim()) return;

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      text: message.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setChatMessages(prev => {
      const newMessages = [...prev, userMessage];
      console.log('Updated chat messages after user message:', newMessages);
      return newMessages;
    });

    setIsTyping(true);

    try {
      console.log('Sending request to chat API...');
      const response = await fetch(getApiUrl(API_CONFIG.ENDPOINTS.CHAT), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: message.trim(),
          document_text: documentText,
        }),
      });

      console.log('Chat API response status:', response.status);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Chat API response data:', data);

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: data.response || 'I received your message but couldn\'t generate a response.',
        isUser: false,
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending chat message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage(currentMessage);
      setCurrentMessage('');
    }
  };

  // Chat functions
  // Cleanup effect
  useEffect(() => {
    return () => {
      if (selectionIntervalRef.current) {
        clearInterval(selectionIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    // Dispose previous instance
    if (adobeView) {
      try {
        adobeView.dispose?.();
      } catch (e) {
        console.warn("Error disposing Adobe viewer:", e);
      }
      setAdobeView(null);
    }

    // Clear container
    if (viewerRef.current) viewerRef.current.innerHTML = "";

    setIsLoading(true);
    setError("");

    const startWhenReady = () => {
      sdkReadyRef.current = true;
      initializeAdobePDF();
    };

    // Load SDK once and wait for ready event
    if (window.AdobeDC) {
      startWhenReady();
    } else {
      const handleReady = () => {
        document.removeEventListener("adobe_dc_view_sdk.ready", handleReady);
        startWhenReady();
      };
      document.addEventListener("adobe_dc_view_sdk.ready", handleReady);

      // Inject script if not present
      if (!document.querySelector('script[src*="documentservices.adobe.com/view-sdk/viewer.js"]')) {
        const script = document.createElement("script");
        script.src = "https://documentservices.adobe.com/view-sdk/viewer.js";
        script.async = true;
        script.onerror = () => {
          setError("Failed to load Adobe PDF viewer script");
          setIsLoading(false);
        };
        document.head.appendChild(script);
      }
    }

    return () => {
      // No-op; we removed the handler above when it fired. If it didn't fire, browser GC will collect it with component unmount.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentUrl, filename]);

  const initializeAdobePDF = async () => {
    if (!window.AdobeDC || !viewerRef.current) return;

    try {
      // Load PDF as ArrayBuffer to avoid CORS/public URL requirements
      const filePromise = (async () => {
        // If the URL is cross-origin, route through our proxy to avoid CORS.
        let fetchUrl = documentUrl;
        let fetchHeaders: HeadersInit = {};
        try {
          const u = new URL(documentUrl, window.location.origin);
          // Rewrite local relative /api/proxy-gcs path to backend absolute for proxying
          if (u.pathname.startsWith('/api/proxy-gcs/')) {
            const rest = u.pathname.replace(/^\/api\/proxy-gcs\//, '');
            const backendUrl = `${API_CONFIG.BASE_URL}/proxy-gcs/${rest}`;
            fetchUrl = `/api/proxy-pdf?url=${encodeURIComponent(backendUrl)}`;
            fetchHeaders = await withAuthHeaders({});
          } else if (u.pathname.startsWith('/proxy-gcs/')) {
            // Also handle bare relative /proxy-gcs paths
            const rest = u.pathname.replace(/^\/proxy-gcs\//, '');
            const backendUrl = `${API_CONFIG.BASE_URL}/proxy-gcs/${rest}`;
            fetchUrl = `/api/proxy-pdf?url=${encodeURIComponent(backendUrl)}`;
            fetchHeaders = await withAuthHeaders({});
          } else {
            const isCrossOrigin = u.origin !== window.location.origin;
            if (isCrossOrigin) {
              fetchUrl = `/api/proxy-pdf?url=${encodeURIComponent(u.toString())}`;
              fetchHeaders = await withAuthHeaders({});
            }
          }
        } catch {
          // If it isn't a valid absolute/relative URL, try as-is
          fetchHeaders = await withAuthHeaders({});
        }
        const res = await fetch(fetchUrl, { headers: fetchHeaders });
        if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
        return await res.arrayBuffer();
      })();

      // Create new view
      const adobeDCView = new window.AdobeDC.View({
        clientId: ADOBE_API_KEY,
        divId: viewerId
      });

      const previewFilePromise = adobeDCView.previewFile(
        {
          content: { promise: filePromise },
          metaData: { fileName: filename }
        },
        {
          embedMode: "SIZED_CONTAINER",
          defaultViewMode: "FIT_PAGE",
          showZoomControl: true,
          showPageControls: true,
          dockPageControls: true,
          showLeftHandPanel: true,
          showThumbnails: true,
          showBookmarks: true,
          showAnnotationTools: true,
          showDownloadPDF: true,
          showPrintPDF: true,
          enableFormFilling: true,
          includePDFAnnotations: true,
          enableFilePreviewEvents: true,
          focusOnRendering: false
        }
      );

      // Wait for the preview to be ready and get access to viewer APIs
      previewFilePromise.then(adobeViewer => {
        setAdobeViewer(adobeViewer);
        
        // Extract document text for chat context
        extractDocumentText();
        
        // Set up text selection monitoring
        adobeViewer.getAPIs().then((apis: any) => {
          
          // Set up a periodic check for selected content
          const checkSelection = () => {
            apis.getSelectedContent()
              .then((result: any) => {
                if (result && result.data && result.data.trim()) {
                  const text = result.data.trim();
                  if (text && text !== lastExplainedRef.current) {
                    lastExplainedRef.current = text;
                    setSelectedText(text);
                    handleExplainText(text);
                  }
                } else {
                  // No selection
                  setTooltipPosition(null);
                  setSelectedText("");
                }
              })
              .catch(() => {
                // API call failed, probably no selection
                setTooltipPosition(null);
                setSelectedText("");
              });
          };

          // Check for selection changes every 500ms
          selectionIntervalRef.current = setInterval(checkSelection, 500);
        });
      });

      // Register event listeners for file preview events
      const eventOptions = {
        enableFilePreviewEvents: true,
        listenOn: [
          window.AdobeDC.View.Enum.FilePreviewEvents.PREVIEW_SELECTION_END,
          window.AdobeDC.View.Enum.FilePreviewEvents.PREVIEW_PAGE_CLICK,
          window.AdobeDC.View.Enum.FilePreviewEvents.PREVIEW_DOCUMENT_CLICK
        ]
      };

      adobeDCView.registerCallback(
        window.AdobeDC.View.Enum.CallbackType.EVENT_LISTENER,
        function(event: any) {
          try {
            console.log("Adobe PDF Event:", event?.type, event?.data);
            if (!event || !event.type) return;
            
            if (event.type === 'PREVIEW_SELECTION_END' && event.data?.selections) {
            const selection = window.getSelection();
            const text = selection?.toString().trim() || "";
            if (text && text !== lastExplainedRef.current) {
              lastExplainedRef.current = text;
              setSelectedText(text);
              handleExplainText(text);
            }
            } else if (event.type === 'PREVIEW_PAGE_CLICK' || event.type === 'PREVIEW_DOCUMENT_CLICK') {
            // Clear selection when clicking elsewhere
            setTimeout(() => {
              const selection = window.getSelection();
              if (!selection || !selection.toString().trim()) {
                setTooltipPosition(null);
                setSelectedText("");
              }
            }, 100);
            }
          } catch (eh) {
            // Guard against SDK edge cases
            console.warn('Adobe event handler error:', eh);
          }
        },
        eventOptions
      );

      setAdobeView(adobeDCView);
      setIsLoading(false);
      
    } catch (err) {
      console.error("Adobe PDF initialization error:", err);
      setError("Failed to initialize PDF viewer");
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">Failed to load document</p>
            <p className="text-sm text-gray-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-white">
      {/* PDF Viewer Container */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-gray-600">Loading document...</p>
            </div>
          </div>
        )}
        
        <div 
          id={viewerId}
          ref={viewerRef}
          className="w-full h-full"
          style={{ minHeight: '600px' }}
        />

        {/* Explain Tooltip removed: auto-trigger explain and RAG on selection */}

        

      {/* Chat Panel */}
      <div className={`transition-all duration-300 ease-in-out bg-gray-50 border-l border-gray-200 ${isChatOpen ? 'w-96' : 'w-0'} overflow-hidden`}>
        {isChatOpen && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Chat with Document</h3>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.length === 0 && (
                <div className="text-center py-8">
                  <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">Start a conversation about the document</p>
                  <p className="text-xs text-gray-400 mt-1">Ask questions, request summaries, or get explanations</p>
                </div>
              )}

              {chatMessages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-start space-x-2 max-w-xs lg:max-w-md ${message.isUser ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${message.isUser ? 'bg-blue-600' : 'bg-gray-600'}`}>
                      {message.isUser ? (
                        <User className="w-4 h-4 text-white" />
                      ) : (
                        <Bot className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <div className={`px-3 py-2 rounded-lg ${message.isUser ? 'bg-blue-600 text-white' : 'bg-white text-gray-900 border border-gray-200'}`}>
                      <p className="text-sm">{message.text}</p>
                      <p className={`text-xs mt-1 ${message.isUser ? 'text-blue-100' : 'text-gray-500'}`}>
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-2 max-w-xs">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="px-3 py-2 rounded-lg bg-white border border-gray-200">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 bg-white">
              <button
                onClick={() => {
                  const testMessage = "Test message: " + new Date().toLocaleTimeString();
                  setChatMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    text: testMessage,
                    isUser: true,
                    timestamp: new Date()
                  }]);
                }}
                className="w-full mb-2 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Test Add Message
              </button>
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Ask about this document..."
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isTyping}
                />
                <button
                  onClick={() => {
                    sendChatMessage(currentMessage);
                    setCurrentMessage('');
                  }}
                  disabled={!currentMessage.trim() || isTyping}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default DocumentViewer;