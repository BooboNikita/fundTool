export interface User {
  id: number;
  username: string;
  password: string;
  created_at: string;
}

export interface Fund {
  id: number;
  user_id: number;
  code: string;
  name: string;
  note: string;
  is_watchlist: boolean;
  is_holding: boolean;
  created_at: string;
}

export interface DingTalkConfig {
  id: number;
  user_id: number;
  webhook_url: string;
  secret: string;
  push_time: string;
  push_enabled: boolean;
  created_at: string;
  updated_at: string;
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

export interface FundSearchResult {
  code: string;
  name: string;
  type?: string;
}
