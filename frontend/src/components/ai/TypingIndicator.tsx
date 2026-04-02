export function TypingIndicator() {
  return (
    <div className="ai-assistant__message assistant">
      <div className="ai-assistant__message-avatar">🤖</div>
      <div className="ai-assistant__message-content">
        <div className="ai-assistant__message-bubble">
          <div className="ai-assistant__typing">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>
  );
}
