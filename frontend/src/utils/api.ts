import axios from "axios";
import {
  AuthResponse,
  Fund,
  FundWithEstimation,
  FundSearchResult,
  AllFundsResponse,
  DingTalkConfig,
  ChatMessage,
  ChatSession,
  UserWithAIPermission,
  AIUsageStats,
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

export const aiApi = {
  checkPermission: () => api.get<{ canUseAI: boolean }>("/ai/permission"),

  chatStream: (
    message: string,
    sessionId: number | null,
    onMessage: (content: string) => void,
    onDone: () => void,
    onError: (error: string) => void,
    onSessionId?: (id: number) => void,
  ) => {
    const token = localStorage.getItem("token");
    const body: { message: string; sessionId?: number } = { message };
    if (sessionId) {
      body.sessionId = sessionId;
    }

    // 使用POST方式
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/fundTool/api/ai/chat", true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    let buffer = "";

    xhr.onprogress = () => {
      const newData = xhr.responseText.substring(buffer.length);
      buffer = xhr.responseText;

      const lines = newData.split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.sessionId && onSessionId) {
              onSessionId(data.sessionId);
            }
            if (data.content) {
              onMessage(data.content);
            }
            if (data.done) {
              onDone();
            }
            if (data.error) {
              onError(data.error);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    };

    xhr.onerror = () => {
      onError("连接错误");
    };

    xhr.onload = () => {
      if (xhr.status !== 200) {
        onError("请求失败");
      }
    };

    xhr.send(JSON.stringify(body));

    return () => xhr.abort();
  },

  sendMessage: async (
    message: string,
    sessionId?: number,
  ): Promise<ReadableStream<Uint8Array>> => {
    const token = localStorage.getItem("token");
    const body: { message: string; sessionId?: number } = { message };
    if (sessionId) {
      body.sessionId = sessionId;
    }

    const response = await fetch("/fundTool/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error("Failed to send message");
    }

    return response.body!;
  },

  // 话题管理
  getSessions: () => api.get<{ sessions: ChatSession[] }>("/ai/sessions"),

  createSession: (title?: string) =>
    api.post<{ id: number; title: string }>("/ai/sessions", { title }),

  deleteSession: (sessionId: number) =>
    api.delete<{ message: string }>(`/ai/sessions/${sessionId}`),

  updateSessionTitle: (sessionId: number, title: string) =>
    api.put<{ message: string }>(`/ai/sessions/${sessionId}/title`, { title }),

  getHistory: (sessionId: number) =>
    api.get<{ history: ChatMessage[] }>(`/ai/history/${sessionId}`),

  clearHistory: (sessionId: number) =>
    api.delete<{ message: string }>(`/ai/history/${sessionId}`),

  // 删除指定消息及之后的所有消息（用于刷新功能）
  deleteMessagesFrom: (sessionId: number, messageId: number) =>
    api.delete<{ message: string }>(
      `/ai/history/${sessionId}/from/${messageId}`,
    ),

  // 保存消息（用于中止时保存已接收的内容）
  saveMessage: (
    sessionId: number,
    message: { role: string; content: string },
  ) =>
    api.post<{ message: string }>(
      `/ai/sessions/${sessionId}/messages`,
      message,
    ),
};

export interface MenuPermissions {
  aiAssistant: boolean;
  admin: boolean;
}

export const menuApi = {
  getPermissions: () =>
    api.get<{ permissions: MenuPermissions }>("/menu/permissions"),
};

export const adminApi = {
  getUsers: () => api.get<{ users: UserWithAIPermission[] }>("/admin/users"),

  updateAIPermission: (userId: number, can_use_ai_assistant: boolean) =>
    api.patch<{ message: string }>(`/admin/users/${userId}/ai-permission`, {
      can_use_ai_assistant,
    }),

  batchUpdateAIPermission: (userIds: number[], can_use_ai_assistant: boolean) =>
    api.post<{ message: string }>("/admin/users/batch-ai-permission", {
      userIds,
      can_use_ai_assistant,
    }),

  getAIStats: () => api.get<{ stats: AIUsageStats }>("/admin/ai-stats"),
};

export default api;
