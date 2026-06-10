# 架构设计与文件说明

## 1. 总体架构

```
┌─────────────────────────── 浏览器 ───────────────────────────┐
│  index.html  像素小镇（Canvas 渲染 + DOM 浮层场景）            │
│  admin.html  管理后台（密码登录 + 内容上传）                   │
│      │  fetch /api/*                                          │
└──────┼────────────────────────────────────────────────────────┘
       ▼
┌─────────────────────────── Node.js ──────────────────────────┐
│  Express                                                      │
│   ├─ 静态托管  web/（游戏与后台页面）、data/uploads（媒体文件）│
│   ├─ 公共 API  新闻 / 书籍 / 电台 / 玩家 / 笔记 / 任务进度     │
│   └─ 管理 API  登录鉴权 + 内容增删（multer 处理文件上传）      │
│      │                                                        │
│      ▼                                                        │
│  data/db.json（JSON 文件存储，原子写入）+ data/uploads/ 媒体   │
└───────────────────────────────────────────────────────────────┘
```

### 关键技术决策

| 决策 | 选择 | 理由 |
|---|---|---|
| 前端框架 | **无框架**，原生 ES Module + Canvas | 游戏主体是 Canvas 绘制，React/Vue 帮不上忙还引入构建步骤；MVP 零构建、clone 即跑 |
| 游戏引擎 | **手写微引擎**（~300 行） | 只需要瓦片地图+碰撞+行走动画，Phaser（1MB+）杀鸡用牛刀；像素图用代码内字符画定义，仓库无二进制美术资产 |
| epub 渲染 | epub.js（CDN） | 浏览器端解析渲染 epub 的事实标准 |
| Markdown | marked（CDN） | 新闻正文渲染 |
| 后端 | Express + multer | 最小可用的 API + 文件上传组合 |
| 存储 | JSON 文件（自写 60 行存储层） | 零原生依赖（Windows 友好）、零外部服务；存储层接口隔离，后续可平替 SQLite |
| 玩家身份 | 昵称 → 服务端发 UUID → localStorage | MVP 免注册；笔记/进度都挂在 playerId 上即满足"云端保存可回看" |
| 管理鉴权 | 密码（环境变量）→ 内存 token | 单管理员场景下最简方案；重启失效可接受 |
| 部署 | GitHub 托管代码；Node 进程跑在本地或 Render/Railway | **GitHub Pages 只能托管静态页**，无法满足"笔记云端保存 + 管理员上传"，必须有后端进程 |

## 2. 项目文件一览

```
game/
├─ requirement.txt          # 原始需求
├─ README.md                # 运行 / 部署 / 管理指南
├─ package.json             # 依赖与脚本（npm start / npm run seed）
├─ .gitignore               # 忽略 node_modules、data/（运行时数据不进库）
├─ docs/
│  ├─ PRD.md                # 产品方案（MVP）
│  └─ ARCHITECTURE.md       # 本文档
├─ server/                  # ───── 后端 ─────
│  ├─ index.js              # Express 入口：中间件、静态托管、挂载路由、监听端口
│  ├─ db.js                 # JSON 存储层：load/save（临时文件+rename 原子写）、集合 CRUD
│  ├─ auth.js               # 管理员登录（比对 ADMIN_PASSWORD）、签发/校验内存 token
│  └─ routes/
│     ├─ public.js          # 玩家侧 API：新闻、书籍、电台列表；建玩家；笔记增查；任务进度
│     └─ admin.js           # 管理侧 API：登录；新闻增删；epub/音频上传（multer）与删除
├─ web/                     # ───── 前端（纯静态，由 Express 托管） ─────
│  ├─ index.html            # 游戏页：canvas + 任务 HUD + 三个场景浮层 + 昵称弹窗
│  ├─ admin.html            # 管理后台页：登录卡片 + 三个内容管理 Tab
│  ├─ css/style.css         # 像素风 UI：硬边框、阴影、报纸排版、播放器样式
│  └─ js/
│     ├─ api.js             # fetch 封装：玩家侧 + 管理侧所有接口
│     ├─ main.js            # 启动编排：玩家身份 → 启动游戏 → 任务 HUD → 场景路由
│     ├─ admin.js           # 管理后台逻辑：登录态、表单提交、列表渲染与删除
│     ├─ game/
│     │  ├─ sprites.js      # 像素美术：调色板 + 字符画精灵（人物 4 向 2 帧）+ 瓦片绘制
│     │  ├─ map.js          # 小镇地图：字符串地图、建筑定义（门/牌匾）、碰撞查询
│     │  └─ engine.js       # 游戏循环：键盘输入、移动与碰撞、相机、渲染、门口交互检测
│     └─ scenes/
│        ├─ news.js         # 报亭场景：拉新闻 → 报纸排版渲染 → 上报任务①
│        ├─ study.js        # 自习室场景：书架 → epub.js 阅读器 + 笔记面板 + 笔记本回看 → 任务②
│        └─ radio.js        # 电台场景：节目列表 → 自绘播放器（拖动/±15s）→ 累计 30s 上报任务③
├─ scripts/
│  └─ seed.js               # 种子数据：示例新闻 + 程序生成示例 epub（jszip）+ 程序生成示例音频（WAV）
└─ data/                    # 运行时生成，不进 git
   ├─ db.json               # 全部业务数据
   └─ uploads/{books,radio} # 管理员上传的媒体文件
```

