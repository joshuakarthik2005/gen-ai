"use client";

import React, { useState, useEffect } from "react";
import { FileText, Clock, Upload, User, FolderOpen, Lock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { BASE_URL } from "../config/api";

interface WorkspaceDocument {
  id: string;
  name: string;
  url?: string;
  type?: string;
  upload_date?: string;
  size?: number;
}

interface WorkspaceSidebarProps {
  onDocumentSelect: (document: WorkspaceDocument) => void;
}

export default function WorkspaceSidebar({ onDocumentSelect }: WorkspaceSidebarProps) {
  const { isAuthenticated, user, setShowAuthModal } = useAuth();
  const [userFiles, setUserFiles] = useState<WorkspaceDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // Sample documents available for all users
  const sampleDocuments: WorkspaceDocument[] = [
    {
      id: "sample-1",
      name: "Sample Employment Agreement",
      url: "https://www.adobe.com/support/products/enterprise/knowledgecenter/media/c4611_sample_explain.pdf",
      type: "pdf",
      upload_date: "2024-01-10T00:00:00Z",
      size: 245760
    },
    {
      id: "sample-2", 
      name: "Sample Service Contract",
      url: "https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf",
      type: "pdf",
      upload_date: "2024-01-09T00:00:00Z",
      size: 189440
    }
  ];

  // Fetch user files when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchUserFiles();
    }
  }, [isAuthenticated]);

  const fetchUserFiles = async () => {
    if (!isAuthenticated) return;

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("No access token found");
      }

      const response = await fetch(`${BASE_URL}/user-files`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to fetch files");
      }

      const data = await response.json();
      setUserFiles(data.files || []);
    } catch (error) {
      console.error("Error fetching user files:", error);
      setError(error instanceof Error ? error.message : "Failed to load files");
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return Math.round(bytes / (1024 * 1024)) + " MB";
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "Unknown date";
    }
  };

  const handleDocumentClick = (document: WorkspaceDocument) => {
    onDocumentSelect(document);
  };

  const handleAuthRequired = () => {
    setShowAuthModal(true);
  };

  return (
    <div className="h-full bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-2">
          <FolderOpen className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Workspace</h2>
        </div>
        {isAuthenticated && user && (
          <p className="text-sm text-gray-500 mt-1">Welcome, {user.full_name}</p>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* User Files Section - Only show for authenticated users */}
        {isAuthenticated && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-medium text-gray-900">Your Files</h3>
              </div>
              <span className="text-xs text-gray-500">{userFiles.length}</span>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mb-3">
                {error}
              </div>
            )}

            {!loading && !error && userFiles.length === 0 && (
              <div className="text-center py-6">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No documents uploaded yet</p>
                <p className="text-xs text-gray-400 mt-1">Upload files to see them here</p>
              </div>
            )}

            {!loading && userFiles.length > 0 && (
              <div className="space-y-2">
                {userFiles.slice(0, 5).map((file) => (
                  <div
                    key={file.id}
                    onClick={() => handleDocumentClick(file)}
                    className="p-3 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all"
                  >
                    <div className="flex items-start space-x-3">
                      <FileText className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {file.upload_date ? formatDate(file.upload_date) : "Unknown"}
                          </span>
                        </div>
                        {file.size && (
                          <p className="text-xs text-gray-400 mt-1">{formatFileSize(file.size)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {userFiles.length > 5 && (
                  <p className="text-xs text-gray-500 text-center py-2">
                    and {userFiles.length - 5} more files...
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Sample Documents Section */}
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center space-x-2 mb-3">
            <FileText className="w-4 h-4 text-green-600" />
            <h3 className="text-sm font-medium text-gray-900">Sample Documents</h3>
          </div>

          <div className="space-y-2">
            {sampleDocuments.map((document) => (
              <div
                key={document.id}
                onClick={() => handleDocumentClick(document)}
                className="p-3 bg-white border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 cursor-pointer transition-all"
              >
                <div className="flex items-start space-x-3">
                  <FileText className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{document.name}</p>
                    <div className="flex items-center space-x-2 mt-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        {document.upload_date ? formatDate(document.upload_date) : "Sample"}
                      </span>
                    </div>
                    {document.size && (
                      <p className="text-xs text-gray-400 mt-1">{formatFileSize(document.size)}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Login Prompt for Non-Authenticated Users */}
        {!isAuthenticated && (
          <div className="p-4 border-t border-gray-100">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Lock className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-medium text-blue-900">Upload Your Documents</h4>
              </div>
              <p className="text-xs text-blue-700 mb-3">
                Sign in to upload your own legal documents and keep them organized in your workspace.
              </p>
              <button
                onClick={handleAuthRequired}
                className="w-full bg-blue-600 text-white text-xs px-3 py-2 rounded-md hover:bg-blue-700 transition-colors"
              >
                Sign In / Register
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}