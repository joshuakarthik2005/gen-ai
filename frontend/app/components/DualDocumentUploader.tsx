'use client';

import React, { useState } from 'react';
import { Upload, X, FileText, Loader2, ArrowLeftRight } from 'lucide-react';

interface DualDocumentUploaderProps {
  onComparisonResult: (result: any) => void;
  onError: (error: string) => void;
  onLoadingChange: (loading: boolean) => void;
}

interface FileUploadState {
  file: File | null;
  preview: string;
  error: string;
}

const DualDocumentUploader: React.FC<DualDocumentUploaderProps> = ({
  onComparisonResult,
  onError,
  onLoadingChange,
}) => {
  const [originalFile, setOriginalFile] = useState<FileUploadState>({
    file: null,
    preview: '',
    error: '',
  });
  
  const [revisedFile, setRevisedFile] = useState<FileUploadState>({
    file: null,
    preview: '',
    error: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);

  const validateFile = (file: File): string => {
    // Check file type
    if (!file.type.includes('pdf')) {
      return 'Only PDF files are supported';
    }
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return 'File size must be less than 10MB';
    }
    
    return '';
  };

  const handleFileSelect = (
    file: File,
    setFileState: React.Dispatch<React.SetStateAction<FileUploadState>>
  ) => {
    const error = validateFile(file);
    
    if (error) {
      setFileState(prev => ({
        ...prev,
        error,
        file: null,
        preview: '',
      }));
      return;
    }

    const preview = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    
    setFileState({
      file,
      preview,
      error: '',
    });
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    setFileState: React.Dispatch<React.SetStateAction<FileUploadState>>
  ) => {
    e.preventDefault();
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0], setFileState);
    }
  };

  const handleFileInputChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setFileState: React.Dispatch<React.SetStateAction<FileUploadState>>
  ) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0], setFileState);
    }
  };

  const removeFile = (setFileState: React.Dispatch<React.SetStateAction<FileUploadState>>) => {
    setFileState({
      file: null,
      preview: '',
      error: '',
    });
  };

  const canCompare = originalFile.file && revisedFile.file && !isLoading;

  const handleCompare = async () => {
    if (!canCompare) return;

    setIsLoading(true);
    onLoadingChange(true);

    try {
      // Get auth token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required. Please log in.');
      }

      // Create FormData with both files
      const formData = new FormData();
      formData.append('original_file', originalFile.file!);
      formData.append('revised_file', revisedFile.file!);

      // Make API request
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/compare/compare-documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication expired. Please log in again.');
        }
        
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      onComparisonResult(result);

    } catch (error) {
      console.error('Comparison error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to compare documents';
      onError(errorMessage);
    } finally {
      setIsLoading(false);
      onLoadingChange(false);
    }
  };

  const FileUploadZone: React.FC<{
    title: string;
    description: string;
    fileState: FileUploadState;
    setFileState: React.Dispatch<React.SetStateAction<FileUploadState>>;
    inputId: string;
  }> = ({ title, description, fileState, setFileState, inputId }) => (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 mb-4">{description}</p>
      
      {!fileState.file ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            fileState.error
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300 hover:border-gray-400 bg-gray-50'
          }`}
          onDrop={(e) => handleDrop(e, setFileState)}
          onDragOver={(e) => e.preventDefault()}
          onDragEnter={(e) => e.preventDefault()}
        >
          <Upload className={`mx-auto h-12 w-12 mb-4 ${
            fileState.error ? 'text-red-400' : 'text-gray-400'
          }`} />
          
          <p className="text-sm text-gray-600 mb-2">
            Drag and drop your PDF file here, or
          </p>
          
          <label
            htmlFor={inputId}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer transition-colors"
          >
            Choose File
          </label>
          
          <input
            id={inputId}
            type="file"
            accept=".pdf"
            onChange={(e) => handleFileInputChange(e, setFileState)}
            className="hidden"
          />
          
          <p className="text-xs text-gray-500 mt-2">PDF files only, max 10MB</p>
          
          {fileState.error && (
            <p className="text-sm text-red-600 mt-2">{fileState.error}</p>
          )}
        </div>
      ) : (
        <div className="border border-gray-300 rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {fileState.file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {(fileState.file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            
            <button
              onClick={() => removeFile(setFileState)}
              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
              disabled={isLoading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Semantic Document Comparison
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Upload two versions of a PDF document to identify and analyze meaningful differences 
          using advanced AI technology. Perfect for comparing contract revisions, policy updates, 
          and legal document changes.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <FileUploadZone
          title="Original Document"
          description="Upload the original version of your document"
          fileState={originalFile}
          setFileState={setOriginalFile}
          inputId="original-file"
        />
        
        <FileUploadZone
          title="Revised Document"
          description="Upload the revised version of your document"
          fileState={revisedFile}
          setFileState={setRevisedFile}
          inputId="revised-file"
        />
      </div>

      <div className="text-center">
        <button
          onClick={handleCompare}
          disabled={!canCompare}
          className={`inline-flex items-center px-8 py-3 text-lg font-medium rounded-lg transition-all ${
            canCompare
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Analyzing Documents...
            </>
          ) : (
            <>
              <ArrowLeftRight className="h-5 w-5 mr-2" />
              Compare Documents
            </>
          )}
        </button>
        
        <p className="text-sm text-gray-500 mt-3">
          Analysis typically takes 30-60 seconds depending on document size
        </p>
      </div>

      {(originalFile.file || revisedFile.file) && (
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">What happens next?</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Documents are analyzed using advanced AI text extraction</li>
            <li>• Content is segmented into meaningful clauses and sections</li>
            <li>• Semantic matching identifies corresponding sections between versions</li>
            <li>• AI analysis explains the practical implications of each change</li>
            <li>• Results categorize changes as beneficial, harmful, or neutral</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default DualDocumentUploader;