// 星火岛世界：户外海岛 + 报亭/书屋/电台/咖啡馆四个室内场景。
// 地形字符：~ 海  s 沙滩  . 草地  r 小路  T 树  F 花 | 室内：# 墙  w 地板
import { TILE, drawTerrainTile, drawTree, drawBuildingExterior, drawIndoorTile, FURNITURE } from './art.js';

export const BUILDINGS = [
  { id: 'news', label: '报亭', x: 2, y: 2, w: 4, h: 3, door: { x: 4, y: 4 } },
  { id: 'study', label: '书屋', x: 11, y: 2, w: 6, h: 3, door: { x: 13, y: 4 } },
  { id: 'cafe', label: '咖啡馆', x: 2, y: 7, w: 4, h: 3, door: { x: 4, y: 9 } },
  { id: 'radio', label: '电台', x: 12, y: 7, w: 5, h: 3, door: { x: 14, y: 9 } },
];

const ISLAND_TILES = [
  '~~~~~~~~~~~~~~~~~~~~',
  '~~ssssssssssssssss~~',
  '~s......T.........s~',
  '~s................s~',
  '~s................s~',
  '~s..r........r..T.s~',
  '~s..rrrrrrrrrrr...s~',
  '~s..F....r....F...s~',
  '~s.......r........s~',
  '~s.......r........s~',
  '~s..rrrrrrrrrrr...s~',
  '~s.T...........T..s~',
  '~~ssssssssssssssss~~',
];

const islandNpcLines = {
  xiaoyou: [
    '今天天气真好，适合在岛上散步～',
    '你去过书屋了吗？店主阿书人很好的。',
    '听说在书屋读满半小时书，还能拿金币呢！',
  ],
  asen: [
    '报亭每天都有新鲜的 AI 新闻，老周进货可勤了。',
    '海边的风好舒服啊～',
    '攒够金币就去咖啡馆喝一杯，岛上的小确幸。',
  ],
};

export const MAPS = {
  island: {
    id: 'island',
    name: '星火岛',
    outdoor: true,
    tiles: ISLAND_TILES,
    walkable: (ch) => ch === '.' || ch === 'r' || ch === 'F' || ch === 's',
    portals: BUILDINGS.map((b) => ({
      x: b.door.x,
      y: b.door.y,
      to: b.id,
      label: `进入${b.label}`,
    })),
    interactables: [],
    npcs: [
      { id: 'xiaoyou', name: '小柚', preset: 'walker1', x: 7, y: 8, wander: true, color: '#4fc3f7', lines: islandNpcLines.xiaoyou },
      { id: 'asen', name: '阿森', preset: 'walker2', x: 10, y: 8, wander: true, color: '#aed581', lines: islandNpcLines.asen },
    ],
  },

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
          '走到控制台前按 E，就能点播节目啦。',
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

// 室内出口 → 回到岛上建筑门口下方
for (const b of BUILDINGS) {
  const m = MAPS[b.id];
  m.outdoor = false;
  m.walkable = (ch) => ch === 'w';
  m.portals = m.exit.map((e) => ({ x: e.x, y: e.y, to: 'island', spawn: { x: b.door.x, y: b.door.y + 1 }, label: '回到岛上' }));
  m.entrySpawn = { x: m.exit[0].x, y: m.exit[0].y - 1 }; // 从岛上进来时站在出口上方
}

export function mapSize(map) {
  return { w: map.tiles[0].length, h: map.tiles.length };
}

export function tileAt(map, tx, ty) {
  const { w, h } = mapSize(map);
  if (tx < 0 || ty < 0 || tx >= w || ty >= h) return map.outdoor ? '~' : '#';
  return map.tiles[ty][tx];
}

export function isBlocked(map, tx, ty) {
  const ch = tileAt(map, tx, ty);
  if (!map.walkable(ch)) return true;
  if (map.outdoor) {
    // 建筑占地（门所在瓦片放行，踩上即入内）
    for (const b of BUILDINGS) {
      if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) {
        return !(tx === b.door.x && ty === b.door.y);
      }
    }
  }
  return map.interactables?.some((f) => f.kind !== 'ground' && f.x === tx && f.y === ty) ?? false;
}

export function portalAt(map, tx, ty) {
  return map.portals?.find((p) => p.x === tx && p.y === ty) ?? null;
}

/** 预渲染地图背景（含家具），frame 用于海浪两帧动画 */
export function renderBackground(map, frame) {
  const { w, h } = mapSize(map);
  const c = document.createElement('canvas');
  c.width = w * TILE;
  c.height = h * TILE;
  const g = c.getContext('2d');

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = map.tiles[y][x];
      if (map.outdoor) {
        drawTerrainTile(g, ch === 'T' ? '.' : ch, x, y, frame);
      } else {
        drawIndoorTile(g, ch, x, y, map.wallColor, map.floorColor);
      }
    }
  }

  if (map.outdoor) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (map.tiles[y][x] === 'T') drawTree(g, x, y);
      }
    }
    BUILDINGS.forEach((b) => drawBuildingExterior(g, b));
  } else {
    // 地毯先铺，家具后放
    for (const f of map.interactables) {
      if (f.kind === 'ground') FURNITURE[f.furniture](g, f.x * TILE, f.y * TILE, f.color);
    }
    for (const f of map.interactables) {
      if (f.kind !== 'ground') FURNITURE[f.furniture](g, f.x * TILE, f.y * TILE, f.color);
    }
    // 出口门垫
    for (const e of map.exit) {
      g.fillStyle = 'rgba(0,0,0,.12)';
      g.beginPath();
      g.ellipse(e.x * TILE + TILE / 2, e.y * TILE + 10, 18, 7, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}
