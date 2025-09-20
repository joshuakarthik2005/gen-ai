"use client";

import { useState } from "react";
import { Upload, FileText, Bot, ArrowRight, Lock } from "lucide-react";
import Header from "./components/Header";
import DocumentViewer from "./components/DocumentViewerAdobe";
import WorkspaceSidebar from "./components/WorkspaceSidebarOriginal";
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
