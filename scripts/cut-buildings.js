// 建筑立绘抠背景（针对带噪点的渐晕背景）：
// ① 边缘洪水填充（较宽容差，吸收背景噪点；建筑深色描边阻断蔓延）
// ② 斑点清理（被删像素包围的孤立残点一并删除）
// ③ 连通块过滤（只保留占图面积 >0.5% 的前景块，清掉游离碎片）
// ④ 边缘羽化。book 使用用户提供的透明版 book-plan2.png 直接复制。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'ui-building');
const OUT = path.join(SRC, 'cut');
fs.mkdirSync(OUT, { recursive: true });

const TOL = 48; // 相邻像素 RGB 差和阈值（覆盖背景噪点；描边差值远大于此）

function cut(srcName, outName) {
  const png = PNG.sync.read(fs.readFileSync(path.join(SRC, srcName)));
  const { width: w, height: h, data } = png;
  const N = w * h;
  const remove = new Uint8Array(N);
  const queue = new Int32Array(N);
  let head = 0;
  let tail = 0;

  const push = (i) => {
    if (!remove[i]) {
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

  // ① 洪水填充
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i / w) | 0;
    const p = i * 4;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (remove[ni]) continue;
      const q = ni * 4;
      const diff = Math.abs(data[p] - data[q]) + Math.abs(data[p + 1] - data[q + 1]) + Math.abs(data[p + 2] - data[q + 2]);
      if (diff < TOL) push(ni);
    }
  }

  // ② 斑点清理：8 邻域中 ≥6 个已删 → 跟着删（迭代 4 轮）
  for (let pass = 0; pass < 4; pass++) {
    let changed = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (remove[i]) continue;
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

  // ③ 连通块过滤：保留面积 >0.5% 的前景块
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
  const minSize = N * 0.005;
  for (let i = 0; i < N; i++) {
    if (!remove[i] && sizes[label[i]] < minSize) remove[i] = 1;
  }

  let removed = 0;
  for (let i = 0; i < N; i++) {
    if (remove[i]) {
      data[i * 4 + 3] = 0;
      removed++;
    }
  }

  // ④ 边缘羽化
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (remove[i]) continue;
      const nearRemoved = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].some(
        ([nx, ny]) => nx >= 0 && ny >= 0 && nx < w && ny < h && remove[ny * w + nx]
      );
      if (nearRemoved) data[i * 4 + 3] = Math.min(data[i * 4 + 3], 130);
    }
  }

  fs.writeFileSync(path.join(OUT, outName), PNG.sync.write(png));
  console.log(`✓ ${srcName} → cut/${outName}（去除 ${((removed / N) * 100).toFixed(1)}% 背景，前景块 ${sizes.filter((s) => s >= minSize).length} 个）`);
}

/**
 * 棋盘格"假透明"抠图：背景是画出来的灰白棋盘格（实际不透明）。
 * 取图片边缘带的两种主色作为棋盘色，洪水填充只在接近棋盘色的像素上蔓延，
 * 建筑/角色像素不是棋盘色，蔓延自然停止；内部白色因被描边包围不会被误删。
 */
function cutChecker(srcName, outName) {
  const png = PNG.sync.read(fs.readFileSync(path.join(SRC, srcName)));
  const { width: w, height: h, data } = png;
  const N = w * h;

  // 边缘带主色统计（量化到 16 级）
  const freq = new Map();
  const band = 6;
  const sample = (x, y) => {
    const p = (y * w + x) * 4;
    const key = `${data[p] >> 4},${data[p + 1] >> 4},${data[p + 2] >> 4}`;
    const e = freq.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    e.n++;
    e.r += data[p];
    e.g += data[p + 1];
    e.b += data[p + 2];
    freq.set(key, e);
  };
  for (let x = 0; x < w; x++) for (let y = 0; y < band; y++) { sample(x, y); sample(x, h - 1 - y); }
  for (let y = 0; y < h; y++) for (let x = 0; x < band; x++) { sample(x, y); sample(w - 1 - x, y); }
  const top = [...freq.values()].sort((a, b) => b.n - a.n).slice(0, 2)
    .map((e) => [e.r / e.n, e.g / e.n, e.b / e.n]);

  const CTOL = 42;
  const isChecker = (i) => {
    const p = i * 4;
    return top.some(([r, g, b]) => Math.abs(data[p] - r) + Math.abs(data[p + 1] - g) + Math.abs(data[p + 2] - b) < CTOL);
  };

  const remove = new Uint8Array(N);
  const queue = new Int32Array(N);
  let head = 0;
  let tail = 0;
  const push = (i) => {
    if (!remove[i] && isChecker(i)) {
      remove[i] = 1;
      queue[tail++] = i;
    }
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (head < tail) {
    const i = queue[head++];
    const x = i % w;
    const y = (i / w) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      push(ny * w + nx);
    }
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
      if (nearRemoved) data[i * 4 + 3] = Math.min(data[i * 4 + 3], 130);
    }
  }
  fs.writeFileSync(path.join(OUT, outName), PNG.sync.write(png));
  console.log(`✓ ${srcName} → cut/${outName}（棋盘格抠图，去除 ${((removed / N) * 100).toFixed(1)}%）`);
}

cut('news.png', 'news.png');
cut('coffee.png', 'coffee.png');
cut('radio.png', 'radio.png');
cutChecker('book-plan2.png', 'book.png');
cutChecker('user.png', 'user.png');
