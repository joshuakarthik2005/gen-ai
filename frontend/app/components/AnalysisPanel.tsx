"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@radix-ui/react-accordion";
import { AlertTriangle, FileText, BookOpen, Search, ChevronDown } from "lucide-react";
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

export default function AnalysisPanel() {
  const [searchTerm, setSearchTerm] = useState("");

  // Sample analysis data
  const executiveSummary = "This employment agreement establishes a standard employment relationship between TechCorp Inc. and Sarah Chen for a Senior Software Engineer position. The contract includes typical provisions for compensation ($120,000 annually), benefits, confidentiality obligations, and a 12-month non-compete clause within 50 miles. Key areas of concern include the broad non-compete restrictions and immediate termination provisions that could impact future employment opportunities.";

  const keyClauses: KeyClause[] = [
    {
      id: "non-compete",
      title: "Non-Compete Clause",
      riskLevel: "high",
      explanation: "This clause restricts your ability to work for competitors for 12 months within 50 miles after leaving. This could significantly limit your career options and may not be enforceable in all states.",
      content: "During employment and for a period of twelve (12) months following termination of employment for any reason, Employee agrees not to directly or indirectly compete with Company's business within a radius of fifty (50) miles from Company's principal place of business."
    },
    {
      id: "termination",
      title: "Termination Provisions",
      riskLevel: "medium",
      explanation: "The company can terminate your employment immediately 'for cause' which is broadly defined. This gives them significant discretion and could result in sudden job loss without notice.",
      content: "Either party may terminate this Agreement at any time, with or without cause, upon thirty (30) days' written notice to the other party. Company may terminate Employee's employment immediately for cause..."
    },
    {
      id: "confidentiality",
      title: "Confidentiality Obligations",
      riskLevel: "low",
      explanation: "Standard confidentiality clause that protects company information. This is reasonable and typical for most employment agreements, but be aware it continues after employment ends.",
      content: "Employee agrees to maintain the confidentiality of such information and not to disclose it to any third party without Company's written consent."
    }
  ];

  const definedTerms: DefinedTerm[] = [
    { term: "Agreement", definition: "This Employment Agreement document" },
    { term: "Company", definition: "TechCorp Inc., a Delaware corporation" },
    { term: "Employee", definition: "Sarah Chen, the individual being employed" },
    { term: "Confidential Information", definition: "Any proprietary, non-public business information belonging to the Company" },
    { term: "Cause", definition: "Misconduct, breach of agreement, or violation of company policies" },
    { term: "Competing Business", definition: "Any business that directly competes with the Company's core services" }
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
    <div className="h-full flex flex-col bg-white border border-gray-200 rounded-lg shadow-card overflow-hidden">
      {/* Panel Header */}
      <div className="flex-shrink-0 border-b border-gray-200 px-6 py-4 bg-gray-50">
        <h1 className="text-heading-3 text-primary font-bold">AI Analysis</h1>
        <p className="text-body-small text-gray-500 mt-1">Smart insights from your legal document</p>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Executive Summary */}
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-card transition-shadow">
            <div className="flex items-center space-x-2 mb-4">
              <div className="p-2 bg-primary-blue/10 rounded-lg">
                <FileText className="w-5 h-5 text-primary-blue" />
              </div>
              <h2 className="text-heading-3">Executive Summary</h2>
            </div>
            <p className="text-body leading-relaxed text-gray-700">
              {executiveSummary}
            </p>
          </div>

          {/* Key Clauses & Risks */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-card transition-shadow overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <h2 className="text-heading-3">Key Clauses & Risks</h2>
              </div>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {keyClauses.map((clause, index) => (
                <AccordionItem 
                  key={clause.id} 
                  value={clause.id}
                  className="border-b border-gray-100 last:border-b-0"
                >
                  <AccordionTrigger className="flex items-center justify-between w-full p-6 text-left hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center space-x-3">
                      {getRiskIcon(clause.riskLevel)}
                      <span className="text-heading-4 group-hover:text-primary-blue transition-colors">{clause.title}</span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-500 transition-transform duration-200 group-hover:text-primary-blue" />
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-6">
                    <div className={`border-l-4 pl-4 py-4 rounded-r-lg ${getRiskColor(clause.riskLevel)}`}>
                      <p className="text-body mb-4 text-gray-700 leading-relaxed">
                        {clause.explanation}
                      </p>
                      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                        <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Original Clause</div>
                        <p className="text-body-small italic text-gray-600 leading-relaxed">
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
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-card transition-shadow">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-2 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>
                <h2 className="text-heading-3">Defined Terms</h2>
              </div>
              
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search terms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent text-body transition-colors"
                />
              </div>
            </div>

            <div className="p-6">
              <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                {filteredTerms.map((term, index) => (
                  <div key={term.term} className="border-b border-gray-100 last:border-b-0 pb-4 last:pb-0">
                    <div className="font-medium text-primary-blue text-body hover:text-primary transition-colors cursor-pointer">
                      {term.term}
                    </div>
                    <div className="text-body-small text-gray-600 mt-1 leading-relaxed">
                      {term.definition}
                    </div>
                  </div>
                ))}
                
                {filteredTerms.length === 0 && (
                  <div className="text-center text-gray-500 text-body-small py-8">
                    <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                    <p>No terms found matching "{searchTerm}"</p>
                    <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}