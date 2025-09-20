"use client";

import { useState, useEffect } from "react";
import { FileText, Zap, AlertCircle, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { BASE_URL } from "../config/api";

interface ComparisonViewProps {
  originalDocument: { url: string; filename: string };
  modifiedDocument: { url: string; filename: string };
}

interface SemanticChange {
  original_text: string;
  modified_text: string;
  change_type: string;
  description: string;
  impact: string;
  confidence: number;
  section: string;
}

interface ComparisonResult {
  summary: string;
  semantic_changes: SemanticChange[];
  total_changes: number;
  high_impact_changes: number;
}

export default function ComparisonView({ originalDocument, modifiedDocument }: ComparisonViewProps) {
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [selectedViewMode, setSelectedViewMode] = useState<'changes' | 'documents'>('changes');
  const [expandedChanges, setExpandedChanges] = useState<Set<number>>(new Set());

  // Perform comparison on component mount
  useEffect(() => {
    performComparison();
  }, [originalDocument.url, modifiedDocument.url]);

  const performComparison = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${BASE_URL}/compare-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          original_url: originalDocument.url,
          modified_url: modifiedDocument.url
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Comparison failed');
      }

      const data = await response.json();
      setComparisonResult(data);
    } catch (error) {
      console.error('Comparison error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const toggleChangeExpansion = (index: number) => {
    const newExpanded = new Set(expandedChanges);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedChanges(newExpanded);
  };

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType.toLowerCase()) {
      case 'addition':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'deletion':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'modification':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'structural':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getImpactColor = (impact: string) => {
    if (impact.toLowerCase().includes('high')) {
      return 'text-red-600 bg-red-50 border-red-200';
    } else if (impact.toLowerCase().includes('medium')) {
      return 'text-orange-600 bg-orange-50 border-orange-200';
    } else {
      return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) {
      return 'text-green-600';
    } else if (confidence >= 0.6) {
      return 'text-orange-600';
    } else {
      return 'text-red-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Comparing Documents</h3>
          <p className="text-gray-600">Our AI is analyzing the differences between your documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Comparison Failed</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={performComparison}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-2 mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  if (!comparisonResult) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Comparison Data</h3>
          <p className="text-gray-600">Unable to retrieve comparison results.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Document Names */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Original</p>
              <p className="font-medium text-gray-900">{originalDocument.filename}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Modified</p>
              <p className="font-medium text-gray-900">{modifiedDocument.filename}</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-600">{comparisonResult.total_changes}</p>
            <p className="text-sm text-gray-500">Total Changes</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-600">{comparisonResult.high_impact_changes}</p>
            <p className="text-sm text-gray-500">High Impact</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">
              {comparisonResult.total_changes - comparisonResult.high_impact_changes}
            </p>
            <p className="text-sm text-gray-500">Low Impact</p>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center space-x-2 mb-4">
          <Zap className="w-5 h-5 text-indigo-600" />
          <h3 className="text-lg font-semibold text-gray-900">AI Summary</h3>
        </div>
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-700 leading-relaxed">{comparisonResult.summary}</p>
        </div>
      </div>

      {/* Changes List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Detailed Changes</h3>
          <p className="text-sm text-gray-500 mt-1">
            {comparisonResult.semantic_changes.length} semantic changes detected
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {comparisonResult.semantic_changes.map((change, index) => (
            <div key={index} className="p-6">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getChangeTypeColor(change.change_type)}`}>
                    {change.change_type}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getImpactColor(change.impact)}`}>
                    {change.impact}
                  </span>
                  <span className={`text-xs font-medium ${getConfidenceColor(change.confidence)}`}>
                    {Math.round(change.confidence * 100)}% confidence
                  </span>
                </div>
                <button
                  onClick={() => toggleChangeExpansion(index)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                >
                  {expandedChanges.has(index) ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Section: {change.section}</p>
                  <p className="text-gray-600">{change.description}</p>
                </div>

                {expandedChanges.has(index) && (
                  <div className="space-y-3 pt-3 border-t border-gray-100">
                    {change.original_text && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-red-700 mb-1">Original Text:</p>
                        <p className="text-sm text-red-900">{change.original_text}</p>
                      </div>
                    )}
                    
                    {change.modified_text && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <p className="text-xs font-medium text-green-700 mb-1">Modified Text:</p>
                        <p className="text-sm text-green-900">{change.modified_text}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {comparisonResult.semantic_changes.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Significant Changes</h3>
            <p className="text-gray-500">
              Our AI analysis found no meaningful semantic differences between the documents.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}