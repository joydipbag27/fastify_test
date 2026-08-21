export interface User {
  id?: string;
  user_id?: string;
  name?: string;
  email?: string;
  created_at?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  user?: T;
  userId?: string;
}

export interface ApiLog {
  id: string;
  timestamp: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  status: number;
  requestPayload?: any;
  responsePayload: any;
  durationMs: number;
}
