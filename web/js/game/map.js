// 小镇地图：地形（字符画）+ 建筑（对象）+ 碰撞查询 + 背景预渲染。
import { TILE, drawTerrainTile, drawBuilding } from './sprites.js';

// 地形：. 草地  r 道路  T 树  W 水  F 花
const TERRAIN = [
  'TTTTTTTTTTTTTTTTTTTT',
  'T..................T',
  'T..................T',
  'T..................T',
  'T..................T',
  'T....r.......r.....T',
  'T..rrrrrrrrrrrrr...T',
  'T.F......r......F..T',
  'T.WW.....r.........T',
  'T.WW.....r.........T',
  'T........r.........T',
  'T....rrrrrrrrrr....T',
  'T..F............F..T',
  'TTTTTTTTTTTTTTTTTTTT',
];

export const MAP_W = TERRAIN[0].length;
export const MAP_H = TERRAIN.length;

export const BUILDINGS = [
  { id: 'news', label: '报亭', x: 3, y: 2, w: 4, h: 3, door: { x: 5, y: 4 } },
  { id: 'study', label: '自习室', x: 11, y: 2, w: 6, h: 3, door: { x: 13, y: 4 } },
  { id: 'radio', label: '电台', x: 13, y: 8, w: 4, h: 3, door: { x: 14, y: 10 } },
];

export const SPAWN = { x: 9, y: 7 };

export function terrainAt(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 'T';
  return TERRAIN[ty][tx];
}

export function blocked(tx, ty) {
  const t = terrainAt(tx, ty);
  if (t === 'T' || t === 'W') return true;
  return BUILDINGS.some((b) => tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h);
}

/** 玩家脚下瓦片靠近哪栋建筑的门（曼哈顿距离 ≤1），没有则返回 null */
export function nearDoor(tx, ty) {
  return BUILDINGS.find((b) => Math.abs(tx - b.door.x) + Math.abs(ty - b.door.y) <= 1) ?? null;
}

/** 预渲染整张背景（地形 + 建筑）到离屏 canvas；水面两帧波纹 */
export function renderBackground(waveFrame) {
  const c = document.createElement('canvas');
  c.width = MAP_W * TILE;
  c.height = MAP_H * TILE;
  const g = c.getContext('2d');
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      drawTerrainTile(g, TERRAIN[y][x], x, y, waveFrame);
    }
  }
  BUILDINGS.forEach((b) => drawBuilding(g, b));
  return c;
}
