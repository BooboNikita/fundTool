import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { authApi } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Card, CardBody } from "../components/Card";
import "./Login.css";

export function Login() {
  const [username, setUsername] = useState(
    () => localStorage.getItem("last_username") || "",
  );
  const [password, setPassword] = useState(
    () => localStorage.getItem("last_password") || "",
  );
  const [rememberPassword, setRememberPassword] = useState(
    () => localStorage.getItem("remember_password") === "true",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await authApi.login(username, password);
      login(response.data.token, response.data.user);

      // 保存账号
      localStorage.setItem("last_username", username);
      if (rememberPassword) {
        localStorage.setItem("last_password", password);
        localStorage.setItem("remember_password", "true");
      } else {
        localStorage.removeItem("last_password");
        localStorage.setItem("remember_password", "false");
      }

      console.log("登录成功", response.data);
      navigate("/");
    } catch (err: any) {
      console.error("登录失败", err);
      setError(err.response?.data?.error || "登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-glow" />
      </div>
      <Card className="login-card">
        <CardBody>
          <div className="login-header">
            <h1>基金净值浏览</h1>
            <p>登录您的账户</p>
          </div>
          <form onSubmit={handleSubmit} className="login-form">
            {error && <div className="login-error">{error}</div>}
            <Input
              label="用户名"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
            />
            <Input
              label="密码"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
            />
            <label className="login-remember">
              <input
                type="checkbox"
                checked={rememberPassword}
                onChange={(e) => setRememberPassword(e.target.checked)}
              />
              记住密码
            </label>
            <Button type="submit" loading={loading} fullWidth>
              登录
            </Button>
          </form>
          <div className="login-footer">
            还没有账户？<Link to="/register">立即注册</Link>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
