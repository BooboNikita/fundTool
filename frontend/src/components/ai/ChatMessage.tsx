import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { ChatMessage as ChatMessageType } from "../../types";

interface ChatMessageProps {
  msg: ChatMessageType;
  index: number;
  isLoading: boolean;
  onCopy: (content: string) => void;
  onRefresh: (index: number) => void;
  onEdit: (index: number) => void;
}

const toolNameMap: Record<string, string> = {
  get_user_holdings: "获取用户持仓",
  get_user_watchlist: "获取自选基金",
  get_top10_funds: "获取热门TOP10基金",
  search_funds: "搜索基金",
};

export function ChatMessage({
  msg,
  index,
  isLoading,
  onCopy,
  onRefresh,
  onEdit,
}: ChatMessageProps) {
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());

  const toggleTool = (toolIndex: number) => {
    setExpandedTools((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(toolIndex)) {
        newSet.delete(toolIndex);
      } else {
        newSet.add(toolIndex);
      }
      return newSet;
    });
  };

  return (
    <div
      className={`ai-assistant__message ${msg.role === "user" ? "user" : "assistant"}`}
    >
      <div className="ai-assistant__message-avatar">
        {msg.role === "user" ? "👤" : "🤖"}
      </div>
      <div className="ai-assistant__message-content">
        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="ai-assistant__tool-calls">
            {msg.toolCalls.map((toolCall, toolIndex) => (
              <div key={toolIndex} className="ai-assistant__tool-call">
                <div
                  className="ai-assistant__tool-header"
                  onClick={() => toggleTool(toolIndex)}
                >
                  <span className="ai-assistant__tool-icon">
                    {toolCall.status === "running" ? "⏳" : 
                     toolCall.status === "completed" ? "✅" : "❌"}
                  </span>
                  <span className="ai-assistant__tool-name">
                    {toolNameMap[toolCall.name] || toolCall.name}
                  </span>
                  <span className="ai-assistant__tool-status">
                    {toolCall.status === "running" ? "执行中..." : 
                     toolCall.status === "completed" ? "完成" : "失败"}
                  </span>
                  <span className={`ai-assistant__tool-expand ${expandedTools.has(toolIndex) ? "expanded" : ""}`}>
                    ▼
                  </span>
                </div>
                {expandedTools.has(toolIndex) && (
                  <div className="ai-assistant__tool-details">
                    <div className="ai-assistant__tool-section">
                      <div className="ai-assistant__tool-label">输入参数</div>
                      <pre className="ai-assistant__tool-code">
                        {JSON.stringify(toolCall.arguments, null, 2)}
                      </pre>
                    </div>
                    {toolCall.result && (
                      <div className="ai-assistant__tool-section">
                        <div className="ai-assistant__tool-label">执行结果</div>
                        <pre className="ai-assistant__tool-code">
                          {JSON.stringify(toolCall.result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="ai-assistant__message-bubble">
          {msg.role === "assistant" ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {msg.content}
            </ReactMarkdown>
          ) : (
            msg.content
          )}
        </div>
        {!isLoading && (
          <div className="ai-assistant__message-actions">
            <button
              className="ai-assistant__action-btn"
              onClick={() => onCopy(msg.content)}
              title="复制"
            >
              <img src="/fundTool/assets/copy.svg" alt="复制" />
            </button>
            {msg.role === "assistant" && (
              <button
                className="ai-assistant__action-btn"
                onClick={() => onRefresh(index)}
                title="重新回答"
              >
                <img src="/fundTool/assets/refresh.svg" alt="刷新" />
              </button>
            )}
            {msg.role === "user" && (
              <button
                className="ai-assistant__action-btn"
                onClick={() => onEdit(index)}
                title="编辑"
              >
                <img src="/fundTool/assets/edit.svg" alt="编辑" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
