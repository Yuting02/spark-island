// 咖啡馆·吧台：点单消费金币（为后续多用户社交铺垫的第一块拼图）。
import { api } from '../api.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function openCafe({ player, container, onCoins }) {
  container.innerHTML = '<p class="scene-loading">店长摩卡正在擦杯子……</p>';

  Promise.all([api.cafeMenu(), api.getPlayer(player.id)])
    .then(([menu, me]) => {
      container.innerHTML = `
        <div class="cafe-head">
          <span class="cafe-balance">我的金币：🪙 <strong id="cafe-coins">${me.coins}</strong></span>
          <span class="study-tip">完成每日任务赚金币，犒劳自己一杯～</span>
        </div>
        <div class="cafe-menu">
          ${menu
            .map(
              (m) => `
            <div class="cafe-item">
              <div class="ci-emoji">${m.emoji}</div>
              <div class="ci-name">${escapeHtml(m.name)}</div>
              <div class="ci-price">🪙 ${m.price}</div>
              <button class="ac-btn ac-primary" data-order="${m.id}">来一杯</button>
            </div>`
            )
            .join('')}
        </div>
        <div class="cafe-msg" id="cafe-msg"></div>`;

      const msgEl = container.querySelector('#cafe-msg');
      container.querySelectorAll('[data-order]').forEach((btn) => {
        btn.onclick = async () => {
          btn.disabled = true;
          try {
            const r = await api.cafeOrder(player.id, btn.dataset.order);
            container.querySelector('#cafe-coins').textContent = r.coins;
            msgEl.textContent = `${r.item.emoji} ${r.item.name}好啦，请慢用～（-${r.item.price} 金币）`;
            msgEl.className = 'cafe-msg ok';
            onCoins(r.coins);
          } catch (e) {
            msgEl.textContent = e.message;
            msgEl.className = 'cafe-msg err';
          } finally {
            btn.disabled = false;
          }
        };
      });
    })
    .catch((e) => {
      container.innerHTML = `<p class="scene-empty">${escapeHtml(e.message)}</p>`;
    });
}
