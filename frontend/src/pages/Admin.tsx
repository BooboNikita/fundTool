import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../utils/api";
import { UserWithAIPermission, AIUsageStats } from "../types";
import "./Admin.css";

export function Admin() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithAIPermission[]>([]);
  const [stats, setStats] = useState<AIUsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) {
        setError("未登录");
        setLoading(false);
        return;
      }

      const user = JSON.parse(userStr);
      // 假设第一个用户是管理员
      if (user.id !== 1) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      setIsAdmin(true);
      await Promise.all([loadUsers(), loadStats()]);
    } catch (error) {
      console.error("Failed to check admin:", error);
      setError("检查权限失败");
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data } = await adminApi.getUsers();
      setUsers(data.users);
    } catch (error) {
      console.error("Failed to load users:", error);
      setError("加载用户列表失败");
    }
  };

  const loadStats = async () => {
    try {
      const { data } = await adminApi.getAIStats();
      setStats(data.stats);
    } catch (error) {
      console.error("Failed to load stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePermission = async (
    userId: number,
    currentPermission: boolean,
  ) => {
    try {
      await adminApi.updateAIPermission(userId, !currentPermission);
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId
            ? { ...user, can_use_ai_assistant: !currentPermission }
            : user,
        ),
      );
    } catch (error) {
      console.error("Failed to update permission:", error);
      alert("更新权限失败");
    }
  };

  const handleSelectUser = (userId: number) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const handleBatchEnable = async () => {
    if (selectedUsers.size === 0) return;

    try {
      await adminApi.batchUpdateAIPermission(Array.from(selectedUsers), true);
      setUsers((prev) =>
        prev.map((user) =>
          selectedUsers.has(user.id)
            ? { ...user, can_use_ai_assistant: true }
            : user,
        ),
      );
      setSelectedUsers(new Set());
    } catch (error) {
      console.error("Failed to batch update:", error);
      alert("批量更新失败");
    }
  };

  const handleBatchDisable = async () => {
    if (selectedUsers.size === 0) return;

    try {
      await adminApi.batchUpdateAIPermission(Array.from(selectedUsers), false);
      setUsers((prev) =>
        prev.map((user) =>
          selectedUsers.has(user.id)
            ? { ...user, can_use_ai_assistant: false }
            : user,
        ),
      );
      setSelectedUsers(new Set());
    } catch (error) {
      console.error("Failed to batch update:", error);
      alert("批量更新失败");
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.id.toString().includes(searchTerm),
  );

  if (loading) {
    return (
      <div className="admin-container">
        <header className="admin-header">
          <div className="header-content">
            <div className="header-left">
              <button className="back-btn" onClick={() => navigate("/")}>
                ← 返回
              </button>
              <h1>管理后台</h1>
            </div>
          </div>
        </header>
        <main className="admin-main">
          <div className="admin__loading">
            <div className="admin__spinner"></div>
            <p>加载中...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="admin-container">
        <header className="admin-header">
          <div className="header-content">
            <div className="header-left">
              <button className="back-btn" onClick={() => navigate("/")}>
                ← 返回
              </button>
              <h1>管理后台</h1>
            </div>
          </div>
        </header>
        <main className="admin-main">
          <div className="admin__no-access">
            <div className="admin__icon">🚫</div>
            <h2>访问被拒绝</h2>
            <p>您没有权限访问管理后台</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-container">
        <header className="admin-header">
          <div className="header-content">
            <div className="header-left">
              <button className="back-btn" onClick={() => navigate("/")}>
                ← 返回
              </button>
              <h1>管理后台</h1>
            </div>
          </div>
        </header>
        <main className="admin-main">
          <div className="admin__error">
            <div className="admin__icon">⚠️</div>
            <h2>出错了</h2>
            <p>{error}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="admin-container">
      <header className="admin-header">
        <div className="header-content">
          <div className="header-left">
            <button className="back-btn" onClick={() => navigate("/")}>
              ← 返回
            </button>
            <h1>管理后台</h1>
          </div>
        </div>
      </header>

      <main className="admin-main">
        <div className="admin">
          <div className="admin__header">
            <h2>用户权限管理</h2>
            <p>管理用户 AI 助手权限</p>
          </div>

          {stats && (
            <div className="admin__stats">
              <div className="admin__stat-card">
                <div className="admin__stat-value">{stats.totalUsers}</div>
                <div className="admin__stat-label">总用户数</div>
              </div>
              <div className="admin__stat-card">
                <div className="admin__stat-value admin__stat-value--success">
                  {stats.aiEnabledUsers}
                </div>
                <div className="admin__stat-label">AI 权限用户</div>
              </div>
              <div className="admin__stat-card">
                <div className="admin__stat-value">
                  {stats.totalChatMessages}
                </div>
                <div className="admin__stat-label">总对话数</div>
              </div>
              <div className="admin__stat-card">
                <div className="admin__stat-value admin__stat-value--info">
                  {stats.todayChatMessages}
                </div>
                <div className="admin__stat-label">今日对话</div>
              </div>
            </div>
          )}

          <div className="admin__content">
            <div className="admin__toolbar">
              <div className="admin__search">
                <input
                  type="text"
                  placeholder="搜索用户名或ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="admin__actions">
                <button
                  className="admin__btn admin__btn--success"
                  onClick={handleBatchEnable}
                  disabled={selectedUsers.size === 0}
                >
                  批量启用
                </button>
                <button
                  className="admin__btn admin__btn--danger"
                  onClick={handleBatchDisable}
                  disabled={selectedUsers.size === 0}
                >
                  批量禁用
                </button>
              </div>
            </div>

            <div className="admin__table-wrapper">
              <table className="admin__table">
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={
                          filteredUsers.length > 0 &&
                          selectedUsers.size === filteredUsers.length
                        }
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th>ID</th>
                    <th>用户名</th>
                    <th>注册时间</th>
                    <th>AI 权限</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(user.id)}
                          onChange={() => handleSelectUser(user.id)}
                        />
                      </td>
                      <td>{user.id}</td>
                      <td>{user.username}</td>
                      <td>
                        {new Date(user.created_at).toLocaleDateString("zh-CN")}
                      </td>
                      <td>
                        <span
                          className={`admin__badge ${
                            user.can_use_ai_assistant
                              ? "admin__badge--success"
                              : "admin__badge--default"
                          }`}
                        >
                          {user.can_use_ai_assistant ? "已启用" : "未启用"}
                        </span>
                      </td>
                      <td>
                        <button
                          className={`admin__toggle-btn ${
                            user.can_use_ai_assistant
                              ? "admin__toggle-btn--active"
                              : ""
                          }`}
                          onClick={() =>
                            handleTogglePermission(
                              user.id,
                              user.can_use_ai_assistant,
                            )
                          }
                        >
                          <span className="admin__toggle-slider"></span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredUsers.length === 0 && (
                <div className="admin__empty">
                  <p>没有找到匹配的用户</p>
                </div>
              )}
            </div>

            <div className="admin__footer">
              <p>
                已选择 {selectedUsers.size} 个用户 | 共 {filteredUsers.length}{" "}
                个用户
              </p>
            </div>
          </div>

          {stats && stats.topUsers.length > 0 && (
            <div className="admin__section">
              <h3>活跃用户排行 (TOP 10)</h3>
              <div className="admin__top-users">
                {stats.topUsers.map((user, index) => (
                  <div key={index} className="admin__top-user">
                    <div className="admin__top-user-rank">#{index + 1}</div>
                    <div className="admin__top-user-name">{user.username}</div>
                    <div className="admin__top-user-count">
                      {user.message_count} 条消息
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
