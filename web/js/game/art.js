// 猫咪后院风绘制层：四方向迈步动画猫（角色/NPC 通用）+ 室内瓦片与家具。
// 户外建筑/岛屿使用 ui-building 图片素材，此处只负责"会动的部分"与室内。
export const TILE = 48;

/** 圆角矩形路径 */
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

/* ════════════ 猫咪角色 ════════════ */

// 主角五官与配色严格对照 ui-building/new/user.png：
// 橘色头顶三道条纹、白色下半脸与两颊、大圆黑眼带高光、粉鼻 ω 嘴、
// 米色编织项圈配粉花、白色四肢带粉爪垫、橘尾深色环纹
export const CAT_PRESETS = {
  player: { fur: '#f3a662', stripe: '#d9813f', belly: '#fff6e8', earIn: '#f49d8c', collar: '#c9a87c', flower: '#f7b9ca', paw: '#f2a6a0' },
  zhou: { fur: '#9aa0a6', stripe: '#6f767d', belly: '#e8eaed', earIn: '#d8a0a0', accessory: 'cap' }, // 报亭老周：灰猫大叔
  shu: { fur: '#f5f1e8', stripe: '#4a4a4a', belly: '#ffffff', earIn: '#f0b5ab', accessory: 'glasses' }, // 书屋阿书：奶牛猫
  dj: { fur: '#52525e', stripe: '#3d3d49', belly: '#9d9dab', earIn: '#c98989', accessory: 'headphones' }, // DJ 阿波：黑猫
  mocha: { fur: '#a9755a', stripe: '#8a5a42', belly: '#f0e0d0', earIn: '#e0a090', accessory: 'apron' }, // 店长摩卡：棕猫
  walker1: { fur: '#f7e3c8', stripe: '#e8954f', belly: '#fffaf0', earIn: '#f0a898' }, // 小柚：三花
  walker2: { fur: '#c8d2d8', stripe: '#94a6b0', belly: '#f2f6f8', earIn: '#d8a0a0' }, // 阿森：蓝灰
};

function ellipse(g, x, y, rx, ry, color) {
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
}

function triangle(g, p1, p2, p3, color) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(...p1);
  g.lineTo(...p2);
  g.lineTo(...p3);
  g.closePath();
  g.fill();
}

/**
 * 画一只猫。(fx, fy) 为脚底中心。
 * opts: { dir(down/up/left/right), frame(0/1), moving, palette, accessory, scale }
 * 行走时两条腿交替迈步；左右朝向镜像，上下朝向有独立的头部画法（满足"头朝向对应变动"）。
 */
