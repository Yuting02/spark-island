# 架构设计与文件说明（v1.2）

## 1. 总体架构

```
┌─────────────────────────── 浏览器 ───────────────────────────┐
│  index.html  星火岛（Canvas 动森风渲染 + DOM 浮层场景/对话框）│
│  admin.html  管理后台（密码登录 + 内容上传）                   │
│      │  fetch /api/*                                          │
└──────┼────────────────────────────────────────────────────────┘
       ▼
┌─────────────────────────── Node.js ──────────────────────────┐
│  Express                                                      │
│   ├─ 静态托管  web/、data/uploads（媒体文件）                  │
│   ├─ 公共 API  新闻/书籍/电台/玩家/笔记/任务/阅读计时/咖啡馆   │
│   ├─ 经济模块  economy.js（钱包、交易流水、菜单、奖励常量）    │
│   └─ 管理 API  登录鉴权 + 内容增删（multer 处理文件上传）      │
│      │                                                        │
│      ▼                                                        │
│  data/db.json（JSON 文件存储，原子写入）+ data/uploads/ 媒体   │
└───────────────────────────────────────────────────────────────┘
```

### 关键技术决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 前端框架 | **无框架**，原生 ES Module + Canvas | 游戏主体是 Canvas 绘制；MVP 零构建、clone 即跑 |
| 游戏引擎 | **手写微引擎** | 瓦片地图 + 碰撞 + 多地图切换 + NPC 游走，自写可控且轻量 |
| 美术 | **Canvas 矢量手绘（动森风）** | 圆角/圆弧/渐变程序绘制，仓库零图片资产；改造美术=改代码 |
| epub 渲染 | epub.js（CDN） | 浏览器端解析渲染 epub 的事实标准 |
| 后端 | Express + multer | 最小可用的 API + 文件上传组合 |
| 存储 | JSON 文件（自写存储层） | 零原生依赖、零外部服务；接口隔离可平替 SQLite |
| 玩家身份 | 昵称 → 服务端发 UUID → localStorage | 免注册；邮箱绑定为可选奖励项（不发验证邮件） |
| 经济 | 服务端集中记账 | 奖励/扣费全部服务端判定 + 交易流水，前端只展示 |
| 部署 | GitHub 托管代码；Node 进程运行 | GitHub Pages 静态托管无法承载后端能力 |

## 2. 项目文件一览

```
game/
├─ requirement.txt          # 原始需求（v1.0 + v1.1 调整）
├─ README.md                # 运行 / 玩法 / 管理 / 部署指南
├─ package.json             # 依赖与脚本（npm start / npm run seed）
├─ docs/                    # PRD.md 产品方案 · ARCHITECTURE.md 本文档
├─ server/                  # ───── 后端 ─────
│  ├─ index.js              # Express 入口
│  ├─ db.js                 # JSON 存储层（原子写入；集合 CRUD）
│  ├─ economy.js            # 金币经济：奖励常量、咖啡菜单、addCoins 记账
│  ├─ auth.js               # 管理员登录 token
│  └─ routes/
│     ├─ public.js          # 玩家侧 API（含金币/阅读心跳/咖啡点单）
│     └─ admin.js           # 管理侧 API（multer 上传）
├─ web/                     # ───── 前端 ─────
│  ├─ index.html            # 游戏页：canvas + HUD + 对话框 + 浮层 + 起名弹窗
│  ├─ admin.html            # 管理后台页
│  ├─ css/style.css         # 动森风 UI：奶油色、圆角胶囊、柔和阴影
│  └─ js/
│     ├─ api.js             # fetch 封装（玩家侧 + 管理侧）
│     ├─ main.js            # 启动编排：身份/金币 HUD/任务/场景与对话路由
│     ├─ admin.js           # 管理后台逻辑
│     ├─ game/
│     │  ├─ art.js          # 动森风绘制：Q 萌角色（配饰区分 NPC）/地形/建筑/家具
│     │  ├─ world.js        # 世界定义：户外岛 + 4 室内地图、NPC 配置、碰撞/传送门
│     │  ├─ engine.js       # 引擎：移动碰撞、地图切换（踩门进出）、NPC 游走、热点检测
│     │  └─ dialog.js       # 动森式对话框（名牌 + 打字机 + E 推进）
│     └─ scenes/            # DOM 浮层场景
│        ├─ news.js         # 报纸阅读（任务①）
│        ├─ bookshelf.js    # 书架挑书 + 我的笔记本
│        ├─ reading.js      # 自习桌：epub + 笔记（任务②）+ 阅读计时心跳
│        ├─ radio.js        # 播放器（任务③）
│        ├─ cafe.js         # 咖啡馆点单（金币消费）
│        └─ profile.js      # 岛民护照：余额/邮箱绑定/账单
├─ scripts/seed.js          # 种子：示例新闻 + 生成 epub + 生成 WAV
└─ data/                    # 运行时生成，不进 git（db.json + uploads/）
```

