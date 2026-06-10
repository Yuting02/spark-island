// 电台场景：节目列表 + 自绘播放器（播放/暂停、可拖动进度条、±15 秒）；累计收听 30 秒完成任务。
import { api } from '../api.js';

const LISTEN_GOAL = 30; // 秒

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmt(sec) {
  if (!Number.isFinite(sec)) return '--:--';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function openRadio({ container, completeTask }) {
  const audio = new Audio();
  let listened = 0;
  let lastT = null;
  let dragging = false;
  let goalDone = false;

  container.innerHTML = '<p class="scene-loading">正在调频……</p>';

  api
    .radio()
    .then((tracks) => {
      if (!tracks.length) {
        container.innerHTML = '<p class="scene-empty">📻 电台今天停播，请管理员在后台上传节目。</p>';
        return;
      }
      container.innerHTML = `
        <div class="radio-layout">
          <div class="radio-list">
            <h3>📻 节目单</h3>
            ${tracks.map((t, i) => `<button class="radio-track" data-i="${i}">${escapeHtml(t.title)}</button>`).join('')}
          </div>
          <div class="radio-player">
            <div class="rp-disc">📻</div>
            <div class="rp-title" id="rp-title">点左侧节目单开始收听</div>
            <div class="rp-progress">
              <span id="rp-cur">00:00</span>
              <input type="range" id="rp-seek" min="0" max="100" step="0.1" value="0" disabled>
              <span id="rp-dur">--:--</span>
            </div>
            <div class="rp-controls">
              <button class="px-btn" id="rp-back" title="快退 15 秒">⏪ 15s</button>
              <button class="px-btn px-primary" id="rp-play">▶ 播放</button>
              <button class="px-btn" id="rp-fwd" title="快进 15 秒">15s ⏩</button>
            </div>
            <div class="rp-goal" id="rp-goal">🎯 累计收听 ${LISTEN_GOAL} 秒完成今日任务</div>
          </div>
        </div>`;

      const $ = (sel) => container.querySelector(sel);
      const seek = $('#rp-seek');
      const playBtn = $('#rp-play');

      function pick(i) {
        const t = tracks[i];
        audio.src = t.file;
        $('#rp-title').textContent = t.title;
        container.querySelectorAll('.radio-track').forEach((el, j) => el.classList.toggle('active', i === j));
        seek.disabled = false;
        lastT = null;
        audio.play().catch(() => {});
      }

      container.querySelectorAll('.radio-track').forEach((el) => {
        el.onclick = () => pick(Number(el.dataset.i));
      });

      playBtn.onclick = () => {
        if (!audio.src) return pick(0);
        audio.paused ? audio.play().catch(() => {}) : audio.pause();
      };
      $('#rp-back').onclick = () => (audio.currentTime = Math.max(0, audio.currentTime - 15));
      $('#rp-fwd').onclick = () => (audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 15));

      audio.addEventListener('play', () => (playBtn.textContent = '⏸ 暂停'));
      audio.addEventListener('pause', () => {
        playBtn.textContent = '▶ 播放';
        lastT = null;
      });
      audio.addEventListener('loadedmetadata', () => {
        seek.max = audio.duration;
        $('#rp-dur').textContent = fmt(audio.duration);
      });
      audio.addEventListener('timeupdate', () => {
        if (!dragging) {
          seek.value = audio.currentTime;
          $('#rp-cur').textContent = fmt(audio.currentTime);
        }
        // 只累计自然播放（拖动/跳转产生的大间隔不算）
        if (lastT !== null) {
          const delta = audio.currentTime - lastT;
          if (delta > 0 && delta < 1.5) listened += delta;
        }
        lastT = audio.currentTime;
        if (!goalDone) {
          const left = Math.max(0, Math.ceil(LISTEN_GOAL - listened));
          $('#rp-goal').textContent = left > 0 ? `🎯 再听 ${left} 秒完成今日任务` : '✅ 今日收听任务完成！';
          if (listened >= LISTEN_GOAL) {
            goalDone = true;
            completeTask('radio');
          }
        }
      });

      seek.addEventListener('input', () => {
        dragging = true;
        $('#rp-cur').textContent = fmt(Number(seek.value));
      });
      seek.addEventListener('change', () => {
        audio.currentTime = Number(seek.value);
        dragging = false;
        lastT = null;
      });
    })
    .catch((e) => {
      container.innerHTML = `<p class="scene-empty">信号不好：${escapeHtml(e.message)}</p>`;
    });

  return () => {
    audio.pause();
    audio.removeAttribute('src');
  };
}
