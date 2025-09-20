// API Configuration for Legal Document Demystifier

// Backend API URL - uses environment variable or fallback to Cloud Run service URL
export const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://legal-backend-144935064473.asia-south1.run.app';

export const API_CONFIG = {
  BASE_URL,
  
  // API Endpoints
  ENDPOINTS: {
    HEALTH: "/health",
    ANALYZE_DOCUMENT: "/analyze-document",
    ANALYZE_TEXT: "/analyze-text",
    SUMMARIZE: "/summarize",
    SUMMARIZE_UPLOAD: "/summarize-upload",
    CHAT: "/chat",
    EXTRACT_PDF_TEXT: "/extract-pdf-text",
    RAG_SEARCH: "/rag-search",
    UPLOAD_PDF: "/upload-pdf",
    ROOT: "/"
  },
  
  // Request configuration
  TIMEOUT: 30000, // 30 seconds
  
  // File upload limits
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: ['application/pdf', 'text/plain', 'text/markdown'],
};

// Helper function to get full API URL
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};

// Analysis types supported by the backend
export const ANALYSIS_TYPES = {
  SUMMARY: 'summary',
  KEY_POINTS: 'key_points', 
  RISKS: 'risks',
  RECOMMENDATIONS: 'recommendations',
  EXPLAIN: 'explain'
} as const;

export type AnalysisType = typeof ANALYSIS_TYPES[keyof typeof ANALYSIS_TYPES];