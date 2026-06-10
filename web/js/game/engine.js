// 游戏引擎 v2：户外伪3D 图片大世界（相机跟随、近大远小、深度遮挡）+ 室内瓦片场景。
// 输入：键盘（WASD/方向键 + E）与鼠标（点地面行走 / 点建筑进门 / 点 NPC 对话 / 点家具交互）并存。
import { TILE, drawCharacter, CHARACTER_PRESETS, rr } from './art.js';
import {
  WORLD, BUILDINGS, OUTDOOR_NPCS, MAPS,
  depthScale, buildingRenderW, buildingDoor, outdoorBlocked,
  mapSize, indoorBlocked, portalAt, renderIndoorBackground,
} from './world.js';

export const VIEW_W = 1920;
export const VIEW_H = 1080;
const INDOOR_SCALE = 2;
const PLAYER_SPEED = 320; // 户外基准 px/s（乘纵深系数）
const INDOOR_SPEED = 165; // 室内（地图坐标系）
const CHAR_SCALE = 1.25; // 户外角色基准体型

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败：${src}`));
    img.src = src;
  });
}

export async function createGame(canvas, { onAction }) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d');

  const [islandImg, ...bImgs] = await Promise.all([loadImage(WORLD.imageSrc), ...BUILDINGS.map((b) => loadImage(b.img))]);
  const buildingImg = Object.fromEntries(BUILDINGS.map((b, i) => [b.id, bImgs[i]]));

  /* ── 状态 ── */
  let mode = 'outdoor'; // 'outdoor' | 'indoor'
  let map = null; // 当前室内地图
  const indoorBg = new Map();
  let indoorOffset = { x: 0, y: 0 };
  const player = { x: WORLD.spawn.x, y: WORLD.spawn.y, dir: 'down', moving: false, animTime: 0 };
  const cam = { x: 0, y: 0 };
  let npcs = [];
  let paused = false;
  let doorArmed = false;
  let fadeUntil = 0;
  let hotspot = null;
  let moveTarget = null; // {x, y, action?: {type:'npc',id} | {type:'ui',f}}
  let stuckTimer = 0;
  const keys = new Set();
  let last = performance.now();

  function makeNpcs(defs, toWorld) {
    return defs.map((def) => ({
      def,
      x: toWorld ? def.x : def.x * TILE + TILE / 2,
      y: toWorld ? def.y : def.y * TILE + TILE - 8,
      dir: 'down',
      moving: false,
      animTime: 0,
      timer: 1 + Math.random() * 2,
      target: null,
    }));
  }

  function setOutdoor(spawn) {
    mode = 'outdoor';
    map = null;
    player.x = spawn.x;
    player.y = spawn.y;
    npcs = makeNpcs(OUTDOOR_NPCS, true);
    moveTarget = null;
    doorArmed = false;
    fadeUntil = last + 350;
  }

  function setIndoor(id) {
    mode = 'indoor';
    map = MAPS[id];
    const { w, h } = mapSize(map);
    indoorOffset = {
      x: Math.floor((VIEW_W - w * TILE * INDOOR_SCALE) / 2),
      y: Math.floor((VIEW_H - h * TILE * INDOOR_SCALE) / 2),
    };
    player.x = map.entrySpawn.x * TILE + TILE / 2;
    player.y = map.entrySpawn.y * TILE + TILE - 8;
    npcs = makeNpcs(map.npcs ?? [], false);
    moveTarget = null;
    doorArmed = false;
    fadeUntil = last + 350;
  }

  /* ── 碰撞 ── */
  function npcBlockRadius() {
    return mode === 'outdoor' ? 30 * depthScale(player.y) : 20;
  }

  function blocked(x, y) {
    if (mode === 'outdoor') {
      if (outdoorBlocked(x, y)) return true;
    } else {
      if (indoorBlocked(map, Math.floor(x / TILE), Math.floor(y / TILE))) return true;
    }
    const r = npcBlockRadius();
    return npcs.some((n) => (x - n.x) ** 2 + (y - n.y) ** 2 < r * r);
  }

  /* ── 键盘 ── */
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
      moveTarget = null; // 键盘接管，取消点击寻路
      e.preventDefault();
    } else if (k === 'e' && hotspot) {
      triggerHotspot(hotspot);
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  function faceNpcToPlayer(npcId) {
    const n = npcs.find((x) => x.def.id === npcId);
    if (!n) return;
    const dx = player.x - n.x;
    const dy = player.y - n.y;
    n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    n.moving = false;
    n.target = null;
  }

  function triggerHotspot(h) {
    if (h.type === 'npc') faceNpcToPlayer(h.npc.id);
    onAction(h);
  }

  /* ── 鼠标点击 ── */
  canvas.addEventListener('click', (e) => {
    if (paused) return;
    const rect = canvas.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) * VIEW_W) / rect.width;
    const vy = ((e.clientY - rect.top) * VIEW_H) / rect.height;
    keys.clear();
    if (mode === 'outdoor') return clickOutdoor(vx + cam.x, vy + cam.y);
    clickIndoor((vx - indoorOffset.x) / INDOOR_SCALE, (vy - indoorOffset.y) / INDOOR_SCALE);
  });

  function clickOutdoor(wx, wy) {
    // 1) 点中 NPC → 走近并对话
    for (const n of npcs) {
      const s = depthScale(n.y) * CHAR_SCALE;
      if (Math.abs(wx - n.x) < 36 * s && wy > n.y - 105 * s && wy < n.y + 12 * s) {
        moveTarget = { x: n.x, y: n.y + 55 * s, action: { type: 'npc', id: n.def.id } };
        return;
      }
    }
    // 2) 点中建筑 → 走到门口（门口圈会自动进门）
    for (const b of BUILDINGS) {
      const w = buildingRenderW(b);
      if (Math.abs(wx - b.x) < w * 0.42 && wy > b.y - w * 0.95 && wy < b.y + 18) {
        const d = buildingDoor(b);
        moveTarget = { x: d.x, y: d.y + 26 };
        return;
      }
    }
    // 3) 点地面 → 走过去
    moveTarget = {
      x: Math.min(Math.max(wx, WORLD.bounds.minX), WORLD.bounds.maxX),
      y: Math.min(Math.max(wy, WORLD.bounds.minY), WORLD.bounds.maxY),
    };
  }

  function clickIndoor(mx, my) {
    const tx = Math.floor(mx / TILE);
    const ty = Math.floor(my / TILE);
    // 1) NPC
    for (const n of npcs) {
      if (Math.abs(mx - n.x) < 26 && my > n.y - 80 && my < n.y + 10) {
        moveTarget = { x: n.x, y: Math.min(n.y + TILE, (mapSize(map).h - 1) * TILE), action: { type: 'npc', id: n.def.id } };
        return;
      }
    }
    // 2) 可交互家具 → 走到其相邻可走格
    const f = map.interactables.find((i) => i.kind === 'ui' && i.x === tx && i.y === ty);
    if (f) {
      const candidates = [[0, 1], [0, -1], [-1, 0], [1, 0]]
        .map(([dx, dy]) => ({ tx: f.x + dx, ty: f.y + dy }))
        .filter((t) => !indoorBlocked(map, t.tx, t.ty));
      if (candidates.length) {
        const c = candidates[0];
        moveTarget = { x: c.tx * TILE + TILE / 2, y: c.ty * TILE + TILE - 10, action: { type: 'ui', f } };
      }
      return;
    }
    // 3) 地板（含出口门垫）
    if (!indoorBlocked(map, tx, ty)) {
      moveTarget = { x: mx, y: my };
    }
  }

  /** 寻路中的目标动作是否已进入触发范围 */
  function actionInRange(action) {
    if (action.type === 'npc') {
      const n = npcs.find((x) => x.def.id === action.id);
      if (!n) return false;
      const range = mode === 'outdoor' ? 120 * depthScale(n.y) : TILE * 2.2;
      return (player.x - n.x) ** 2 + (player.y - n.y) ** 2 < range * range;
    }
    const ftx = Math.floor(player.x / TILE);
    const fty = Math.floor(player.y / TILE);
    return Math.abs(ftx - action.f.x) + Math.abs(fty - action.f.y) <= 1;
  }

  function executeAction(action) {
    if (action.type === 'npc') {
      const n = npcs.find((x) => x.def.id === action.id);
      if (n) triggerHotspot({ type: 'npc', npc: n.def, label: `和${n.def.name}聊聊` });
    } else {
      onAction({ type: 'ui', scene: action.f.scene, label: action.f.label });
    }
  }

  /* ── 更新 ── */
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

    if (!vx && !vy && moveTarget) {
      // 动作型目标提前触发（走进范围就停）
      if (moveTarget.action && actionInRange(moveTarget.action)) {
        const a = moveTarget.action;
        moveTarget = null;
        executeAction(a);
      } else {
        const dx = moveTarget.x - player.x;
        const dy = moveTarget.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 6) {
          const a = moveTarget.action;
          moveTarget = null;
          if (a && actionInRange(a)) executeAction(a);
        } else {
          vx = dx / dist;
          vy = dy / dist;
          player.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
        }
      }
    }

    player.moving = vx !== 0 || vy !== 0;
    if (player.moving) {
      const len = Math.hypot(vx, vy) || 1;
      const speed = mode === 'outdoor' ? PLAYER_SPEED * depthScale(player.y) : INDOOR_SPEED;
      const before = { x: player.x, y: player.y };
      const nx = player.x + (vx / len) * speed * dt;
      const ny = player.y + (vy / len) * speed * dt;
      if (!blocked(nx, player.y)) player.x = nx;
      if (!blocked(player.x, ny)) player.y = ny;
      player.animTime += dt;

      // 卡住检测：寻路 0.45 秒推进不足 2px 就放弃
      if (moveTarget) {
        if (Math.hypot(player.x - before.x, player.y - before.y) < speed * dt * 0.25) {
          stuckTimer += dt;
          if (stuckTimer > 0.45) {
            moveTarget = null;
            stuckTimer = 0;
          }
        } else {
          stuckTimer = 0;
        }
      }
    }

    // 进出门
    if (mode === 'outdoor') {
      const inDoor = BUILDINGS.find((b) => {
        const d = buildingDoor(b);
        return (player.x - d.x) ** 2 + (player.y - d.y) ** 2 < d.r * d.r;
      });
      if (!inDoor) doorArmed = true;
      else if (doorArmed) setIndoor(inDoor.id);
    } else {
      const portal = portalAt(map, Math.floor(player.x / TILE), Math.floor(player.y / TILE));
      if (!portal) doorArmed = true;
      else if (doorArmed) {
        const b = BUILDINGS.find((x) => x.id === map.id);
        setOutdoor({ x: b.x, y: b.y + buildingDoor(b).r + 55 });
      }
    }
  }

  function updateNpcs(dt) {
    for (const n of npcs) {
      if (n.target) {
        const dx = n.target.x - n.x;
        const dy = n.target.y - n.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 3) {
          n.target = null;
          n.moving = false;
        } else {
          const speed = mode === 'outdoor' ? 85 * depthScale(n.y) : 65;
          n.x += (dx / dist) * speed * dt;
          n.y += (dy / dist) * speed * dt;
          n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
          n.moving = true;
          n.animTime += dt;
        }
        continue;
      }
      n.timer -= dt;
      if (n.timer > 0) continue;
      n.timer = 1.6 + Math.random() * 2.6;
      if (!n.def.wander || Math.random() < 0.35) {
        n.dir = ['down', 'left', 'right', 'up'][Math.floor(Math.random() * 4)];
        continue;
      }
      if (mode === 'outdoor') {
        const tx = n.x + (Math.random() - 0.5) * 520;
        const ty = n.y + (Math.random() - 0.5) * 360;
        if (!outdoorBlocked(tx, ty) && !outdoorBlocked((n.x + tx) / 2, (n.y + ty) / 2)) {
          n.target = { x: tx, y: ty };
        }
      } else {
        const ntx = Math.floor(n.x / TILE) + Math.round((Math.random() - 0.5) * 2);
        const nty = Math.floor(n.y / TILE) + Math.round((Math.random() - 0.5) * 2);
        if (!indoorBlocked(map, ntx, nty) && !portalAt(map, ntx, nty)) {
          n.target = { x: ntx * TILE + TILE / 2, y: nty * TILE + TILE - 8 };
        }
      }
    }
  }

  function findHotspot() {
    // E 键交互对象：NPC（户外/室内），室内家具
    let best = null;
    let bestD = Infinity;
    for (const n of npcs) {
      const d = Math.hypot(player.x - n.x, player.y - n.y);
      const range = mode === 'outdoor' ? 130 * depthScale(n.y) : TILE * 2.2;
      if (d < range && d < bestD) {
        best = { type: 'npc', npc: n.def, label: `和${n.def.name}聊聊` };
        bestD = d;
      }
    }
    if (mode === 'indoor') {
      const ftx = Math.floor(player.x / TILE);
      const fty = Math.floor(player.y / TILE);
      for (const f of map.interactables) {
        if (f.kind !== 'ui') continue;
        const d = Math.abs(ftx - f.x) + Math.abs(fty - f.y);
        if (d <= 1 && d * TILE < bestD) {
          best = { type: 'ui', scene: f.scene, label: f.label };
          bestD = d * TILE;
        }
      }
    }
    return best;
  }

  /* ── 渲染 ── */
  function drawPrompt(g, x, y, text, fontSize = 15) {
    g.font = `bold ${fontSize}px "Microsoft YaHei", sans-serif`;
    const w = g.measureText(text).width + 24;
    const h = fontSize + 14;
    const bx = x - w / 2;
    const by = y - h;
    g.fillStyle = 'rgba(255,251,232,.95)';
    rr(g, bx, by, w, h, h / 2);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,.1)';
    g.lineWidth = 2;
    rr(g, bx, by, w, h, h / 2);
    g.stroke();
    g.beginPath();
    g.moveTo(x - 6, by + h);
    g.lineTo(x + 6, by + h);
    g.lineTo(x, by + h + 8);
    g.closePath();
    g.fillStyle = 'rgba(255,251,232,.95)';
    g.fill();
    g.fillStyle = '#7a6a4f';
    g.textBaseline = 'middle';
    g.fillText(text, bx + 12, by + h / 2 + 1);
  }

  function renderOutdoor() {
    const s = WORLD.imgScale;
    ctx.drawImage(islandImg, cam.x / s, cam.y / s, VIEW_W / s, VIEW_H / s, 0, 0, VIEW_W, VIEW_H);

    const entities = [];
    for (const b of BUILDINGS) {
      // 需求7：玩家越近建筑越大（仅视觉，碰撞不变）
      const dist = Math.hypot(player.x - b.x, player.y - (b.y - 60));
      const t = Math.min(Math.max(1 - dist / 560, 0), 1);
      const boost = 1 + 0.16 * t * (2 - t); // ease-out
      const w = buildingRenderW(b) * boost;
      entities.push({
        y: b.y,
        draw() {
          const sx = b.x - cam.x;
          const sy = b.y - cam.y;
          ctx.drawImage(buildingImg[b.id], sx - w / 2, sy - w, w, w);
          // 中文牌匾
          const label = b.label;
          ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
          const tw = ctx.measureText(label).width + 26;
          ctx.fillStyle = 'rgba(255,251,232,.92)';
          rr(ctx, sx - tw / 2, sy - w * 0.99, tw, 32, 16);
          ctx.fill();
          ctx.fillStyle = '#6d5b43';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, sx - tw / 2 + 13, sy - w * 0.99 + 17);
        },
      });
    }
    for (const n of npcs) {
      entities.push({
        y: n.y,
        draw: () =>
          drawCharacter(ctx, n.x - cam.x, n.y - cam.y, {
            dir: n.dir,
            frame: Math.floor(n.animTime / 0.2) % 2,
            moving: n.moving,
            palette: CHARACTER_PRESETS[n.def.preset],
            scale: depthScale(n.y) * CHAR_SCALE,
          }),
      });
    }
    entities.push({
      y: player.y,
      draw: () =>
        drawCharacter(ctx, player.x - cam.x, player.y - cam.y, {
          dir: player.dir,
          frame: Math.floor(player.animTime / 0.16) % 2,
          moving: player.moving,
          palette: CHARACTER_PRESETS.player,
          scale: depthScale(player.y) * CHAR_SCALE,
        }),
    });
    entities.sort((a, b) => a.y - b.y).forEach((e) => e.draw());

    if (moveTarget && !moveTarget.action) {
      // 行走目标点提示圈
      const tx = moveTarget.x - cam.x;
      const ty = moveTarget.y - cam.y;
      ctx.strokeStyle = 'rgba(255,255,255,.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(tx, ty, 16, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (hotspot && !paused) {
      drawPrompt(ctx, player.x - cam.x, player.y - cam.y - 130 * depthScale(player.y), `Ⓔ ${hotspot.label}（或点击）`);
    }
  }

  function renderIndoor() {
    ctx.fillStyle = '#3a3046';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (!indoorBg.has(map.id)) indoorBg.set(map.id, renderIndoorBackground(map));
    ctx.save();
    ctx.translate(indoorOffset.x, indoorOffset.y);
    ctx.scale(INDOOR_SCALE, INDOOR_SCALE);
    ctx.drawImage(indoorBg.get(map.id), 0, 0);
    const entities = [
      ...npcs.map((n) => ({
        y: n.y,
        draw: () =>
          drawCharacter(ctx, n.x, n.y, {
            dir: n.dir,
            frame: Math.floor(n.animTime / 0.2) % 2,
            moving: n.moving,
            palette: CHARACTER_PRESETS[n.def.preset],
          }),
      })),
      {
        y: player.y,
        draw: () =>
          drawCharacter(ctx, player.x, player.y, {
            dir: player.dir,
            frame: Math.floor(player.animTime / 0.16) % 2,
            moving: player.moving,
            palette: CHARACTER_PRESETS.player,
          }),
      },
    ].sort((a, b) => a.y - b.y);
    entities.forEach((e) => e.draw());
    if (hotspot && !paused) {
      drawPrompt(ctx, player.x, player.y - 92, `Ⓔ ${hotspot.label}（或点击）`, 12);
    }
    ctx.restore();
  }

  function render() {
    if (mode === 'outdoor') renderOutdoor();
    else renderIndoor();
    const fade = Math.max(0, ((fadeUntil - last) / 350) * 0.9);
    if (fade > 0) {
      ctx.fillStyle = `rgba(20,16,28,${fade.toFixed(3)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!paused) {
      updatePlayer(dt);
      updateNpcs(dt);
      hotspot = findHotspot();
      if (mode === 'outdoor') {
        cam.x = Math.min(Math.max(player.x - VIEW_W / 2, 0), WORLD.w - VIEW_W);
        cam.y = Math.min(Math.max(player.y - VIEW_H / 2, 0), WORLD.h - VIEW_H);
      }
    }
    render();
    requestAnimationFrame(loop);
  }

  // 出生：户外（?map=xxx 可直接出生在室内，调试/演示用）
  const debugMap = new URLSearchParams(location.search).get('map');
  if (debugMap && MAPS[debugMap]) setIndoor(debugMap);
  else setOutdoor(WORLD.spawn);
  requestAnimationFrame(loop);

  return {
    pause() {
      paused = true;
      keys.clear();
      moveTarget = null;
      player.moving = false;
    },
    resume() {
      paused = false;
      last = performance.now();
    },
    getState() {
      return { mode, mapId: map?.id ?? null, x: player.x, y: player.y, worldW: WORLD.w, worldH: WORLD.h };
    },
  };
}
