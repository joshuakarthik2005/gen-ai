"use client";

import { useState } from "react";
import { Upload, FileText, Bot, ArrowRight, Lock } from "lucide-react";
import Link from "next/link";
import Header from "./components/Header";
import DocumentViewer from "./components/DocumentViewerAdobe";
import WorkspaceSidebar from "./components/WorkspaceSidebarNew";
import SynapsePanel from "./components/SynapsePanel";
import AuthModal from "./components/AuthModal";
import { useAuth } from "./contexts/AuthContext";

// Local type to avoid missing module and DOM `Document` conflicts
type WorkspaceDocument = {
  id: string;
  name: string;
  url?: string;
  type?: string;
  uploadDate?: string;
  size?: number;
};

export default function Dashboard() {
  const { isAuthenticated, setShowAuthModal } = useAuth();
  const [explainedText, setExplainedText] = useState<string>("");
  const [showUploadDemo, setShowUploadDemo] = useState(true); // Default to true to show the new interface
  const [selectedDocument, setSelectedDocument] = useState({
    url: "https://www.adobe.com/support/products/enterprise/knowledgecenter/media/c4611_sample_explain.pdf",
    name: "Sample Employment Agreement"
  });
  const [ragSearchQuery, setRagSearchQuery] = useState<string>("");

  const handleExplainText = (text: string) => {
    setExplainedText(text);
    // Reset after a brief moment to allow the chat component to process it
    setTimeout(() => setExplainedText(""), 100);
  };

  const handleRagSearch = (query: string) => {
    setRagSearchQuery(query);
    // Reset after a brief moment to allow the SynapsePanel to process it
    setTimeout(() => setRagSearchQuery(""), 100);
  };

  const handleDocumentSelect = (document: WorkspaceDocument) => {
    if (document.url) {
      setSelectedDocument({
        url: document.url,
        name: document.name
      });
    }
  };

  const handleAuthRequired = (feature: string) => {
    setShowAuthModal(true);
  };

  if (showUploadDemo) {
    return (
      <div className="h-screen bg-white flex flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Auth Modal */}
        <AuthModal />

        {/* Main Three-Panel Layout */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Left Panel - Workspace Sidebar */}
          <div className="order-2 md:order-1 md:w-[20%] md:min-w-[280px] bg-gray-50 border-t md:border-t-0 md:border-r border-gray-200">
            <WorkspaceSidebar onDocumentSelect={handleDocumentSelect} />
          </div>

          {/* Center Panel - Document Viewer */}
          <div className="order-1 md:order-2 md:w-[50%] md:min-w-[400px] bg-white min-h-[40vh] md:min-h-0">
            <DocumentViewer 
              documentUrl={selectedDocument.url}
              filename={selectedDocument.name}
              onExplainText={handleExplainText}
              onRagSearch={handleRagSearch}
            />
          </div>

          {/* Right Panel - Synapse Analysis */}
          <div className="order-3 md:order-3 md:w-[30%] md:min-w-[320px] bg-gray-50 border-t md:border-t-0 md:border-l border-gray-200">
            <SynapsePanel 
              explainedText={explainedText}
              documentUrl={selectedDocument.url}
              filename={selectedDocument.name}
              ragSearchQuery={ragSearchQuery}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <Header />

      {/* Auth Modal */}
      <AuthModal />

      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <FileText className="w-10 h-10 text-white" />
          </div>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to ClarityLegal
          </h1>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Transform complex legal documents into clear, understandable insights with AI-powered analysis. 
            Upload, analyze, and get instant explanations.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            {isAuthenticated ? (
              <>
                <Link 
                  href="/upload"
                  className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center space-x-2 shadow-lg hover:shadow-xl"
                >
                  <Upload className="w-5 h-5" />
                  <span>Upload Document</span>
                </Link>
                
                <Link 
                  href="/compare"
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2 shadow-lg hover:shadow-xl"
                >
                  <ArrowRight className="w-5 h-5 rotate-90" />
                  <span>Compare Documents</span>
                </Link>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleAuthRequired('upload')}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center space-x-2 shadow-lg hover:shadow-xl relative"
                >
                  <Upload className="w-5 h-5" />
                  <span>Upload Document</span>
                  <Lock className="w-4 h-4 ml-2" />
                </button>
                
                <button
                  onClick={() => handleAuthRequired('compare')}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2 shadow-lg hover:shadow-xl relative"
                >
                  <ArrowRight className="w-5 h-5 rotate-90" />
                  <span>Compare Documents</span>
                  <Lock className="w-4 h-4 ml-2" />
                </button>
              </>
            )}
            
            <button
              onClick={() => setShowUploadDemo(true)}
              className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center space-x-2"
            >
              <span>Try Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {!isAuthenticated && (
            <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-blue-800">
                <strong>Demo Mode:</strong> You can try our analysis features with sample documents. 
                Sign in to upload your own documents and save your analysis history.
              </p>
            </div>
          )}

          {/* Features Grid */}
          <div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Easy Upload</h3>
              <p className="text-gray-600 text-sm">
                Drag & drop your PDF documents for instant processing
                {!isAuthenticated && <span className="block text-xs text-gray-500 mt-1">(Sign in required)</span>}
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Bot className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Analysis</h3>
              <p className="text-gray-600 text-sm">
                Highlight any text to get instant AI-powered explanations
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <ArrowRight className="w-6 h-6 text-purple-600 rotate-90" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Smart Comparison</h3>
              <p className="text-gray-600 text-sm">
                Compare document versions to identify meaningful changes
                {!isAuthenticated && <span className="block text-xs text-gray-500 mt-1">(Sign in required)</span>}
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-orange-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Clear Insights</h3>
              <p className="text-gray-600 text-sm">
                Complex legal terms explained in plain English
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
