// 报亭场景：当日 AI 新闻以"报纸"形态渲染；停留阅读 3 秒后记任务完成。
import { api } from '../api.js';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function cnDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 星期${WEEKDAYS[d.getDay()]}`;
}

export function openNews({ container, completeTask }) {
  container.innerHTML = '<p class="scene-loading">店主正在整理今天的报纸……</p>';
  let timer = null;

  api
    .newsToday()
    .then(({ date, fallback, items }) => {
      if (!items.length) {
        container.innerHTML = '<p class="scene-empty">📭 报亭今天还没进货，请管理员在后台上传新闻。</p>';
        return;
      }
      const articles = items
        .map(
          (n) => `
        <article class="np-article">
          <h2>${escapeHtml(n.title)}</h2>
          <div class="np-body">${window.marked ? window.marked.parse(n.content) : escapeHtml(n.content)}</div>
        </article>`
        )
        .join('<hr class="np-rule">');

      container.innerHTML = `
        <div class="newspaper">
          <div class="np-masthead">像素小镇日报<span>PIXEL TOWN DAILY</span></div>
          <div class="np-date">${cnDate(date)}</div>
          ${fallback ? `<div class="np-fallback">今日新刊未到，为您展示最近一期（${date}）</div>` : ''}
          ${articles}
          <div class="np-foot">—— 读完报纸，任务自动完成 ——</div>
        </div>`;

      timer = setTimeout(() => completeTask('news'), 3000);
    })
    .catch((e) => {
      container.innerHTML = `<p class="scene-empty">报纸被风吹跑了：${escapeHtml(e.message)}</p>`;
    });

  return () => clearTimeout(timer);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
