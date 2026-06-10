// 像素美术：全部由代码生成（字符画 + 调色板 + 程序纹理），仓库零图片资产。
export const TILE = 16;

// ── 字符画 → 离屏 canvas ──
function spriteFromGrid(rows, palette) {
  const c = document.createElement('canvas');
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext('2d');
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const color = palette[ch];
      if (color) {
        g.fillStyle = color;
        g.fillRect(x, y, 1, 1);
      }
    });
  });
  return c;
}

function mirror(canvas) {
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = canvas.height;
  const g = c.getContext('2d');
  g.translate(canvas.width, 0);
  g.scale(-1, 1);
  g.drawImage(canvas, 0, 0);
  return c;
}

// ── 主角（12×16，4 方向 × 2 帧） ──
const P = {
  h: '#6b4a2f', // 头发
  s: '#f2c79b', // 皮肤
  e: '#26211c', // 眼睛
  c: '#d94f4f', // 上衣
  d: '#b03a3a', // 上衣暗部
  p: '#3a4a6b', // 裤子
  k: '#2e2620', // 鞋
};

const BODY_A = [
  '..cccccccc..',
  '.s.cdccccd.s',
  '.s.cccccc.s.',
  '...dccccd...',
  '...pppppp...',
  '...pp..pp...',
  '...pp..pp...',
  '...kk..kk...',
];
const BODY_B = [
  '..cccccccc..',
  '.s.cdccccd.s',
  '.s.cccccc.s.',
  '...dccccd...',
  '...pppppp...',
  '....pppp....',
  '...pp..pp...',
  '..kk....kk..',
];

const HEAD_DOWN = [
  '..hhhhhhhh..',
  '.hhhhhhhhhh.',
  '.hhhhhhhhhh.',
  '.hssssssssh.',
  '.hsessssesh.',
  '..ssssssss..',
  '...ssssss...',
  '....ssss....',
];
const HEAD_UP = [
  '..hhhhhhhh..',
  '.hhhhhhhhhh.',
  '.hhhhhhhhhh.',
  '.hhhhhhhhhh.',
  '.hhhhhhhhhh.',
  '..hhhhhhhh..',
  '...hhhhhh...',
  '....ssss....',
];
const HEAD_SIDE = [
  '..hhhhhhhh..',
  '.hhhhhhhhhh.',
  '.hhhhhhhhhh.',
  '.hhhssssss..',
  '.hhhsssess..', // 右侧脸，眼睛偏右
  '..hhssssss..',
  '...ssssss...',
  '....ssss....',
];

function makeFrames(head, body) {
  return [spriteFromGrid([...head, ...body], P), spriteFromGrid([...head, ...BODY_B], P)];
}

export function buildPlayerSprites() {
  const down = makeFrames(HEAD_DOWN, BODY_A);
  const up = makeFrames(HEAD_UP, BODY_A);
  const right = makeFrames(HEAD_SIDE, BODY_A);
  const left = right.map(mirror);
  return { down, up, right, left };
}

// ── 确定性伪随机（地形点缀用，保证每帧/每次刷新长一样） ──
export function rand01(seed) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ── 地形瓦片：直接画进背景 ctx（逻辑坐标，1 像素 = 1 单位） ──
export function drawTerrainTile(g, type, tx, ty, waveFrame) {
  const x = tx * TILE;
  const y = ty * TILE;
  const seed = tx * 73 + ty * 151;

  // 草地打底
  g.fillStyle = '#67b06f';
  g.fillRect(x, y, TILE, TILE);
  for (let i = 0; i < 4; i++) {
    const sx = Math.floor(rand01(seed + i) * 14);
    const sy = Math.floor(rand01(seed + i + 9) * 14);
    g.fillStyle = i % 2 ? '#5da265' : '#74bd7c';
    g.fillRect(x + sx, y + sy, 2, 1);
  }

  if (type === 'r') {
    g.fillStyle = '#d9c8a0';
    g.fillRect(x, y, TILE, TILE);
    for (let i = 0; i < 3; i++) {
      g.fillStyle = '#c9b78e';
      g.fillRect(x + Math.floor(rand01(seed + i + 20) * 13), y + Math.floor(rand01(seed + i + 31) * 13), 2, 2);
    }
  } else if (type === 'W') {
    g.fillStyle = '#4d9be6';
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = '#7fb9f0';
    const off = waveFrame ? 4 : 0;
    g.fillRect(x + 2 + off, y + 4, 5, 1);
    g.fillRect(x + 8 - off, y + 11, 5, 1);
  } else if (type === 'T') {
    g.fillStyle = '#7a5230';
    g.fillRect(x + 6, y + 9, 4, 6); // 树干
    g.fillStyle = '#2e6b3e';
    g.fillRect(x + 3, y + 2, 10, 8);
    g.fillRect(x + 1, y + 4, 14, 5);
    g.fillStyle = '#3d8552';
    g.fillRect(x + 4, y + 3, 4, 2);
    g.fillRect(x + 9, y + 6, 3, 2);
  } else if (type === 'F') {
    const colors = ['#f06292', '#ffd54f', '#ef5350'];
    for (let i = 0; i < 3; i++) {
      const fx = x + 2 + Math.floor(rand01(seed + i + 40) * 11);
      const fy = y + 2 + Math.floor(rand01(seed + i + 55) * 11);
      g.fillStyle = colors[i];
      g.fillRect(fx, fy, 2, 2);
      g.fillStyle = '#fffde7';
      g.fillRect(fx, fy, 1, 1);
    }
  }
}

