// 动森风格绘制层：圆润矢量造型 + 柔和配色，全部代码绘制，仓库零图片资产。
export const TILE = 48;

/** 圆角矩形路径（手写，避免依赖 ctx.roundRect 兼容性） */
export function rr(g, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rad, y);
  g.arcTo(x + w, y, x + w, y + h, rad);
  g.arcTo(x + w, y + h, x, y + h, rad);
  g.arcTo(x, y + h, x, y, rad);
  g.arcTo(x, y, x + w, y, rad);
  g.closePath();
}

export function rand01(seed) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/* ════════════ 角色（玩家 / NPC 通用） ════════════ */

export const CHARACTER_PRESETS = {
  player: { hair: '#6b4a2f', skin: '#ffd9b0', shirt: '#ff8a65' },
  zhou: { hair: '#8d8d8d', skin: '#f5c9a3', shirt: '#5c8a64', accessory: 'cap' }, // 报亭老周
  shu: { hair: '#4e3b2a', skin: '#ffe0bd', shirt: '#7986cb', accessory: 'glasses' }, // 书屋阿书
  dj: { hair: '#26323f', skin: '#f2c79b', shirt: '#9575cd', accessory: 'headphones' }, // 电台 DJ
  mocha: { hair: '#a1664a', skin: '#ffe0bd', shirt: '#8d6e63', accessory: 'apron' }, // 咖啡店长
  walker1: { hair: '#3e2723', skin: '#ffd9b0', shirt: '#4fc3f7' },
  walker2: { hair: '#795548', skin: '#f5c9a3', shirt: '#aed581' },
};

/**
 * 画一个 Q 萌小人。(fx, fy) 为脚底中心点。
 * opts: { dir, frame(0/1), moving, palette:{hair,skin,shirt}, accessory, scale }
 * scale 用于伪3D 纵深（近大远小），以脚底为基准缩放。
 */
