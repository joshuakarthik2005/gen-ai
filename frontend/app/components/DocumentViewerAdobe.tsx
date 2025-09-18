"use client";

import { useState, useEffect, useRef } from "react";
import { ZoomIn, ZoomOut, RotateCw, Download, FileText, ChevronLeft, ChevronRight, Search, Menu } from "lucide-react";

// Adobe PDF Embed API Configuration
const ADOBE_API_KEY = "42dca80537eb431cad94af71101d769d";

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
  const [viewerId] = useState(() => `adobe-dc-view-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    // Clear any existing viewer
    if (adobeView) {
      try {
        adobeView.dispose?.();
      } catch (e) {
        console.warn("Error disposing Adobe viewer:", e);
      }
      setAdobeView(null);
    }

    // Clear the container
    if (viewerRef.current) {
      viewerRef.current.innerHTML = '';
    }

    setIsLoading(true);
    setError("");

    // Load Adobe PDF Embed API
    if (window.AdobeDC) {
      initializeAdobePDF();
    } else {
      const script = document.createElement('script');
      script.src = 'https://documentservices.adobe.com/view-sdk/viewer.js';
      script.async = true;
      
      script.onload = () => {
        setTimeout(initializeAdobePDF, 100); // Small delay to ensure SDK is ready
      };
      
      script.onerror = () => {
        setError("Failed to load Adobe PDF viewer");
        setIsLoading(false);
      };
      
      document.head.appendChild(script);
    }
  }, [documentUrl, filename]);

  const initializeAdobePDF = () => {
    if (!window.AdobeDC || !viewerRef.current) return;

    try {
      // Clear any existing content
      viewerRef.current.innerHTML = '';

      const adobeDCView = new window.AdobeDC.View({
        clientId: ADOBE_API_KEY,
        divId: viewerId
      });

      // Configure the viewer to match the reference design
      adobeDCView.previewFile({
        content: { location: { url: documentUrl } },
        metaData: { fileName: filename }
      }, {
        embedMode: "SIZED_CONTAINER",
        showAnnotationTools: true,
        showLeftHandPanel: true,
        showDownloadPDF: true,
        showPrintPDF: true,
        showZoomControl: true,
        defaultViewMode: "FIT_WIDTH",
        enableFormFilling: true,
        showBookmarks: true,
        showThumbnails: true,
        dockPageControls: false
      });

      // Add text selection event listener
      adobeDCView.registerCallback(
        window.AdobeDC.View.Enum.CallbackType.DOCUMENT_FRAGMENT_SELECTION,
        function(event: any) {
          if (event.data && event.data.text) {
            onExplainText(event.data.text);
          }
        },
        { enableFilePreviewEvents: true }
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
      </div>
    </div>
  );
};

export default DocumentViewer;