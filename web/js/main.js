// 启动编排：玩家身份 → 游戏引擎 → 任务 HUD → 场景浮层路由
import { api } from './api.js';
import { createGame } from './game/engine.js';
import { openNews } from './scenes/news.js';
import { openStudy } from './scenes/study.js';
import { openRadio } from './scenes/radio.js';

const $ = (sel) => document.querySelector(sel);

const TASK_META = {
  news: { icon: '📰', label: '去报亭读 AI 新闻' },
  study: { icon: '📚', label: '去自习室读书并记一条笔记' },
  radio: { icon: '📻', label: '去电台听 30 秒播客' },
};
const SCENES = { news: openNews, study: openStudy, radio: openRadio };

let player = null;
let game = null;
let progress = null;
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

function start() {
  $('#hud-player').textContent = `🧢 ${player.nickname}`;
  game = createGame($('#game'), { onEnter: openScene });
  refreshProgress();
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

function openScene(building) {
  game.pause();
  $('#overlay').classList.remove('hidden');
  $('#overlay-box').dataset.scene = building.id;
  $('#overlay-title').textContent = `${TASK_META[building.id].icon} ${building.label}`;
  sceneCleanup = SCENES[building.id]({ player, container: $('#overlay-content'), completeTask }) || null;
}

function closeScene() {
  sceneCleanup?.();
  sceneCleanup = null;
  $('#overlay-content').innerHTML = '';
  $('#overlay').classList.add('hidden');
  game.resume();
}

$('#overlay-close').onclick = closeScene;
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('#overlay').classList.contains('hidden')) closeScene();
});

async function completeTask(task) {
  if (progress?.tasks?.[task]) return; // 今天已完成，不重复上报
  try {
    progress = await api.completeTask(player.id, task);
  } catch {
    return;
  }
  toast(`✅ 任务完成：${TASK_META[task].label}`);
  renderTasks();
}

let toastTimer = null;
function toast(text) {
  const el = $('#toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function celebrate() {
  const el = $('#celebrate');
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 4500);
}
