// 启动编排：玩家身份 → 游戏引擎 → 金币/任务 HUD → NPC 对话 → 场景浮层路由
import { api } from './api.js';
import { createGame } from './game/engine.js';
import { showDialog } from './game/dialog.js';
import { openNews } from './scenes/news.js';
import { openBookshelf } from './scenes/bookshelf.js';
import { openReading } from './scenes/reading.js';
import { openRadio } from './scenes/radio.js';
import { openCafe } from './scenes/cafe.js';
import { openProfile } from './scenes/profile.js';

const $ = (sel) => document.querySelector(sel);

const TASK_META = {
  news: { icon: '📰', label: '去报亭读 AI 新闻' },
  study: { icon: '📚', label: '在书屋记一条读书笔记' },
  radio: { icon: '📻', label: '去电台听 30 秒播客' },
};

let player = null;
let game = null;
let progress = null;
let coins = 0;
let selectedBook = null; // 在书架选好、还没去自习桌读的书
let sceneCleanup = null;
let celebrated = false;

try {
  player = JSON.parse(localStorage.getItem('pt_player') || 'null');
} catch {}

if (player?.id) {
  start();
} else if (new URLSearchParams(location.search).has('guest')) {
  // 演示模式：?guest=1 跳过起名，自动创建临时玩家
  api.createPlayer(`游客${Math.floor(Math.random() * 1000)}`).then((p) => {
    player = p;
    localStorage.setItem('pt_player', JSON.stringify(player));
    start();
  });
} else {
  $('#login').classList.remove('hidden');
  const submit = async () => {
    const nickname = $('#login-input').value.trim();
    if (!nickname) return;
    const btn = $('#login-btn');
    btn.disabled = true;
    try {
      player = await api.createPlayer(nickname);
      localStorage.setItem('pt_player', JSON.stringify(player));
      $('#login').classList.add('hidden');
      start();
      toast(`🪙 +${player.coins} 初来星火岛见面礼！`);
    } catch (e) {
      alert(e.message);
    } finally {
      btn.disabled = false;
    }
  };
  $('#login-btn').onclick = submit;
  $('#login-input').addEventListener('keydown', (e) => e.key === 'Enter' && submit());
  $('#login-input').focus();
}

async function start() {
  game = createGame($('#game'), { onAction });
  $('#hud-player').onclick = () => openOverlay('🛂 岛民护照', 'profile', (ctx) => openProfile(ctx));
  try {
    const me = await api.getPlayer(player.id);
    coins = me.coins;
  } catch {}
  renderPlayerChip();
  refreshProgress();
}

function renderPlayerChip() {
  $('#hud-player').innerHTML = `🧢 ${escapeHtml(player.nickname)} <span class="chip-coins">🪙 ${coins}</span>`;
}

function setCoins(value, msg) {
  coins = value;
  renderPlayerChip();
  if (msg) toast(msg);
}

async function refreshProgress() {
  try {
    progress = await api.progress(player.id);
  } catch {
    return;
  }
  renderTasks();
}

function renderTasks() {
  const ul = $('#hud-task-list');
  ul.innerHTML = Object.entries(TASK_META)
    .map(([task, m]) => {
      const done = !!progress?.tasks?.[task];
      return `<li class="${done ? 'done' : ''}">${done ? '✅' : m.icon} ${m.label}</li>`;
    })
    .join('');
  const allDone = progress && Object.values(progress.tasks).every(Boolean);
  $('#hud-task-title').textContent = allDone ? '今日任务 · 全部完成' : '今日任务';
  if (allDone && !celebrated) {
    celebrated = true;
    celebrate();
  }
}

/* ── 引擎动作路由 ── */
async function onAction(hotspot) {
  if (hotspot.type === 'npc') {
    game.pause();
    const lines = hotspot.npc.lines;
    const line = lines[Math.floor(Math.random() * lines.length)];
    await showDialog({ name: hotspot.npc.name, color: hotspot.npc.color, lines: [line] });
    game.resume();
    return;
  }
  const ctx = { player, completeTask, onCoins: setCoins };
  switch (hotspot.scene) {
    case 'news':
      openOverlay('📰 今日报纸', 'news', (c) => openNews(c));
      break;
    case 'bookshelf':
      openOverlay('📚 书屋 · 书架', 'study', (c) =>
        openBookshelf({
          ...c,
          selectedBook,
          onSelect(book) {
            selectedBook = book;
            closeOverlay();
            toast(`已选《${book.title}》，找张自习桌坐下吧 →`);
          },
        })
      );
      break;
    case 'desk':
      if (!selectedBook) {
        toast('🤔 先去书架挑一本书，再来坐下吧');
        return;
      }
      openOverlay(`📖 自习桌 · ${selectedBook.title}`, 'study', (c) => openReading({ ...c, book: selectedBook }));
      break;
    case 'radio':
      openOverlay('📻 星火电台 · 点播台', 'radio', (c) => openRadio(c));
      break;
    case 'cafe':
      openOverlay('☕ 咖啡馆 · 吧台', 'cafe', (c) => openCafe(c));
      break;
  }
}

/* ── 浮层管理 ── */
function openOverlay(title, sceneClass, opener) {
  game.pause();
  $('#overlay').classList.remove('hidden');
  $('#overlay-box').dataset.scene = sceneClass;
  $('#overlay-title').textContent = title;
  const container = $('#overlay-content');
  sceneCleanup = opener({ player, container, completeTask, onCoins: setCoins }) || null;
}

function closeOverlay() {
  sceneCleanup?.();
  sceneCleanup = null;
  $('#overlay-content').innerHTML = '';
  $('#overlay').classList.add('hidden');
  game.resume();
}

$('#overlay-close').onclick = closeOverlay;
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#overlay').classList.contains('hidden')) closeOverlay();
});

/* ── 任务完成与奖励 ── */
async function completeTask(task) {
  if (progress?.tasks?.[task]) return; // 今天已完成，不重复上报
  let res;
  try {
    res = await api.completeTask(player.id, task);
  } catch {
    return;
  }
  progress = res;
  setCoins(res.coins, `✅ 任务完成 +${res.reward} 🪙`);
  renderTasks();
}

let toastTimer = null;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function celebrate() {
  const el = $('#celebrate');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4500);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
