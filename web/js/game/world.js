// 星火岛世界 v2：户外 = 图片伪3D 大世界（相机滚动、近大远小）；室内 = 瓦片场景。
// 户外底图 island.png(1672×941) 放大 2 倍作为世界，上方为远景（建筑小），下方为近景（建筑大）。
import { TILE, drawIndoorTile, FURNITURE } from './art.js';

/* ════════════ 户外伪3D 世界 ════════════ */

export const WORLD = {
  w: 3344,
  h: 1882,
  imageSrc: '/assets/island.png',
  imgScale: 2, // 世界坐标 = 图片像素 × 2
  spawn: { x: 1650, y: 1250 },
  // 可行走区域：草地带（上方天空海面、最下沿不可走）
  bounds: { minX: 70, maxX: 3274, minY: 800, maxY: 1810 },
  // 底图上的障碍（左侧大树 / 右下灌木 / 岩石）
  obstacles: [
    { x: 240, y: 1060, r: 210 },
    { x: 2860, y: 1430, r: 230 },
    { x: 2450, y: 1560, r: 95 },
  ],
};

export const BUILDINGS = [
  { id: 'news', label: '报亭', img: '/assets/news.png', x: 780, y: 920, size: 0.55 },
  { id: 'study', label: '书屋', img: '/assets/book.png', x: 2150, y: 870, size: 0.55 },
  { id: 'cafe', label: '咖啡馆', img: '/assets/coffee.png', x: 1180, y: 1600, size: 0.58 },
  { id: 'radio', label: '电台', img: '/assets/radio.png', x: 2620, y: 1500, size: 0.58 },
];

/** 纵深缩放：y 越靠下（越近）越大 —— 伪3D 的核心 */
export function depthScale(y) {
  const t = (y - 680) / (WORLD.h - 680);
  return Math.min(1.18, Math.max(0.5, 0.52 + 0.62 * t));
}

/** 建筑渲染宽度（不含靠近加成，碰撞用它保证稳定） */
export function buildingRenderW(b) {
  return 1024 * b.size * depthScale(b.y);
}

/** 建筑占地椭圆（世界坐标，锚点 = 图片底部中心） */
export function buildingFootprint(b) {
  const w = buildingRenderW(b);
  return { cx: b.x, cy: b.y - w * 0.13, rx: w * 0.31, ry: w * 0.13 };
}

/** 门口触发圈（走进即入内） */
export function buildingDoor(b) {
  return { x: b.x, y: b.y + 12, r: Math.max(48, buildingRenderW(b) * 0.13) };
}

export function outdoorBlocked(x, y) {
  const { minX, maxX, minY, maxY } = WORLD.bounds;
  if (x < minX || x > maxX || y < minY || y > maxY) return true;
  for (const o of WORLD.obstacles) {
    if ((x - o.x) ** 2 + (y - o.y) ** 2 < o.r ** 2) return true;
  }
  for (const b of BUILDINGS) {
    const f = buildingFootprint(b);
    if (((x - f.cx) / f.rx) ** 2 + ((y - f.cy) / f.ry) ** 2 < 1) return true;
  }
  return false;
}

const outdoorNpcLines = {
  xiaoyou: [
    '今天天气真好，适合在岛上散步～',
    '你去过书屋了吗？店主阿书人很好的。',
    '听说在书屋读满半小时书，还能拿金币呢！',
    '点一下远处的地面，我看你能不能走过去～',
  ],
  asen: [
    '报亭每天都有新鲜的 AI 新闻，老周进货可勤了。',
    '海边的风好舒服啊～',
    '攒够金币就去咖啡馆喝一杯，岛上的小确幸。',
  ],
};

export const OUTDOOR_NPCS = [
  { id: 'xiaoyou', name: '小柚', preset: 'walker1', x: 1480, y: 1050, wander: true, color: '#4fc3f7', lines: outdoorNpcLines.xiaoyou },
  { id: 'asen', name: '阿森', preset: 'walker2', x: 2050, y: 1380, wander: true, color: '#aed581', lines: outdoorNpcLines.asen },
];

/* ════════════ 室内场景（瓦片） ════════════ */

