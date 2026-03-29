# 基金净值浏览工具

个人基金净值管理工具，支持基金搜索、添加、分类管理、定时推送等功能。

## 功能特性

### 基金管理

- 支持搜索全市场基金（8000+只）
- 基金分类管理：自选 / 持有
- 灵活分类：一只基金可同时属于"自选"和"持有"
- 实时估值：获取东方财富实时基金估值数据
- 涨跌提醒：一目了然查看基金涨幅

### 钉钉推送

- 支持配置钉钉机器人 Webhook
- 固定时间推送：每天在指定时间自动推送
- 间隔推送：每隔 1/2/3/4/6/8/12 小时推送
- 交易时间判断：间隔推送仅在 A股交易时间（9:30-15:00）执行
- 分类推送：可选择只推送自选基金或持有基金
- Markdown 表格格式：美观易读

### 用户体验

- 暗黑主题 UI
- 响应式设计
- 紧凑列表展示
- 用户数据隔离

## 技术栈

### 后端

- Node.js + Express
- TypeScript
- MySQL 数据库
- JWT 用户认证

### 前端

- React + TypeScript
- Vite 构建工具
- React Router
- Axios

## 快速开始

### 环境要求

- Node.js 18+
- MySQL 5.7+

### 安装配置

1. 克隆项目

```bash
git clone https://github.com/BooboNikita/fundTool.git
cd fundTool
```

2. 配置数据库

```bash
# 创建数据库
mysql -u root -e "CREATE DATABASE fund_tool CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# 配置环境变量（可选）
export DB_HOST=localhost
export DB_PORT=3306
export DB_USER=root
export DB_PASSWORD=your_password
export DB_NAME=fund_tool
```

3. 安装后端依赖并启动

```bash
cd backend
npm install
npm run build
npm start
# 服务运行在 http://localhost:3001
```

4. 安装前端依赖并启动

```bash
cd frontend
npm install
npm run dev
# 前端运行在 http://localhost:5173
```

## 项目结构

```
fundTool/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── controllers/   # 控制器
│   │   ├── models/        # 数据库模型
│   │   ├── routes/       # 路由
│   │   ├── types/        # 类型定义
│   │   └── index.ts      # 入口文件
│   └── package.json
├── frontend/              # 前端应用
│   ├── src/
│   │   ├── components/   # 组件
│   │   ├── contexts/     # React Context
│   │   ├── pages/       # 页面组件
│   │   ├── styles/      # 样式
│   │   ├── types/       # 类型定义
│   │   ├── utils/       # 工具函数
│   │   └── App.tsx      # 应用入口
│   └── package.json
└── README.md
```

## API 接口

### 认证

- `POST /api/auth/register` - 用户注册
- `POST /api/auth/login` - 用户登录

### 基金

- `GET /api/funds/search` - 搜索基金
- `GET /api/funds/all` - 获取所有基金（分页）
- `POST /api/funds/add` - 添加基金
- `PATCH /api/funds/:code/flags` - 更新基金分类
- `DELETE /api/funds/:code` - 删除基金
- `GET /api/funds/portfolio` - 获取用户基金组合
- `GET /api/funds/portfolio/estimation` - 获取组合估值

### 钉钉推送

- `GET /api/dingtalk/config` - 获取推送配置
- `POST /api/dingtalk/config` - 保存推送配置
- `POST /api/dingtalk/test` - 测试推送
- `POST /api/dingtalk/push` - 立即推送

## 核心亮点

1. **灵活的基金分类体系** - 支持"自选"和"持有"两个独立维度
2. **完整的基金数据生态** - 内置全市场基金数据
3. **优质的用户体验** - 暗黑系主题，紧凑布局
4. **完善的钉钉推送** - 多时间点、间隔推送、交易时间判断

## License

MIT
