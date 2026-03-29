export interface User {
  id: number;
  username: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface Fund {
  id: number;
  code: string;
  name: string;
  note: string;
  created_at?: string;
}

export interface FundEstimation {
  code: string;
  fund_code: string;
  name: string;
  net_value_date: string;
  net_value: string;
  estimate_net_value: string;
  estimate_growth_rate: string;
  estimate_time: string;
}

export interface FundWithEstimation extends Fund {
  estimation: FundEstimation | null;
}

export interface FundSearchResult {
  code: string;
  name: string;
}

export interface ApiError {
  error: string;
}
