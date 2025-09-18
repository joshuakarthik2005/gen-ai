"use client";

import { useState, useEffect } from "react";
import Header from "./Header";
import DocumentViewer from "./DocumentViewer";
import AnalysisPanel from "./AnalysisPanel";
import ChatInterface from "./ChatInterface";

interface DocumentDashboardProps {
  documentUrl: string;
  filename: string;
}

export default function DocumentDashboard({ documentUrl, filename }: DocumentDashboardProps) {
  const [explainedText, setExplainedText] = useState<string>("");
  const [documentAnalysis, setDocumentAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);

  const handleExplainText = (text: string) => {
    setExplainedText(text);
    // Reset after a brief moment to allow the chat component to process it
    setTimeout(() => setExplainedText(""), 100);
  };

  // Analyze the document when component mounts
  useEffect(() => {
    const analyzeDocument = async () => {
      try {
        setIsAnalyzing(true);
        
        // Fetch the document from the signed URL and send it for analysis
        const documentResponse = await fetch(documentUrl);
        if (!documentResponse.ok) {
          throw new Error('Failed to fetch document');
        }
        
        const documentBlob = await documentResponse.blob();
        const formData = new FormData();
        formData.append('file', documentBlob, filename);
        
        // Call the analyze-document endpoint
        const analysisResponse = await fetch(API_ENDPOINTS.ANALYZE_DOCUMENT, {
          method: 'POST',
          body: formData,
        });
        
        if (!analysisResponse.ok) {
          throw new Error('Failed to analyze document');
        }
        
        const analysisData = await analysisResponse.json();
        
        // Parse the AI analysis response and structure it for our UI
        const structuredAnalysis = parseAnalysisResponse(analysisData.analysis, filename);
        
        setDocumentAnalysis(structuredAnalysis);
        setIsAnalyzing(false);
        
      } catch (error) {
        console.error("Error analyzing document:", error);
        
        // Fallback to mock analysis if API call fails
        const fallbackAnalysis = {
          executiveSummary: `This document "${filename}" has been successfully uploaded. We encountered an issue with the automated analysis, but you can still interact with the document. You can highlight any text in the document to get instant explanations.`,
          keyClauses: [
            {
              id: "analysis-unavailable",
              title: "Analysis Unavailable",
              riskLevel: "medium",
              explanation: "We couldn't perform the full document analysis at this time. Please try highlighting specific text for explanations.",
              content: "Full analysis temporarily unavailable..."
            }
          ],
          definedTerms: [
            { term: "Document", definition: "The uploaded legal document available for review" },
            { term: "Analysis", definition: "AI-powered review of legal terms and clauses" }
          ]
        };
        
        setDocumentAnalysis(fallbackAnalysis);
        setIsAnalyzing(false);
      }
    };

    analyzeDocument();
  }, [documentUrl, filename]);

  // Function to parse the AI analysis response into our expected structure
  const parseAnalysisResponse = (analysisText: string, filename: string) => {
    try {
      // Try to parse if it's JSON
      const parsed = JSON.parse(analysisText);
      if (parsed.executiveSummary && parsed.keyClauses) {
        return parsed;
      }
    } catch {
      // If not JSON, create structure from text
    }
    
    // Extract sections from the text-based AI response
    const lines = analysisText.split('\n').filter(line => line.trim());
    
    let executiveSummary = '';
    const keyClauses = [];
    const definedTerms = [];
    
    let currentSection = '';
    let currentClause = null;
    
    for (const line of lines) {
      if (line.toLowerCase().includes('summary') || line.toLowerCase().includes('overview')) {
        currentSection = 'summary';
        executiveSummary = line.replace(/^.*?summary:?\s*/i, '').replace(/^.*?overview:?\s*/i, '');
      } else if (line.toLowerCase().includes('risk') || line.toLowerCase().includes('clause') || line.toLowerCase().includes('concern')) {
        if (currentClause) {
          keyClauses.push(currentClause);
        }
        currentClause = {
          id: `clause-${keyClauses.length + 1}`,
          title: line.replace(/^\d+\.\s*/, '').replace(/^-\s*/, ''),
          riskLevel: line.toLowerCase().includes('high') ? 'high' : 
                    line.toLowerCase().includes('medium') ? 'medium' : 'low',
          explanation: '',
          content: ''
        };
        currentSection = 'clause';
      } else if (line.toLowerCase().includes('definition') || line.toLowerCase().includes('term')) {
        currentSection = 'terms';
        const termMatch = line.match(/["']([^"']+)["']\s*[:=]\s*(.+)/);
        if (termMatch) {
          definedTerms.push({
            term: termMatch[1],
            definition: termMatch[2]
          });
        }
      } else {
        // Add content to current section
        if (currentSection === 'summary' && line.trim()) {
          executiveSummary += ' ' + line;
        } else if (currentSection === 'clause' && currentClause && line.trim()) {
          if (!currentClause.explanation) {
            currentClause.explanation = line;
          } else {
            currentClause.content += ' ' + line;
          }
        }
      }
    }
    
    // Add the last clause if exists
    if (currentClause) {
      keyClauses.push(currentClause);
    }
    
    // Ensure we have some content
    if (!executiveSummary) {
      executiveSummary = `AI analysis of "${filename}" completed. The document has been processed and key insights are available below. You can highlight any text for detailed explanations.`;
    }
    
    if (keyClauses.length === 0) {
      keyClauses.push({
        id: "general-analysis",
        title: "Document Analysis",
        riskLevel: "medium",
        explanation: "The document has been analyzed. For specific clause explanations, highlight text in the document viewer.",
        content: analysisText.substring(0, 200) + "..."
      });
    }
    
    if (definedTerms.length === 0) {
      definedTerms.push(
        { term: "Legal Document", definition: "A document containing legal terms, clauses, and obligations" },
        { term: "Analysis", definition: "AI-powered interpretation of legal language and implications" }
      );
    }
    
    return {
      executiveSummary: executiveSummary.trim(),
      keyClauses,
      definedTerms
    };
  };

  return (
    <div className="h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col overflow-hidden">
      {/* Header */}
      <Header />

      {/* Main Dashboard Layout */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex gap-4 p-4">
          {/* Left Column - Document Viewer (28%) */}
          <div className="w-[28%] min-w-[350px] h-full flex flex-col">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 h-full overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                <h2 className="text-lg font-semibold text-gray-800">Document Viewer</h2>
                <div className="text-sm text-gray-500">{filename}</div>
              </div>
              <div className="flex-1 overflow-hidden">
                <DocumentViewer 
                  documentUrl={documentUrl}
                  filename={filename}
                  onExplainText={handleExplainText} 
                />
              </div>
            </div>
          </div>

          {/* Center Column - Analysis Panel (47%) */}
          <div className="w-[47%] min-w-[450px] h-full flex flex-col">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 h-full overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                <h2 className="text-lg font-semibold text-gray-800">AI Analysis</h2>
                <div className="flex items-center space-x-2">
                  {isAnalyzing && (
                    <div className="flex items-center space-x-2 text-blue-600">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm">Analyzing...</span>
                    </div>
                  )}
                  {!isAnalyzing && documentAnalysis && (
                    <div className="flex items-center space-x-2 text-green-600">
                      <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                      <span className="text-sm">Complete</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <AnalysisPanel 
                  documentAnalysis={documentAnalysis}
                  isLoading={isAnalyzing}
                  filename={filename}
                />
              </div>
            </div>
          </div>

          {/* Right Column - Chat Interface (25%) */}
          <div className="w-[25%] min-w-[300px] h-full flex flex-col">
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 h-full overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                <h2 className="text-lg font-semibold text-gray-800">AI Assistant</h2>
                <div className="text-sm text-gray-500">Ask anything</div>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatInterface 
                  explainedText={explainedText}
                  documentUrl={documentUrl}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}