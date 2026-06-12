// v1.6 建筑抠图：从摆好布局的整图 ui-building/v1.6/island.png 中裁出四栋建筑，
// 抠掉背景后输出带 alpha 的 sprite（游戏中原位贴回、参与 y 排序实现人物前后遮挡）。
// 算法：裁剪 → 边缘洪水填充（相邻容差吸收沙地噪点）→ 斑点清理 → 连通块过滤 → 羽化。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'ui-building', 'v1.6', 'island.png');
const OUT = path.join(ROOT, 'ui-building', 'v1.6', 'sprites');
fs.mkdirSync(OUT, { recursive: true });

// 裁剪框（场景坐标 = 原图像素），四边须为纯背景，宁大勿切到建筑。
// protect = 建筑核心保护区（相对裁剪框），洪水禁止进入，杜绝浅色墙面被穿透。
const JOBS = [
  { id: 'study', x: 145, y: 230, w: 445, h: 335, protect: [60, 30, 330, 270] },
  { id: 'cafe', x: 620, y: 120, w: 520, h: 455, protect: [60, 90, 410, 340] },
  { id: 'radio', x: 1185, y: 40, w: 478, h: 605, protect: [110, 300, 290, 270] },
  { id: 'news', x: 345, y: 505, w: 465, h: 375, protect: [50, 40, 370, 290] },
];

const BG_TOL = 80; // 与背景主色的最大距离（纹理背景靠色域蔓延；建筑描边+保护区双重屏障）

const srcPng = PNG.sync.read(fs.readFileSync(SRC));

function extract(job) {
  const { x: ox, y: oy, w, h } = job;
  const png = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((oy + y) * srcPng.width + ox + x) * 4;
      const di = (y * w + x) * 4;
      png.data[di] = srcPng.data[si];
      png.data[di + 1] = srcPng.data[si + 1];
      png.data[di + 2] = srcPng.data[si + 2];
      png.data[di + 3] = 255;
    }
  }
  const { data } = png;
  const N = w * h;

  // 背景主色域：取裁剪框边缘带（8px）的量化主色 top5
  const freq = new Map();
  const sampleBg = (x, y) => {
    const p = (y * w + x) * 4;
    const key = `${data[p] >> 4},${data[p + 1] >> 4},${data[p + 2] >> 4}`;
    const e = freq.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += data[p];
    e.g += data[p + 1];
    e.b += data[p + 2];
    freq.set(key, e);
  };
  for (let x = 0; x < w; x++) for (let d = 0; d < 8; d++) { sampleBg(x, d); sampleBg(x, h - 1 - d); }
  for (let y = 0; y < h; y++) for (let d = 0; d < 8; d++) { sampleBg(d, y); sampleBg(w - 1 - d, y); }
  const bgColors = [...freq.values()].sort((a, b) => b.n - a.n).slice(0, 12)
    .map((e) => [e.r / e.n, e.g / e.n, e.b / e.n]);
  bgColors.push([252, 252, 252]); // 白云
  const isBgColor = (i) => {
    const p = i * 4;
    return bgColors.some(([r, g, b]) => Math.abs(data[p] - r) + Math.abs(data[p + 1] - g) + Math.abs(data[p + 2] - b) < BG_TOL);
  };

  const [px, py, pw, ph] = job.protect;
  const inProtect = (i) => {
    const x = i % w;
    const y = (i / w) | 0;
    return x >= px && x < px + pw && y >= py && y < py + ph;
  };

  const remove = new Uint8Array(N);
  const queue = new Int32Array(N);
  let head = 0;
  let tail = 0;
  const push = (i) => {
    if (!remove[i] && !inProtect(i)) {
      remove[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  // 色域蔓延：目标像素属于背景色域即可（颗粒纹理背景畅通；建筑深色描边天然挡住蔓延）
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i / w) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (!remove[ni] && isBgColor(ni)) push(ni);
    }
  }

  // 斑点清理（多轮，啃掉连接背景残块的细走廊）
  for (let pass = 0; pass < 10; pass++) {
    let changed = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (remove[i] || inProtect(i)) continue;
        let cnt = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if ((dx || dy) && remove[(y + dy) * w + x + dx]) cnt++;
          }
        }
        if (cnt >= 6) {
          remove[i] = 1;
          changed++;
        }
      }
    }
    if (!changed) break;
  }

  // 连通块过滤：只保留最大块（建筑主体）；分离的小物留在底图即可
  const label = new Int32Array(N).fill(-1);
  const sizes = [];
  for (let s = 0; s < N; s++) {
    if (remove[s] || label[s] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    let qh = 0;
    let qt = 0;
    queue[qt++] = s;
    label[s] = id;
    while (qh < qt) {
      const i = queue[qh++];
      size++;
      const x = i % w;
      const y = (i / w) | 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (!remove[ni] && label[ni] === -1) {
          label[ni] = id;
          queue[qt++] = ni;
        }
      }
    }
    sizes.push(size);
  }
  const maxSize = Math.max(...sizes);
  for (let i = 0; i < N; i++) {
    if (!remove[i] && sizes[label[i]] < maxSize) remove[i] = 1;
  }

  let removed = 0;
  for (let i = 0; i < N; i++) {
    if (remove[i]) {
      data[i * 4 + 3] = 0;
      removed++;
    }
  }
  // 羽化
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (remove[i]) continue;
      const nearRemoved = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(
        ([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h && remove[ny * w + nx]
      );
      if (nearRemoved) data[i * 4 + 3] = 130;
    }
  }

  fs.writeFileSync(path.join(OUT, `${job.id}.png`), PNG.sync.write(png));
  console.log(`✓ ${job.id} (${ox},${oy} ${w}×${h}) 去背 ${((removed / N) * 100).toFixed(1)}%，保留最大块 ${maxSize}px`);
}

JOBS.forEach(extract);