## 3. 数据模型（data/db.json）

```jsonc
{
  "news":    [{ "id", "title", "date": "YYYY-MM-DD", "content": "markdown", "createdAt" }],
  "books":   [{ "id", "title", "author", "file": "/uploads/books/xxx.epub", "createdAt" }],
  "radio":   [{ "id", "title", "file": "/uploads/radio/xxx.mp3", "createdAt" }],
  "players": [{ "id", "nickname", "createdAt" }],
  "notes":   [{ "id", "playerId", "bookId", "bookTitle", "content", "createdAt" }],
  "progress":[{ "playerId", "date": "YYYY-MM-DD", "tasks": { "news": true, "study": false, "radio": false } }]
}
```

## 4. API 设计

### 玩家侧（无鉴权）
| 方法 | 路径 | 说明 |
|---|---|---|
| GET  | `/api/news/today` | 当日新闻（无则回退最近一期，带 `fallback` 标记） |
| GET  | `/api/books` | 书籍列表 |
| GET  | `/api/radio` | 电台节目列表 |
| POST | `/api/players` | `{nickname}` → `{id, nickname}` |
| GET  | `/api/notes/:playerId` | 该玩家全部笔记（倒序） |
| POST | `/api/notes` | `{playerId, bookId, bookTitle, content}` 保存笔记 |
| GET  | `/api/progress/:playerId` | 当日任务进度 |
| POST | `/api/progress` | `{playerId, task}` 标记任务完成（task ∈ news/study/radio） |

### 管理侧（Bearer token）
| 方法 | 路径 | 说明 |
|---|---|---|
| POST   | `/api/admin/login` | `{password}` → `{token}` |
| GET    | `/api/admin/overview` | 三类内容计数（登录后首屏） |
| POST   | `/api/admin/news` | 新增新闻（JSON） |
| DELETE | `/api/admin/news/:id` | 删除新闻 |
| POST   | `/api/admin/books` | multipart：`title, author, file(.epub)` |
| DELETE | `/api/admin/books/:id` | 删除书（连媒体文件） |
| POST   | `/api/admin/radio` | multipart：`title, file(音频)` |
| DELETE | `/api/admin/radio/:id` | 删除节目（连媒体文件） |

## 5. 前端游戏实现要点

- **像素资产代码化**：精灵用字符画 + 调色板定义（如 `'.'=透明, 'h'=头发色`），`sprites.js` 把字符画画到离屏 canvas 缓存；瓦片（草/路/树/水/屋顶）用确定性伪随机点缀纹理。好处：仓库零图片、改像素画就是改代码，符合 vibecoding。
- **渲染**：`image-rendering: pixelated` + 整数坐标，16px 逻辑瓦片放大 3 倍渲染，保证硬像素边缘。
- **场景即浮层**：进建筑不切页面，打开全屏 DOM 浮层（报纸/书房/电台），Esc 或关闭按钮返回小镇，游戏循环暂停输入即可。
- **交互检测**：玩家所在瓦片与建筑门瓦片做曼哈顿距离 ≤1 判定，命中则显示"按 E 进入"。

## 6. 安全与边界（MVP 范围内）

- 管理密码不入库不入仓库，环境变量注入；token 随机 32 字节，仅存内存。
- 上传校验扩展名白名单（.epub / .mp3 .m4a .mp4 .wav .ogg），文件名重写为时间戳+随机串，杜绝路径穿越。
- 笔记/昵称长度限制，防垃圾数据撑爆 JSON。
- 已知取舍：玩家无密码（知道 playerId 即可写笔记）——MVP 免注册的代价，V2 上账号体系解决。

## 7. 扩展路线（不影响当前实现）

- 存储层 `db.js` 接口化 → 平替 better-sqlite3 / Postgres。
- 玩家身份 → 接入 OAuth（GitHub 登录最顺）。
- 新地点 = 地图加建筑 + `scenes/` 加一个模块，引擎无需改动。
