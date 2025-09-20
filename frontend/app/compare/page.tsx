"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, FileText, Lock, Zap, AlertCircle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import AuthModal from "../components/AuthModal";
import DualDocumentUploader from "../components/DualDocumentUploader";
import ComparisonView from "../components/ComparisonView";
import Link from "next/link";

export default function ComparePage() {
  const { isAuthenticated, setShowAuthModal } = useAuth();
  const [documents, setDocuments] = useState<{
    original: { url: string; filename: string } | null;
    modified: { url: string; filename: string } | null;
  }>({
    original: null,
    modified: null
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
    }
  }, [isAuthenticated, setShowAuthModal]);

  const handleDocumentsUploaded = (originalDoc: { url: string; filename: string }, modifiedDoc: { url: string; filename: string }) => {
    setDocuments({
      original: originalDoc,
      modified: modifiedDoc
    });
  };

  const handleBackToUpload = () => {
    setDocuments({
      original: null,
      modified: null
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Auth Modal */}
      <AuthModal />

      {/* Authentication Required Screen */}
      {!isAuthenticated ? (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="max-w-md mx-auto text-center p-8">
            <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-gray-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Sign In Required
            </h2>
            <p className="text-gray-600 mb-6">
              Please sign in to compare documents. This feature requires authentication to securely process and analyze your files.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setShowAuthModal(true)}
                className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
              >
                Sign In / Register
              </button>
              <Link 
                href="/"
                className="w-full border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors inline-block"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <header className="bg-white border-b border-gray-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {(documents.original && documents.modified) && (
                    <button
                      onClick={handleBackToUpload}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Back to upload"
                    >
                      <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                  )}
                  <Link href="/" className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">ClarityLegal</h1>
                      <p className="text-sm text-gray-500">Document Comparison</p>
                    </div>
                  </Link>
                </div>
                
                {documents.original && documents.modified && (
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">
                      {documents.original.filename} vs {documents.modified.filename}
                    </p>
                    <p className="text-xs text-gray-500">Documents loaded</p>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-6 py-8">
            {!(documents.original && documents.modified) ? (
              /* Upload State */
              <div className="text-center">
                <div className="mb-8">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Zap className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    Compare Legal Documents with AI
                  </h2>
                  <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
                    Upload two versions of a document to see what changed. Our AI identifies 
                    meaningful differences and explains their impact in plain English.
                  </p>
                  
                  {/* Feature highlights */}
                  <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto mb-8">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Zap className="w-4 h-4 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-blue-900 mb-1">Smart Detection</h3>
                      <p className="text-sm text-blue-700">AI identifies semantic changes, not just text differences</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <AlertCircle className="w-4 h-4 text-green-600" />
                      </div>
                      <h3 className="font-semibold text-green-900 mb-1">Impact Analysis</h3>
                      <p className="text-sm text-green-700">Understand the legal implications of each change</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                        <FileText className="w-4 h-4 text-purple-600" />
                      </div>
                      <h3 className="font-semibold text-purple-900 mb-1">Side-by-side View</h3>
                      <p className="text-sm text-purple-700">Compare documents visually with highlighted changes</p>
                    </div>
                  </div>
                </div>
                
                <DualDocumentUploader onDocumentsUploaded={handleDocumentsUploaded} />
              </div>
            ) : (
              /* Comparison State */
              <ComparisonView
                originalDocument={documents.original}
                modifiedDocument={documents.modified}
              />
            )}
          </main>
        </>
      )}
    </div>
  );
}