export function drawCharacter(g, fx, fy, opts = {}) {
  const { dir = 'down', frame = 0, moving = false, palette = CHARACTER_PRESETS.player } = opts;
  const accessory = opts.accessory ?? palette.accessory;
  const bob = moving ? (frame ? -1.5 : 0.5) : 0;
  const scale = opts.scale ?? 1;
  g.save();
  if (scale !== 1) {
    g.translate(fx, fy);
    g.scale(scale, scale);
    g.translate(-fx, -fy);
  }

  // 影子
  g.fillStyle = 'rgba(40,60,40,.18)';
  g.beginPath();
  g.ellipse(fx, fy + 2, 13, 5, 0, 0, Math.PI * 2);
  g.fill();

  // 脚（行走时交替抬起）
  const lift = moving ? (frame ? 3 : -3) : 0;
  g.fillStyle = '#7a5230';
  g.beginPath();
  g.ellipse(fx - 6, fy - 3 + (lift > 0 ? -lift : 0), 5, 4, 0, 0, Math.PI * 2);
  g.ellipse(fx + 6, fy - 3 + (lift < 0 ? lift : 0), 5, 4, 0, 0, Math.PI * 2);
  g.fill();

  // 身体（胶囊）
  g.fillStyle = palette.shirt;
  rr(g, fx - 11, fy - 27 + bob, 22, 23, 10);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,.08)';
  rr(g, fx - 11, fy - 14 + bob, 22, 10, 8);
  g.fill();

  // 围裙
  if (accessory === 'apron') {
    g.fillStyle = '#fff3e0';
    rr(g, fx - 7, fy - 22 + bob, 14, 16, 6);
    g.fill();
  }

  // 手
  g.fillStyle = palette.skin;
  g.beginPath();
  g.ellipse(fx - 12, fy - 16 + bob, 3.5, 4.5, 0, 0, Math.PI * 2);
  g.ellipse(fx + 12, fy - 16 + bob, 3.5, 4.5, 0, 0, Math.PI * 2);
  g.fill();

  // 头
  const hy = fy - 40 + bob;
  g.fillStyle = dir === 'up' ? palette.hair : palette.skin;
  g.beginPath();
  g.arc(fx, hy, 16, 0, Math.PI * 2);
  g.fill();

  if (dir !== 'up') {
    // 刘海（上半圆 + 两鬓）
    g.fillStyle = palette.hair;
    g.beginPath();
    g.arc(fx, hy, 16.5, Math.PI, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(fx - 14, hy - 2, 4, 8, 0, 0, Math.PI * 2);
    g.ellipse(fx + 14, hy - 2, 4, 8, 0, 0, Math.PI * 2);
    g.fill();

    // 眼睛 + 腮红
    g.fillStyle = '#33271e';
    const ey = hy + 4;
    if (dir === 'down') {
      g.beginPath();
      g.ellipse(fx - 6, ey, 2.4, 3.2, 0, 0, Math.PI * 2);
      g.ellipse(fx + 6, ey, 2.4, 3.2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,130,120,.35)';
      g.beginPath();
      g.ellipse(fx - 10, ey + 5, 3, 2, 0, 0, Math.PI * 2);
      g.ellipse(fx + 10, ey + 5, 3, 2, 0, 0, Math.PI * 2);
      g.fill();
    } else {
      const dx = dir === 'left' ? -1 : 1;
      g.beginPath();
      g.ellipse(fx + 8 * dx, ey, 2.4, 3.2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,130,120,.35)';
      g.beginPath();
      g.ellipse(fx + 3 * dx, ey + 5, 3, 2, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // 配饰
  if (accessory === 'glasses' && dir !== 'up') {
    g.strokeStyle = '#5d4037';
    g.lineWidth = 1.5;
    const ey = hy + 4;
    if (dir === 'down') {
      g.beginPath();
      g.arc(fx - 6, ey, 5, 0, Math.PI * 2);
      g.arc(fx + 6, ey, 5, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(fx - 1, ey);
      g.lineTo(fx + 1, ey);
      g.stroke();
    } else {
      g.beginPath();
      g.arc(fx + (dir === 'left' ? -8 : 8), ey, 5, 0, Math.PI * 2);
      g.stroke();
    }
  }
  if (accessory === 'headphones') {
    g.strokeStyle = '#37474f';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(fx, hy - 4, 17, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
    g.fillStyle = '#ff7043';
    g.beginPath();
    g.ellipse(fx - 15, hy + 3, 4, 6, 0, 0, Math.PI * 2);
    g.ellipse(fx + 15, hy + 3, 4, 6, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (accessory === 'cap') {
    g.fillStyle = '#455a64';
    g.beginPath();
    g.arc(fx, hy - 6, 15, Math.PI, Math.PI * 2);
    g.fill();
    rr(g, fx - 15, hy - 8, 30, 5, 2);
    g.fill();
  }
  g.restore();
}

/* ════════════ 户外地形 ════════════ */

export function drawTerrainTile(g, type, tx, ty, frame) {
  const x = tx * TILE;
  const y = ty * TILE;
  const seed = tx * 73 + ty * 151;

  if (type === '~') {
    g.fillStyle = '#5fc7e8';
    g.fillRect(x, y, TILE, TILE);
    g.strokeStyle = 'rgba(255,255,255,.5)';
    g.lineWidth = 2;
    for (let i = 0; i < 2; i++) {
      const wx = x + 6 + rand01(seed + i) * 24 + (frame ? 6 : 0);
      const wy = y + 10 + rand01(seed + i + 7) * 28;
      g.beginPath();
      g.arc(wx, wy, 5, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    }
    return;
  }
  if (type === 's') {
    g.fillStyle = '#f3e2b3';
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = '#e6d09c';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(x + rand01(seed + i) * 44 + 2, y + rand01(seed + i + 11) * 44 + 2, 1.5, 0, Math.PI * 2);
      g.fill();
    }
    return;
  }

  // 草地打底（统一鲜绿，AC 风）
  g.fillStyle = '#82c860';
  g.fillRect(x, y, TILE, TILE);
  g.fillStyle = 'rgba(255,255,255,.06)';
  if ((tx + ty) % 2) g.fillRect(x, y, TILE, TILE);
  g.fillStyle = '#6eb44e';
  for (let i = 0; i < 3; i++) {
    const gx = x + 4 + rand01(seed + i) * 38;
    const gy = y + 4 + rand01(seed + i + 5) * 38;
    g.beginPath();
    g.moveTo(gx, gy + 4);
    g.lineTo(gx + 2.5, gy);
    g.lineTo(gx + 5, gy + 4);
    g.closePath();
    g.fill();
  }

  if (type === 'r') {
    g.fillStyle = '#ecd9a8';
    rr(g, x - 2, y - 2, TILE + 4, TILE + 4, 8);
    g.fill();
    g.fillStyle = '#dcc28b';
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(x + 6 + rand01(seed + i + 20) * 36, y + 6 + rand01(seed + i + 31) * 36, 2, 0, Math.PI * 2);
      g.fill();
    }
  } else if (type === 'F') {
    const colors = ['#ff7eb3', '#ffd166', '#ff6b6b'];
    for (let i = 0; i < 3; i++) {
      const fx = x + 8 + rand01(seed + i + 40) * 30;
      const fy = y + 8 + rand01(seed + i + 55) * 30;
      g.fillStyle = colors[i];
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        g.beginPath();
        g.arc(fx + Math.cos(a) * 3.2, fy + Math.sin(a) * 3.2, 2.2, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#fffbe8';
      g.beginPath();
      g.arc(fx, fy, 2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = colors[i];
    }
  }
}

/** 蓬松大树（占 1 瓦片，树冠向上溢出，画在背景层） */
export function drawTree(g, tx, ty) {
  const x = tx * TILE + TILE / 2;
  const y = ty * TILE + TILE;
  g.fillStyle = 'rgba(40,60,40,.15)';
  g.beginPath();
  g.ellipse(x, y - 5, 16, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#9c6b3f';
  rr(g, x - 5, y - 26, 10, 22, 4);
  g.fill();
  const blobs = [
    [0, -44, 20, '#3f9d4e'],
    [-14, -34, 14, '#3f9d4e'],
    [14, -34, 14, '#3f9d4e'],
    [0, -40, 15, '#52b262'],
    [-8, -48, 10, '#52b262'],
  ];
  for (const [dx, dy, r, c] of blobs) {
    g.fillStyle = c;
    g.beginPath();
    g.arc(x + dx, y + dy, r, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,.25)';
  g.beginPath();
  g.arc(x - 6, y - 50, 4, 0, Math.PI * 2);
  g.arc(x + 9, y - 42, 3, 0, Math.PI * 2);
  g.fill();
}

/* ════════════ 建筑外观（动森小屋） ════════════ */

const BUILDING_STYLE = {
  news: { roof: '#ef6c57', wall: '#fff3dc', door: '#8d5a3a', icon: '📰' },
  study: { roof: '#5b8bd0', wall: '#fdf6e3', door: '#7a4f2f', icon: '📚' },
  radio: { roof: '#9268c9', wall: '#ece5f5', door: '#5d4a6e', icon: '📻' },
  cafe: { roof: '#a9743f', wall: '#ffeede', door: '#6d4427', icon: '☕' },
};

export function drawBuildingExterior(g, b) {
  const s = BUILDING_STYLE[b.id];
  const x = b.x * TILE;
  const y = b.y * TILE;
  const w = b.w * TILE;
  const h = b.h * TILE;
  const wallTop = y + TILE * 0.9;

  // 影子 + 墙
  g.fillStyle = 'rgba(40,60,40,.15)';
  g.beginPath();
  g.ellipse(x + w / 2, y + h - 2, w / 2, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = s.wall;
  rr(g, x, wallTop, w, y + h - wallTop - 2, 8);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,.12)';
  g.lineWidth = 2;
  rr(g, x, wallTop, w, y + h - wallTop - 2, 8);
  g.stroke();

  // 屋顶（圆拱 + 出檐）
  g.fillStyle = s.roof;
  rr(g, x - 8, y, w + 16, TILE * 1.1, 18);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,.18)';
  rr(g, x - 8, y, w + 16, TILE * 0.4, 18);
  g.fill();

  // 报亭：圆弧波浪遮阳棚
  if (b.id === 'news') {
    const scallops = Math.round(b.w * 2);
    const sw = (w + 16) / scallops;
    for (let i = 0; i < scallops; i++) {
      g.fillStyle = i % 2 ? '#fff' : '#ef6c57';
      g.beginPath();
      g.arc(x - 8 + sw * (i + 0.5), y + TILE * 1.1, sw / 2, 0, Math.PI);
      g.fill();
    }
  }

  // 窗户（圆窗）
  g.lineWidth = 2;
  for (let i = 0; i < b.w; i++) {
    const wx = b.x + i;
    if (i % 2 === 0 || wx === b.door.x) continue;
    const cx = wx * TILE + TILE / 2;
    const cy = wallTop + (y + h - wallTop) / 2 - 4;
    g.fillStyle = '#bfe7f5';
    g.beginPath();
    g.arc(cx, cy, 9, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.stroke();
    g.beginPath();
    g.moveTo(cx - 9, cy);
    g.lineTo(cx + 9, cy);
    g.stroke();
  }

  // 门（圆顶门）
  const dx = b.door.x * TILE + TILE / 2;
  const dh = TILE * 0.95;
  const dw = TILE * 0.62;
  const dy = y + h - dh - 2;
  g.fillStyle = s.door;
  g.beginPath();
  g.moveTo(dx - dw / 2, dy + dh);
  g.lineTo(dx - dw / 2, dy + dw / 2);
  g.arc(dx, dy + dw / 2, dw / 2, Math.PI, 0);
  g.lineTo(dx + dw / 2, dy + dh);
  g.closePath();
  g.fill();
  g.fillStyle = '#ffd166';
  g.beginPath();
  g.arc(dx + dw / 4, dy + dh * 0.6, 2.5, 0, Math.PI * 2);
  g.fill();

  // 牌匾（圆角胶囊）
  const label = `${s.icon} ${b.label}`;
  g.font = 'bold 15px "Microsoft YaHei", sans-serif';
  const tw = g.measureText(label).width + 20;
  g.fillStyle = '#fffbe8';
  rr(g, dx - tw / 2, y + TILE * 0.65, tw, 24, 12);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,.15)';
  rr(g, dx - tw / 2, y + TILE * 0.65, tw, 24, 12);
  g.stroke();
  g.fillStyle = '#6d5b43';
  g.textBaseline = 'middle';
  g.fillText(label, dx - tw / 2 + 10, y + TILE * 0.65 + 13);

  // 电台天线 / 咖啡馆烟囱
  if (b.id === 'radio') {
    const ax = x + w - 18;
    g.strokeStyle = '#4a4a55';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(ax, y + 4);
    g.lineTo(ax, y - 26);
    g.stroke();
    g.fillStyle = '#ff5252';
    g.beginPath();
    g.arc(ax, y - 30, 5, 0, Math.PI * 2);
    g.fill();
  }
  if (b.id === 'cafe') {
    g.fillStyle = '#8d5a3a';
    rr(g, x + w - 30, y - 16, 16, 26, 4);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.6)';
    g.beginPath();
    g.arc(x + w - 22, y - 24, 5, 0, Math.PI * 2);
    g.arc(x + w - 16, y - 34, 4, 0, Math.PI * 2);
    g.fill();
  }
}

/* ════════════ 室内 ════════════ */

export function drawIndoorTile(g, type, tx, ty, wallColor, floorColor) {
  const x = tx * TILE;
  const y = ty * TILE;
  if (type === '#') {
    g.fillStyle = wallColor;
    g.fillRect(x, y, TILE, TILE);
    g.fillStyle = 'rgba(0,0,0,.1)';
    g.fillRect(x, y + TILE - 6, TILE, 6);
  } else {
    g.fillStyle = floorColor;
    g.fillRect(x, y, TILE, TILE);
    g.strokeStyle = 'rgba(0,0,0,.07)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, y + TILE);
    g.lineTo(x + TILE, y + TILE);
    if ((tx + ty) % 2) g.moveTo(x + TILE / 2, y + TILE / 2);
    g.stroke();
  }
}

/** 家具：以瓦片为锚点绘制 */
export const FURNITURE = {
  bookshelf(g, x, y) {
    g.fillStyle = '#9c6b3f';
    rr(g, x + 2, y - 14, TILE - 4, TILE + 10, 5);
    g.fill();
    const colors = ['#e57373', '#64b5f6', '#ffd54f', '#81c784', '#ba68c8'];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 5; i++) {
        g.fillStyle = colors[(i + row * 2) % colors.length];
        g.fillRect(x + 6 + i * 8, y - 8 + row * 24, 6, 18);
      }
      g.fillStyle = '#7a5230';
      g.fillRect(x + 2, y + 12 + row * 24 - 24, TILE - 4, 4);
    }
  },
  desk(g, x, y) {
    g.fillStyle = 'rgba(40,60,40,.12)';
    g.beginPath();
    g.ellipse(x + TILE / 2, y + TILE - 4, 20, 6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c8955c';
    rr(g, x + 4, y + 6, TILE - 8, TILE - 20, 6);
    g.fill();
    g.fillStyle = '#fffbe8'; // 摊开的书
    rr(g, x + 12, y + 10, 24, 14, 2);
    g.fill();
    g.strokeStyle = '#bbb';
    g.beginPath();
    g.moveTo(x + 24, y + 10);
    g.lineTo(x + 24, y + 24);
    g.stroke();
  },
  counter(g, x, y, color = '#b07d4a') {
    g.fillStyle = color;
    rr(g, x + 1, y + 8, TILE - 2, TILE - 14, 6);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.2)';
    rr(g, x + 1, y + 8, TILE - 2, 8, 6);
    g.fill();
  },
  newsrack(g, x, y) {
    g.fillStyle = '#8d6e63';
    rr(g, x + 3, y - 10, TILE - 6, TILE + 4, 4);
    g.fill();
    for (let i = 0; i < 3; i++) {
      g.fillStyle = '#fdf6e3';
      rr(g, x + 8, y - 4 + i * 13, TILE - 16, 9, 2);
      g.fill();
      g.strokeStyle = '#9e9e9e';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 11, y - 1 + i * 13);
      g.lineTo(x + TILE - 11, y - 1 + i * 13);
      g.stroke();
    }
  },
  console(g, x, y) {
    g.fillStyle = '#4a4a55';
    rr(g, x + 2, y, TILE - 4, TILE - 10, 6);
    g.fill();
    g.fillStyle = '#80deea';
    rr(g, x + 8, y + 5, TILE - 16, 10, 3);
    g.fill();
    for (let i = 0; i < 4; i++) {
      g.fillStyle = ['#ff7043', '#ffd54f', '#81c784', '#64b5f6'][i];
      g.beginPath();
      g.arc(x + 12 + i * 8, y + 24, 3, 0, Math.PI * 2);
      g.fill();
    }
  },
  cafetable(g, x, y) {
    g.fillStyle = 'rgba(40,60,40,.12)';
    g.beginPath();
    g.ellipse(x + TILE / 2, y + TILE - 6, 18, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d7a86e';
    g.beginPath();
    g.arc(x + TILE / 2, y + TILE / 2 - 2, 16, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fffbe8';
    g.beginPath();
    g.arc(x + TILE / 2, y + TILE / 2 - 2, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#8d5a3a'; // 小咖啡杯
    g.beginPath();
    g.arc(x + TILE / 2, y + TILE / 2 - 2, 4, 0, Math.PI * 2);
    g.fill();
  },
  plant(g, x, y) {
    g.fillStyle = '#bf6f4a';
    rr(g, x + 14, y + 22, 20, 16, 4);
    g.fill();
    g.fillStyle = '#52b262';
    g.beginPath();
    g.arc(x + 18, y + 14, 8, 0, Math.PI * 2);
    g.arc(x + 30, y + 14, 8, 0, Math.PI * 2);
    g.arc(x + 24, y + 6, 8, 0, Math.PI * 2);
    g.fill();
  },
  rug(g, x, y, color = '#ef9a9a') {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(x + TILE, y + TILE / 2, TILE * 0.95, TILE * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(x + TILE, y + TILE / 2, TILE * 0.7, TILE * 0.3, 0, 0, Math.PI * 2);
    g.stroke();
  },
};