export const MAPS = {
  news: {
    id: 'news',
    name: '报亭',
    wallColor: '#e8a87c',
    floorColor: '#f5deb0',
    tiles: [
      '##########',
      '#wwwwwwww#',
      '#wwwwwwww#',
      '#wwwwwwww#',
      '#wwwwwwww#',
      '#wwwwwwww#',
      '####ww####',
    ],
    exit: [{ x: 4, y: 6 }, { x: 5, y: 6 }],
    interactables: [
      { x: 2, y: 1, furniture: 'newsrack', kind: 'ui', scene: 'news', label: '翻看今日报纸' },
      { x: 3, y: 1, furniture: 'newsrack', kind: 'ui', scene: 'news', label: '翻看今日报纸' },
      { x: 6, y: 2, furniture: 'counter', kind: 'deco' },
      { x: 7, y: 2, furniture: 'counter', kind: 'deco' },
      { x: 1, y: 4, furniture: 'plant', kind: 'deco' },
      { x: 4, y: 3, furniture: 'rug', kind: 'ground' },
    ],
    npcs: [
      {
        id: 'zhou', name: '老周', preset: 'zhou', x: 7, y: 1, color: '#5c8a64',
        lines: [
          '哟，来啦！今天的《星火岛日报》刚到货，墨香还没散呢。',
          '想知道 AI 圈今天发生了什么？去报刊架翻翻就知道。',
          '读完报纸记得跟我唠唠，老周我最爱听新鲜事了。',
        ],
      },
    ],
  },

  study: {
    id: 'study',
    name: '书屋',
    wallColor: '#a48ac0',
    floorColor: '#ecd9b0',
    tiles: [
      '##############',
      '#wwwwwwwwwwww#',
      '#wwwwwwwwwwww#',
      '#wwwwwwwwwwww#',
      '#wwwwwwwwwwww#',
      '#wwwwwwwwwwww#',
      '#wwwwwwwwwwww#',
      '######ww######',
    ],
    exit: [{ x: 6, y: 7 }, { x: 7, y: 7 }],
    interactables: [
      ...[1, 2, 3, 4].map((x) => ({ x, y: 1, furniture: 'bookshelf', kind: 'ui', scene: 'bookshelf', label: '挑一本书' })),
      ...[9, 10, 11, 12].map((x) => ({ x, y: 1, furniture: 'bookshelf', kind: 'ui', scene: 'bookshelf', label: '挑一本书' })),
      { x: 3, y: 4, furniture: 'desk', kind: 'ui', scene: 'desk', label: '在自习桌坐下' },
      { x: 6, y: 4, furniture: 'desk', kind: 'ui', scene: 'desk', label: '在自习桌坐下' },
      { x: 9, y: 4, furniture: 'desk', kind: 'ui', scene: 'desk', label: '在自习桌坐下' },
      { x: 12, y: 5, furniture: 'plant', kind: 'deco' },
      { x: 1, y: 5, furniture: 'plant', kind: 'deco' },
    ],
    npcs: [
      {
        id: 'ashu', name: '阿书', preset: 'shu', x: 7, y: 2, color: '#7986cb',
        lines: [
          '欢迎来书屋～先去书架挑一本喜欢的书吧。',
          '选好书就找张自习桌坐下，安安静静读上一会儿。',
          '在桌前累计读满 30 分钟，我会送你 10 金币哦。',
          '记笔记是最好的思考方式，写下来的才是自己的。',
        ],
      },
    ],
  },

  radio: {
    id: 'radio',
    name: '电台',
    wallColor: '#7e6a9e',
    floorColor: '#d8cce8',
    tiles: [
      '##########',
      '#wwwwwwww#',
      '#wwwwwwww#',
      '#wwwwwwww#',
      '#wwwwwwww#',
      '#wwwwwwww#',
      '####ww####',
    ],
    exit: [{ x: 4, y: 6 }, { x: 5, y: 6 }],
    interactables: [
      ...[3, 4, 5, 6].map((x) => ({ x, y: 1, furniture: 'console', kind: 'ui', scene: 'radio', label: '打开点播台' })),
      { x: 1, y: 1, furniture: 'plant', kind: 'deco' },
      { x: 8, y: 1, furniture: 'plant', kind: 'deco' },
      { x: 4, y: 3, furniture: 'rug', kind: 'ground', color: '#b39ddb' },
    ],
    npcs: [
      {
        id: 'dj', name: 'DJ 阿波', preset: 'dj', x: 7, y: 2, color: '#9575cd',
        lines: [
          'Yo！欢迎来到星火电台，今天的节目超棒。',
          '走到控制台前按 E（或直接点它），就能点播节目啦。',
          '听满 30 秒就算完成今日任务，戴上耳机慢慢享受～',
        ],
      },
    ],
  },

  cafe: {
    id: 'cafe',
    name: '咖啡馆',
    wallColor: '#c08a5a',
    floorColor: '#f0dcc0',
    tiles: [
      '############',
      '#wwwwwwwwww#',
      '#wwwwwwwwww#',
      '#wwwwwwwwww#',
      '#wwwwwwwwww#',
      '#wwwwwwwwww#',
      '#wwwwwwwwww#',
      '#####ww#####',
    ],
    exit: [{ x: 5, y: 7 }, { x: 6, y: 7 }],
    interactables: [
      ...[2, 3, 4, 5, 6, 7].map((x) => ({ x, y: 2, furniture: 'counter', color: '#9c6b3f', kind: 'ui', scene: 'cafe', label: '看看菜单' })),
      { x: 3, y: 5, furniture: 'cafetable', kind: 'deco' },
      { x: 8, y: 4, furniture: 'cafetable', kind: 'deco' },
      { x: 1, y: 1, furniture: 'plant', kind: 'deco' },
      { x: 10, y: 1, furniture: 'plant', kind: 'deco' },
    ],
    npcs: [
      {
        id: 'mocha', name: '店长摩卡', preset: 'mocha', x: 4, y: 1, color: '#8d6e63',
        lines: [
          '欢迎光临星火咖啡馆～想来点什么？到吧台前看看菜单吧。',
          '完成每日任务能赚金币，攒够 35 金币来杯店长特调？',
          '以后岛上的朋友们都会来这儿聚会，先占个老座位呀。',
        ],
      },
    ],
  },
};

