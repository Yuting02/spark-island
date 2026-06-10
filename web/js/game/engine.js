// 游戏引擎：键盘移动与碰撞、地图切换（踩门自动进出）、NPC 游走与对话朝向、交互热点检测。
import { TILE, drawCharacter, CHARACTER_PRESETS, rr } from './art.js';
import { MAPS, mapSize, isBlocked, portalAt, renderBackground } from './world.js';

const SPEED = 3.2 * TILE; // 像素/秒
const NPC_SPEED = 1.4 * TILE;

export function createGame(canvas, { onAction }) {
  const islandSize = mapSize(MAPS.island);
  canvas.width = islandSize.w * TILE;
  canvas.height = islandSize.h * TILE;
  const ctx = canvas.getContext('2d');

  let map = MAPS.island;
  let offset = { x: 0, y: 0 };
  const bgCache = new Map(); // `${mapId}:${frame}` -> canvas

  // 坐标系：角色位置 = 脚底中心点（地图本地像素）
  const player = { x: 0, y: 0, dir: 'down', moving: false, animTime: 0 };
  let npcs = [];
  let paused = false;
  let portalArmed = false;
  let fadeUntil = 0; // 切图淡入截止时间戳（rAF 时钟）
  let hotspot = null;
  const keys = new Set();

  function bg(frame) {
    const key = `${map.id}:${frame}`;
    if (!bgCache.has(key)) bgCache.set(key, renderBackground(map, frame));
    return bgCache.get(key);
  }

  function setMap(id, spawnTile) {
    map = MAPS[id];
    const { w, h } = mapSize(map);
    offset = { x: Math.floor((canvas.width - w * TILE) / 2), y: Math.floor((canvas.height - h * TILE) / 2) };
    player.x = spawnTile.x * TILE + TILE / 2;
    player.y = spawnTile.y * TILE + TILE - 8;
    npcs = (map.npcs ?? []).map((def) => ({
      def,
      x: def.x * TILE + TILE / 2,
      y: def.y * TILE + TILE - 8,
      dir: 'down',
      moving: false,
      animTime: 0,
      timer: 1 + Math.random() * 2,
      target: null,
    }));
    portalArmed = false;
    fadeUntil = last + 320;
  }

  const tileOf = (px, py) => ({ tx: Math.floor(px / TILE), ty: Math.floor(py / TILE) });

  function occupiedByNpc(tx, ty) {
    return npcs.some((n) => {
      const t = tileOf(n.x, n.y);
      return t.tx === tx && t.ty === ty;
    });
  }

  /** 碰撞：脚部采样点（宽 18px、高 10px） */
  function collides(px, py, isPlayer = true) {
    const pts = [
      [px - 9, py], [px + 9, py],
      [px - 9, py - 10], [px + 9, py - 10],
    ];
    return pts.some(([cx, cy]) => {
      const { tx, ty } = tileOf(cx, cy);
      if (isBlocked(map, tx, ty)) return true;
      if (isPlayer && occupiedByNpc(tx, ty)) return true;
      if (!isPlayer) {
        const pt = tileOf(player.x, player.y);
        if (pt.tx === tx && pt.ty === ty) return true;
      }
      return false;
    });
  }

  const DIRS = {
    arrowup: [0, -1, 'up'], w: [0, -1, 'up'],
    arrowdown: [0, 1, 'down'], s: [0, 1, 'down'],
    arrowleft: [-1, 0, 'left'], a: [-1, 0, 'left'],
    arrowright: [1, 0, 'right'], d: [1, 0, 'right'],
  };

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (paused) return;
    if (DIRS[k]) {
      keys.add(k);
      e.preventDefault();
    } else if (k === 'e' && hotspot) {
      if (hotspot.type === 'npc') {
        // NPC 转身面向玩家
        const n = npcs.find((x) => x.def.id === hotspot.npc.id);
        if (n) {
          const dx = player.x - n.x;
          const dy = player.y - n.y;
          n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
          n.moving = false;
          n.target = null;
        }
      }
      onAction(hotspot);
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  function updatePlayer(dt) {
    let vx = 0;
    let vy = 0;
    for (const k of keys) {
      const d = DIRS[k];
      if (d) {
        vx += d[0];
        vy += d[1];
        player.dir = d[2];
      }
    }
    player.moving = vx !== 0 || vy !== 0;
    if (player.moving) {
      const len = Math.hypot(vx, vy);
      const nx = player.x + (vx / len) * SPEED * dt;
      const ny = player.y + (vy / len) * SPEED * dt;
      if (!collides(nx, player.y)) player.x = nx;
      if (!collides(player.x, ny)) player.y = ny;
      player.animTime += dt;
    }

    // 传送门：踩上即切换（离开门后才重新武装，避免来回闪切）
    const { tx, ty } = tileOf(player.x, player.y);
    const portal = portalAt(map, tx, ty);
    if (!portal) portalArmed = true;
    else if (portalArmed) {
      const to = MAPS[portal.to];
      setMap(portal.to, portal.spawn ?? to.entrySpawn);
      keys.clear();
    }
  }

  function updateNpcs(dt) {
    for (const n of npcs) {
      if (n.target) {
        const dx = n.target.x - n.x;
        const dy = n.target.y - n.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 2) {
          n.x = n.target.x;
          n.y = n.target.y;
          n.target = null;
          n.moving = false;
        } else {
          n.x += (dx / dist) * NPC_SPEED * dt;
          n.y += (dy / dist) * NPC_SPEED * dt;
          n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
          n.moving = true;
          n.animTime += dt;
        }
        continue;
      }
      n.timer -= dt;
      if (n.timer > 0) continue;
      n.timer = 1.5 + Math.random() * 2.5;
      if (!n.def.wander || Math.random() < 0.4) {
        n.dir = ['down', 'left', 'right', 'up'][Math.floor(Math.random() * 4)];
        continue;
      }
      const { tx, ty } = tileOf(n.x, n.y);
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]].sort(() => Math.random() - 0.5);
      for (const [dx, dy] of dirs) {
        const nt = { tx: tx + dx, ty: ty + dy };
        const px = nt.tx * TILE + TILE / 2;
        const py = nt.ty * TILE + TILE - 8;
        if (!isBlocked(map, nt.tx, nt.ty) && !portalAt(map, nt.tx, nt.ty) && !collides(px, py, false)) {
          n.target = { x: px, y: py };
          break;
        }
      }
    }
  }

  function findHotspot() {
    const { tx, ty } = tileOf(player.x, player.y);
    let best = null;
    let bestD = 99;
    for (const f of map.interactables ?? []) {
      if (f.kind !== 'ui') continue;
      const d = Math.abs(tx - f.x) + Math.abs(ty - f.y);
      if (d <= 1 && d < bestD) {
        best = { type: 'ui', scene: f.scene, label: f.label };
        bestD = d;
      }
    }
    for (const n of npcs) {
      const t = tileOf(n.x, n.y);
      const d = Math.abs(tx - t.tx) + Math.abs(ty - t.ty);
      if (d <= 2 && d < bestD) {
        best = { type: 'npc', npc: n.def, label: `和${n.def.name}聊聊` };
        bestD = d;
      }
    }
    return best;
  }

  let waveTimer = 0;
  let waveFrame = 0;

  function render() {
    // 背景幕布
    ctx.fillStyle = map.outdoor ? '#5fc7e8' : '#3a3046';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bg(map.outdoor ? waveFrame : 0), offset.x, offset.y);

    // 角色按 y 排序（近下远上）
    ctx.save();
    ctx.translate(offset.x, offset.y);
    const entities = [
      ...npcs.map((n) => ({ y: n.y, draw: () => drawCharacter(ctx, n.x, n.y, { dir: n.dir, frame: Math.floor(n.animTime / 0.2) % 2, moving: n.moving, palette: CHARACTER_PRESETS[n.def.preset] }) })),
      { y: player.y, draw: () => drawCharacter(ctx, player.x, player.y, { dir: player.dir, frame: Math.floor(player.animTime / 0.16) % 2, moving: player.moving, palette: CHARACTER_PRESETS.player }) },
    ].sort((a, b) => a.y - b.y);
    entities.forEach((e) => e.draw());

    // 交互气泡（动森式白色圆角胶囊）
    if (hotspot && !paused) {
      const text = `Ⓔ ${hotspot.label}`;
      ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
      const w = ctx.measureText(text).width + 22;
      const bx = player.x - w / 2;
      const by = player.y - 86;
      ctx.fillStyle = 'rgba(255,251,232,.95)';
      rr(ctx, bx, by, w, 28, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.1)';
      ctx.lineWidth = 2;
      rr(ctx, bx, by, w, 28, 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(player.x - 6, by + 28);
      ctx.lineTo(player.x + 6, by + 28);
      ctx.lineTo(player.x, by + 36);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,251,232,.95)';
      ctx.fill();
      ctx.fillStyle = '#7a6a4f';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + 11, by + 15);
    }
    ctx.restore();

    // 地图名角标 + 切图淡入
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    const nw = ctx.measureText(map.name).width + 24;
    ctx.fillStyle = 'rgba(255,251,232,.9)';
    rr(ctx, 12, canvas.height - 40, nw, 28, 14);
    ctx.fill();
    ctx.fillStyle = '#7a6a4f';
    ctx.textBaseline = 'middle';
    ctx.fillText(map.name, 24, canvas.height - 26);

    const fade = Math.max(0, ((fadeUntil - last) / 320) * 0.9);
    if (fade > 0) {
      ctx.fillStyle = `rgba(20,16,28,${fade.toFixed(3)})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    waveTimer += dt;
    if (waveTimer > 0.55) {
      waveTimer = 0;
      waveFrame = 1 - waveFrame;
    }
    if (!paused) {
      updatePlayer(dt);
      updateNpcs(dt);
      hotspot = findHotspot();
    }
    render();
    requestAnimationFrame(loop);
  }

  // 默认出生在岛上；?map=study 可直接出生在某室内（调试/演示用）
  const debugMap = new URLSearchParams(location.search).get('map');
  if (debugMap && MAPS[debugMap] && debugMap !== 'island') {
    setMap(debugMap, MAPS[debugMap].entrySpawn);
  } else {
    setMap('island', { x: 9, y: 8 });
  }
  requestAnimationFrame(loop);

  return {
    pause() {
      paused = true;
      keys.clear();
      player.moving = false;
    },
    resume() {
      paused = false;
      last = performance.now();
    },
  };
}
