// 书屋·自习桌：epub 在线阅读 + 云端笔记 + 阅读计时（累计 30 分钟得金币，30 秒心跳上报）。
import { api } from '../api.js';
import { fmtTime } from './bookshelf.js';

const HEARTBEAT = 30; // 秒

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export function openReading({ player, book: bookMeta, container, completeTask, onCoins }) {
  let epubBook = null;
  let rendition = null;
  let tickTimer = null;
  let beatTimer = null;

  container.innerHTML = `
    <div class="reader-layout">
      <div class="reader-pane">
        <div class="reader-head">
          <strong>${escapeHtml(bookMeta.title)}</strong>
          <span class="reader-author">${escapeHtml(bookMeta.author || '')}</span>
          <span class="read-timer" id="read-timer">⏱ 今日 --:--</span>
        </div>
        <div id="epub-viewer"></div>
        <div class="reader-nav">
          <button class="ac-btn" id="btn-prev">◀ 上一页</button>
          <button class="ac-btn" id="btn-next">下一页 ▶</button>
        </div>
      </div>
      <div class="notes-pane">
        <h3>📝 读书笔记</h3>
        <textarea id="note-input" maxlength="5000" placeholder="写下这本书带给你的想法……&#10;保存后云端可回看"></textarea>
        <button class="ac-btn ac-primary" id="btn-save-note">保存笔记</button>
        <div class="notes-list" id="notes-list"></div>
      </div>
    </div>`;

  // ── epub 渲染 ──
  if (!window.ePub) {
    container.querySelector('#epub-viewer').innerHTML = '<p class="scene-empty">阅读器组件加载失败，请检查网络后刷新。</p>';
  } else {
    epubBook = window.ePub(bookMeta.file);
    rendition = epubBook.renderTo(container.querySelector('#epub-viewer'), { width: '100%', height: '100%', spread: 'none' });
    rendition.display();
    container.querySelector('#btn-prev').onclick = () => rendition.prev();
    container.querySelector('#btn-next').onclick = () => rendition.next();
  }

  // ── 阅读计时：本地秒表 + 30 秒心跳上报 ──
  const timerEl = container.querySelector('#read-timer');
  let baseSeconds = 0;
  let localSeconds = 0;
  let rewarded = false;

  function renderTimer() {
    const total = baseSeconds + localSeconds;
    const goal = 30 * 60;
    timerEl.textContent = rewarded || total >= goal ? `⏱ 今日 ${mmss(total)} ✅` : `⏱ 今日 ${mmss(total)} / 30:00`;
  }

  api.reading(player.id).then((r) => {
    baseSeconds = r.seconds;
    rewarded = r.rewarded;
    renderTimer();
  }).catch(() => {});

  tickTimer = setInterval(() => {
    localSeconds++;
    renderTimer();
  }, 1000);

  beatTimer = setInterval(async () => {
    try {
      const r = await api.readingHeartbeat(player.id, HEARTBEAT);
      baseSeconds = r.seconds;
      localSeconds = 0;
      if (r.reward > 0) {
        rewarded = true;
        onCoins(r.coins, `🪙 +${r.reward} 阅读满 30 分钟奖励！`);
      }
      renderTimer();
    } catch {}
  }, HEARTBEAT * 1000);

  // ── 笔记 ──
  const listEl = container.querySelector('#notes-list');
  const renderNotes = (notes) => {
    const mine = notes.filter((n) => n.bookId === bookMeta.id);
    listEl.innerHTML = mine.length
      ? `<h4>这本书的笔记（${mine.length}）</h4>` +
        mine.map((n) => `<div class="note-item"><time>${fmtTime(n.createdAt)}</time><p>${escapeHtml(n.content)}</p></div>`).join('')
      : '<p class="notes-empty">这本书还没有笔记</p>';
  };
  api.notes(player.id).then(renderNotes).catch(() => {});

  container.querySelector('#btn-save-note').onclick = async () => {
    const input = container.querySelector('#note-input');
    const content = input.value.trim();
    if (!content) return;
    const btn = container.querySelector('#btn-save-note');
    btn.disabled = true;
    try {
      await api.saveNote({ playerId: player.id, bookId: bookMeta.id, bookTitle: bookMeta.title, content });
      input.value = '';
      api.notes(player.id).then(renderNotes).catch(() => {});
      completeTask('study');
    } catch (e) {
      alert(e.message);
    } finally {
      btn.disabled = false;
    }
  };

  return () => {
    clearInterval(tickTimer);
    clearInterval(beatTimer);
    try {
      rendition?.destroy();
      epubBook?.destroy();
    } catch {}
  };
}
