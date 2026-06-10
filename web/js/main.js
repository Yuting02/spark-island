// 启动编排 v2：登录（账户/游客）→ 伪3D 引擎 → HUD（任务/金币/小地图）→ NPC 对话与场景路由
import { api } from './api.js';
import { createGame } from './game/engine.js';
import { WORLD, BUILDINGS } from './game/world.js';
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
const BUILDING_EMOJI = { news: '📰', study: '📚', cafe: '☕', radio: '📻' };

let player = null;
let game = null;
let progress = null;
let coins = 0;
let selectedBook = null;
let sceneCleanup = null;
let celebrated = false;

/* ── 登录：每次进入都需登录或游客身份（不持久化登录态） ── */
function loginMsg(text) {
  $('#login-msg').textContent = text;
}

async function enter(p, welcomeMsg) {
  player = p;
  coins = p.coins;
  $('#login').classList.add('hidden');
  await start();
  if (welcomeMsg) toast(welcomeMsg);
}

if (new URLSearchParams(location.search).has('guest')) {
  // 调试/演示捷径：?guest=1 直接游客进入
  api.createPlayer('').then((p) => enter(p, `🪙 +${p.coins} 初来星火岛见面礼！`));
} else {
  $('#login').classList.remove('hidden');

  $('#btn-login').onclick = async () => {
    try {
      const p = await api.login($('#login-username').value, $('#login-password').value);
      enter(p, `欢迎回来，${p.nickname}！`);
    } catch (e) {
      loginMsg(e.message);
    }
  };
  $('#btn-register').onclick = async () => {
    try {
      const p = await api.register($('#login-username').value, $('#login-password').value);
      enter(p, `🪙 +${p.coins} 注册成功，初来星火岛见面礼！`);
    } catch (e) {
      loginMsg(e.message);
    }
  };
  $('#btn-guest').onclick = async () => {
    try {
      const p = await api.createPlayer('');
      enter(p, '👤 游客身份：本次进度不会保存哦');
    } catch (e) {
      loginMsg(e.message);
    }
  };
  $('#login-password').addEventListener('keydown', (e) => e.key === 'Enter' && $('#btn-login').click());
}

async function start() {
  game = await createGame($('#game'), { onAction });
  $('#hud-player').onclick = () => openOverlay('🛂 岛民护照', 'profile', (ctx) => openProfile(ctx));
  renderPlayerChip();
  refreshProgress();
  initPanels();
  initMinimap();
}

function renderPlayerChip() {
  $('#hud-player').innerHTML = `🧢 ${escapeHtml(player.nickname)}${player.guest ? '<small>（游客）</small>' : ''} <span class="chip-coins">🪙 ${coins}</span>`;
}

function setCoins(value, msg) {
  coins = value;
  renderPlayerChip();
  if (msg) toast(msg);
}

/* ── 可收起面板（任务 / 地图，默认展开） ── */
function initPanels() {
  document.querySelectorAll('.hud-panel .panel-head').forEach((head) => {
    head.onclick = () => {
      const panel = head.parentElement;
      panel.classList.toggle('collapsed');
      head.querySelector('.panel-arrow').textContent = panel.classList.contains('collapsed') ? '▸' : '▾';
    };
  });
}

/* ── 小地图导航 ── */
function initMinimap() {
  const img = new Image();
  img.src = WORLD.imageSrc;
  const mm = $('#minimap');
  const g = mm.getContext('2d');
  const W = mm.width;
  const H = mm.height;
  const sx = (x) => (x / WORLD.w) * W;
  const sy = (y) => (y / WORLD.h) * H;

  setInterval(() => {
    if (!game || !img.complete || $('#minimap-panel').classList.contains('collapsed')) return;
    const st = game.getState();
    g.clearRect(0, 0, W, H);
    g.drawImage(img, 0, 0, W, H);
    g.fillStyle = 'rgba(20,16,28,.18)';
    g.fillRect(0, 0, W, H);

    g.font = '15px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const b of BUILDINGS) {
      if (st.mode === 'indoor' && st.mapId === b.id) {
        g.fillStyle = 'rgba(255,179,71,.9)';
        g.beginPath();
        g.arc(sx(b.x), sy(b.y) - 6, 12, 0, Math.PI * 2);
        g.fill();
      }
      g.fillText(BUILDING_EMOJI[b.id], sx(b.x), sy(b.y) - 6);
    }

    if (st.mode === 'outdoor') {
      g.fillStyle = '#ff5252';
      g.strokeStyle = '#fff';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(sx(st.x), sy(st.y), 5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else {
      const b = BUILDINGS.find((x) => x.id === st.mapId);
      g.fillStyle = '#fffbe8';
      g.font = 'bold 13px "Microsoft YaHei", sans-serif';
      g.fillText(`📍 当前在${b?.label ?? ''}`, W / 2, H - 12);
      g.font = '15px sans-serif';
    }
    g.textAlign = 'left';
  }, 200);
}

/* ── 任务进度 ── */
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
  $('#hud-task-title').childNodes[0].textContent = allDone ? '今日任务 · 全部完成' : '今日任务';
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
  if (progress?.tasks?.[task]) return;
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
