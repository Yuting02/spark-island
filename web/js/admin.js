// 管理后台：登录态 + 三类内容（新闻/书籍/电台）的发布、列表与删除
import { adminApi } from './api.js';

const $ = (sel) => document.querySelector(sel);
let token = localStorage.getItem('pt_admin_token') || '';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function msg(id, text, ok = false) {
  const el = $(id);
  el.textContent = text;
  el.className = `admin-msg ${ok ? 'ok' : 'err'}`;
  if (text) setTimeout(() => (el.textContent = ''), 4000);
}

// ── 登录 ──
async function tryEnter() {
  if (!token) return showLogin();
  try {
    await refreshOverview();
    showMain();
  } catch {
    token = '';
    localStorage.removeItem('pt_admin_token');
    showLogin();
  }
}

function showLogin() {
  $('#admin-login').classList.remove('hidden');
  $('#admin-main').classList.add('hidden');
  document.querySelectorAll('[data-panel]').forEach((p) => p.classList.add('hidden'));
}

function showMain() {
  $('#admin-login').classList.add('hidden');
  $('#admin-main').classList.remove('hidden');
  switchTab('news');
}

$('#admin-login-btn').onclick = async () => {
  try {
    const { token: t } = await adminApi.login($('#admin-password').value);
    token = t;
    localStorage.setItem('pt_admin_token', t);
    await refreshOverview();
    showMain();
  } catch (e) {
    msg('#admin-login-msg', e.message);
  }
};
$('#admin-password').addEventListener('keydown', (e) => e.key === 'Enter' && $('#admin-login-btn').click());

$('#admin-logout').onclick = () => {
  token = '';
  localStorage.removeItem('pt_admin_token');
  showLogin();
};

async function refreshOverview() {
  const o = await adminApi.overview(token);
  $('#admin-overview').textContent = `当前内容：新闻 ${o.news} 篇 · 书籍 ${o.books} 本 · 电台节目 ${o.radio} 个`;
}

// ── Tab 切换 ──
document.querySelectorAll('.admin-tabs [data-tab]').forEach((btn) => {
  btn.onclick = () => switchTab(btn.dataset.tab);
});

function switchTab(tab) {
  document.querySelectorAll('.admin-tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('[data-panel]').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== tab));
  ({ news: loadNews, books: loadBooks, radio: loadRadio })[tab]();
}

// ── 新闻 ──
async function loadNews() {
  const list = await adminApi.listNews(token).catch(() => []);
  $('#news-list').innerHTML = list
    .map(
      (n) => `<div class="admin-item"><span>📰 ${escapeHtml(n.title)} <small>${n.date}</small></span>
        <button class="px-btn" data-del-news="${n.id}">删除</button></div>`
    )
    .join('');
  bindDelete('[data-del-news]', 'delNews', loadNews);
}

$('#news-date').value = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
$('#news-submit').onclick = async () => {
  try {
    await adminApi.addNews(token, {
      title: $('#news-title').value,
      date: $('#news-date').value,
      content: $('#news-content').value,
    });
    $('#news-title').value = '';
    $('#news-content').value = '';
    msg('#news-msg', '发布成功 ✅', true);
    loadNews();
    refreshOverview();
  } catch (e) {
    msg('#news-msg', e.message);
  }
};

// ── 书籍 ──
async function loadBooks() {
  const list = await adminApi.listBooks().catch(() => []);
  $('#book-list').innerHTML = list
    .map(
      (b) => `<div class="admin-item"><span>📚 ${escapeHtml(b.title)} <small>${escapeHtml(b.author || '')}</small></span>
        <button class="px-btn" data-del-book="${b.id}">删除</button></div>`
    )
    .join('');
  bindDelete('[data-del-book]', 'delBook', loadBooks);
}

$('#book-submit').onclick = async () => {
  const file = $('#book-file').files[0];
  if (!file) return msg('#book-msg', '请选择 .epub 文件');
  const fd = new FormData();
  fd.append('title', $('#book-title').value);
  fd.append('author', $('#book-author').value);
  fd.append('file', file);
  const btn = $('#book-submit');
  btn.disabled = true;
  try {
    await adminApi.addBook(token, fd);
    $('#book-title').value = '';
    $('#book-author').value = '';
    $('#book-file').value = '';
    msg('#book-msg', '上传成功 ✅', true);
    loadBooks();
    refreshOverview();
  } catch (e) {
    msg('#book-msg', e.message);
  } finally {
    btn.disabled = false;
  }
};

// ── 电台 ──
async function loadRadio() {
  const list = await adminApi.listRadio().catch(() => []);
  $('#radio-list').innerHTML = list
    .map(
      (r) => `<div class="admin-item"><span>📻 ${escapeHtml(r.title)}</span>
        <button class="px-btn" data-del-radio="${r.id}">删除</button></div>`
    )
    .join('');
  bindDelete('[data-del-radio]', 'delRadio', loadRadio);
}

$('#radio-submit').onclick = async () => {
  const file = $('#radio-file').files[0];
  if (!file) return msg('#radio-msg', '请选择音频文件');
  const fd = new FormData();
  fd.append('title', $('#radio-title').value);
  fd.append('file', file);
  const btn = $('#radio-submit');
  btn.disabled = true;
  try {
    await adminApi.addRadio(token, fd);
    $('#radio-title').value = '';
    $('#radio-file').value = '';
    msg('#radio-msg', '上传成功 ✅', true);
    loadRadio();
    refreshOverview();
  } catch (e) {
    msg('#radio-msg', e.message);
  } finally {
    btn.disabled = false;
  }
};

function bindDelete(selector, method, reload) {
  document.querySelectorAll(selector).forEach((btn) => {
    btn.onclick = async () => {
      if (!confirm('确定删除？玩家端将立即看不到该内容。')) return;
      const id = btn.getAttribute(selector.slice(1, -1));
      try {
        await adminApi[method](token, id);
        reload();
        refreshOverview();
      } catch (e) {
        alert(e.message);
      }
    };
  });
}

tryEnter();
