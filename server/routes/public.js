// 玩家侧 API：新闻 / 书籍 / 电台 / 玩家与金币 / 笔记 / 每日任务 / 阅读计时 / 咖啡馆
import { Router } from 'express';
import { all, insert, update, newId, today } from '../db.js';
import { REWARD, READING_GOAL_SECONDS, CAFE_MENU, getPlayer, addCoins } from '../economy.js';

const router = Router();
const TASKS = ['news', 'study', 'radio'];
const byNewest = (a, b) => (a.createdAt < b.createdAt ? 1 : -1);

const publicPlayer = (p) => ({ id: p.id, nickname: p.nickname, coins: p.coins ?? 0, email: p.email ?? null });

// ── 内容 ──
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

// ── 玩家与金币 ──
router.post('/players', (req, res) => {
  const nickname = String(req.body?.nickname ?? '').trim().slice(0, 16);
  if (!nickname) return res.status(400).json({ error: '昵称不能为空' });
  const player = insert('players', { id: newId(), nickname, coins: 0, email: null, createdAt: new Date().toISOString() });
  addCoins(player.id, REWARD.welcome, '初来星火岛见面礼');
  res.json(publicPlayer(getPlayer(player.id)));
});

router.get('/players/:id', (req, res) => {
  const p = getPlayer(req.params.id);
  if (!p) return res.status(404).json({ error: '玩家不存在' });
  res.json(publicPlayer(p));
});

router.post('/players/:id/email', (req, res) => {
  const p = getPlayer(req.params.id);
  if (!p) return res.status(404).json({ error: '玩家不存在' });
  if (p.email) return res.status(400).json({ error: '已绑定过邮箱，奖励不可重复领取' });
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 100) {
    return res.status(400).json({ error: '邮箱格式不正确' });
  }
  if (all('players').some((x) => x.email === email)) {
    return res.status(400).json({ error: '该邮箱已被其他岛民绑定' });
  }
  update('players', (x) => x.id === p.id, (x) => (x.email = email));
  const balance = addCoins(p.id, REWARD.email, '绑定邮箱奖励');
  res.json({ ...publicPlayer(getPlayer(p.id)), reward: REWARD.email, balance });
});

router.get('/transactions/:playerId', (req, res) => {
  res.json(all('transactions').filter((t) => t.playerId === req.params.playerId).sort(byNewest).slice(0, 50));
});

// ── 笔记 ──
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

// ── 每日任务（完成发金币） ──
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
  if (!getPlayer(playerId) || !TASKS.includes(task)) return res.status(400).json({ error: '参数不合法' });
  const date = today();
  const before = progressOf(playerId);
  const isNew = !before.tasks[task];
  const existing = update(
    'progress',
    (p) => p.playerId === playerId && p.date === date,
    (p) => (p.tasks[task] = true)
  );
  if (!existing) {
    insert('progress', { playerId, date, tasks: { news: false, study: false, radio: false, [task]: true } });
  }
  let reward = 0;
  if (isNew) {
    reward = REWARD.task;
    addCoins(playerId, reward, `完成每日任务：${task}`);
  }
  res.json({ ...progressOf(playerId), reward, coins: getPlayer(playerId).coins });
});

// ── 阅读计时（书屋自习桌，累计 30 分钟当日奖励一次） ──
function readingOf(playerId) {
  const date = today();
  return all('reading').find((r) => r.playerId === playerId && r.date === date) ?? null;
}

router.get('/reading/:playerId', (req, res) => {
  const r = readingOf(req.params.playerId);
  res.json({ seconds: r?.seconds ?? 0, goal: READING_GOAL_SECONDS, rewarded: r?.rewarded ?? false });
});

router.post('/reading', (req, res) => {
  const { playerId } = req.body ?? {};
  const seconds = Math.min(Math.max(Number(req.body?.seconds) || 0, 0), 60); // 单次心跳最多记 60 秒，防刷
  if (!getPlayer(playerId)) return res.status(400).json({ error: '玩家不存在' });
  const date = today();
  let r = update(
    'reading',
    (x) => x.playerId === playerId && x.date === date,
    (x) => (x.seconds += seconds)
  );
  if (!r) r = insert('reading', { playerId, date, seconds, rewarded: false });
  let reward = 0;
  if (!r.rewarded && r.seconds >= READING_GOAL_SECONDS) {
    update('reading', (x) => x.playerId === playerId && x.date === date, (x) => (x.rewarded = true));
    reward = REWARD.reading;
    addCoins(playerId, reward, '书屋阅读满 30 分钟');
  }
  res.json({ seconds: r.seconds, goal: READING_GOAL_SECONDS, rewarded: r.rewarded || reward > 0, reward, coins: getPlayer(playerId).coins });
});

// ── 咖啡馆 ──
router.get('/cafe/menu', (_req, res) => {
  res.json(CAFE_MENU);
});

router.post('/cafe/order', (req, res) => {
  const { playerId, itemId } = req.body ?? {};
  const player = getPlayer(playerId);
  const item = CAFE_MENU.find((i) => i.id === itemId);
  if (!player || !item) return res.status(400).json({ error: '参数不合法' });
  const balance = addCoins(playerId, -item.price, `咖啡馆消费：${item.name}`);
  if (balance === null) {
    return res.status(400).json({ error: `金币不足：${item.name} 需要 ${item.price} 金币，你只有 ${player.coins ?? 0}` });
  }
  const order = insert('orders', {
    id: newId(),
    playerId,
    itemId: item.id,
    itemName: item.name,
    price: item.price,
    createdAt: new Date().toISOString(),
  });
  res.json({ order, item, coins: balance });
});

router.get('/cafe/orders/:playerId', (req, res) => {
  res.json(all('orders').filter((o) => o.playerId === req.params.playerId).sort(byNewest).slice(0, 20));
});

export default router;
