// 自习室场景：书架 → epub.js 在线阅读 + 笔记面板（云端保存）；「我的笔记本」回看全部笔记。
import { api } from '../api.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function coverHue(title) {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

function fmtTime(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function openStudy({ player, container, completeTask }) {
  let book = null;
  let rendition = null;

  function destroyReader() {
    try {
      rendition?.destroy();
      book?.destroy();
    } catch {}
    rendition = null;
    book = null;
  }

  async function showShelf() {
    destroyReader();
    container.innerHTML = '<p class="scene-loading">正在擦书架……</p>';
    let books;
    try {
      books = await api.books();
    } catch (e) {
      container.innerHTML = `<p class="scene-empty">${escapeHtml(e.message)}</p>`;
      return;
    }
    const covers = books.length
      ? books
          .map(
            (b) => `
        <button class="book-cover" data-id="${b.id}" style="--hue:${coverHue(b.title)}">
          <span class="bc-title">${escapeHtml(b.title)}</span>
          <span class="bc-author">${escapeHtml(b.author || '佚名')}</span>
        </button>`
          )
          .join('')
      : '<p class="scene-empty">📚 书架空空如也，请管理员在后台上传 epub。</p>';

    container.innerHTML = `
      <div class="study-toolbar">
        <span class="study-tip">点一本书开始阅读，写下一条笔记即完成今日任务</span>
        <button class="px-btn" id="btn-notebook">🗒️ 我的笔记本</button>
      </div>
      <div class="bookshelf">${covers}</div>`;

    container.querySelector('#btn-notebook').onclick = showNotebook;
    container.querySelectorAll('.book-cover').forEach((el) => {
      el.onclick = () => openBook(books.find((b) => b.id === el.dataset.id));
    });
  }

  async function openBook(b) {
    container.innerHTML = `
      <div class="reader-layout">
        <div class="reader-pane">
          <div class="reader-head">
            <button class="px-btn" id="btn-back-shelf">← 书架</button>
            <strong>${escapeHtml(b.title)}</strong>
            <span class="reader-author">${escapeHtml(b.author || '')}</span>
          </div>
          <div id="epub-viewer"></div>
          <div class="reader-nav">
            <button class="px-btn" id="btn-prev">◀ 上一页</button>
            <button class="px-btn" id="btn-next">下一页 ▶</button>
          </div>
        </div>
        <div class="notes-pane">
          <h3>📝 读书笔记</h3>
          <textarea id="note-input" maxlength="5000" placeholder="写下这本书带给你的想法……&#10;保存后云端可回看"></textarea>
          <button class="px-btn px-primary" id="btn-save-note">保存笔记</button>
          <div class="notes-list" id="notes-list"></div>
        </div>
      </div>`;

    container.querySelector('#btn-back-shelf').onclick = showShelf;

    if (!window.ePub) {
      container.querySelector('#epub-viewer').innerHTML = '<p class="scene-empty">阅读器组件加载失败，请检查网络后刷新。</p>';
    } else {
      book = window.ePub(b.file);
      rendition = book.renderTo(container.querySelector('#epub-viewer'), {
        width: '100%',
        height: '100%',
        spread: 'none',
      });
      rendition.display();
      container.querySelector('#btn-prev').onclick = () => rendition.prev();
      container.querySelector('#btn-next').onclick = () => rendition.next();
    }

    const listEl = container.querySelector('#notes-list');
    const renderNotes = (notes) => {
      const mine = notes.filter((n) => n.bookId === b.id);
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
        await api.saveNote({ playerId: player.id, bookId: b.id, bookTitle: b.title, content });
        input.value = '';
        api.notes(player.id).then(renderNotes).catch(() => {});
        completeTask('study');
      } catch (e) {
        alert(e.message);
      } finally {
        btn.disabled = false;
      }
    };
  }

  async function showNotebook() {
    destroyReader();
    container.innerHTML = '<p class="scene-loading">正在翻开笔记本……</p>';
    let notes = [];
    try {
      notes = await api.notes(player.id);
    } catch {}
    container.innerHTML = `
      <div class="study-toolbar">
        <button class="px-btn" id="btn-back-shelf2">← 书架</button>
        <span class="study-tip">我的笔记本 · 共 ${notes.length} 条（云端保存）</span>
      </div>
      <div class="notebook">
        ${
          notes.length
            ? notes
                .map(
                  (n) => `
          <div class="note-item">
            <div class="note-meta"><strong>${escapeHtml(n.bookTitle || '随想')}</strong><time>${fmtTime(n.createdAt)}</time></div>
            <p>${escapeHtml(n.content)}</p>
          </div>`
                )
                .join('')
            : '<p class="notes-empty">还没有笔记，去读一本书写下第一条吧！</p>'
        }
      </div>`;
    container.querySelector('#btn-back-shelf2').onclick = showShelf;
  }

  showShelf();
  return destroyReader;
}
