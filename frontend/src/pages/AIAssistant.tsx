import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { aiApi } from "../utils/api";
import { ChatMessage, ChatSession } from "../types";
import { Button } from "../components/Button";
import {
  ChatMessage as ChatMessageComponent,
  ChatInput,
  SessionSidebar,
  WelcomeScreen,
  TypingIndicator,
} from "../components/ai";
import "./AIAssistant.css";

export function AIAssistant() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasReceivedContent, setHasReceivedContent] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [toast, setToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: "",
  });
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 显示 toast
  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: "" });
    }, 2000);
  };

  // 监听用户滚动
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      50;

    // 只有当用户滚动到底部时，才恢复自动滚动
    setIsUserScrolling(!isAtBottom);
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      loadSessionMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  useEffect(() => {
    if (!isUserScrolling) {
      scrollToBottom();
    }
  }, [messages, isUserScrolling]);

  const loadSessions = async () => {
    try {
      const { data } = await aiApi.getSessions();
      setSessions(data.sessions);
      // 如果有话题，默认选中第一个
      if (data.sessions.length > 0 && !currentSessionId) {
        setCurrentSessionId(data.sessions[0].id);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
    }
  };

  const loadSessionMessages = async (sessionId: number) => {
    try {
      const { data } = await aiApi.getHistory(sessionId);
      // 将后端的字段映射到前端
      const messages = data.history.map((msg: any) => ({
        ...msg,
        toolCalls: msg.tool_calls,
        isError: msg.is_error,
      }));
      setMessages(messages);
    } catch (error) {
      console.error("Failed to load messages:", error);
    }
  };

  const createNewSession = async () => {
    try {
      const { data } = await aiApi.createSession("新话题");
      const newSession: ChatSession = {
        id: data.id,
        title: data.title,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSessionId(data.id);
      setMessages([]);
      setSidebarOpen(false);
    } catch (error) {
      console.error("Failed to create session:", error);
    }
  };

  // 检查话题是否需要更新标题（标题为"新话题"时用第一条消息更新）
  const shouldUpdateTitle = (sessionId: number | null): boolean => {
    if (!sessionId) return false;
    const session = sessions.find((s) => s.id === sessionId);
    return session?.title === "新话题";
  };

  const deleteSession = async (sessionId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除这个话题吗？")) return;

    try {
      await aiApi.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const startEditingTitle = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitle(session.title);
  };

  const saveTitle = async (sessionId: number) => {
    if (!editingTitle.trim()) return;

    try {
      await aiApi.updateSessionTitle(sessionId, editingTitle.trim());
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, title: editingTitle.trim() } : s,
        ),
      );
      setEditingSessionId(null);
    } catch (error) {
      console.error("Failed to update title:", error);
    }
  };

  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditingTitle("");
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 通用的流式聊天请求函数
  const streamChatRequest = async (
    userMessage: string,
    options: {
      onSessionId?: (sessionId: number) => void;
      onContent?: (content: string) => void;
      onToolCall?: (toolCall: any) => void;
      onError?: (error: Error) => void;
    } = {},
  ): Promise<string> => {
    if (!abortControllerRef.current) {
      abortControllerRef.current = new AbortController();
    }

    let assistantMessage = "";

    try {
      const response = await fetch("/fundTool/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId: currentSessionId,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.sessionId && options.onSessionId) {
                  options.onSessionId(data.sessionId);
                }
                if (data.content) {
                  assistantMessage += data.content;
                  if (options.onContent) {
                    options.onContent(assistantMessage);
                  }
                }
                if (data.toolCall && options.onToolCall) {
                  options.onToolCall(data.toolCall);
                }
                if (data.error) {
                  // 处理后端返回的错误
                  const errorMessage = data.errorDetails
                    ? `${data.error} (类型: ${data.errorDetails.type || "未知"}, 代码: ${data.errorDetails.code || "无"})`
                    : data.error;
                  throw new Error(errorMessage);
                }
              } catch (e) {
                // 如果是我们抛出的错误，继续抛出
                if (e instanceof Error && e.message.includes("类型:")) {
                  throw e;
                }
                // 否则忽略解析错误
              }
            }
          }
        }
      }

      return assistantMessage;
    } catch (error: any) {
      if (error.name === "AbortError") {
        console.log("Request was aborted by user");
        // 如果有已接收的内容，保存到后端
        if (assistantMessage.trim() && currentSessionId) {
          try {
            await aiApi.saveMessage(currentSessionId, {
              role: "assistant",
              content: assistantMessage,
            });
          } catch (saveError) {
            console.error("Failed to save aborted message:", saveError);
          }
        }
      } else {
        console.error("Chat request error:", error);
        if (options.onError) {
          options.onError(error);
        }
      }
      throw error;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // 统一的聊天消息处理函数
  const handleChat = async (
    messageOrIndex: string | number,
    options: {
      isRefresh?: boolean;
    } = {},
  ) => {
    if (isLoading) return;

    const { isRefresh } = options;
    let userMessage: string;

    // 如果是刷新，先找到对应的问题并从后端删除旧消息
    if (isRefresh && typeof messageOrIndex === "number") {
      const assistantIndex = messageOrIndex;
      let userMessageIndex = assistantIndex - 1;
      while (
        userMessageIndex >= 0 &&
        messages[userMessageIndex].role !== "user"
      ) {
        userMessageIndex--;
      }

      if (userMessageIndex < 0) {
        console.error("Cannot find user message for refresh");
        return;
      }

      userMessage = messages[userMessageIndex].content;

      // 从后端删除该助手消息及之后的所有消息
      const assistantMessage = messages[assistantIndex];
      if (assistantMessage?.id && currentSessionId) {
        try {
          await aiApi.deleteMessagesFrom(currentSessionId, assistantMessage.id);
        } catch (error) {
          console.error("Failed to delete messages from backend:", error);
        }
      }

      // 标记当前助手回复及之后的所有消息为删除（前端不显示）
      setMessages((prev) =>
        prev.map((msg, idx) =>
          idx >= assistantIndex ? { ...msg, deleted: true } : msg,
        ),
      );

      // 添加一个新的空助手消息用于显示新回答（先隐藏）
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", hidden: true },
      ]);
    } else if (typeof messageOrIndex === "string") {
      // 新消息：添加用户消息和空的助手消息占位到列表（先隐藏）
      userMessage = messageOrIndex;
      setMessages((prev) => [
        ...prev,
        { role: "user", content: userMessage },
        { role: "assistant", content: "", hidden: true },
      ]);
      setInputMessage("");
    } else {
      console.error("Invalid parameters for handleChat");
      return;
    }

    setIsLoading(true);
    setHasReceivedContent(false);
    abortControllerRef.current = new AbortController();

    let receivedSessionId: number | null = null;

    try {
      await streamChatRequest(userMessage, {
        onSessionId: (sessionId) => {
          // 只有新消息时才需要处理sessionId
          if (!isRefresh && !currentSessionId) {
            receivedSessionId = sessionId;
            setCurrentSessionId(sessionId);
            loadSessions();
          }
        },
        onContent: (content) => {
          // 第一次接收到非空内容时，标记为已接收
          if (!hasReceivedContent && content.trim()) {
            setHasReceivedContent(true);
          }
          setMessages((prev) => {
            const newMessages = [...prev];
            // 找到最后一个未删除的助手消息
            let lastAssistantIndex = newMessages.length - 1;
            while (
              lastAssistantIndex >= 0 &&
              (newMessages[lastAssistantIndex].role !== "assistant" ||
                newMessages[lastAssistantIndex].deleted)
            ) {
              lastAssistantIndex--;
            }

            if (lastAssistantIndex >= 0) {
              // 更新现有的助手消息，并显示它
              newMessages[lastAssistantIndex] = {
                ...newMessages[lastAssistantIndex],
                content: content,
                hidden: false,
              };
            } else {
              // 如果没有找到，添加新的助手消息
              newMessages.push({
                role: "assistant",
                content: content,
              });
            }
            return newMessages;
          });
        },
        onToolCall: (toolCall) => {
          setMessages((prev) => {
            const newMessages = [...prev];
            // 找到最后一个未删除的助手消息
            let lastAssistantIndex = newMessages.length - 1;
            while (
              lastAssistantIndex >= 0 &&
              (newMessages[lastAssistantIndex].role !== "assistant" ||
                newMessages[lastAssistantIndex].deleted)
            ) {
              lastAssistantIndex--;
            }

            if (lastAssistantIndex >= 0) {
              const currentToolCalls =
                newMessages[lastAssistantIndex].toolCalls || [];
              const existingIndex = currentToolCalls.findIndex(
                (tc) =>
                  tc.name === toolCall.name &&
                  JSON.stringify(tc.arguments) ===
                    JSON.stringify(toolCall.arguments),
              );

              let updatedToolCalls;
              if (existingIndex >= 0) {
                updatedToolCalls = [...currentToolCalls];
                updatedToolCalls[existingIndex] = toolCall;
              } else {
                updatedToolCalls = [...currentToolCalls, toolCall];
              }

              newMessages[lastAssistantIndex] = {
                ...newMessages[lastAssistantIndex],
                toolCalls: updatedToolCalls,
                hidden: false,
              };
            }
            return newMessages;
          });
        },
      });

      // 只有新消息时才更新标题
      if (!isRefresh) {
        const sessionIdToUpdate = receivedSessionId || currentSessionId;
        if (sessionIdToUpdate && shouldUpdateTitle(sessionIdToUpdate)) {
          const title =
            userMessage.slice(0, 30) + (userMessage.length > 30 ? "..." : "");
          await aiApi.updateSessionTitle(sessionIdToUpdate, title);
          loadSessions();
        }
      }
    } catch (error: any) {
      if (error.name !== "AbortError") {
        // 提取错误信息，优先显示详细的错误消息
        const errorContent = error?.message
          ? `抱歉，请求失败：${error.message}`
          : isRefresh
            ? "抱歉，重新生成回答失败，请稍后重试。"
            : "抱歉，发送消息失败，请稍后重试。";

        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: errorContent,
            isError: true,
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      setHasReceivedContent(false);
      abortControllerRef.current = null;
    }
  };

  // 发送新消息
  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;
    handleChat(inputMessage.trim());
  };

  // 刷新指定回复
  const handleRefreshResponse = (assistantIndex: number) => {
    if (!currentSessionId) return;
    handleChat(assistantIndex, { isRefresh: true });
  };

  // 复制消息内容
  const handleCopyMessage = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast("已复制到剪贴板");
    } catch (error) {
      console.error("复制失败:", error);
      showToast("复制失败");
    }
  };

  // 编辑用户消息
  const handleEditMessage = async (userIndex: number) => {
    if (!currentSessionId) return;

    const userMessage = messages[userIndex];
    if (!userMessage || userMessage.role !== "user") return;

    // 找到该用户消息之后的所有消息（包括对应的助手回复）
    const messageId = userMessage.id;
    if (messageId) {
      try {
        // 从后端删除该消息及之后的所有消息
        await aiApi.deleteMessagesFrom(currentSessionId, messageId);
      } catch (error) {
        console.error("Failed to delete messages:", error);
      }
    }

    // 前端标记该消息及之后的所有消息为删除
    setMessages((prev) =>
      prev.map((msg, idx) =>
        idx >= userIndex ? { ...msg, deleted: true } : msg,
      ),
    );

    // 将消息内容放入输入框
    setInputMessage(userMessage.content);
  };

  const handleClearHistory = async () => {
    if (!currentSessionId) return;
    if (!confirm("确定要清空当前话题的聊天记录吗？")) return;

    try {
      await aiApi.clearHistory(currentSessionId);
      setMessages([]);
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  const handleSelectSession = (sessionId: number) => {
    if (isLoading && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setCurrentSessionId(sessionId);
  };

  return (
    <div className="ai-assistant-container">
      <SessionSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={handleSelectSession}
        onCreateNewSession={createNewSession}
        editingSessionId={editingSessionId}
        editingTitle={editingTitle}
        onEditingTitleChange={setEditingTitle}
        onSaveTitle={saveTitle}
        onCancelEditing={cancelEditing}
        onStartEditing={startEditingTitle}
        onDeleteSession={deleteSession}
      />

      <div className="ai-assistant-main-wrapper">
        <header className="ai-assistant-header">
          <div className="header-content">
            <div className="header-left">
              <button
                className="menu-btn"
                onClick={() => setSidebarOpen(true)}
                title="打开话题列表"
              >
                ☰
              </button>
              <button className="back-btn" onClick={() => navigate("/")}>
                ← 返回
              </button>
              <h1>AI 基金助手</h1>
            </div>
            <div className="header-right">
              {currentSessionId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearHistory}
                  disabled={messages.length === 0 || isLoading}
                >
                  清空当前话题
                </Button>
              )}
              <Button
                variant="primary"
                size="sm"
                onClick={createNewSession}
                disabled={isLoading}
              >
                + 新话题
              </Button>
            </div>
          </div>
        </header>

        <main className="ai-assistant-main">
          <div className="ai-assistant">
            {messages.length === 0 ? (
              <WelcomeScreen />
            ) : (
              <div
                className="ai-assistant__messages"
                ref={messagesContainerRef}
                onScroll={handleScroll}
              >
                {messages.map((msg, index) =>
                  msg.deleted || msg.hidden ? null : (
                    <ChatMessageComponent
                      key={index}
                      msg={msg}
                      index={index}
                      isLoading={isLoading}
                      onCopy={handleCopyMessage}
                      onRefresh={handleRefreshResponse}
                      onEdit={handleEditMessage}
                    />
                  ),
                )}
                {isLoading && !hasReceivedContent && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            )}

            <ChatInput
              value={inputMessage}
              onChange={setInputMessage}
              onSend={handleSendMessage}
              onStop={handleStopGeneration}
              isLoading={isLoading}
            />
          </div>
        </main>
      </div>

      {toast.show && <div className="ai-assistant__toast">{toast.message}</div>}
    </div>
  );
}