## 3. 数据模型（data/db.json）

```jsonc
{
  "news":        [{ "id", "title", "date", "content(markdown)", "createdAt" }],
  "books":       [{ "id", "title", "author", "file", "createdAt" }],
  "radio":       [{ "id", "title", "file", "createdAt" }],
  "players":     [{ "id", "nickname", "coins", "email", "createdAt" }],
  "notes":       [{ "id", "playerId", "bookId", "bookTitle", "content", "createdAt" }],
  "progress":    [{ "playerId", "date", "tasks": { "news", "study", "radio" } }],
  "transactions":[{ "id", "playerId", "amount", "reason", "balance", "createdAt" }],
  "reading":     [{ "playerId", "date", "seconds", "rewarded" }],
  "orders":      [{ "id", "playerId", "itemId", "itemName", "price", "createdAt" }]
}
```

## 4. API 设计

### 玩家侧（无鉴权）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET  | `/api/news/today` | 当日新闻（无则回退最近一期） |
| GET  | `/api/books` · `/api/radio` | 内容列表 |
| POST | `/api/players` | 建玩家（发 10🪙 见面礼） |
| GET  | `/api/players/:id` | 玩家信息（昵称/金币/邮箱） |
| POST | `/api/players/:id/email` | 绑定邮箱（+100🪙，唯一性校验） |
| GET  | `/api/transactions/:playerId` | 最近 50 笔交易流水 |
| GET/POST | `/api/notes…` | 笔记回看 / 保存 |
| GET  | `/api/progress/:playerId` | 当日任务进度 |
| POST | `/api/progress` | 标记任务完成（新完成 +10🪙，返回余额） |
| GET  | `/api/reading/:playerId` | 今日阅读秒数 / 目标 / 是否已奖励 |
| POST | `/api/reading` | 阅读心跳（单次 ≤60s；累计 1800s 当日一次 +10🪙） |
| GET  | `/api/cafe/menu` | 菜单（6 款，9–35🪙） |
| POST | `/api/cafe/order` | 点单（服务端扣款，余额不足 400） |
| GET  | `/api/cafe/orders/:playerId` | 最近点单 |

### 管理侧（Bearer token，同 v1.0）
login / overview / news 增删查 / books、radio 上传删除。

## 5. 前端游戏实现要点

- **坐标系**：TILE=48px，角色锚点为脚底中心；碰撞用脚部采样点，分轴判定可贴障碍滑动。
- **多地图**：`world.js` 声明式定义每张地图（地形字符画、可走判定、传送门、家具交互点、NPC）；背景（地形+家具）按地图预渲染缓存，海浪两帧动画。
- **进出门**：户外踩建筑门口瓦片 → 自动切室内；室内踩门垫 → 回岛。传送门"武装"机制防止来回闪切；切图带淡入。
- **NPC**：场馆 NPC 原地随机转向；行人随机选相邻可走瓦片游走（避开门口与玩家）；对话时转身面向玩家。
- **热点检测**：家具（曼哈顿距离 ≤1）与 NPC（≤2，可隔吧台对话）就近取一，头顶气泡提示"Ⓔ 动作"。
- **对话框**：DOM 实现，打字机逐字、E/空格/点击推进，capture 阶段拦截按键避免透传引擎。
- **书屋两段式**：书架场景 onSelect 把书存到主控状态 → 自习桌场景读取；未选书时坐下会被提示先挑书。
- **阅读计时**：阅读浮层期间本地秒表 + 每 30s 心跳上报，服务端累计发奖，前端只展示。

