import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { dingtalkApi } from "../utils/api";
import { DingTalkConfig } from "../types";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Card, CardHeader, CardBody } from "../components/Card";
import "./Settings.css";

export function Settings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pushMode, setPushMode] = useState<"time" | "interval">("time");
  const [config, setConfig] = useState<DingTalkConfig>({
    webhook_url: "",
    secret: "",
    push_times: ["09:00"],
    push_interval_hours: 0,
    push_enabled: false,
    push_watchlist: true,
    push_holding: true,
  });
  const [newTime, setNewTime] = useState("09:00");

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await dingtalkApi.getConfig();
      if (response.data.config) {
        const cfg = response.data.config;
        setConfig(cfg);
        if ((cfg.push_interval_hours || 0) > 0) {
          setPushMode("interval");
        } else {
          setPushMode("time");
        }
      }
    } catch (error) {
      console.error("Failed to fetch config:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config.push_watchlist && !config.push_holding) {
      alert("请至少选择一种推送分类");
      return;
    }
    if (pushMode === "time" && (config.push_times || []).length === 0) {
      alert("请至少添加一个推送时间");
      return;
    }
    if (pushMode === "interval" && (config.push_interval_hours || 0) === 0) {
      alert("请选择推送间隔时间");
      return;
    }

    const saveConfig = {
      ...config,
      push_interval_hours:
        pushMode === "interval" ? config.push_interval_hours || 0 : 0,
    };

    setSaving(true);
    try {
      await dingtalkApi.saveConfig(saveConfig);
      alert("保存成功！");
    } catch (error: any) {
      alert(error.response?.data?.error || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!config.webhook_url) {
      alert("请先填写 Webhook 地址");
      return;
    }
    setTesting(true);
    try {
      await dingtalkApi.testPush(config.webhook_url, config.secret);
      alert("测试消息已发送！请检查钉钉群消息。");
    } catch (error: any) {
      alert(error.response?.data?.error || "发送失败，请检查配置");
    } finally {
      setTesting(false);
    }
  };

  const handlePushNow = async () => {
    setPushing(true);
    try {
      await dingtalkApi.pushNow();
      alert("推送成功！");
    } catch (error: any) {
      alert(error.response?.data?.error || "推送失败");
    } finally {
      setPushing(false);
    }
  };

  const addPushTime = () => {
    if (!newTime) return;
    const currentTimes = config.push_times || [];
    if (currentTimes.includes(newTime)) {
      alert("该时间已存在");
      return;
    }
    setConfig({
      ...config,
      push_times: [...currentTimes, newTime].sort(),
    });
  };

  const removePushTime = (time: string) => {
    const currentTimes = config.push_times || [];
    setConfig({
      ...config,
      push_times: currentTimes.filter((t) => t !== time),
    });
  };

  return (
    <div className="settings-container">
      <header className="settings-header">
        <div className="header-content">
          <div className="header-left">
            <button className="back-btn" onClick={() => navigate("/")}>
              ← 返回
            </button>
            <h1>设置</h1>
          </div>
        </div>
      </header>

      <main className="settings-main">
        <Card>
          <CardHeader>
            <span>钉钉推送设置</span>
          </CardHeader>
          <CardBody>
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner" />
                <p>加载中...</p>
              </div>
            ) : (
              <div className="settings-form">
                <div className="form-group">
                  <label className="form-label">Webhook 地址</label>
                  <Input
                    placeholder="钉钉机器人 Webhook 地址"
                    value={config.webhook_url}
                    onChange={(e) =>
                      setConfig({ ...config, webhook_url: e.target.value })
                    }
                  />
                  <p className="form-hint">
                    在钉钉群设置中添加自定义机器人，获取 Webhook 地址
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">签名密钥（可选）</label>
                  <Input
                    placeholder="机器人安全设置中的签名密钥"
                    value={config.secret}
                    onChange={(e) =>
                      setConfig({ ...config, secret: e.target.value })
                    }
                  />
                  <p className="form-hint">
                    如启用了加签安全设置，请填写对应的密钥
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label">推送方式</label>
                  <div className="radio-group">
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="pushMode"
                        checked={pushMode === "time"}
                        onChange={() => setPushMode("time")}
                      />
                      <span>固定时间推送</span>
                    </label>
                    <label className="radio-label">
                      <input
                        type="radio"
                        name="pushMode"
                        checked={pushMode === "interval"}
                        onChange={() => setPushMode("interval")}
                      />
                      <span>间隔推送</span>
                    </label>
                  </div>
                </div>

                {pushMode === "time" && (
                  <div className="form-group">
                    <label className="form-label">推送时间</label>
                    <div className="time-input-row">
                      <Input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                      />
                      <Button size="sm" onClick={addPushTime}>
                        添加
                      </Button>
                    </div>
                    <div className="time-tags">
                      {(config.push_times || []).map((time) => (
                        <span key={time} className="time-tag">
                          {time}
                          <button
                            className="time-tag-remove"
                            onClick={() => removePushTime(time)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <p className="form-hint">
                      添加多个时间点，每天将在这些时间自动推送
                    </p>
                  </div>
                )}

                {pushMode === "interval" && (
                  <div className="form-group">
                    <label className="form-label">推送间隔</label>
                    <div className="interval-select">
                      <select
                        value={config.push_interval_hours}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            push_interval_hours: parseInt(e.target.value),
                          })
                        }
                      >
                        <option value={0}>选择间隔</option>
                        <option value={1}>每隔 1 小时</option>
                        <option value={2}>每隔 2 小时</option>
                        <option value={3}>每隔 3 小时</option>
                        <option value={4}>每隔 4 小时</option>
                        <option value={6}>每隔 6 小时</option>
                        <option value={8}>每隔 8 小时</option>
                        <option value={12}>每隔 12 小时</option>
                      </select>
                    </div>
                    <p className="form-hint">
                      选择每隔多长时间推送一次（如上次推送后每隔 X
                      小时自动推送）
                    </p>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">推送分类</label>
                  <div className="checkbox-group">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={config.push_watchlist}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            push_watchlist: e.target.checked,
                          })
                        }
                      />
                      <span>自选基金</span>
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={config.push_holding}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            push_holding: e.target.checked,
                          })
                        }
                      />
                      <span>持有基金</span>
                    </label>
                  </div>
                  <p className="form-hint">
                    选择要推送的基金分类，推送消息将按分类以表格形式展示
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label toggle-label">
                    <input
                      type="checkbox"
                      checked={config.push_enabled}
                      onChange={(e) =>
                        setConfig({ ...config, push_enabled: e.target.checked })
                      }
                    />
                    <span>开启定时推送</span>
                  </label>
                </div>

                <div className="form-actions">
                  <Button
                    variant="secondary"
                    onClick={handleTest}
                    loading={testing}
                  >
                    测试推送
                  </Button>
                  <Button onClick={handlePushNow} loading={pushing}>
                    立即推送
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    loading={saving}
                  >
                    保存设置
                  </Button>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="help-card">
          <CardHeader>
            <span>使用帮助</span>
          </CardHeader>
          <CardBody>
            <div className="help-content">
              <h4>如何获取钉钉 Webhook？</h4>
              <ol>
                <li>打开钉钉群设置 → 智能群助手</li>
                <li>点击"添加机器人"</li>
                <li>选择"自定义"机器人</li>
                <li>设置机器人名称，点击"完成"</li>
                <li>复制 Webhook 地址到上方输入框</li>
              </ol>
              <h4>如何启用加签？</h4>
              <ol>
                <li>在机器人设置中开启"加签"安全设置</li>
                <li>复制生成的密钥到上方"签名密钥"输入框</li>
              </ol>
              <h4>推送方式说明</h4>
              <ul>
                <li>
                  <strong>固定时间推送</strong>
                  ：每天在指定的时间点推送，可添加多个时间
                </li>
                <li>
                  <strong>间隔推送</strong>：每隔 X 小时推送一次，适合实时监控
                </li>
              </ul>
              <h4>推送消息格式</h4>
              <p>
                推送消息使用 Markdown
                格式，按自选/持有分类展示为表格，包含基金名称、代码、估算净值和估算涨幅。
              </p>
            </div>
          </CardBody>
        </Card>
      </main>
    </div>
  );
}
