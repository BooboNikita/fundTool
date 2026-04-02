export function WelcomeScreen() {
  return (
    <div className="ai-assistant__welcome">
      <div className="ai-assistant__welcome-icon">🤖</div>
      <h3>AI 基金助手</h3>
      <p>我是您的专业基金投资顾问，可以帮您：</p>
      <ul>
        <li>📊 查询当前持有的基金</li>
        <li>⭐ 查询自选基金</li>
        <li>🔥 查看热门 TOP10 基金</li>
        <li>🔍 根据代码或名称搜索基金</li>
      </ul>
      <p className="ai-assistant__welcome-hint">
        点击上方"新话题"开始对话，或在左侧选择已有话题
      </p>
    </div>
  );
}
