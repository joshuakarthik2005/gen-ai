"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Bot, FileText, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import DocumentUploader from "./components/DocumentUploader";
import DocumentViewer from "./components/DocumentViewerNew";
import { BASE_URL } from "./config/api";

export default function DocumentAnalysisPage() {
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [selectedText, setSelectedText] = useState<string>("");
  const [explanation, setExplanation] = useState<string>("");
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationHistory, setExplanationHistory] = useState<Array<{
    text: string;
    explanation: string;
    timestamp: Date;
  }>>([]);

  // Handle successful document upload
  const handleUploadSuccess = (signedUrl: string, uploadedFilename: string) => {
    setDocumentUrl(signedUrl);
    setFilename(uploadedFilename);
    setSelectedText("");
    setExplanation("");
    setExplanationHistory([]);
  };

  // Handle text selection from document viewer
  const handleTextSelection = (text: string) => {
    setSelectedText(text);
  };

  // Reset to upload state
  const handleBackToUpload = () => {
    setDocumentUrl(null);
    setFilename("");
    setSelectedText("");
    setExplanation("");
    setExplanationHistory([]);
  };

  // Fetch explanation when text is selected
  useEffect(() => {
    if (selectedText && documentUrl) {
      setIsLoadingExplanation(true);
      
      const fetchExplanation = async () => {
        try {
          const response = await fetch(`${BASE_URL}/explain-selection`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              selected_text: selectedText,
              document_url: documentUrl
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to get explanation');
          }

          const data = await response.json();
          setExplanation(data.explanation);
          
          // Add to history
          setExplanationHistory(prev => [...prev, {
            text: selectedText,
            explanation: data.explanation,
            timestamp: new Date()
          }]);

        } catch (error) {
          console.error('Explanation error:', error);
          setExplanation(`Sorry, I couldn't provide an explanation for this text. Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
          setIsLoadingExplanation(false);
        }
      };

      fetchExplanation();
    }
  }, [selectedText, documentUrl]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {documentUrl && (
                <button
                  onClick={handleBackToUpload}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Back to upload"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Legal Document Demystifier</h1>
                  <p className="text-sm text-gray-500">AI-Powered Document Analysis</p>
                </div>
              </div>
            </div>
            
            {filename && (
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{filename}</p>
                <p className="text-xs text-gray-500">Document loaded</p>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {!documentUrl ? (
          /* Upload State */
          <div className="text-center">
            <div className="mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Analyze Your Legal Documents with AI
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
                Upload a PDF document and get instant explanations for any text you highlight. 
                Our AI helps you understand complex legal language in plain English.
              </p>
            </div>
            <DocumentUploader onUploadSuccess={handleUploadSuccess} />
          </div>
        ) : (
          /* Document Analysis State - Three Column Layout */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-200px)]">
            {/* Document Viewer - Left Column (28% equivalent in 3-column grid) */}
            <div className="lg:col-span-1">
              <DocumentViewer
                documentUrl={documentUrl}
                filename={filename}
                onTextSelection={handleTextSelection}
              />
            </div>

            {/* AI Analysis Panel - Center Column (47% equivalent in 3-column grid) */}
            <div className="lg:col-span-1">
              <div className="h-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                {/* Panel Header */}
                <div className="border-b border-gray-200 p-4 bg-gradient-to-r from-blue-50 to-purple-50">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-semibold text-gray-900">AI Analysis</h3>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Highlight text in the document to get explanations
                  </p>
                </div>

                {/* Current Explanation */}
                <div className="p-6 border-b border-gray-100">
                  {!selectedText && !explanation ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Sparkles className="w-8 h-8 text-blue-600" />
                      </div>
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Ready to Analyze</h4>
                      <p className="text-sm text-gray-500">
                        Select any text in the document to get AI-powered explanations
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {selectedText && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                          <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">Selected Text:</p>
                          <p className="text-sm text-blue-900 italic">
                            "{selectedText.length > 200 ? selectedText.substring(0, 200) + "..." : selectedText}"
                          </p>
                        </div>
                      )}
                      
                      {isLoadingExplanation ? (
                        <div className="flex items-center justify-center space-x-3 py-8">
                          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-blue-600 font-medium">Analyzing with AI...</span>
                        </div>
                      ) : explanation && (
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">AI Explanation:</p>
                          <div className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                            {explanation}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Explanation History */}
                <div className="p-6">
                  <h4 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Recent Explanations</h4>
                  {explanationHistory.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">No explanations yet</p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {explanationHistory.slice(-5).reverse().map((item, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors">
                          <p className="text-xs text-gray-500 mb-1">
                            {item.timestamp.toLocaleTimeString()}
                          </p>
                          <p className="text-xs text-blue-700 mb-2 italic">
                            "{item.text.substring(0, 100)}{item.text.length > 100 ? "..." : ""}"
                          </p>
                          <p className="text-sm text-gray-800">
                            {item.explanation.substring(0, 150)}{item.explanation.length > 150 ? "..." : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Chat Interface - Right Column (25% equivalent in 3-column grid) */}
            <div className="lg:col-span-1">
              <div className="h-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                <div className="border-b border-gray-200 p-4 bg-gradient-to-r from-purple-50 to-pink-50">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-5 h-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-gray-900">Document Chat</h3>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    Ask questions about the document
                  </p>
                </div>
                
                <div className="p-6 text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Bot className="w-8 h-8 text-purple-600" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Chat Coming Soon</h4>
                  <p className="text-sm text-gray-500">
                    Interactive chat with your document will be available soon
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
