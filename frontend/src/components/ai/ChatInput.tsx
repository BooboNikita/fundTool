import { useRef, useEffect } from "react";
import { Button } from "../Button";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isLoading,
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) {
        onSend();
      }
    }
  };

  return (
    <div className="ai-assistant__input-area">
      <div className="ai-assistant__input-wrapper">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入您的问题..."
          rows={1}
          disabled={disabled || isLoading}
        />
        {isLoading ? (
          <Button
            onClick={onStop}
            variant="danger"
            className="ai-assistant__send-btn"
          >
            停止
          </Button>
        ) : (
          <Button
            onClick={onSend}
            disabled={!value.trim()}
            className="ai-assistant__send-btn"
          >
            发送
          </Button>
        )}
      </div>
      <p className="ai-assistant__input-hint">
        按 Enter 发送，Shift + Enter 换行
      </p>
    </div>
  );
}
