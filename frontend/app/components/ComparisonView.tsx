'use client';

import React, { useState } from 'react';
import { 
  CheckCircle, 
  AlertTriangle, 
  MinusCircle, 
  PlusCircle, 
  Trash2, 
  FileText,
  ChevronDown,
  ChevronUp,
  BarChart3,
  ArrowLeft
} from 'lucide-react';

// Type definitions for the API response
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

interface ComparisonViewProps {
  result: ComparisonResult;
  onStartNew: () => void;
}

const ComparisonView: React.FC<ComparisonViewProps> = ({ result, onStartNew }) => {
  const [expandedChanges, setExpandedChanges] = useState<Set<number>>(new Set());
  const [showAllAdded, setShowAllAdded] = useState(false);
  const [showAllDeleted, setShowAllDeleted] = useState(false);

  const toggleChangeExpansion = (index: number) => {
    const newExpanded = new Set(expandedChanges);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedChanges(newExpanded);
  };

  const getClassificationIcon = (classification: string) => {
    switch (classification) {
      case 'Beneficial':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'Harmful':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'Neutral':
        return <MinusCircle className="h-5 w-5 text-gray-600" />;
      default:
        return <MinusCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'Beneficial':
        return 'border-green-200 bg-green-50';
      case 'Harmful':
        return 'border-red-200 bg-red-50';
      case 'Neutral':
        return 'border-gray-200 bg-gray-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  const truncateText = (text: string, maxLength: number = 150) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const summaryStats = [
    { label: 'Changed Clauses', value: result.summary.totalChanges, color: 'blue' },
    { label: 'Added Clauses', value: result.summary.additions, color: 'green' },
    { label: 'Deleted Clauses', value: result.summary.deletions, color: 'red' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Document Comparison Results
          </h1>
          <p className="text-gray-600">
            AI-powered analysis of changes between your documents
          </p>
        </div>
        
        <button
          onClick={onStartNew}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          New Comparison
        </button>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {summaryStats.map((stat) => (
          <div key={stat.label} className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center">
              <BarChart3 className={`h-8 w-8 text-${stat.color}-600 mr-3`} />
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Document Overview */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
        <h3 className="font-semibold text-blue-900 mb-2">Document Overview</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-blue-700">Original Document: </span>
            <span className="font-medium">{result.summary.originalClauses} clauses</span>
          </div>
          <div>
            <span className="text-blue-700">Revised Document: </span>
            <span className="font-medium">{result.summary.revisedClauses} clauses</span>
          </div>
        </div>
      </div>

      {/* Changed Clauses Section */}
      {result.changedClauses.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
            <FileText className="h-6 w-6 mr-2" />
            Changed Clauses ({result.changedClauses.length})
          </h2>
          
          <div className="space-y-6">
            {result.changedClauses.map((change, index) => (
              <div
                key={index}
                className={`border rounded-lg ${getClassificationColor(change.aiAnalysis.classification)}`}
              >
                {/* Change Header */}
                <div 
                  className="p-4 cursor-pointer"
                  onClick={() => toggleChangeExpansion(index)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {getClassificationIcon(change.aiAnalysis.classification)}
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          Change #{index + 1} - {change.aiAnalysis.classification}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {change.aiAnalysis.summary}
                        </p>
                      </div>
                    </div>
                    
                    {expandedChanges.has(index) ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedChanges.has(index) && (
                  <div className="border-t bg-white p-6">
                    {/* AI Analysis */}
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h4 className="font-semibold text-blue-900 mb-2">AI Analysis</h4>
                      <p className="text-blue-800 mb-3">
                        <strong>Summary:</strong> {change.aiAnalysis.summary}
                      </p>
                      <p className="text-blue-800">
                        <strong>Practical Implication:</strong> {change.aiAnalysis.implication}
                      </p>
                    </div>

                    {/* Text Comparison */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Original Text */}
                      <div>
                        <h4 className="font-semibold text-red-700 mb-2 flex items-center">
                          <MinusCircle className="h-4 w-4 mr-1" />
                          Original Text
                        </h4>
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {change.originalText}
                          </p>
                        </div>
                      </div>

                      {/* Revised Text */}
                      <div>
                        <h4 className="font-semibold text-green-700 mb-2 flex items-center">
                          <PlusCircle className="h-4 w-4 mr-1" />
                          Revised Text
                        </h4>
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {change.revisedText}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Added Clauses Section */}
      {result.addedClauses.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <PlusCircle className="h-6 w-6 mr-2 text-green-600" />
              Added Clauses ({result.addedClauses.length})
            </h2>
            
            {result.addedClauses.length > 3 && (
              <button
                onClick={() => setShowAllAdded(!showAllAdded)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showAllAdded ? 'Show Less' : 'Show All'}
              </button>
            )}
          </div>
          
          <div className="space-y-4">
            {(showAllAdded ? result.addedClauses : result.addedClauses.slice(0, 3)).map((clause, index) => (
              <div key={index} className="border border-green-200 bg-green-50 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <PlusCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-green-900 mb-2">
                      New Clause #{index + 1}
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {clause}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deleted Clauses Section */}
      {result.deletedClauses.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center">
              <Trash2 className="h-6 w-6 mr-2 text-red-600" />
              Deleted Clauses ({result.deletedClauses.length})
            </h2>
            
            {result.deletedClauses.length > 3 && (
              <button
                onClick={() => setShowAllDeleted(!showAllDeleted)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showAllDeleted ? 'Show Less' : 'Show All'}
              </button>
            )}
          </div>
          
          <div className="space-y-4">
            {(showAllDeleted ? result.deletedClauses : result.deletedClauses.slice(0, 3)).map((clause, index) => (
              <div key={index} className="border border-red-200 bg-red-50 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Trash2 className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-red-900 mb-2">
                      Removed Clause #{index + 1}
                    </h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {clause}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Changes Message */}
      {result.changedClauses.length === 0 && result.addedClauses.length === 0 && result.deletedClauses.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Significant Changes Detected
          </h3>
          <p className="text-gray-600 max-w-md mx-auto">
            The AI analysis found no meaningful differences between the two documents. 
            They appear to be substantially identical.
          </p>
        </div>
      )}

      {/* Footer Actions */}
      <div className="mt-12 pt-6 border-t border-gray-200">
        <div className="flex justify-center space-x-4">
          <button
            onClick={onStartNew}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Compare New Documents
          </button>
          
          <button
            onClick={() => window.print()}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Print Results
          </button>
        </div>
        
        <p className="text-center text-sm text-gray-500 mt-4">
          AI analysis is for reference only. For legal advice, consult a qualified attorney.
        </p>
      </div>
    </div>
  );
};

export default ComparisonView;