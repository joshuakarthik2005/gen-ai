"use client";

import { useState, useEffect, useRef, useId } from "react";
import { FileText } from "lucide-react";

// Adobe PDF Embed API Configuration
const ADOBE_API_KEY =
  (process.env.NEXT_PUBLIC_ADOBE_CLIENT_ID as string) ||
  "42dca80537eb431cad94af71101d769d";

interface DocumentViewerProps {
  documentUrl: string;
  filename: string;
  onExplainText: (text: string) => void;
}

declare global {
  interface Window {
    AdobeDC: any;
  }
}

const DocumentViewer = ({ documentUrl, filename, onExplainText }: DocumentViewerProps) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [adobeView, setAdobeView] = useState<any>(null);
  const reactId = useId();
  const viewerId = `adobe-dc-view-${reactId}`;
  const sdkReadyRef = useRef(false);

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

      await adobeDCView.previewFile(
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
        }
      );

      // Text selection callback (guard for SDKs that don't expose this enum)
      const cbEnum = window.AdobeDC?.View?.Enum?.CallbackType;
      if (cbEnum) {
        // Try to find any selection-related callbacks the SDK exposes
        const keys = Object.keys(cbEnum);
        const selectionKeys = keys.filter((k) => /SELECT|SELECTION|FRAGMENT/i.test(k));

        const handleSelection = (event: any) => {
          const text =
            event?.data?.text ||
            event?.data?.selectedText ||
            event?.dataPayload?.text ||
            event?.dataPayload?.selectedText;
          if (text && typeof text === "string" && text.trim()) {
            onExplainText(text.trim());
          }
        };

        if (selectionKeys.length > 0) {
          // Register to all selection-like callbacks defensively
          selectionKeys.forEach((k) => {
            try {
              adobeDCView.registerCallback((cbEnum as any)[k], handleSelection, {
                enableFilePreviewEvents: true,
              });
            } catch (e) {
              // ignore unsupported keys
            }
          });
        } else {
          console.warn(
            "Adobe Embed SDK: No selection-related callback types exposed; selection-to-chat disabled."
          );
        }
      }

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
      </div>
    </div>
  );
};

export default DocumentViewer;