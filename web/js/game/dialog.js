// 动森式对话框：名牌胶囊 + 打字机逐字显示；E / 空格 / 回车 / 点击推进。
const TYPE_INTERVAL = 28; // 每字毫秒

export function showDialog({ name, color = '#ef9a63', lines }) {
  return new Promise((resolve) => {
    const box = document.getElementById('dialog');
    const nameEl = document.getElementById('dialog-name');
    const textEl = document.getElementById('dialog-text');
    const hintEl = document.getElementById('dialog-hint');

    nameEl.textContent = name;
    nameEl.style.background = color;
    box.classList.remove('hidden');

    let lineIdx = 0;
    let charIdx = 0;
    let typing = null;

    function startLine() {
      textEl.textContent = '';
      charIdx = 0;
      hintEl.style.visibility = 'hidden';
      clearInterval(typing);
      typing = setInterval(() => {
        charIdx++;
        textEl.textContent = lines[lineIdx].slice(0, charIdx);
        if (charIdx >= lines[lineIdx].length) {
          clearInterval(typing);
          typing = null;
          hintEl.style.visibility = 'visible';
        }
      }, TYPE_INTERVAL);
    }

    function advance() {
      if (typing) {
        // 正在打字 → 直接放完整句
        clearInterval(typing);
        typing = null;
        textEl.textContent = lines[lineIdx];
        hintEl.style.visibility = 'visible';
        return;
      }
      lineIdx++;
      if (lineIdx < lines.length) {
        startLine();
      } else {
        close();
      }
    }

    function onKey(e) {
      const k = e.key.toLowerCase();
      if (k === 'e' || k === ' ' || k === 'enter') {
        e.preventDefault();
        e.stopPropagation();
        advance();
      }
    }

    function close() {
      clearInterval(typing);
      box.classList.add('hidden');
      window.removeEventListener('keydown', onKey, true);
      box.removeEventListener('click', advance);
      resolve();
    }

    // capture 阶段拦截，避免触发引擎的 E 键交互
    window.addEventListener('keydown', onKey, true);
    box.addEventListener('click', advance);
    startLine();
  });
}
