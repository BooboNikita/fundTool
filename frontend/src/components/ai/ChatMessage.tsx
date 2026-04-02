import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChatMessage as ChatMessageType } from "../../types";

interface ChatMessageProps {
  msg: ChatMessageType;
  index: number;
  isLoading: boolean;
  onCopy: (content: string) => void;
  onRefresh: (index: number) => void;
  onEdit: (index: number) => void;
}

export function ChatMessage({
  msg,
  index,
  isLoading,
  onCopy,
  onRefresh,
  onEdit,
}: ChatMessageProps) {
  return (
    <div
      className={`ai-assistant__message ${msg.role === "user" ? "user" : "assistant"}`}
    >
      <div className="ai-assistant__message-avatar">
        {msg.role === "user" ? "👤" : "🤖"}
      </div>
      <div className="ai-assistant__message-content">
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
