// 星火岛世界 v3：户外 = 猫咪后院风扁平 2D 大世界（相机滚动、固定尺寸、无纵深）；室内 = 瓦片场景。
// 户外底图 island.png(1672×941) 放大 2.4 倍作为世界；建筑用 cut/ 下的透明立绘，固定大小。
import { TILE, drawIndoorTile, FURNITURE } from './art.js';

/* ════════════ 户外 2D 世界 ════════════ */

export const WORLD = {
  w: 4013, // 1672 × 2.4
  h: 2258, // 941 × 2.4
  imageSrc: '/assets/island.png',
  spawn: { x: 2010, y: 1560 },
  // 可行走区域：沙地草地带（上方海面天空、最下沿不可走）
  bounds: { minX: 90, maxX: 3923, minY: 1030, maxY: 2150 },
  // 底图上的障碍（木牌 / 岩石 / 灌木花丛，按新图目测标定）
  obstacles: [
    { x: 250, y: 1000, r: 120 }, // 左上木牌
    { x: 360, y: 1180, r: 90 }, // 左侧岩石草丛
    { x: 3480, y: 1060, r: 140 }, // 右侧岩石花丛
    { x: 100, y: 1960, r: 150 }, // 左下岩石
    { x: 3760, y: 2120, r: 200 }, // 右下灌木
    { x: 2230, y: 2010, r: 55 }, // 中下小石
  ],
};

// renderW = 固定渲染宽度（高度按图片宽高比自动），锚点 = 图片底部中心
export const BUILDINGS = [
  { id: 'news', label: '报亭', img: '/assets/cut/news.png', x: 1280, y: 1330, renderW: 560 },
  { id: 'study', label: '书屋', img: '/assets/cut/book.png', x: 2790, y: 1300, renderW: 540 },
  { id: 'cafe', label: '咖啡馆', img: '/assets/cut/coffee.png', x: 1330, y: 2060, renderW: 590 },
  { id: 'radio', label: '电台', img: '/assets/cut/radio.png', x: 2720, y: 2080, renderW: 380 },
];

/** 建筑占地椭圆（世界坐标，锚点 = 图片底部中心） */
export function buildingFootprint(b) {
  return { cx: b.x, cy: b.y - b.renderW * 0.1, rx: b.renderW * 0.4, ry: b.renderW * 0.12 };
}

/** 门口交互圈（走近出现"进入"提示，按 E 或点击进入） */
export function buildingDoor(b) {
  return { x: b.x, y: b.y + 6, r: 85 };
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
  { id: 'xiaoyou', name: '小柚', preset: 'walker1', x: 1720, y: 1350, wander: true, color: '#4fc3f7', lines: outdoorNpcLines.xiaoyou },
  { id: 'asen', name: '阿森', preset: 'walker2', x: 2560, y: 1820, wander: true, color: '#aed581', lines: outdoorNpcLines.asen },
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
