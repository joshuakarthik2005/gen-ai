import axios, { AxiosResponse } from 'axios';
import { API_CONFIG, getApiUrl, AnalysisType } from '../config/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response types
export interface HealthResponse {
  status: string;
  vertex_ai_initialized: boolean;
  timestamp: string;
}

export interface AnalysisResponse {
  analysis: string;
  analysis_type: string;
  confidence: number;
  processing_time: number;
  document_type?: string;
}

export interface DocumentUploadResponse {
  message: string;
  analysis: string;
  file_info: {
    filename: string;
    size: number;
    type: string;
  };
  processing_time: number;
}

export interface ApiError {
  message: string;
  detail?: string;
  status_code?: number;
}

// API Service Class
export class LegalApiService {
  
  // Health check
  static async checkHealth(): Promise<HealthResponse> {
    try {
      const response: AxiosResponse<HealthResponse> = await apiClient.get(API_CONFIG.ENDPOINTS.HEALTH);
      return response.data;
    } catch (error) {
      console.error('Health check failed:', error);
      throw new Error('Service unavailable');
    }
  }

  // Analyze text directly
  static async analyzeText(
    text: string, 
    analysisType: AnalysisType = 'summary'
  ): Promise<AnalysisResponse> {
    try {
      const response: AxiosResponse<AnalysisResponse> = await apiClient.post(
        API_CONFIG.ENDPOINTS.ANALYZE_TEXT,
        {
          text,
          analysis_type: analysisType
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Text analysis failed:', error);
      const message = error.response?.data?.detail || error.message || 'Analysis failed';
      throw new Error(message);
    }
  }

  // Upload and analyze document
  static async uploadDocument(
    file: File,
    analysisType: AnalysisType = 'summary'
  ): Promise<DocumentUploadResponse> {
    try {
      // Validate file
      if (file.size > API_CONFIG.MAX_FILE_SIZE) {
        throw new Error(`File size must be less than ${API_CONFIG.MAX_FILE_SIZE / (1024 * 1024)}MB`);
      }

      if (!API_CONFIG.ALLOWED_FILE_TYPES.includes(file.type)) {
        throw new Error('File type not supported. Please upload PDF or text files.');
      }

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('analysis_type', analysisType);

      // Upload with different content type for FormData
      const response: AxiosResponse<DocumentUploadResponse> = await axios.post(
        getApiUrl(API_CONFIG.ENDPOINTS.ANALYZE_DOCUMENT),
        formData,
        {
          timeout: API_CONFIG.TIMEOUT,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Document upload failed:', error);
      const message = error.response?.data?.detail || error.message || 'Upload failed';
      throw new Error(message);
    }
  }

  // Get API info
  static async getApiInfo(): Promise<any> {
    try {
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.ROOT);
      return response.data;
    } catch (error) {
      console.error('Failed to get API info:', error);
      throw new Error('Failed to connect to service');
    }
  }
}

// Hook for easier use in React components
export const useApi = () => {
  return {
    checkHealth: LegalApiService.checkHealth,
    analyzeText: LegalApiService.analyzeText,
    uploadDocument: LegalApiService.uploadDocument,
    getApiInfo: LegalApiService.getApiInfo,
  };
};