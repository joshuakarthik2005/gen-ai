"use client";

import { useState, useEffect } from "react";
import Header from "./Header";
import DocumentViewer from "./DocumentViewer";
import AnalysisPanel from "./AnalysisPanel";
import ChatInterface from "./ChatInterface";
import { API_ENDPOINTS } from "../lib/config";

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
        
        // For now, we'll use mock analysis data
        // In a real implementation, you would fetch and analyze the actual document
        setTimeout(() => {
          setDocumentAnalysis({
            executiveSummary: `This document "${filename}" has been successfully uploaded and is ready for analysis. The AI analysis will provide insights into key clauses, risks, and important terms to help you understand the legal implications. You can highlight any text in the document to get instant explanations.`,
            keyClauses: [
              {
                id: "general-terms",
                title: "General Terms",
                riskLevel: "low",
                explanation: "This section contains standard legal language. Generally low risk but important to understand.",
                content: "Standard terms that govern the overall agreement..."
              },
              {
                id: "obligations",
                title: "Party Obligations",
                riskLevel: "medium",
                explanation: "This outlines what each party must do under the agreement. Pay attention to your specific responsibilities.",
                content: "Obligations and duties of each party..."
              },
              {
                id: "termination",
                title: "Termination Clauses",
                riskLevel: "high",
                explanation: "These clauses define how and when the agreement can be ended. Important to understand notice requirements and consequences.",
                content: "Conditions under which the agreement may be terminated..."
              }
            ],
            definedTerms: [
              { term: "Agreement", definition: "This legal document and all its terms and conditions" },
              { term: "Party", definition: "Any individual or entity that has signed or is bound by this agreement" },
              { term: "Effective Date", definition: "The date when this agreement officially begins" },
              { term: "Notice", definition: "Official communication that must be provided as specified in the agreement" }
            ]
          });
          setIsAnalyzing(false);
        }, 2000);
        
      } catch (error) {
        console.error("Error analyzing document:", error);
        setIsAnalyzing(false);
      }
    };

    analyzeDocument();
  }, [documentUrl, filename]);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <Header />

      {/* Main Dashboard Layout */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex gap-6 p-6">
          {/* Left Column - Document Viewer (28%) */}
          <div className="w-[28%] min-w-[350px] h-full">
            <DocumentViewer 
              documentUrl={documentUrl}
              filename={filename}
              onExplainText={handleExplainText} 
            />
          </div>

          {/* Center Column - Analysis Panel (47%) */}
          <div className="w-[47%] min-w-[450px] h-full">
            <AnalysisPanel 
              documentAnalysis={documentAnalysis}
              isLoading={isAnalyzing}
              filename={filename}
            />
          </div>

          {/* Right Column - Chat Interface (25%) */}
          <div className="w-[25%] min-w-[300px] h-full">
            <ChatInterface 
              explainedText={explainedText}
              documentUrl={documentUrl}
            />
          </div>
        </div>
      </div>
    </div>
  );
}