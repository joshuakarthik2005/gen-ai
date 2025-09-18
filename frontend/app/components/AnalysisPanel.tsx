"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@radix-ui/react-accordion";
import { AlertTriangle, FileText, BookOpen, Search, ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";

interface DefinedTerm {
  term: string;
  definition: string;
}

interface KeyClause {
  id: string;
  title: string;
  riskLevel: 'high' | 'medium' | 'low';
  explanation: string;
  content: string;
}

interface LaymanSummary {
  title: string;
  summary: string;
  key_points: string[];
}

interface AnalysisPanelProps {
  documentAnalysis?: any;
  isLoading?: boolean;
  filename?: string;
  laymanSummary?: LaymanSummary | null;
}

export default function AnalysisPanel({ documentAnalysis, isLoading = false, filename, laymanSummary }: AnalysisPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");

  // Use provided analysis data or fallback to sample data
  const executiveSummary = documentAnalysis?.executiveSummary || 
    `This document "${filename || 'your document'}" has been successfully uploaded and is ready for analysis. The AI analysis will provide insights into key clauses, risks, and important terms to help you understand the legal implications. You can highlight any text in the document to get instant explanations.`;

  const keyClauses: KeyClause[] = documentAnalysis?.keyClauses || [
    {
      id: "general-terms",
      title: "General Terms",
      riskLevel: "low",
      explanation: "This section contains standard legal language. Generally low risk but important to understand.",
      content: "Standard terms that govern the overall agreement..."
    },
    {
      id: "obligations",
      title: "Party Obligations", 
      riskLevel: "medium",
      explanation: "This outlines what each party must do under the agreement. Pay attention to your specific responsibilities.",
      content: "Obligations and duties of each party..."
    },
    {
      id: "termination",
      title: "Termination Clauses",
      riskLevel: "high", 
      explanation: "These clauses define how and when the agreement can be ended. Important to understand notice requirements and consequences.",
      content: "Conditions under which the agreement may be terminated..."
    }
  ];

  const definedTerms: DefinedTerm[] = documentAnalysis?.definedTerms || [
    { term: "Agreement", definition: "This legal document and all its terms and conditions" },
    { term: "Party", definition: "Any individual or entity that has signed or is bound by this agreement" },
    { term: "Effective Date", definition: "The date when this agreement officially begins" },
    { term: "Notice", definition: "Official communication that must be provided as specified in the agreement" }
  ];

  const filteredTerms = definedTerms.filter(term =>
    term.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
    term.definition.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'medium':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'low':
        return <AlertTriangle className="w-4 h-4 text-green-500" />;
      default:
        return null;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high':
        return 'border-l-red-500 bg-red-50';
      case 'medium':
        return 'border-l-orange-500 bg-orange-50';
      case 'low':
        return 'border-l-green-500 bg-green-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      {/* Loading State */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-primary-blue animate-spin mx-auto mb-4" />
            <p className="text-body text-gray-600">Analyzing document...</p>
            <p className="text-body-small text-gray-400 mt-1">This may take a few moments</p>
          </div>
        </div>
      ) : (
        /* Scrollable Content */
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Layman Summary (from Gemini summarize) */}
            {laymanSummary && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-indigo-600 rounded-lg">
                      <BookOpen className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-800">Layman Summary</h2>
                  </div>
                  <div className="text-xs text-gray-500">{laymanSummary.title}</div>
                </div>
                <p className="text-sm leading-relaxed text-gray-700 mb-3">{laymanSummary.summary}</p>
                {Array.isArray(laymanSummary.key_points) && laymanSummary.key_points.length > 0 && (
                  <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
                    {laymanSummary.key_points.map((pt, idx) => (
                      <li key={idx}>{pt}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Executive Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center space-x-2 mb-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-gray-800">Executive Summary</h2>
              </div>
              <p className="text-sm leading-relaxed text-gray-700">
                {executiveSummary}
              </p>
            </div>

            {/* Key Clauses & Risks */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
                <div className="flex items-center space-x-2">
                  <div className="p-2 bg-orange-500 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-800">Key Clauses & Risks</h2>
                </div>
              </div>

              <Accordion type="single" collapsible className="w-full">
                {keyClauses.map((clause) => (
                  <AccordionItem 
                    key={clause.id} 
                    value={clause.id}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <AccordionTrigger className="flex items-center justify-between w-full p-4 text-left hover:bg-gray-50 transition-colors group">
                      <div className="flex items-center space-x-3">
                        {getRiskIcon(clause.riskLevel)}
                        <span className="text-base font-medium group-hover:text-blue-600 transition-colors">{clause.title}</span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-gray-500 transition-transform duration-200 group-hover:text-blue-600" />
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className={`border-l-4 pl-4 py-3 rounded-r-lg ${getRiskColor(clause.riskLevel)}`}>
                        <p className="text-sm mb-3 text-gray-700 leading-relaxed">
                          {clause.explanation}
                        </p>
                        <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                          <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Original Clause</div>
                          <p className="text-xs italic text-gray-600 leading-relaxed">
                            "{clause.content}"
                          </p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            {/* Defined Terms */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-800">Defined Terms</h2>
                </div>
                
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search terms..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-colors"
                  />
                </div>
              </div>

              <div className="p-4">
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {filteredTerms.map((term) => (
                    <div key={term.term} className="border-b border-gray-100 last:border-b-0 pb-3 last:pb-0">
                      <div className="font-medium text-blue-600 text-sm hover:text-blue-800 transition-colors cursor-pointer">
                        {term.term}
                      </div>
                      <div className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {term.definition}
                      </div>
                    </div>
                  ))}
                  
                  {filteredTerms.length === 0 && (
                    <div className="text-center text-gray-500 text-sm py-6">
                      <Search className="w-6 h-6 text-gray-300 mx-auto mb-2" />
                      <p>No terms found matching "{searchTerm}"</p>
                      <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}