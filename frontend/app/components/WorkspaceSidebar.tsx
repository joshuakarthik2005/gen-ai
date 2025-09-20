"use client";

import { useState, useRef, useEffect } from "react";
import { 
  Search, 
  Plus, 
  FileText, 
  Folder, 
  Star, 
  Clock, 
  ChevronDown, 
  ChevronRight,
  Upload,
  Settings,
  User
} from "lucide-react";

interface Document {
  id: string;
  name: string;
  type: string;
  lastModified: string;
  starred?: boolean;
  url?: string;
}

interface WorkspaceSidebarProps {
  onDocumentSelect?: (document: Document) => void;
}

// localStorage helper functions
const DOCUMENTS_STORAGE_KEY = "workspace_documents";

const getStoredDocuments = (): Document[] => {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(DOCUMENTS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    }
  } catch (error) {
    console.error('Error loading documents from localStorage:', error);
  }
  
  // Return default documents if no stored documents found
  return [
    { 
      id: "1", 
      name: "Employment Agreement", 
      type: "Contract", 
      lastModified: "2 hours ago", 
      starred: true,
      url: "https://www.adobe.com/support/products/enterprise/knowledgecenter/media/c4611_sample_explain.pdf"
    },
    { 
      id: "2", 
      name: "NDA Template", 
      type: "Agreement", 
      lastModified: "1 day ago",
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
    },
    { 
      id: "3", 
      name: "Service Agreement", 
      type: "Contract", 
      lastModified: "3 days ago", 
      starred: true,
      url: "https://www.adobe.com/support/products/enterprise/knowledgecenter/media/c4611_sample_explain.pdf"
    },
    { 
      id: "4", 
      name: "Privacy Policy", 
      type: "Policy", 
      lastModified: "1 week ago",
      url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
    },
    { 
      id: "5", 
      name: "Terms of Service", 
      type: "Legal", 
      lastModified: "2 weeks ago",
      url: "https://www.adobe.com/support/products/enterprise/knowledgecenter/media/c4611_sample_explain.pdf"
    },
  ];
};

const saveDocumentsToStorage = (documents: Document[]) => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(DOCUMENTS_STORAGE_KEY, JSON.stringify(documents));
    }
  } catch (error) {
    console.error('Error saving documents to localStorage:', error);
  }
};

const WorkspaceSidebar = ({ onDocumentSelect }: WorkspaceSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(["recent"]));
  const [documents, setDocuments] = useState<Document[]>(getStoredDocuments);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Save documents to localStorage whenever documents change
  useEffect(() => {
    saveDocumentsToStorage(documents);
  }, [documents]);

  // Clean up blob URLs when the window is about to unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      const storedDocs = getStoredDocuments();
      storedDocs.forEach(doc => {
        if (doc.url && doc.url.startsWith('blob:')) {
          URL.revokeObjectURL(doc.url);
        }
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleFileUpload = (files: FileList | null) => {
    if (!files) return;
    
    console.log('handleFileUpload called with files:', files.length);
    const uploadedFiles: string[] = [];
    
    Array.from(files).forEach((file) => {
      console.log('Processing file:', file.name, file.type);
      if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
        // Create a blob URL for the uploaded file
        const fileUrl = URL.createObjectURL(file);
        
        const newDocument: Document = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: file.name.replace('.pdf', ''),
          type: 'PDF Document',
          lastModified: 'Just now',
          starred: false,
          url: fileUrl
        };
        
        setDocuments(prev => [newDocument, ...prev]);
        uploadedFiles.push(file.name);
        
        console.log('Document added:', newDocument);
      } else {
        alert('Please upload only PDF files.');
      }
    });
    
    if (uploadedFiles.length > 0) {
      setUploadMessage(`Successfully uploaded ${uploadedFiles.length} document${uploadedFiles.length > 1 ? 's' : ''}`);
      setTimeout(() => setUploadMessage(""), 3000);
    }
  };

  const handleNewDocument = () => {
    console.log('handleNewDocument clicked');
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input changed:', e.target.files);
    handleFileUpload(e.target.files);
    e.target.value = ''; // Reset input
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Drag over');
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Drag leave');
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('Drop event', e.dataTransfer.files);
    setIsDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Workspace</h2>
          <div className="flex items-center space-x-2">
            <button className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
              <Settings className="w-4 h-4 text-gray-500" />
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded-md transition-colors">
              <User className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Upload Area */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />
        
        {uploadMessage && (
          <div className="mb-3 p-2 bg-green-100 border border-green-300 rounded-lg">
            <p className="text-xs text-green-700 text-center">{uploadMessage}</p>
          </div>
        )}
        
        <button 
          onClick={handleNewDocument}
          className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">New Document</span>
        </button>
        
        <div 
          onClick={handleNewDocument}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`mt-3 p-3 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
            isDragOver 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-blue-400'
          }`}
        >
          <div className="text-center">
            <Upload className={`w-6 h-6 mx-auto mb-2 ${isDragOver ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className={`text-xs ${isDragOver ? 'text-blue-600' : 'text-gray-500'}`}>
              {isDragOver ? 'Drop files here' : 'Drop files here or click to upload'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto">
        {/* Quick Access */}
        <div className="p-4 border-b border-gray-200">
          <div className="space-y-1">
            <button className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100 rounded-md transition-colors">
              <Star className="w-4 h-4 text-yellow-500" />
              <span className="text-sm text-gray-700">Starred</span>
              <span className="ml-auto text-xs text-gray-400">3</span>
            </button>
            
            <button className="w-full flex items-center space-x-3 px-3 py-2 text-left hover:bg-gray-100 rounded-md transition-colors">
              <Clock className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-700">Recent</span>
              <span className="ml-auto text-xs text-gray-400">5</span>
            </button>
          </div>
        </div>

        {/* Document List */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => toggleFolder("recent")}
              className="flex items-center space-x-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              {expandedFolders.has("recent") ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              <Folder className="w-4 h-4 text-blue-500" />
              <span>Recent Documents</span>
            </button>
          </div>

          {expandedFolders.has("recent") && (
            <div className="space-y-2 ml-6">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => onDocumentSelect?.(doc)}
                  className="flex items-center space-x-3 p-2 hover:bg-blue-50 rounded-md cursor-pointer group border border-transparent hover:border-blue-200 transition-all"
                >
                  <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700">
                        {doc.name}
                      </p>
                      {doc.starred && (
                        <Star className="w-3 h-3 text-yellow-500 fill-current flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <span>{doc.type}</span>
                      <span>•</span>
                      <span>{doc.lastModified}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Categories */}
        <div className="p-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Categories
          </h3>
          <div className="space-y-1">
            <button className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100 rounded-md transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-700">Contracts</span>
              </div>
              <span className="text-xs text-gray-400">3</span>
            </button>
            
            <button className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100 rounded-md transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-700">Agreements</span>
              </div>
              <span className="text-xs text-gray-400">2</span>
            </button>
            
            <button className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-100 rounded-md transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="text-sm text-gray-700">Policies</span>
              </div>
              <span className="text-xs text-gray-400">2</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkspaceSidebar;