export interface User {
  id?: string;
  user_id?: string;
  name?: string;
  email?: string;
  created_at?: string;
}

export interface PasswordLoginResponse {
  success: boolean;
  message?: string;
  requiresTotp?: boolean;
  userId?: string;
  data?: {
    name?: string;
    email?: string;
    user_id?: string;
  };
}

export interface TotpSetupResponse {
  success: boolean;
  message: string;
  data?: {
    uri: string;
  };
}

export interface UserMeResponse {
  userId: string;
  name?: string;
  email?: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  user?: T;
  userId?: string;
  name?: string;
  email?: string;
}

export interface PasskeySetupResponse {
  success: boolean;
  message?: string;
  options?: any;
}

export interface PasskeyOptionResponse {
  success: boolean;
  message?: string;
  options?: any;
}