// 室内出口 → 回到岛上（建筑门口下方）
for (const b of BUILDINGS) {
  const m = MAPS[b.id];
  m.walkable = (ch) => ch === 'w';
  m.portals = m.exit.map((e) => ({ x: e.x, y: e.y, to: 'island' }));
  m.entrySpawn = { x: m.exit[0].x, y: m.exit[0].y - 1 };
}

export function mapSize(map) {
  return { w: map.tiles[0].length, h: map.tiles.length };
}

export function tileAt(map, tx, ty) {
  const { w, h } = mapSize(map);
  if (tx < 0 || ty < 0 || tx >= w || ty >= h) return '#';
  return map.tiles[ty][tx];
}

export function indoorBlocked(map, tx, ty) {
  if (!map.walkable(tileAt(map, tx, ty))) return true;
  return map.interactables?.some((f) => f.kind !== 'ground' && f.x === tx && f.y === ty) ?? false;
}

export function portalAt(map, tx, ty) {
  return map.portals?.find((p) => p.x === tx && p.y === ty) ?? null;
}

/** 预渲染室内背景（含家具） */
export function renderIndoorBackground(map) {
  const { w, h } = mapSize(map);
  const c = document.createElement('canvas');
  c.width = w * TILE;
  c.height = h * TILE;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      drawIndoorTile(g, map.tiles[y][x], x, y, map.wallColor, map.floorColor);
    }
  }
  for (const f of map.interactables) {
    if (f.kind === 'ground') FURNITURE[f.furniture](g, f.x * TILE, f.y * TILE, f.color);
  }
  for (const f of map.interactables) {
    if (f.kind !== 'ground') FURNITURE[f.furniture](g, f.x * TILE, f.y * TILE, f.color);
  }
  for (const e of map.exit) {
    g.fillStyle = 'rgba(0,0,0,.12)';
    g.beginPath();
    g.ellipse(e.x * TILE + TILE / 2, e.y * TILE + 10, 18, 7, 0, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}
