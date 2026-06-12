// 岛民护照：昵称、金币、绑定邮箱（奖励 100 金币）、最近账单。
import { api } from '../api.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function openProfile({ player, container, onCoins }) {
  container.innerHTML = '<p class="scene-loading">正在翻开护照……</p>';

  Promise.all([api.getPlayer(player.id), api.transactions(player.id)])
    .then(([me, txs]) => {
      container.innerHTML = `
        <div class="profile">
          <div class="profile-card">
            <img class="pf-avatar" src="/assets/v1.6/user.png" alt="猫咪头像">
            <div class="pf-name">${escapeHtml(me.nickname)}</div>
            <div class="pf-coins">🪙 ${me.coins} 金币</div>
          </div>
          <div class="profile-email">
            ${
              me.email
                ? `<p>📮 已绑定邮箱：<strong>${escapeHtml(me.email)}</strong></p>`
                : `<p>📮 绑定邮箱，领取 <strong>100 金币</strong> 奖励：</p>
                   <div class="pf-email-form">
                     <input type="email" id="pf-email-input" placeholder="you@example.com">
                     <button class="ac-btn ac-primary" id="pf-email-btn">绑定领奖</button>
                   </div>
                   <div class="cafe-msg" id="pf-email-msg"></div>`
            }
          </div>
          <div class="profile-txs">
            <h3>🧾 最近账单</h3>
            ${
              txs.length
                ? txs
                    .map(
                      (t) => `<div class="tx-item"><span>${escapeHtml(t.reason)}</span>
                        <strong class="${t.amount >= 0 ? 'tx-in' : 'tx-out'}">${t.amount >= 0 ? '+' : ''}${t.amount}</strong></div>`
                    )
                    .join('')
                : '<p class="notes-empty">还没有账单记录</p>'
            }
          </div>
        </div>`;

      const btn = container.querySelector('#pf-email-btn');
      if (btn) {
        btn.onclick = async () => {
          const email = container.querySelector('#pf-email-input').value.trim();
          const msgEl = container.querySelector('#pf-email-msg');
          btn.disabled = true;
          try {
            const r = await api.bindEmail(player.id, email);
            onCoins(r.coins, `🪙 +${r.reward} 绑定邮箱奖励！`);
            openProfile({ player, container, onCoins }); // 刷新视图
          } catch (e) {
            msgEl.textContent = e.message;
            msgEl.className = 'cafe-msg err';
            btn.disabled = false;
          }
        };
      }
    })
    .catch((e) => {
      container.innerHTML = `<p class="scene-empty">${escapeHtml(e.message)}</p>`;
    });
}
