"use client";

import { useState, useEffect, useRef } from "react";
import { ZoomIn, ZoomOut, RotateCw, Download, FileText } from "lucide-react";

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
  onExplainText: (text: string) => void;
}

export default function DocumentViewer({ onExplainText }: DocumentViewerProps) {
  const [zoom, setZoom] = useState(100);
  const [selectedText, setSelectedText] = useState("");
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const [isAdobeLoaded, setIsAdobeLoaded] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);
  const adobeViewerRef = useRef<any>(null);

  // Adobe PDF Embed API configuration
  const ADOBE_API_KEY = "42dca80537eb431cad94af71101d769d";

  useEffect(() => {
    // Load Adobe PDF Embed API
    const script = document.createElement('script');
    script.src = 'https://documentservices.adobe.com/view-sdk/viewer.js';
    script.onload = () => {
      setIsAdobeLoaded(true);
      initializeAdobePDF();
    };
    document.head.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  const initializeAdobePDF = () => {
    if (typeof window !== 'undefined' && (window as any).AdobeDC && viewerRef.current) {
      const adobeDCView = new (window as any).AdobeDC.View({
        clientId: ADOBE_API_KEY,
        divId: "adobe-dc-view",
      });

      // You can load a PDF from URL or file
      // For demo purposes, we'll show the fallback document viewer
      // In production, you would call:
      // adobeDCView.previewFile({
      //   content: {location: {url: "path/to/your/document.pdf"}},
      //   metaData: {fileName: "employment_agreement.pdf"}
      // });
      
      adobeViewerRef.current = adobeDCView;
    }
  };

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

  // Sample document content for demonstration
  const sampleDocument = `EMPLOYMENT AGREEMENT

This Employment Agreement ("Agreement") is entered into on March 15, 2024 between TechCorp Inc., a corporation organized under the laws of Delaware ("Company"), and Sarah Chen ("Employee").

1. EMPLOYMENT AND DUTIES
Company agrees to employ Employee, and Employee agrees to be employed by Company, as Senior Software Engineer. Employee shall perform such duties and responsibilities as may be assigned by Company's management, consistent with Employee's position.

2. COMPENSATION
Company shall pay Employee a base salary of $120,000 per year, payable in accordance with Company's standard payroll practices. Employee may be eligible for bonuses and other compensation as determined by Company in its sole discretion.

3. BENEFITS
Employee shall be entitled to participate in Company's employee benefit plans, including health insurance, retirement plans, and paid time off, subject to the terms and conditions of such plans.

4. CONFIDENTIALITY
Employee acknowledges that during employment, Employee may have access to confidential information belonging to Company. Employee agrees to maintain the confidentiality of such information and not to disclose it to any third party without Company's written consent.

5. NON-COMPETE
During employment and for a period of twelve (12) months following termination of employment for any reason, Employee agrees not to directly or indirectly compete with Company's business within a radius of fifty (50) miles from Company's principal place of business.

6. TERMINATION
Either party may terminate this Agreement at any time, with or without cause, upon thirty (30) days' written notice to the other party. Company may terminate Employee's employment immediately for cause, including but not limited to misconduct, breach of this Agreement, or violation of Company policies.

7. RETURN OF PROPERTY
Upon termination of employment, Employee agrees to return all Company property, including but not limited to documents, equipment, and confidential information.

8. GOVERNING LAW
This Agreement shall be governed by and construed in accordance with the laws of Delaware, without regard to its conflict of laws principles.

IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.

TechCorp Inc.                    Sarah Chen

By: _________________________    _________________________
Name: Michael Johnson            Sarah Chen  
Title: CEO
Date: March 15, 2024           Date: March 15, 2024`;

  return (
    <div className="h-full flex flex-col bg-white border border-gray-200 rounded-lg shadow-card overflow-hidden">
      {/* Document Viewer Header */}
      <div className="flex-shrink-0 border-b border-gray-200 px-4 py-3 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <FileText className="w-4 h-4 text-primary-blue" />
            <div>
              <span className="text-sm font-medium text-gray-900">employment_agreement.pdf</span>
              <div className="text-xs text-gray-500">Page 1 of 2 • 2.3 MB</div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setZoom(Math.max(50, zoom - 25))}
              className="p-2 hover:bg-gray-200 rounded-md transition-colors group"
              title="Zoom out"
            >
              <ZoomOut className="w-4 h-4 text-gray-600 group-hover:text-gray-800" />
            </button>
            
            <span className="text-sm text-gray-600 min-w-[3rem] text-center font-medium">{zoom}%</span>
            
            <button
              onClick={() => setZoom(Math.min(200, zoom + 25))}
              className="p-2 hover:bg-gray-200 rounded-md transition-colors group"
              title="Zoom in"
            >
              <ZoomIn className="w-4 h-4 text-gray-600 group-hover:text-gray-800" />
            </button>
            
            <div className="w-px h-4 bg-gray-300 mx-2" />
            
            <button className="p-2 hover:bg-gray-200 rounded-md transition-colors group" title="Rotate">
              <RotateCw className="w-4 h-4 text-gray-600 group-hover:text-gray-800" />
            </button>
            
            <button className="p-2 hover:bg-gray-200 rounded-md transition-colors group" title="Download">
              <Download className="w-4 h-4 text-gray-600 group-hover:text-gray-800" />
            </button>
          </div>
        </div>
      </div>

      {/* Adobe PDF Viewer Container */}
      <div className="flex-1 relative overflow-hidden">
        {/* Adobe PDF Embed API Container */}
        <div 
          id="adobe-dc-view" 
          ref={viewerRef}
          className="w-full h-full"
          style={{ display: isAdobeLoaded ? 'block' : 'none' }}
        />
        
        {/* Fallback Document Content */}
        {!isAdobeLoaded && (
          <div className="w-full h-full overflow-auto">
            <div className="p-6 bg-white">
              <div 
                className="max-w-none mx-auto bg-white text-gray-900 leading-relaxed select-text shadow-sm border border-gray-100 rounded-lg p-8"
                style={{ 
                  fontSize: `${zoom}%`,
                  fontFamily: 'Georgia, serif',
                  lineHeight: '1.8',
                  maxWidth: '8.5in',
                  minHeight: '11in'
                }}
                onMouseUp={handleTextSelection}
              >
                <pre className="whitespace-pre-wrap font-serif text-sm">
                  {sampleDocument}
                </pre>
              </div>
            </div>
          </div>
        )}
        
        {/* Loading state for Adobe PDF */}
        {!isAdobeLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-gray-600">Loading Adobe PDF Viewer...</p>
            </div>
          </div>
        )}
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