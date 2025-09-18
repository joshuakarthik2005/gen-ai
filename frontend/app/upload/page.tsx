"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Bot, FileText, Sparkles } from "lucide-react";
import DocumentUploader from "../components/DocumentUploader";
import DocumentViewer from "../components/DocumentViewerNew";
import { BASE_URL } from "../config/api";

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
                <div className="w-8 h-8 bg-gradient-to-br from-primary-blue to-accent rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-primary">ClarityLegal</h1>
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
              <div className="w-20 h-20 bg-gradient-to-br from-primary-blue to-accent rounded-full flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Analyze Your Legal Documents with AI
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Upload a PDF document and get instant explanations for any text you highlight. 
                Our AI helps you understand complex legal language in plain English.
              </p>
            </div>
            <DocumentUploader onUploadSuccess={handleUploadSuccess} />
          </div>
        ) : (
          /* Document Analysis State */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-200px)]">
            {/* Document Viewer */}
            <div className="lg:col-span-2">
              <DocumentViewer
                documentUrl={documentUrl}
                filename={filename}
                onTextSelection={handleTextSelection}
              />
            </div>

            {/* Explanation Panel */}
            <div className="lg:col-span-1">
              <div className="h-full bg-white border border-gray-200 rounded-lg shadow-card overflow-hidden">
                {/* Panel Header */}
                <div className="border-b border-gray-200 p-4 bg-gray-50">
                  <div className="flex items-center space-x-2">
                    <Bot className="w-5 h-5 text-accent" />
                    <h3 className="text-lg font-semibold text-gray-900">AI Explanation</h3>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Highlight text in the document to get explanations
                  </p>
                </div>

                {/* Current Explanation */}
                <div className="p-4 border-b border-gray-100">
                  {!selectedText && !explanation ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Sparkles className="w-6 h-6 text-accent" />
                      </div>
                      <p className="text-sm text-gray-500">
                        Select any text in the document to get started
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedText && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-xs font-medium text-blue-700 mb-1">Selected Text:</p>
                          <p className="text-sm text-blue-900 italic">
                            "{selectedText.length > 200 ? selectedText.substring(0, 200) + "..." : selectedText}"
                          </p>
                        </div>
                      )}
                      
                      {isLoadingExplanation ? (
                        <div className="flex items-center space-x-2 text-accent">
                          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm">Analyzing text...</span>
                        </div>
                      ) : explanation && (
                        <div className="prose prose-sm max-w-none">
                          <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                            {explanation}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Explanation History */}
                {explanationHistory.length > 0 && (
                  <div className="flex-1 overflow-y-auto">
                    <div className="p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Previous Explanations</h4>
                      <div className="space-y-3">
                        {explanationHistory.slice().reverse().map((item, index) => (
                          <div key={index} className="border border-gray-200 rounded-lg p-3 text-sm">
                            <p className="text-gray-600 italic mb-2 line-clamp-2">
                              "{item.text.substring(0, 100)}..."
                            </p>
                            <p className="text-gray-700 text-xs line-clamp-3">
                              {item.explanation.substring(0, 150)}...
                            </p>
                            <p className="text-xs text-gray-400 mt-2">
                              {item.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}