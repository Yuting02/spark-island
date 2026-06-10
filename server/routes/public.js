// 玩家侧 API：新闻 / 书籍 / 电台 / 玩家 / 笔记 / 每日任务进度
import { Router } from 'express';
import { all, insert, update, newId, today } from '../db.js';

const router = Router();
const TASKS = ['news', 'study', 'radio'];
const byNewest = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);

// 当日新闻；当日没有则回退最近一期并标记 fallback
router.get('/news/today', (_req, res) => {
  const list = [...all('news')].sort((a, b) => (a.date < b.date ? 1 : -1));
  const date = today();
  const todays = list.filter((n) => n.date === date);
  if (todays.length) return res.json({ date, fallback: false, items: todays });
  const latest = list[0];
  if (!latest) return res.json({ date, fallback: false, items: [] });
  res.json({ date: latest.date, fallback: true, items: list.filter((n) => n.date === latest.date) });
});

router.get('/books', (_req, res) => {
  res.json([...all('books')].sort(byNewest));
});

router.get('/radio', (_req, res) => {
  res.json([...all('radio')].sort(byNewest));
});

router.post('/players', (req, res) => {
  const nickname = String(req.body?.nickname ?? '').trim().slice(0, 16);
  if (!nickname) return res.status(400).json({ error: '昵称不能为空' });
  const player = insert('players', { id: newId(), nickname, createdAt: new Date().toISOString() });
  res.json(player);
});

router.get('/notes/:playerId', (req, res) => {
  res.json(all('notes').filter((n) => n.playerId === req.params.playerId).sort(byNewest));
});

router.post('/notes', (req, res) => {
  const { playerId, bookId, bookTitle, content } = req.body ?? {};
  const text = String(content ?? '').trim();
  if (!playerId || !text) return res.status(400).json({ error: '笔记内容不能为空' });
  if (text.length > 5000) return res.status(400).json({ error: '单条笔记最长 5000 字' });
  const note = insert('notes', {
    id: newId(),
    playerId,
    bookId: bookId ?? null,
    bookTitle: String(bookTitle ?? '').slice(0, 100),
    content: text,
    createdAt: new Date().toISOString(),
  });
  res.json(note);
});

function progressOf(playerId) {
  const date = today();
  return (
    all('progress').find((p) => p.playerId === playerId && p.date === date) ?? {
      playerId,
      date,
      tasks: { news: false, study: false, radio: false },
    }
  );
}

router.get('/progress/:playerId', (req, res) => {
  res.json(progressOf(req.params.playerId));
});

router.post('/progress', (req, res) => {
  const { playerId, task } = req.body ?? {};
  if (!playerId || !TASKS.includes(task)) return res.status(400).json({ error: '参数不合法' });
  const date = today();
  const existing = update(
    'progress',
    (p) => p.playerId === playerId && p.date === date,
    (p) => (p.tasks[task] = true)
  );
  if (!existing) {
    insert('progress', { playerId, date, tasks: { news: false, study: false, radio: false, [task]: true } });
  }
  res.json(progressOf(playerId));
});

export default router;
