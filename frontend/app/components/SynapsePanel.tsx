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
}

interface RelatedSnippet {
  id: string;
  text: string;
  source: string;
  relevance: number;
  type: "contract" | "policy" | "precedent";
}

interface Analysis {
  id: string;
  text: string;
  explanation: string;
  timestamp: string;
  type: "explanation" | "insight" | "warning";
}

const SynapsePanel = ({ explainedText }: SynapsePanelProps) => {
  const [activeTab, setActiveTab] = useState<"snippets" | "analysis" | "chat">("snippets");
  const [chatMessage, setChatMessage] = useState("");
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Sample related snippets data
  const relatedSnippets: RelatedSnippet[] = [
    {
      id: "1",
      text: "The employee agrees to work exclusively for the company during the term of employment...",
      source: "Standard Employment Contract",
      relevance: 95,
      type: "contract"
    },
    {
      id: "2", 
      text: "Confidentiality obligations shall survive termination of this agreement...",
      source: "NDA Template",
      relevance: 87,
      type: "policy"
    },
    {
      id: "3",
      text: "Either party may terminate this agreement with 30 days written notice...",
      source: "Service Agreement",
      relevance: 78,
      type: "contract"
    }
  ];

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
        <div className="flex items-center space-x-2 mb-4">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900">Synapse</h2>
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
            <MessageSquare className="w-4 h-4" />
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
            
            {relatedSnippets.map((snippet) => (
              <div key={snippet.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getSnippetTypeColor(snippet.type)}`}>
                    {snippet.type}
                  </span>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-gray-500">{snippet.relevance}%</span>
                  </div>
                </div>
                
                <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                  {snippet.text}
                </p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>From: {snippet.source}</span>
                  <button className="text-blue-600 hover:text-blue-800 font-medium">
                    View Source
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === "analysis" && (
          <div className="p-4 space-y-4">
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
            <div className="flex-1 p-4">
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">Start a conversation</p>
                <p className="text-xs text-gray-400 mt-1">Ask questions about the document</p>
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 bg-white">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Ask about this document..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      // Handle send message
                      setChatMessage("");
                    }
                  }}
                />
                <button className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SynapsePanel;