// ── 建筑：按类型配色绘制（roof/wall/window/door/牌匾/天线） ──
const BUILDING_STYLE = {
  news: { roof: '#e25555', roofAlt: '#f7f3e8', wall: '#caa472', icon: '📰' },
  study: { roof: '#4a6fa5', roofAlt: '#3a5a8c', wall: '#e8ddc3', icon: '📚' },
  radio: { roof: '#7c5cbf', roofAlt: '#684aa6', wall: '#8b95a5', icon: '📻' },
};

export function drawBuilding(g, b) {
  const s = BUILDING_STYLE[b.id];
  const x = b.x * TILE;
  const y = b.y * TILE;
  const w = b.w * TILE;
  const h = b.h * TILE;

  // 墙体
  g.fillStyle = s.wall;
  g.fillRect(x, y + TILE, w, h - TILE);
  g.fillStyle = 'rgba(0,0,0,.12)';
  g.fillRect(x, y + h - 3, w, 3); // 墙脚阴影

  // 屋顶（报亭是红白条纹遮阳棚，其余是双色瓦）
  if (b.id === 'news') {
    for (let i = 0; i < b.w * 2; i++) {
      g.fillStyle = i % 2 ? s.roofAlt : s.roof;
      g.fillRect(x + i * (TILE / 2), y, TILE / 2, TILE);
    }
    g.fillStyle = 'rgba(0,0,0,.15)';
    g.fillRect(x, y + TILE - 3, w, 3);
  } else {
    g.fillStyle = s.roof;
    g.fillRect(x - 2, y, w + 4, TILE);
    g.fillStyle = s.roofAlt;
    for (let i = 0; i < (w + 4) / 8; i++) g.fillRect(x - 2 + i * 8, y + 6, 4, 2);
    g.fillStyle = 'rgba(0,0,0,.2)';
    g.fillRect(x - 2, y + TILE - 2, w + 4, 2);
  }

  // 窗户（墙面每隔一格，跳过门所在格）
  for (let i = 0; i < b.w; i++) {
    const wx = b.x + i;
    if (i % 2 === 0 || wx === b.door.x) continue;
    g.fillStyle = '#ffe9a8';
    g.fillRect(wx * TILE + 4, y + TILE + 4, 8, 7);
    g.fillStyle = '#6b5b45';
    g.fillRect(wx * TILE + 4, y + TILE + 7, 8, 1);
    g.strokeStyle = '#6b5b45';
    g.strokeRect(wx * TILE + 4.5, y + TILE + 4.5, 8, 7);
  }

  // 门（在建筑最下排）
  const dx = b.door.x * TILE;
  const dy = b.door.y * TILE;
  g.fillStyle = '#5b3a29';
  g.fillRect(dx + 3, dy + 2, 10, 14);
  g.fillStyle = '#7a5230';
  g.fillRect(dx + 4, dy + 3, 8, 12);
  g.fillStyle = '#ffd54f';
  g.fillRect(dx + 11, dy + 9, 1, 2);

  // 牌匾（带图标与名字，挂在门上方屋檐处）
  const label = `${s.icon} ${b.label}`;
  g.font = '8px "Microsoft YaHei", sans-serif';
  const tw = g.measureText(label).width + 8;
  const px = dx + TILE / 2 - tw / 2;
  const py = y + TILE - 6;
  g.fillStyle = '#2b2b2b';
  g.fillRect(px, py, tw, 12);
  g.fillStyle = '#f4a83b';
  g.fillRect(px, py, tw, 1);
  g.fillStyle = '#fff';
  g.textBaseline = 'middle';
  g.fillText(label, px + 4, py + 7);

  // 电台天线
  if (b.id === 'radio') {
    const ax = x + w - 10;
    g.fillStyle = '#3b3b3b';
    g.fillRect(ax, y - 12, 2, 12);
    g.fillRect(ax - 3, y - 8, 8, 1);
    g.fillStyle = '#ff5252';
    g.fillRect(ax, y - 14, 2, 2);
  }
}
