// 管理侧 API：登录 + 新闻/书籍/电台内容的增删。文件上传经 multer 落盘到 data/uploads/。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { login, requireAdmin } from '../auth.js';
import { all, insert, remove, newId, UPLOAD_DIR } from '../db.js';

const router = Router();

const EXT_WHITELIST = {
  books: ['.epub'],
  radio: ['.mp3', '.m4a', '.mp4', '.wav', '.ogg'],
};

function uploader(kind) {
  const dir = path.join(UPLOAD_DIR, kind);
  const storage = multer.diskStorage({
    destination(_req, _file, cb) {
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename(_req, file, cb) {
      // 文件名整体重写，杜绝原始文件名注入路径
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
    },
  });
  return multer({
    storage,
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter(_req, file, cb) {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!EXT_WHITELIST[kind].includes(ext)) {
        return cb(new Error(`不支持的文件格式 ${ext}，允许：${EXT_WHITELIST[kind].join(' ')}`));
      }
      cb(null, true);
    },
  }).single('file');
}

// multer 错误转 JSON 响应
function withUpload(kind, handler) {
  const up = uploader(kind);
  return (req, res) => {
    up(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      handler(req, res);
    });
  };
}

router.post('/login', (req, res) => {
  const token = login(req.body?.password);
  if (!token) return res.status(401).json({ error: '密码错误' });
  res.json({ token });
});

router.use(requireAdmin);

router.get('/overview', (_req, res) => {
  res.json({ news: all('news').length, books: all('books').length, radio: all('radio').length });
});

// ── 新闻 ──
router.get('/news', (_req, res) => {
  res.json([...all('news')].sort((a, b) => (a.date < b.date ? 1 : -1)));
});

router.post('/news', (req, res) => {
  const { title, date, content } = req.body ?? {};
  if (!title?.trim() || !content?.trim()) return res.status(400).json({ error: '标题和正文不能为空' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return res.status(400).json({ error: '日期格式应为 YYYY-MM-DD' });
  res.json(
    insert('news', {
      id: newId(),
      title: title.trim().slice(0, 100),
      date,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    })
  );
});

router.delete('/news/:id', (req, res) => {
  res.json({ removed: remove('news', (n) => n.id === req.params.id) });
});

// ── 书籍 / 电台（带文件） ──
function deleteFileOf(doc) {
  if (!doc?.file) return;
  const abs = path.join(UPLOAD_DIR, '..', doc.file.replace(/^\//, ''));
  fs.rm(abs, { force: true }, () => {});
}

router.post('/books', withUpload('books', (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title || !req.file) return res.status(400).json({ error: '书名和 epub 文件都不能少' });
  res.json(
    insert('books', {
      id: newId(),
      title: title.slice(0, 100),
      author: String(req.body?.author ?? '').trim().slice(0, 50),
      file: `/uploads/books/${req.file.filename}`,
      createdAt: new Date().toISOString(),
    })
  );
}));

router.delete('/books/:id', (req, res) => {
  const doc = all('books').find((b) => b.id === req.params.id);
  deleteFileOf(doc);
  res.json({ removed: remove('books', (b) => b.id === req.params.id) });
});

router.post('/radio', withUpload('radio', (req, res) => {
  const title = String(req.body?.title ?? '').trim();
  if (!title || !req.file) return res.status(400).json({ error: '节目名和音频文件都不能少' });
  res.json(
    insert('radio', {
      id: newId(),
      title: title.slice(0, 100),
      file: `/uploads/radio/${req.file.filename}`,
      createdAt: new Date().toISOString(),
    })
  );
}));

router.delete('/radio/:id', (req, res) => {
  const doc = all('radio').find((r) => r.id === req.params.id);
  deleteFileOf(doc);
  res.json({ removed: remove('radio', (r) => r.id === req.params.id) });
});

export default router;
