"use client";

import { useState, useEffect } from "react";
import { Upload, FileText, Bot, ArrowRight, Lock } from "lucide-react";
import Header from "./components/Header";
import DocumentViewer from "./components/DocumentViewerAdobe";
import WorkspaceSidebar from "./components/WorkspaceSidebarOriginal";
import SynapsePanel from "./components/SynapsePanel";
import AuthModal from "./components/AuthModal";
import OnboardingTutorial from "./components/OnboardingTutorial";
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
  const [selectedDocument, setSelectedDocument] = useState({
    url: "https://www.adobe.com/support/products/enterprise/knowledgecenter/media/c4611_sample_explain.pdf",
    name: "Sample Employment Agreement"
  });
  const [ragSearchQuery, setRagSearchQuery] = useState<string>("");
  const [pdfSearchFunction, setPdfSearchFunction] = useState<((text: string) => void) | null>(null);
  const [pendingSearchText, setPendingSearchText] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if user has completed onboarding
  useEffect(() => {
    const hasCompletedOnboarding = localStorage.getItem('onboarding_completed');
    if (!hasCompletedOnboarding) {
      // Show onboarding after a short delay
      setTimeout(() => setShowOnboarding(true), 1000);
    }
  }, []);

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

  const handleViewerReady = (searchFn: (text: string) => void) => {
    console.log('📄 Viewer ready. Setting search function.');
    setPdfSearchFunction(() => searchFn);
    
    // If there's a pending search from document switch, execute it now
    if (pendingSearchText) {
      console.log('🔎 Executing pending search for:', pendingSearchText.substring(0, 50) + '...');
      setTimeout(() => {
        searchFn(pendingSearchText);
        setPendingSearchText(null);
      }, 500); // Small delay to ensure viewer is fully initialized
    }
  };

  const handleDocumentSelect = (document: WorkspaceDocument) => {
    if (document.url) {
      setSelectedDocument({
        url: document.url,
        name: document.name
      });
    }
  };

  const handleSwitchDocument = (url: string, name: string, searchText?: string) => {
    console.log('🔄 Switching document to:', name, searchText ? 'with pending search' : '');
    setSelectedDocument({ url, name });
    // Reset search function since we're loading a new document
    setPdfSearchFunction(null);
    // Store search text to execute after new viewer is ready
    if (searchText) {
      setPendingSearchText(searchText);
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* Header */}
      <Header onShowTutorial={() => setShowOnboarding(true)} />

      {/* Auth Modal */}
      <AuthModal />

      {/* Onboarding Tutorial */}
      {showOnboarding && (
        <OnboardingTutorial onClose={() => setShowOnboarding(false)} />
      )}

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
            onViewerReady={handleViewerReady}
          />
        </div>

        {/* Right Panel - Synapse Analysis */}
        <div className="order-3 md:order-3 md:w-[30%] md:min-w-[320px] bg-gray-50 border-t md:border-t-0 md:border-l border-gray-200">
          <SynapsePanel 
            explainedText={explainedText}
            documentUrl={selectedDocument.url}
            filename={selectedDocument.name}
            ragSearchQuery={ragSearchQuery}
            onSearchInPDF={pdfSearchFunction || undefined}
            onSwitchDocument={handleSwitchDocument}
          />
        </div>
      </div>
    </div>
  );
}