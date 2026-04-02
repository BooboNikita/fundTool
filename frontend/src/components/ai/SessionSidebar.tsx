import { ChatSession } from "../../types";
import { formatTime } from "../../utils/date";

interface SessionSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: number | null;
  onSelectSession: (sessionId: number) => void;
  onCreateNewSession: () => void;
  editingSessionId: number | null;
  editingTitle: string;
  onEditingTitleChange: (title: string) => void;
  onSaveTitle: (sessionId: number) => void;
  onCancelEditing: () => void;
  onStartEditing: (session: ChatSession, e: React.MouseEvent) => void;
  onDeleteSession: (sessionId: number, e: React.MouseEvent) => void;
}

export function SessionSidebar({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onCreateNewSession,
  editingSessionId,
  editingTitle,
  onEditingTitleChange,
  onSaveTitle,
  onCancelEditing,
  onStartEditing,
  onDeleteSession,
}: SessionSidebarProps) {
  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <h2>话题列表</h2>
          <button
            className="new-chat-btn"
            onClick={onCreateNewSession}
            title="新建话题"
          >
            <span>+</span>
            新话题
          </button>
        </div>

        <div className="sidebar-sessions">
          {sessions.length === 0 ? (
            <div className="sidebar-empty">暂无话题，点击上方按钮创建</div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`session-item ${currentSessionId === session.id ? "active" : ""}`}
                onClick={() => {
                  onSelectSession(session.id);
                  onClose();
                }}
              >
                <div className="session-icon">💬</div>
                <div className="session-info">
                  {editingSessionId === session.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => onEditingTitleChange(e.target.value)}
                      onBlur={() => onSaveTitle(session.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onSaveTitle(session.id);
                        } else if (e.key === "Escape") {
                          onCancelEditing();
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="session-title-input"
                    />
                  ) : (
                    <>
                      <div className="session-title">{session.title}</div>
                      <div className="session-time">
                        {formatTime(session.updated_at)}
                      </div>
                    </>
                  )}
                </div>
                <div className="session-actions">
                  <button
                    className="session-action-btn"
                    onClick={(e) => onStartEditing(session, e)}
                    title="重命名"
                  >
                    ✏️
                  </button>
                  <button
                    className="session-action-btn delete"
                    onClick={(e) => onDeleteSession(session.id, e)}
                    title="删除"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
