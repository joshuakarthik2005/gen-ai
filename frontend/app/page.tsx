"use client";

import { useState } from "react";
import { Upload, FileText, Bot, ArrowRight } from "lucide-react";
import Link from "next/link";
import Header from "./components/Header";
import DocumentDashboard from "./components/DocumentDashboard";

export default function Dashboard() {
  const [showDashboard, setShowDashboard] = useState(true); // Show dashboard by default

  // If showing dashboard, render the three-column layout
  if (showDashboard) {
    return (
      <DocumentDashboard
        documentUrl="https://www.adobe.com/support/products/enterprise/knowledgecenter/media/c4611_sample_explain.pdf"
        filename="Sample Employment Agreement"
      />
    );
  }

  // Landing page (if user chooses to go back)
  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <Header />

      {/* Hero Section */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-primary-blue to-accent rounded-full flex items-center justify-center mx-auto mb-6">
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
            <Link 
              href="/upload"
              className="bg-accent text-white px-8 py-3 rounded-lg font-medium hover:bg-accent/90 transition-colors flex items-center space-x-2 shadow-lg hover:shadow-xl"
            >
              <Upload className="w-5 h-5" />
              <span>Upload Document</span>
            </Link>
            
            <button
              onClick={() => setShowDashboard(true)}
              className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center space-x-2"
            >
              <span>View Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Easy Upload</h3>
              <p className="text-gray-600 text-sm">
                Drag & drop your PDF documents for instant processing
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
                <FileText className="w-6 h-6 text-purple-600" />
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