## 6. 安全与边界（MVP 范围内）

- 管理密码环境变量注入；token 内存态。上传扩展名白名单 + 文件名重写。
- 金币只能由服务端逻辑变动；心跳单次封顶 60s 防刷；邮箱唯一性校验。
- 已知取舍：玩家无密码（持 playerId 即可操作）、邮箱不发验证邮件——免注册 MVP 的代价，V2 账号体系解决。

## 7. 扩展路线

- 存储层平替 SQLite/Postgres；玩家接 OAuth；咖啡馆加 WebSocket 实现同屏社交。
- 新场馆 = world.js 加一张地图 + scenes/ 加一个浮层模块，引擎零改动。

## 8. v1.1 架构调整评估（动森风改版）

| 层 | 调整 | 量级 |
|---|---|---|
| 渲染（art.js） | 像素字符画 → Canvas 矢量手绘（圆弧/渐变/Q 萌角色） | 重写（独立模块，不影响其他层） |
| 世界（world.js） | 单地图 → 户外 + 4 室内，声明式地图定义 | 重写 |
| 引擎（engine.js） | 加地图切换、NPC 实体与游走 AI、热点系统 | 重构 |
| 对话（dialog.js） | 新增 | 新模块 |
| 场景浮层 | 拆分书屋两段式、新增咖啡馆/护照 | 增改 |
| 服务端 | 新增经济/阅读/咖啡 API，原 API 不变 | 增量 |
| 存储/部署/管理后台 | 不变 | 0 |

结论：**核心架构（Canvas 自绘 + DOM 浮层 + Express + JSON 存储）完全复用**，本次为模块级改造而非重写。

## 9. v1.2 架构调整评估（伪3D 图片世界 + 鼠标 + 账户）

| 层 | 调整 | 说明 |
|---|---|---|
| 世界模型 | 户外从瓦片网格 → **连续坐标图片大世界**（island.png ×2 = 3344×1882） | 碰撞改为几何判定：边界矩形 + 障碍圆（底图上的树/灌木/岩石）+ 建筑占地椭圆 |
| 渲染 | 新增**相机视口**（1920×1080 裁剪绘制底图）+ **纵深缩放** `depthScale(y)` + **深度排序遮挡** | 建筑用 ui-building 立绘（底部中心锚点）；"靠近建筑放大 16%"只作用于渲染，碰撞用基础尺寸保持稳定 |
| 输入 | 新增**鼠标点击寻路**：直线趋近 + 分轴滑墙 + 卡住自动放弃；点击命中优先级 NPC > 建筑（导航至门口）> 地面 | 点击携带"到达后动作"（对话/交互），进入触发范围即提前执行；键盘输入随时接管 |
| 进出门 | 户外门口改为**触发圆**（走进即入内），室内门垫不变 | 武装机制防止出门瞬间回流 |
| 账户 | 新增 `/api/auth/register|login`（scrypt+salt 存储）；游客 `POST /api/players` 每次新建 | 登录态不落地（刷新即回登录页，满足"每次都需登录"）；账户数据天然云端保留 |
| HUD | 任务（左上）与小地图（左下）可收起；金币右上；移除产品名与后台入口 | 小地图 = island 底图缩略 + 建筑图标 + 玩家红点，室内高亮当前场馆 |
| 室内 | 沿用 v1.1 瓦片场景，整体 2 倍缩放适配 1080p，新增鼠标点击 | 无素材部分继续代码绘制 |

结论：仍无需更换技术栈；引擎完成"瓦片引擎 → 连续坐标伪3D 引擎"的升级后，后续加地图、加建筑只是改 `world.js` 配置。已知取舍：寻路为直线趋近而非 A*（大世界开阔，足够），底图放大 2 倍有轻微模糊（动森手绘风下不明显）。
