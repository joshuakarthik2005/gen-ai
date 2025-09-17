"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

interface DocumentUploaderProps {
  onUploadSuccess: (signedUrl: string, filename: string) => void;
}

export default function DocumentUploader({ onUploadSuccess }: DocumentUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatus({ type: null, message: '' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://127.0.0.1:8000/upload-document', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Upload failed');
      }

      const data = await response.json();
      
      setUploadStatus({
        type: 'success',
        message: `Successfully uploaded ${file.name}`
      });

      // Call the success callback with the signed URL
      onUploadSuccess(data.signed_url, file.name);

    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Upload failed'
      });
    } finally {
      setIsUploading(false);
    }
  }, [onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: isUploading
  });

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer
          ${isDragActive && !isDragReject ? 'border-accent bg-accent/5 scale-105' : ''}
          ${isDragReject ? 'border-red-400 bg-red-50' : ''}
          ${!isDragActive && !isDragReject ? 'border-gray-300 hover:border-accent hover:bg-accent/5' : ''}
          ${isUploading ? 'pointer-events-none opacity-75' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        {isUploading ? (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
            <div>
              <p className="text-lg font-medium text-gray-700">Uploading document...</p>
              <p className="text-sm text-gray-500">Please wait while we process your file</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <div className={`
              w-16 h-16 rounded-full flex items-center justify-center transition-colors
              ${isDragActive ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600'}
            `}>
              {isDragReject ? (
                <AlertCircle className="w-8 h-8 text-red-500" />
              ) : (
                <Upload className="w-8 h-8" />
              )}
            </div>
            
            <div>
              {isDragReject ? (
                <p className="text-lg font-medium text-red-600">Only PDF files are supported</p>
              ) : isDragActive ? (
                <p className="text-lg font-medium text-accent">Drop your PDF here</p>
              ) : (
                <>
                  <p className="text-lg font-medium text-gray-700">
                    Drag & drop your PDF document here
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    or <span className="text-accent font-medium">click to browse</span>
                  </p>
                </>
              )}
            </div>
            
            <div className="text-xs text-gray-400 space-y-1">
              <p>Supported format: PDF only</p>
              <p>Maximum size: 10MB</p>
            </div>
          </div>
        )}
      </div>

      {/* Status Messages */}
      {uploadStatus.type && (
        <div className={`
          mt-4 p-4 rounded-lg flex items-center space-x-3
          ${uploadStatus.type === 'success' ? 'bg-green-50 border border-green-200' : ''}
          ${uploadStatus.type === 'error' ? 'bg-red-50 border border-red-200' : ''}
        `}>
          {uploadStatus.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <p className={`text-sm font-medium ${
            uploadStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
          }`}>
            {uploadStatus.message}
          </p>
        </div>
      )}

      {/* Features List */}
      <div className="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">What happens after upload?</h3>
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-accent" />
            </div>
            <p className="text-sm text-gray-700">View your PDF in our secure document viewer</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-accent">AI</span>
            </div>
            <p className="text-sm text-gray-700">Highlight any text to get instant AI explanations</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 bg-accent/10 rounded-full flex items-center justify-center">
              <span className="text-xs font-bold text-accent">🔒</span>
            </div>
            <p className="text-sm text-gray-700">Your document is processed securely and never stored permanently</p>
          </div>
        </div>
      </div>
    </div>
  );
}