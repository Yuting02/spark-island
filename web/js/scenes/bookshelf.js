// 书屋·书架：挑一本书（之后去自习桌阅读）；附「我的笔记本」回看全部云端笔记。
import { api } from '../api.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function coverHue(title) {
  let h = 0;
  for (const ch of title) h = (h * 31 + ch.codePointAt(0)) % 360;
  return h;
}

export function fmtTime(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function openBookshelf({ player, container, onSelect, selectedBook }) {
  async function showShelf() {
    container.innerHTML = '<p class="scene-loading">阿书正在整理书架……</p>';
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
        <button class="book-cover ${selectedBook?.id === b.id ? 'picked' : ''}" data-id="${b.id}" style="--hue:${coverHue(b.title)}">
          <span class="bc-title">${escapeHtml(b.title)}</span>
          <span class="bc-author">${escapeHtml(b.author || '佚名')}</span>
          ${selectedBook?.id === b.id ? '<span class="bc-badge">已选</span>' : ''}
        </button>`
          )
          .join('')
      : '<p class="scene-empty">📚 书架空空如也，请管理员在后台上传 epub。</p>';

    container.innerHTML = `
      <div class="study-toolbar">
        <span class="study-tip">挑一本书，然后到自习桌坐下开始阅读</span>
        <button class="ac-btn" id="btn-notebook">🗒️ 我的笔记本</button>
      </div>
      <div class="bookshelf">${covers}</div>`;

    container.querySelector('#btn-notebook').onclick = showNotebook;
    container.querySelectorAll('.book-cover').forEach((el) => {
      el.onclick = () => onSelect(books.find((b) => b.id === el.dataset.id));
    });
  }

  async function showNotebook() {
    container.innerHTML = '<p class="scene-loading">正在翻开笔记本……</p>';
    let notes = [];
    try {
      notes = await api.notes(player.id);
    } catch {}
    container.innerHTML = `
      <div class="study-toolbar">
        <button class="ac-btn" id="btn-back-shelf">← 书架</button>
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
            : '<p class="notes-empty">还没有笔记，选本书去自习桌写下第一条吧！</p>'
        }
      </div>`;
    container.querySelector('#btn-back-shelf').onclick = showShelf;
  }

  showShelf();
}
