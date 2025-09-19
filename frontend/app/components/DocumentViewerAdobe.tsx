"use client";

import { useState, useEffect, useRef, useId } from "react";
import { FileText, MessageSquare, X } from "lucide-react";

// Adobe PDF Embed API Configuration
const ADOBE_API_KEY =
  (process.env.NEXT_PUBLIC_ADOBE_CLIENT_ID as string) ||
  "42dca80537eb431cad94af71101d769d";

interface DocumentViewerProps {
  documentUrl: string;
  filename: string;
  onExplainText: (text: string) => void;
}

interface ExplainTooltipProps {
  x: number;
  y: number;
  selectedText: string;
  onExplain: (text: string) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    AdobeDC: any;
  }
}

function ExplainTooltip({ x, y, selectedText, onExplain, onClose }: ExplainTooltipProps) {
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

  return (
    <div 
      ref={tooltipRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-3 max-w-xs animate-in fade-in duration-200"
      style={{ 
        left: Math.min(x, window.innerWidth - 320), 
        top: Math.max(y - 100, 10) 
      }}
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

const DocumentViewer = ({ documentUrl, filename, onExplainText }: DocumentViewerProps) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [adobeView, setAdobeView] = useState<any>(null);
  const [selectedText, setSelectedText] = useState("");
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [adobeViewer, setAdobeViewer] = useState<any>(null);
  const reactId = useId();
  const viewerId = `adobe-dc-view-${reactId}`;
  const sdkReadyRef = useRef(false);
  const selectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const closeTooltip = () => {
    setTooltipPosition(null);
    setSelectedText("");
  };

  const handleExplainText = (text: string) => {
    onExplainText(text);
    closeTooltip();
  };

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
        try {
          const u = new URL(documentUrl, window.location.origin);
          const isCrossOrigin = u.origin !== window.location.origin;
          if (isCrossOrigin) {
            fetchUrl = `/api/proxy-pdf?url=${encodeURIComponent(u.toString())}`;
          }
        } catch {
          // If it isn't a valid absolute/relative URL, try as-is
        }
        const res = await fetch(fetchUrl);
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
        
        // Set up text selection monitoring
        adobeViewer.getAPIs().then((apis: any) => {
          
          // Set up a periodic check for selected content
          const checkSelection = () => {
            apis.getSelectedContent()
              .then((result: any) => {
                if (result && result.data && result.data.trim()) {
                  const selection = window.getSelection();
                  if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    const rect = range.getBoundingClientRect();
                    
                    // Only show tooltip if we have a valid selection and position
                    if (rect.width > 0 && rect.height > 0) {
                      setSelectedText(result.data.trim());
                      setTooltipPosition({
                        x: rect.left + (rect.width / 2),
                        y: rect.top + window.scrollY
                      });
                    }
                  }
                } else {
                  // No selection, hide tooltip
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
          console.log("Adobe PDF Event:", event.type, event.data);
          
          if (event.type === 'PREVIEW_SELECTION_END' && event.data?.selections) {
            // Text has been selected
            const selection = window.getSelection();
            if (selection && selection.toString().trim()) {
              const range = selection.getRangeAt(0);
              const rect = range.getBoundingClientRect();
              
              setSelectedText(selection.toString().trim());
              setTooltipPosition({
                x: rect.left + (rect.width / 2),
                y: rect.top + window.scrollY
              });
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
    <div className="h-full flex flex-col bg-white">
      {/* PDF Viewer Container - Let Adobe handle the full interface */}
      <div className="flex-1 relative overflow-hidden min-h-[60vh] md:min-h-0">
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

        {/* Explain Tooltip */}
        {tooltipPosition && selectedText && (
          <ExplainTooltip
            x={tooltipPosition.x}
            y={tooltipPosition.y}
            selectedText={selectedText}
            onExplain={handleExplainText}
            onClose={closeTooltip}
          />
        )}
      </div>
    </div>
  );
};

export default DocumentViewer;