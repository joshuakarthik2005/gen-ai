"use client";

import { useState } from "react";
import { 
  X, 
  ChevronLeft, 
  ChevronRight,
  Upload,
  FileText,
  Search,
  Sparkles,
  AlertCircle,
  Calendar,
  MessageSquare,
  Rocket
} from "lucide-react";

interface OnboardingTutorialProps {
  onClose: () => void;
}

export default function OnboardingTutorial({ onClose }: OnboardingTutorialProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      icon: <Rocket className="w-12 h-12 text-blue-600" />,
      title: "Welcome to Legal Document Analyzer",
      description: "Your AI-powered legal document assistant that helps you understand contracts, identify risks, and find related information instantly.",
      features: [
        "AI-powered document analysis",
        "Smart risk detection",
        "Cross-document search",
        "Obligation timeline extraction",
        "Interactive PDF viewer"
      ],
      image: "🏛️"
    },
    {
      icon: <Upload className="w-12 h-12 text-blue-600" />,
      title: "Upload Your Documents",
      description: "Start by uploading your PDF documents to the workspace. You can drag and drop files or click to browse.",
      features: [
        "Support for multiple PDF files",
        "Automatic text extraction",
        "Instant document indexing",
        "Secure cloud storage",
        "Quick document access"
      ],
      image: "📄",
      tip: "Look for the document list in the left sidebar to see all your uploaded files"
    },
    {
      icon: <FileText className="w-12 h-12 text-blue-600" />,
      title: "View & Navigate PDFs",
      description: "Use the powerful Adobe PDF viewer in the center panel to read and interact with your documents.",
      features: [
        "High-quality PDF rendering",
        "Zoom and page navigation",
        "Text selection and highlighting",
        "Search within document",
        "Bookmark important pages"
      ],
      image: "👁️",
      tip: "Click on any document in the sidebar to view it in the center panel"
    },
    {
      icon: <Search className="w-12 h-12 text-blue-600" />,
      title: "Select Text for Instant Insights",
      description: "Highlight any text in your document to instantly get AI explanations and find related snippets across all your documents.",
      features: [
        "Real-time text analysis",
        "Cross-document semantic search",
        "Automatic snippet extraction",
        "Relevance scoring",
        "Click-to-navigate to source"
      ],
      image: "🔍",
      tip: "Related snippets appear in the Synapse panel on the right. Click any snippet to jump to its location!"
    },
    {
      icon: <Sparkles className="w-12 h-12 text-blue-600" />,
      title: "Generate Document Summaries",
      description: "Click the 'Summarize' button in the Synapse panel to get an AI-generated layman's summary of your entire document.",
      features: [
        "Plain language explanations",
        "Key points extraction",
        "Section-by-section breakdown",
        "Markdown formatting",
        "Easy to understand structure"
      ],
      image: "✨",
      tip: "Summaries are saved and will reappear when you click Summarize again"
    },
    {
      icon: <AlertCircle className="w-12 h-12 text-red-600" />,
      title: "Identify Risks Automatically",
      description: "The Risks tab automatically scans your document for potential legal risks, penalties, and problematic clauses.",
      features: [
        "AI-powered risk detection",
        "Severity classification (Critical/High/Medium/Low)",
        "Contextual explanations",
        "Impact assessment",
        "Mitigation suggestions"
      ],
      image: "⚠️",
      tip: "Click on any risk snippet to locate it in the source PDF"
    },
    {
      icon: <Calendar className="w-12 h-12 text-green-600" />,
      title: "Extract Obligations & Deadlines",
      description: "Click the 'Timeline' button to automatically extract all obligations, deadlines, and responsibilities from your contract.",
      features: [
        "Automatic deadline extraction",
        "Timeline visualization",
        "Priority classification",
        "Responsible party identification",
        "Export to Google Calendar or ICS"
      ],
      image: "📅",
      tip: "Switch between Timeline View and List View to see obligations in different formats"
    },
    {
      icon: <MessageSquare className="w-12 h-12 text-purple-600" />,
      title: "Chat with Your Documents",
      description: "Use the Chat tab to ask questions about your documents and get instant AI-powered answers.",
      features: [
        "Natural language queries",
        "Context-aware responses",
        "Citation of sources",
        "Multi-document knowledge",
        "Conversation history"
      ],
      image: "💬",
      tip: "Try asking: 'What are the payment terms?' or 'Who is responsible for maintenance?'"
    },
    {
      icon: <Rocket className="w-12 h-12 text-blue-600" />,
      title: "You're Ready to Go!",
      description: "You now know how to use all the powerful features of the Legal Document Analyzer. Start exploring your documents!",
      features: [
        "Upload documents from the sidebar",
        "Select text for instant analysis",
        "Use Summarize for quick overview",
        "Check Risks tab for potential issues",
        "Extract obligations with Timeline",
        "Ask questions in Chat"
      ],
      image: "🎉",
      tip: "Press Ctrl+K anytime to access quick actions and shortcuts"
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const handlePrevious = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleFinish = () => {
    localStorage.setItem('onboarding_completed', 'true');
    onClose();
  };

  const slide = slides[currentSlide];
  const isLastSlide = currentSlide === slides.length - 1;
  const isFirstSlide = currentSlide === 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Welcome to Legal Document Analyzer</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Close tutorial"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-sm font-medium text-gray-600">
              {currentSlide + 1} OF {slides.length}
            </span>
          </div>
          <div className="flex gap-2 justify-center mb-4">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentSlide
                    ? "w-8 bg-blue-600"
                    : index < currentSlide
                    ? "w-2 bg-green-500"
                    : "w-2 bg-gray-300"
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="max-w-6xl mx-auto">
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Side - Visual/Screenshot */}
              <div className="flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 border border-gray-200">
                <div className="mb-4 p-4 bg-white rounded-2xl shadow-md">
                  {slide.icon}
                </div>
                <div className="text-8xl mb-6">{slide.image}</div>
                <h3 className="text-2xl font-bold text-gray-900 text-center">{slide.title}</h3>
              </div>

              {/* Right Side - Content */}
              <div className="flex flex-col justify-center space-y-6">
                {/* Description */}
                <div>
                  <p className="text-base text-gray-700 leading-relaxed">
                    {slide.description}
                  </p>
                </div>

                {/* Features */}
                <div>
                  <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    KEY FEATURES
                  </h4>
                  <ul className="space-y-2">
                    {slide.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                        <span className="text-sm text-gray-700 leading-relaxed">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tip */}
                {slide.tip && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-l-4 border-amber-500 rounded-r-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
                          <span className="text-white text-sm font-bold">💡</span>
                        </div>
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-amber-900 mb-1 uppercase tracking-wide">PRO TIP</h5>
                        <p className="text-sm text-amber-800">{slide.tip}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="border-t border-gray-200 p-6 bg-gray-50">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            <button
              onClick={handlePrevious}
              disabled={isFirstSlide}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                isFirstSlide
                  ? "text-gray-400 cursor-not-allowed"
                  : "text-gray-700 hover:bg-gray-200"
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>

            {isLastSlide ? (
              <button
                onClick={handleFinish}
                className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl"
              >
                Get Started
                <Rocket className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg"
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Skip button */}
          {!isLastSlide && (
            <div className="text-center mt-4">
              <button
                onClick={handleFinish}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Skip tutorial
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
