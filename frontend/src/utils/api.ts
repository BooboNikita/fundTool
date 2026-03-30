import axios from "axios";
import {
  AuthResponse,
  Fund,
  FundWithEstimation,
  FundSearchResult,
  AllFundsResponse,
  DingTalkConfig,
} from "../types";

const api = axios.create({
  baseURL: "/fundTool/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || "";
      const isAuthEndpoint =
        url.includes("/auth/login") || url.includes("/auth/register");
      if (!isAuthEndpoint) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  register: (username: string, password: string) =>
    api.post<AuthResponse>("/auth/register", { username, password }),

  login: (username: string, password: string) =>
    api.post<AuthResponse>("/auth/login", { username, password }),
};

export const fundApi = {
  search: (keyword: string, limit?: number) =>
    api.get<{ results: FundSearchResult[] }>("/funds/search", {
      params: { keyword, limit },
    }),

  getAll: (page?: number, limit?: number) =>
    api.get<AllFundsResponse>("/funds/all", {
      params: { page, limit },
    }),

  add: (
    code: string,
    is_watchlist?: boolean,
    is_holding?: boolean,
    note?: string,
  ) =>
    api.post<{ message: string; fund: Fund }>("/funds/add", {
      code,
      is_watchlist: is_watchlist ?? true,
      is_holding: is_holding ?? false,
      note,
    }),

  updateFlags: (code: string, is_watchlist: boolean, is_holding: boolean) =>
    api.patch<{ message: string }>(`/funds/${code}/flags`, {
      is_watchlist,
      is_holding,
    }),

  remove: (code: string) => api.delete<{ message: string }>(`/funds/${code}`),

  getPortfolio: (filter?: "watchlist" | "holding") =>
    api.get<{ funds: Fund[] }>("/funds/portfolio", {
      params: filter ? { filter } : {},
    }),

  getPortfolioEstimation: (filter?: "watchlist" | "holding") =>
    api.get<{ estimations: FundWithEstimation[] }>(
      "/funds/portfolio/estimation",
      {
        params: filter ? { filter } : {},
      },
    ),

  getEstimation: (code: string) =>
    api.get<{ estimation: FundWithEstimation["estimation"] }>(
      `/funds/estimation/${code}`,
    ),

  getTop10: () => api.get<{ top10: FundWithEstimation[] }>("/funds/top10"),
};

export const dingtalkApi = {
  getConfig: () =>
    api.get<{ config: DingTalkConfig | null }>("/dingtalk/config"),

  saveConfig: (config: DingTalkConfig) =>
    api.post<{ message: string }>("/dingtalk/config", config),

  testPush: (webhook_url: string, secret?: string) =>
    api.post<{ message: string }>("/dingtalk/test", { webhook_url, secret }),

  pushNow: () => api.post<{ message: string; count: number }>("/dingtalk/push"),
};

export default api;
