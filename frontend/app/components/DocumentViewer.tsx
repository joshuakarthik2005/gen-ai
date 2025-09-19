"use client";

import { useState, useEffect, useRef } from "react";
import { ZoomIn, ZoomOut, RotateCw, Download, FileText, ChevronLeft, ChevronRight, Search, Menu } from "lucide-react";
import { Document, Page } from "react-pdf";

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

/* Removed duplicate DocumentViewer definition to resolve merged declaration error */

interface ExplainTooltipProps {
  x: number;
  y: number;
  selectedText: string;
  onExplain: (text: string) => void;
  onClose: () => void;
}

function ExplainTooltip({ x, y, selectedText, onExplain, onClose }: ExplainTooltipProps) {
  return (
    <div 
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-elevated p-3 max-w-xs"
      style={{ 
        left: Math.min(x, window.innerWidth - 320), 
        top: Math.max(y - 60, 10) 
      }}
    >
      <div className="text-xs text-gray-600 mb-2 line-clamp-2">
        "{selectedText.length > 50 ? selectedText.substring(0, 50) + "..." : selectedText}"
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => {
            onExplain(selectedText);
            onClose();
          }}
          className="flex items-center space-x-1 bg-accent text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-accent/90 transition-colors shadow-sm"
        >
          <span>Explain this</span>
          <span className="text-xs">✨</span>
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

interface DocumentViewerProps {
  documentUrl: string;
  filename: string;
  onExplainText: (text: string) => void;
}

export default function DocumentViewer({ documentUrl, filename, onExplainText }: DocumentViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedText, setSelectedText] = useState("");
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
  }

  function onDocumentLoadError(error: Error) {
    console.error('Error loading PDF:', error);
    setError('Failed to load PDF document');
    setLoading(false);
  }

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSelectedText(selection.toString().trim());
      setTooltipPosition({
        x: rect.left + (rect.width / 2),
        y: rect.top
      });
    }
  };

  const closeTooltip = () => {
    setTooltipPosition(null);
    setSelectedText("");
    window.getSelection()?.removeAllRanges();
  };

  const changePage = (offset: number) => {
    setPageNumber(prevPageNumber => {
      const newPageNumber = prevPageNumber + offset;
      return Math.min(Math.max(1, newPageNumber), numPages);
    });
  };

  const changeScale = (newScale: number) => {
    setScale(Math.min(Math.max(0.5, newScale), 3.0));
  };

  return (
    <div className="h-full flex flex-col bg-white border border-gray-200 rounded-lg shadow-card overflow-hidden">
      {/* Document Viewer Header */}
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="w-4 h-4 text-primary-blue" />
            <div>
              <span className="text-sm font-medium text-gray-900">{filename}</span>
              {numPages > 0 && (
                <div className="text-xs text-gray-500">
                  Page {pageNumber} of {numPages}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            {/* Page Navigation */}
            {numPages > 1 && (
              <>
                <button
                  onClick={() => changePage(-1)}
                  disabled={pageNumber <= 1}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                  title="Previous page"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600 group-hover:text-gray-800" />
                </button>
                
                <button
                  onClick={() => changePage(1)}
                  disabled={pageNumber >= numPages}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                  title="Next page"
                >
                  <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-800" />
                </button>
                
                <div className="w-px h-4 bg-gray-300 mx-2" />
              </>
            )}

            {/* Zoom Controls */}
            <button
              onClick={() => changeScale(scale - 0.25)}
              className="p-2 hover:bg-gray-200 rounded-md transition-colors group"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4 text-gray-600 group-hover:text-gray-800" />
            </button>
            
            <span className="text-sm text-gray-600 min-w-[3rem] text-center font-medium">
              {Math.round(scale * 100)}%
            </span>
            
            <button
              onClick={() => changeScale(scale + 0.25)}
              className="p-2 hover:bg-gray-200 rounded-md transition-colors group"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4 text-gray-600 group-hover:text-gray-800" />
            </button>
            
            <div className="w-px h-4 bg-gray-300 mx-2" />
            
            <button 
              className="p-2 hover:bg-gray-200 rounded-md transition-colors group" 
              title="Download"
              onClick={() => window.open(documentUrl, '_blank')}
            >
              <Download className="w-4 h-4 text-gray-600 group-hover:text-gray-800" />
            </button>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <div className="flex-1 overflow-auto bg-gray-100" ref={containerRef}>
        <div className="flex justify-center py-6">
          {loading && (
            <div className="flex items-center justify-center h-96">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-sm text-gray-600">Loading PDF...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-96">
              <div className="text-center text-red-600">
                <p className="font-medium">Error loading PDF</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            </div>
          )}

          {!loading && !error && (
            <div 
              className="shadow-lg bg-white" 
              onMouseUp={handleTextSelection}
              style={{ userSelect: 'text' }}
            >
              <Document
                file={documentUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={onDocumentLoadError}
                loading={
                  <div className="flex items-center justify-center h-96">
                    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                  </div>
                }
              >
                <Page 
                  pageNumber={pageNumber} 
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                />
              </Document>
            </div>
          )}
        </div>
      </div>

      {/* Explain Tooltip */}
      {tooltipPosition && selectedText && (
        <ExplainTooltip
          x={tooltipPosition.x}
          y={tooltipPosition.y}
          selectedText={selectedText}
          onExplain={onExplainText}
          onClose={closeTooltip}
        />
      )}
    </div>
  );
}