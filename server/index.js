// Express 入口：静态托管前端与上传媒体，挂载玩家侧 / 管理侧 API。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import { UPLOAD_DIR } from './db.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();

app.use(express.json({ limit: '2mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use(express.static(path.join(ROOT, 'web')));

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

app.get('/admin', (_req, res) => res.sendFile(path.join(ROOT, 'web', 'admin.html')));

// 统一兜底
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: '服务器开小差了' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🏘️  像素小镇已启动  →  http://localhost:${PORT}`);
  console.log(`🔑  管理后台        →  http://localhost:${PORT}/admin`);
});
