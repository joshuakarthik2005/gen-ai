'use client';

import React, { useState } from 'react';
import { AlertCircle, Loader2, CheckCircle } from 'lucide-react';
import DualDocumentUploader from '../components/DualDocumentUploader';
import ComparisonView from '../components/ComparisonView';
import ProtectedRoute from '../components/ProtectedRoute';

// Type definitions for the comparison result
interface AIAnalysis {
  summary: string;
  implication: string;
  classification: 'Beneficial' | 'Harmful' | 'Neutral';
}

interface ChangedClause {
  originalText: string;
  revisedText: string;
  aiAnalysis: AIAnalysis;
}

interface ComparisonResult {
  addedClauses: string[];
  deletedClauses: string[];
  changedClauses: ChangedClause[];
  summary: {
    totalChanges: number;
    additions: number;
    deletions: number;
    originalClauses: number;
    revisedClauses: number;
  };
}

type AppState = 'uploading' | 'loading' | 'results' | 'error';

const ComparePage: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('uploading');
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string>('');
  const [loadingProgress, setLoadingProgress] = useState<number>(0);

  // Simulate loading progress for better UX
  React.useEffect(() => {
    if (appState === 'loading') {
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          const increment = Math.random() * 15;
          const newProgress = Math.min(prev + increment, 95);
          return newProgress;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setLoadingProgress(0);
    }
  }, [appState]);

  const handleComparisonResult = (result: ComparisonResult) => {
    setLoadingProgress(100);
    setTimeout(() => {
      setComparisonResult(result);
      setAppState('results');
      setError('');
    }, 500);
  };

  const handleError = (errorMessage: string) => {
    setError(errorMessage);
    setAppState('error');
    setComparisonResult(null);
  };

  const handleLoadingChange = (isLoading: boolean) => {
    if (isLoading) {
      setAppState('loading');
      setError('');
      setLoadingProgress(10);
    }
  };

  const handleStartNew = () => {
    setAppState('uploading');
    setComparisonResult(null);
    setError('');
    setLoadingProgress(0);
  };

  const renderContent = () => {
    switch (appState) {
      case 'uploading':
        return (
          <DualDocumentUploader
            onComparisonResult={handleComparisonResult}
            onError={handleError}
            onLoadingChange={handleLoadingChange}
          />
        );

      case 'loading':
        return (
          <div className="max-w-2xl mx-auto text-center py-12">
            <div className="mb-8">
              <Loader2 className="h-16 w-16 text-blue-600 mx-auto mb-6 animate-spin" />
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Analyzing Documents
              </h2>
              <p className="text-gray-600 mb-8">
                Our AI is processing your documents and identifying meaningful differences. 
                This may take a moment...
              </p>
              
              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                <div 
                  className="bg-blue-600 h-3 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500">
                {loadingProgress < 30 && "Extracting text from documents..."}
                {loadingProgress >= 30 && loadingProgress < 60 && "Generating semantic embeddings..."}
                {loadingProgress >= 60 && loadingProgress < 90 && "Matching clauses between documents..."}
                {loadingProgress >= 90 && "Analyzing changes with AI..."}
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-3">What's happening behind the scenes?</h3>
              <div className="text-sm text-blue-800 space-y-2 text-left">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>Advanced PDF text extraction using PyMuPDF</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span>Intelligent document segmentation into clauses</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Loader2 className="h-4 w-4 text-blue-600 animate-spin flex-shrink-0" />
                  <span>Semantic similarity analysis using Vertex AI embeddings</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="h-4 w-4 border-2 border-gray-300 rounded-full flex-shrink-0"></div>
                  <span>AI-powered change analysis with Gemini Pro</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'results':
        return comparisonResult ? (
          <ComparisonView
            result={comparisonResult}
            onStartNew={handleStartNew}
          />
        ) : null;

      case 'error':
        return (
          <div className="max-w-2xl mx-auto text-center py-12">
            <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Analysis Failed
            </h2>
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
              <p className="text-red-800 mb-4">
                <strong>Error:</strong> {error}
              </p>
              <div className="text-sm text-red-700">
                <p className="mb-2"><strong>Common solutions:</strong></p>
                <ul className="text-left space-y-1">
                  <li>• Ensure both files are valid PDF documents</li>
                  <li>• Check that files are less than 10MB each</li>
                  <li>• Verify you're logged in to your account</li>
                  <li>• Try refreshing the page and uploading again</li>
                  <li>• Make sure the documents contain readable text (not just images)</li>
                </ul>
              </div>
            </div>
            
            <div className="space-x-4">
              <button
                onClick={handleStartNew}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation breadcrumb */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-2 py-4 text-sm">
              <a href="/" className="text-blue-600 hover:text-blue-800">
                Home
              </a>
              <span className="text-gray-400">/</span>
              <span className="text-gray-900 font-medium">
                Document Comparison
              </span>
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="py-8">
          {renderContent()}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-gray-200 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-2">
                Powered by Google Cloud Vertex AI and advanced natural language processing
              </p>
              <p className="text-xs text-gray-400">
                This tool provides AI-assisted analysis for informational purposes only. 
                For legal advice, please consult a qualified attorney.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </ProtectedRoute>
  );
};

export default ComparePage;