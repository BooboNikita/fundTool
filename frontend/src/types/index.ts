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
  is_watchlist: boolean;
  is_holding: boolean;
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
  type?: string;
  estimation: FundEstimation | null;
}

export interface FundSearchResult {
  code: string;
  name: string;
  type?: string;
}

export interface AllFundsResponse {
  results: FundSearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DingTalkConfig {
  id?: number;
  user_id?: number;
  webhook_url: string;
  secret?: string;
  push_times?: string[];
  push_interval_hours?: number;
  push_enabled?: boolean;
  push_watchlist?: boolean;
  push_holding?: boolean;
}

export interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
  deleted?: boolean;
  hidden?: boolean;
}

export interface ChatSession {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface UserWithAIPermission {
  id: number;
  username: string;
  created_at: string;
  can_use_ai_assistant: boolean;
}

export interface AIUsageStats {
  totalUsers: number;
  aiEnabledUsers: number;
  totalChatMessages: number;
  todayChatMessages: number;
  topUsers: { username: string; message_count: number }[];
}

export interface ApiError {
  error: string;
}