export function drawCat(g, fx, fy, opts = {}) {
  const { dir = 'down', frame = 0, moving = false, palette = CAT_PRESETS.player, scale = 1 } = opts;
  const accessory = opts.accessory ?? palette.accessory;
  const P = palette;
  const t = performance.now() / 1000;
  const wag = Math.sin(t * 2.8 + fx * 0.01); // 尾巴持续摆动
  const bob = moving ? (frame ? -1.5 : 0.5) : 0;
  const step = moving ? (frame ? 1 : -1) : 0; // 迈步相位

  g.save();
  g.translate(fx, fy);
  g.scale(scale, scale);

  // 阴影
  ellipse(g, 0, 1, 20, 6, 'rgba(60,50,30,.18)');

  const side = dir === 'left' || dir === 'right';
  if (dir === 'left') g.scale(-1, 1); // 朝左 = 朝右镜像

  // 尾巴：橘色粗尾 + 深色环纹（对照 user.png）
  const tail = (p0, p1, p2) => {
    g.strokeStyle = P.fur;
    g.lineWidth = 7;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(p0[0], p0[1]);
    g.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]);
    g.stroke();
    g.fillStyle = P.stripe;
    for (const t of [0.45, 0.75]) {
      const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
      const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
      g.beginPath();
      g.arc(x, y, 3.3, 0, Math.PI * 2);
      g.fill();
    }
  };

  if (!side) {
    /* ── 正面 / 背面 ── */
    if (dir === 'down') tail([13, -12], [28, -14], [26 + wag * 4, -34 - wag * 5]);
    else tail([0, -10], [16, -2], [22 + wag * 5, -10 + wag * 3]);

    // 两条白色小腿交替迈步（user.png 四肢为奶白色），正面带粉爪垫
    ellipse(g, -8, -4 + step * 3, 4.5, 6, P.belly);
    ellipse(g, 8, -4 - step * 3, 4.5, 6, P.belly);
    if (dir === 'down' && P.paw) {
      ellipse(g, -8, -1.5 + step * 3, 2.2, 1.6, P.paw);
      ellipse(g, 8, -1.5 - step * 3, 2.2, 1.6, P.paw);
    }

    // 身体
    g.fillStyle = P.fur;
    rr(g, -16, -34 + bob, 32, 28, 14);
    g.fill();
    if (dir === 'down') {
      ellipse(g, 0, -16 + bob, 9.5, 11, P.belly); // 白肚
      if (accessory === 'apron') {
        g.fillStyle = '#fdf3e3';
        rr(g, -11, -26 + bob, 22, 18, 6);
        g.fill();
      }
    } else {
      // 背部条纹
      g.strokeStyle = P.stripe;
      g.lineWidth = 3;
      for (const sy of [-28, -22, -16]) {
        g.beginPath();
        g.arc(0, sy + bob + 14, 13, Math.PI * 1.25, Math.PI * 1.75);
        g.stroke();
      }
    }

    // 头
    const hy = -46 + bob;
    // 耳朵（含内耳）
    triangle(g, [-15, hy - 6], [-11, hy - 19], [-3, hy - 12], P.fur);
    triangle(g, [15, hy - 6], [11, hy - 19], [3, hy - 12], P.fur);
    triangle(g, [-12, hy - 8], [-10, hy - 15], [-5, hy - 11], P.earIn);
    triangle(g, [12, hy - 8], [10, hy - 15], [5, hy - 11], P.earIn);
    ellipse(g, 0, hy, 17, 15.5, P.fur);

    if (dir === 'down') {
      // 白色下半脸 + 两颊（user.png：眼睛以下到下巴大面积奶白）
      ellipse(g, 0, hy + 6, 13.5, 9.5, P.belly);
      ellipse(g, -8, hy + 3.5, 6.5, 6, P.belly);
      ellipse(g, 8, hy + 3.5, 6.5, 6, P.belly);
      // 头顶三道条纹
      g.strokeStyle = P.stripe;
      g.lineWidth = 2.5;
      for (const dx of [-5, 0, 5]) {
        g.beginPath();
        g.moveTo(dx, hy - 15);
        g.lineTo(dx * 1.2, hy - 9);
        g.stroke();
      }
      // 大圆眼睛 + 高光（user.png：圆形黑亮眼，间距宽）
      g.fillStyle = '#2e2420';
      g.beginPath();
      g.arc(-7.5, hy - 2, 3.1, 0, Math.PI * 2);
      g.arc(7.5, hy - 2, 3.1, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(-6.4, hy - 3.2, 1.25, 0, Math.PI * 2);
      g.arc(8.6, hy - 3.2, 1.25, 0, Math.PI * 2);
      g.fill();
      // 粉鼻 + ω 嘴
      triangle(g, [-1.8, hy + 2.6], [1.8, hy + 2.6], [0, hy + 4.8], '#ec9286');
      g.strokeStyle = '#c08a72';
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(-2.2, hy + 5.4, 2.2, Math.PI * 0.05, Math.PI * 0.95);
      g.stroke();
      g.beginPath();
      g.arc(2.2, hy + 5.4, 2.2, Math.PI * 0.05, Math.PI * 0.95);
      g.stroke();
      // 胡须（深色细线，自两颊向外）
      g.strokeStyle = 'rgba(90,70,55,.6)';
      g.lineWidth = 1.1;
      for (const [y1, y2] of [[1, -1], [4, 4], [7, 9]]) {
        g.beginPath();
        g.moveTo(-12, hy + y1);
        g.lineTo(-20, hy + y2 - 1);
        g.moveTo(12, hy + y1);
        g.lineTo(20, hy + y2 - 1);
        g.stroke();
      }
    } else {
      // 后脑勺条纹
      g.strokeStyle = P.stripe;
      g.lineWidth = 2.5;
      for (const dx of [-6, 0, 6]) {
        g.beginPath();
        g.moveTo(dx, hy - 14);
        g.lineTo(dx, hy - 4);
        g.stroke();
      }
    }
  } else {
    /* ── 侧面（朝右；朝左已镜像） ── */
    tail([-14, -14], [-28, -16], [-26 - wag * 3, -34 - wag * 6]);

    // 前后白色小腿交替倒腾迈步，前爪带粉垫
    ellipse(g, -8 + step * 4, -4, 4.5, 6, P.belly);
    ellipse(g, 9 - step * 4, -4, 4.5, 6, P.belly);
    if (P.paw) ellipse(g, 9 - step * 4, -1.5, 2, 1.5, P.paw);

    // 身体（横向）
    g.fillStyle = P.fur;
    rr(g, -18, -32 + bob, 37, 26, 13);
    g.fill();
    ellipse(g, 2, -12 + bob, 11, 6, P.belly);
    // 身侧条纹
    g.strokeStyle = P.stripe;
    g.lineWidth = 3;
    for (const sx of [-8, -1, 6]) {
      g.beginPath();
      g.moveTo(sx, -32 + bob);
      g.lineTo(sx - 2, -24 + bob);
      g.stroke();
    }
    if (accessory === 'apron') {
      g.fillStyle = '#fdf3e3';
      rr(g, 2, -26 + bob, 14, 16, 5);
      g.fill();
    }

    // 头（偏前）
    const hy = -44 + bob;
    const hx = 10;
    triangle(g, [hx - 14, hy - 5], [hx - 10, hy - 18], [hx - 2, hy - 11], P.fur);
    triangle(g, [hx + 3, hy - 11], [hx + 9, hy - 18], [hx + 13, hy - 6], P.fur);
    triangle(g, [hx - 11, hy - 7], [hx - 9, hy - 14], [hx - 4, hy - 10], P.earIn);
    ellipse(g, hx, hy, 16, 14.5, P.fur);
    g.strokeStyle = P.stripe;
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(hx - 2, hy - 14);
    g.lineTo(hx - 3, hy - 8);
    g.stroke();
    // 白色下半脸（吻部 + 脸颊 + 下巴，对照 user.png）
    ellipse(g, hx + 7, hy + 5, 9.5, 7.5, P.belly);
    ellipse(g, hx - 2, hy + 6, 7, 6, P.belly);
    // 大圆眼 + 高光
    g.fillStyle = '#2e2420';
    g.beginPath();
    g.arc(hx + 6, hy - 2, 3.1, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(hx + 7.1, hy - 3.2, 1.25, 0, Math.PI * 2);
    g.fill();
    // 粉鼻 + ω 嘴（侧视半边）
    triangle(g, [hx + 13.5, hy + 2], [hx + 16.2, hy + 3.5], [hx + 13.5, hy + 5], '#ec9286');
    g.strokeStyle = '#c08a72';
    g.lineWidth = 1.3;
    g.beginPath();
    g.arc(hx + 11, hy + 5.2, 2.1, Math.PI * 0.05, Math.PI * 0.95);
    g.stroke();
    // 胡须
    g.strokeStyle = 'rgba(90,70,55,.6)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(hx + 9, hy + 3);
    g.lineTo(hx + 1, hy + 1);
    g.moveTo(hx + 9, hy + 6);
    g.lineTo(hx + 1, hy + 8);
    g.stroke();
  }

  // 项圈（主角专属）：米色编织带 + 粉色小花，对照 user.png
  if (!opts.noCollar && P.collar) {
    const cy = side ? -36 + bob : -33 + bob;
    const cx = side ? 8 : 0;
    g.strokeStyle = P.collar;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(cx, cy - 6, side ? 11 : 13, Math.PI * 0.18, Math.PI * 0.82);
    g.stroke();
    // 编织纹理
    g.strokeStyle = 'rgba(255,255,255,.45)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(cx, cy - 6, side ? 11 : 13, Math.PI * 0.25, Math.PI * 0.75);
    g.stroke();
    if (dir !== 'up' && P.flower) {
      const fy = cy + (side ? 5.5 : 6.5);
      const fx2 = cx + (side ? 3 : 0);
      g.fillStyle = P.flower;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
        g.beginPath();
        g.arc(fx2 + Math.cos(a) * 2.6, fy + Math.sin(a) * 2.6, 2, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#fffdf5';
      g.beginPath();
      g.arc(fx2, fy, 1.7, 0, Math.PI * 2);
      g.fill();
    }
  }

  // 配饰
  const ahy = (side ? -44 : -46) + bob;
  const ahx = side ? 10 : 0;
  if (accessory === 'cap') {
    g.fillStyle = '#5d7052';
    g.beginPath();
    g.arc(ahx, ahy - 8, 13, Math.PI, Math.PI * 2);
    g.fill();
    rr(g, ahx - 14, ahy - 9, side ? 24 : 28, 4.5, 2);
    g.fill();
  }
  if (accessory === 'glasses' && dir !== 'up') {
    g.strokeStyle = '#6d5b43';
    g.lineWidth = 1.6;
    if (side) {
      g.beginPath();
      g.arc(ahx + 6, ahy - 2, 5, 0, Math.PI * 2);
      g.stroke();
    } else {
      g.beginPath();
      g.arc(-7, ahy - 1, 5, 0, Math.PI * 2);
      g.arc(7, ahy - 1, 5, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(-2, ahy - 1);
      g.lineTo(2, ahy - 1);
      g.stroke();
    }
  }
  if (accessory === 'headphones') {
    g.strokeStyle = '#37474f';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(ahx, ahy - 2, 17, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
    g.fillStyle = '#ff7043';
    if (side) {
      ellipse(g, ahx + 13, ahy + 2, 4.5, 6, '#ff7043');
    } else {
      ellipse(g, -15, ahy + 2, 4, 6, '#ff7043');
      ellipse(g, 15, ahy + 2, 4, 6, '#ff7043');
    }
  }

  g.restore();
}

/* ════════════ 室内瓦片与家具（沿用） ════════════ */

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
    g.stroke();
  }
}

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
    g.fillStyle = '#fffbe8';
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
    g.fillStyle = '#8d5a3a';
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
