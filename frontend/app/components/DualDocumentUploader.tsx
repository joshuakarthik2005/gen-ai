"use client";

import { useState, useRef } from "react";
import { Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { BASE_URL } from "../config/api";

interface DualDocumentUploaderProps {
  onDocumentsUploaded: (originalDoc: { url: string; filename: string }, modifiedDoc: { url: string; filename: string }) => void;
}

export default function DualDocumentUploader({ onDocumentsUploaded }: DualDocumentUploaderProps) {
  const [uploadState, setUploadState] = useState<{
    original: { file: File | null; uploading: boolean; uploaded: boolean; url?: string };
    modified: { file: File | null; uploading: boolean; uploaded: boolean; url?: string };
  }>({
    original: { file: null, uploading: false, uploaded: false },
    modified: { file: null, uploading: false, uploaded: false }
  });
  const [error, setError] = useState<string>("");
  const [comparing, setComparing] = useState(false);

  const originalInputRef = useRef<HTMLInputElement>(null);
  const modifiedInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (type: 'original' | 'modified', file: File) => {
    if (!file.type.includes('pdf')) {
      setError("Please select PDF files only");
      return;
    }

    setError("");
    setUploadState(prev => ({
      ...prev,
      [type]: { file, uploading: true, uploaded: false }
    }));

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${BASE_URL}/upload-pdf`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Upload failed");
      }

      const data = await response.json();
      
      setUploadState(prev => ({
        ...prev,
        [type]: { file, uploading: false, uploaded: true, url: data.signed_url }
      }));

    } catch (error) {
      console.error("Upload error:", error);
      setError(`Failed to upload ${type} document: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setUploadState(prev => ({
        ...prev,
        [type]: { file: null, uploading: false, uploaded: false }
      }));
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, type: 'original' | 'modified') => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(type, files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const triggerFileInput = (type: 'original' | 'modified') => {
    if (type === 'original') {
      originalInputRef.current?.click();
    } else {
      modifiedInputRef.current?.click();
    }
  };

  const handleCompare = () => {
    if (uploadState.original.uploaded && uploadState.modified.uploaded && 
        uploadState.original.url && uploadState.modified.url &&
        uploadState.original.file && uploadState.modified.file) {
      
      setComparing(true);
      
      onDocumentsUploaded(
        { url: uploadState.original.url, filename: uploadState.original.file.name },
        { url: uploadState.modified.url, filename: uploadState.modified.file.name }
      );
    }
  };

  const canCompare = uploadState.original.uploaded && uploadState.modified.uploaded && !comparing;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Upload Areas */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Original Document */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 text-center">Original Document</h3>
          <div
            onDrop={(e) => handleDrop(e, 'original')}
            onDragOver={handleDragOver}
            onClick={() => triggerFileInput('original')}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
              ${uploadState.original.uploaded 
                ? 'border-green-300 bg-green-50' 
                : uploadState.original.uploading 
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
              }
            `}
          >
            <input
              ref={originalInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect('original', file);
              }}
              className="hidden"
            />
            
            <div className="space-y-3">
              {uploadState.original.uploaded ? (
                <>
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                  <div>
                    <p className="text-green-700 font-medium">{uploadState.original.file?.name}</p>
                    <p className="text-green-600 text-sm">Ready to compare</p>
                  </div>
                </>
              ) : uploadState.original.uploading ? (
                <>
                  <div className="w-12 h-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <div>
                    <p className="text-blue-700 font-medium">Uploading...</p>
                    <p className="text-blue-600 text-sm">{uploadState.original.file?.name}</p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-gray-700 font-medium">Drop your original PDF here</p>
                    <p className="text-gray-500 text-sm">or click to browse</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Modified Document */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 text-center">Modified Document</h3>
          <div
            onDrop={(e) => handleDrop(e, 'modified')}
            onDragOver={handleDragOver}
            onClick={() => triggerFileInput('modified')}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
              ${uploadState.modified.uploaded 
                ? 'border-green-300 bg-green-50' 
                : uploadState.modified.uploading 
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
              }
            `}
          >
            <input
              ref={modifiedInputRef}
              type="file"
              accept=".pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect('modified', file);
              }}
              className="hidden"
            />
            
            <div className="space-y-3">
              {uploadState.modified.uploaded ? (
                <>
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
                  <div>
                    <p className="text-green-700 font-medium">{uploadState.modified.file?.name}</p>
                    <p className="text-green-600 text-sm">Ready to compare</p>
                  </div>
                </>
              ) : uploadState.modified.uploading ? (
                <>
                  <div className="w-12 h-12 mx-auto border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <div>
                    <p className="text-blue-700 font-medium">Uploading...</p>
                    <p className="text-blue-600 text-sm">{uploadState.modified.file?.name}</p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                  <div>
                    <p className="text-gray-700 font-medium">Drop your modified PDF here</p>
                    <p className="text-gray-500 text-sm">or click to browse</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Compare Button */}
      <div className="text-center">
        <button
          onClick={handleCompare}
          disabled={!canCompare}
          className={`
            px-8 py-3 rounded-lg font-semibold text-white transition-all
            ${canCompare 
              ? 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-xl' 
              : 'bg-gray-300 cursor-not-allowed'
            }
          `}
        >
          {comparing ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              <span>Starting Comparison...</span>
            </div>
          ) : (
            <>
              <FileText className="w-5 h-5 inline mr-2" />
              Compare Documents
            </>
          )}
        </button>
        
        {!canCompare && !comparing && (
          <p className="text-gray-500 text-sm mt-2">
            Upload both documents to enable comparison
          </p>
        )}
      </div>
    </div>
  );
}