# 像素小镇 PixelTown 🏘️

一个网页即开即玩的 2D 像素小镇：每天进镇完成三件小事——**报亭读 AI 新闻 📰、自习室读书记笔记 📚、电台听播客 📻**，把"每日信息摄入"游戏化。

- 产品方案：[docs/PRD.md](docs/PRD.md)
- 架构与文件说明：[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 快速开始

```bash
npm install        # 安装依赖
npm run seed       # 生成种子内容（示例新闻 / 示例 epub / 示例音频）
npm start          # 启动，默认 http://localhost:3000
```

- 游戏入口：`http://localhost:3000`
- 管理后台：`http://localhost:3000/admin`（默认密码 `admin123`，生产环境务必通过环境变量修改）

## 玩法

1. 输入昵称进入小镇（免注册，进度与笔记保存在云端，绑定你的玩家 ID）。
2. WASD / 方向键移动，走到建筑门口按 **E** 进入：
   - **报亭**：报纸排版阅读当日 AI 新闻 → 完成任务①
   - **自习室**：书架选书在线阅读（epub），写一条笔记保存云端 → 完成任务②；可在"我的笔记本"回看全部历史笔记
   - **电台**：选节目收听（支持拖动进度、±15 秒），累计听满 30 秒 → 完成任务③
3. 右上角任务面板实时打勾，三项全完成有庆祝彩蛋；每天 0 点自动重置。

## 管理后台

`/admin` 密码登录后可上传与删除：

| 内容 | 格式 |
|---|---|
| AI 新闻 | 标题 + 日期 + Markdown 正文 |
| 书籍 | 标题 + 作者 + `.epub` 文件 |
| 电台节目 | 标题 + 音频文件（mp3 / m4a / mp4 / wav / ogg） |

玩家端看到的都是渲染后的形态（报纸 / 书架与阅读器 / 播放器）。

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 服务端口 |
| `ADMIN_PASSWORD` | `admin123` | 管理后台密码，**部署时必须修改** |

## 部署

代码托管于 GitHub。运行需要 Node ≥ 18 的进程环境（GitHub Pages 是纯静态托管，**无法**承载笔记云端保存与管理上传，故不适用）：

- **Render / Railway / Fly.io**（推荐，免费档即可）：新建 Web Service 指向本仓库，Build `npm install && npm run seed`，Start `npm start`，配置 `ADMIN_PASSWORD` 环境变量即可获得公网 URL。
- **自有服务器**：`git clone` 后同上三条命令，配合 pm2 / systemd 守护。

> 注意：`data/` 目录是运行时数据（数据库 + 上传媒体），不进 git；平台部署时给 `data/` 挂载持久化磁盘，否则重新部署会丢内容。

## 技术栈

Node.js + Express + multer（后端，JSON 文件存储）；原生 Canvas 手写微引擎（像素画全部代码生成，仓库零图片资产）；epub.js + marked（CDN）。详见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)。
