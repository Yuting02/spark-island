// 游戏引擎 v4：户外为固定一屏场景（猫咪后院式定镜头）——场景逻辑坐标固定（1672×941），
// 渲染层按窗口 cover 缩放铺满，屏幕自适应但不滚动；室内为瓦片场景。
// 输入：键盘（WASD/方向键 + E）与鼠标（点地面行走 / 点建筑走近进入 / 点 NPC 对话 / 点家具交互）。
import { TILE, drawCat, CAT_PRESETS, rr } from './art.js';
import {
  WORLD, BUILDINGS, OUTDOOR_NPCS, MAPS,
  buildingFootprint, buildingDoor, outdoorBlocked,
  mapSize, indoorBlocked, portalAt, renderIndoorBackground,
} from './world.js';

const OUT_SPEED = 200; // 场景坐标 px/s
const INDOOR_SPEED = 170;
const NPC_SPEED = 60;
const CAT_SCALE = 1.6; // 户外猫体型（v1.6：按布局图中趴着的橘猫比例标定，站高约 100 场景px）
const INDOOR_CAT_SCALE = 0.95;

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败：${src}`));
    img.src = src;
  });
}

export async function createGame(canvas, { onAction }) {
  const ctx = canvas.getContext('2d');
  const [islandImg, ...bImgs] = await Promise.all([loadImage(WORLD.imageSrc), ...BUILDINGS.map((b) => loadImage(b.img))]);
  const buildingImg = Object.fromEntries(BUILDINGS.map((b, i) => [b.id, bImgs[i]]));

  // 建筑 sprite 的像素级点击命中（透明区不算点中，重叠时取视觉在前者）
  const buildingHitCtx = {};
  for (const b of BUILDINGS) {
    const img = buildingImg[b.id];
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    buildingHitCtx[b.id] = g;
  }
  function hitBuilding(wx, wy) {
    return BUILDINGS.filter((b) => {
      const { x, y, w, h } = b.box;
      if (wx < x || wy < y || wx >= x + w || wy >= y + h) return false;
      const px = Math.floor(((wx - x) / w) * buildingImg[b.id].width);
      const py = Math.floor(((wy - y) / h) * buildingImg[b.id].height);
      return buildingHitCtx[b.id].getImageData(px, py, 1, 1).data[3] > 40;
    }).sort((a, b2) => b2.anchorY - a.anchorY)[0] ?? null;
  }

  /* ── 视口：窗口自适应；户外按 cover 缩放铺满（场景固定不滚动） ── */
  const view = { w: 0, h: 0 };
  let outScale = 1;
  let outOffset = { x: 0, y: 0 };
  let indoorScale = 2;
  let indoorOffset = { x: 0, y: 0 };

  function layoutOutdoor() {
    outScale = Math.max(view.w / WORLD.w, view.h / WORLD.h);
    outOffset = {
      x: Math.floor((view.w - WORLD.w * outScale) / 2),
      y: Math.floor((view.h - WORLD.h * outScale) / 2),
    };
  }

  function layoutIndoor() {
    if (!map) return;
    const { w, h } = mapSize(map);
    const pw = w * TILE;
    const ph = h * TILE;
    indoorScale = Math.min(2.6, Math.max(1, Math.min((view.w * 0.92) / pw, (view.h * 0.84) / ph)));
    indoorOffset = {
      x: Math.floor((view.w - pw * indoorScale) / 2),
      y: Math.floor((view.h - ph * indoorScale) / 2),
    };
  }

  function resize() {
    view.w = canvas.width = window.innerWidth;
    view.h = canvas.height = window.innerHeight;
    layoutOutdoor();
    layoutIndoor();
  }
  window.addEventListener('resize', resize);

  /* ── 状态 ── */
  let mode = 'outdoor';
  let map = null;
  const indoorBg = new Map();
  const player = { x: WORLD.spawn.x, y: WORLD.spawn.y, dir: 'down', moving: false, animTime: 0 };
  let npcs = [];
  let paused = false;
  let exitArmed = false;
  let fadeUntil = 0;
  let hotspot = null;
  let moveTarget = null;
  let stuckTimer = 0;
  const keys = new Set();
  let last = performance.now();

  function makeNpcs(defs, isScene) {
    return defs.map((def) => ({
      def,
      x: isScene ? def.x : def.x * TILE + TILE / 2,
      y: isScene ? def.y : def.y * TILE + TILE - 8,
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
    fadeUntil = last + 350;
  }

  function setIndoor(id) {
    mode = 'indoor';
    map = MAPS[id];
    layoutIndoor();
    player.x = map.entrySpawn.x * TILE + TILE / 2;
    player.y = map.entrySpawn.y * TILE + TILE - 8;
    npcs = makeNpcs(map.npcs ?? [], false);
    moveTarget = null;
    exitArmed = false;
    fadeUntil = last + 350;
  }

  /* ── 碰撞 ── */
  function blocked(x, y) {
    if (mode === 'outdoor') {
      if (outdoorBlocked(x, y)) return true;
    } else if (indoorBlocked(map, Math.floor(x / TILE), Math.floor(y / TILE))) {
      return true;
    }
    const r = mode === 'outdoor' ? 26 : 20;
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
      moveTarget = null;
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
    if (h.type === 'door') return setIndoor(h.building.id);
    if (h.type === 'npc') faceNpcToPlayer(h.npc.id);
    onAction(h);
  }

  /* ── 鼠标点击 ── */
  canvas.addEventListener('click', (e) => {
    if (paused) return;
    const rect = canvas.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) * view.w) / rect.width;
    const vy = ((e.clientY - rect.top) * view.h) / rect.height;
    keys.clear();
    if (mode === 'outdoor') return clickOutdoor((vx - outOffset.x) / outScale, (vy - outOffset.y) / outScale);
    clickIndoor((vx - indoorOffset.x) / indoorScale, (vy - indoorOffset.y) / indoorScale);
  });

  function clickOutdoor(wx, wy) {
    // 1) NPC
    for (const n of npcs) {
      if (Math.abs(wx - n.x) < 24 * CAT_SCALE && wy > n.y - 56 * CAT_SCALE && wy < n.y + 8 * CAT_SCALE) {
        moveTarget = { x: n.x, y: n.y + 55, action: { type: 'npc', id: n.def.id } };
        return;
      }
    }
    // 2) 建筑 → 走到门口进入；若已在门口圈内直接进入（像素级命中，透明区不算）
    const hitB = hitBuilding(wx, wy);
    if (hitB) {
      const d = buildingDoor(hitB);
      if ((player.x - d.x) ** 2 + (player.y - d.y) ** 2 < d.r * d.r) {
        setIndoor(hitB.id);
      } else {
        moveTarget = { x: d.x, y: d.y + 22, action: { type: 'door', id: hitB.id } };
      }
      return;
    }
    // 3) 地面
    moveTarget = {
      x: Math.min(Math.max(wx, WORLD.bounds.minX), WORLD.bounds.maxX),
      y: Math.min(Math.max(wy, WORLD.bounds.minY), WORLD.bounds.maxY),
    };
  }

  function clickIndoor(mx, my) {
    const tx = Math.floor(mx / TILE);
    const ty = Math.floor(my / TILE);
    for (const n of npcs) {
      if (Math.abs(mx - n.x) < 26 && my > n.y - 70 && my < n.y + 10) {
        moveTarget = { x: n.x, y: Math.min(n.y + TILE, (mapSize(map).h - 1) * TILE), action: { type: 'npc', id: n.def.id } };
        return;
      }
    }
    const f = map.interactables.find((i) => i.kind === 'ui' && i.x === tx && i.y === ty);
    if (f) {
      const spot = [[0, 1], [0, -1], [-1, 0], [1, 0]]
        .map(([dx, dy]) => ({ tx: f.x + dx, ty: f.y + dy }))
        .find((t) => !indoorBlocked(map, t.tx, t.ty));
      if (spot) {
        moveTarget = { x: spot.tx * TILE + TILE / 2, y: spot.ty * TILE + TILE - 10, action: { type: 'ui', f } };
      }
      return;
    }
    if (!indoorBlocked(map, tx, ty)) moveTarget = { x: mx, y: my };
  }

  function actionInRange(action) {
    if (action.type === 'npc') {
      const n = npcs.find((x) => x.def.id === action.id);
      if (!n) return false;
      const range = mode === 'outdoor' ? 105 : TILE * 2.2;
      return (player.x - n.x) ** 2 + (player.y - n.y) ** 2 < range * range;
    }
    if (action.type === 'door') {
      const b = BUILDINGS.find((x) => x.id === action.id);
      const d = buildingDoor(b);
      return (player.x - d.x) ** 2 + (player.y - d.y) ** 2 < d.r * d.r;
    }
    const ftx = Math.floor(player.x / TILE);
    const fty = Math.floor(player.y / TILE);
    return Math.abs(ftx - action.f.x) + Math.abs(fty - action.f.y) <= 1;
  }

  function executeAction(action) {
    if (action.type === 'npc') {
      const n = npcs.find((x) => x.def.id === action.id);
      if (n) triggerHotspot({ type: 'npc', npc: n.def, label: `和${n.def.name}聊聊` });
    } else if (action.type === 'door') {
      setIndoor(action.id); // 点击建筑已表达进入意图，到门口直接进
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
      if (moveTarget.action && actionInRange(moveTarget.action)) {
        const a = moveTarget.action;
        moveTarget = null;
        executeAction(a);
      } else {
        const dx = moveTarget.x - player.x;
        const dy = moveTarget.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 5) {
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
      const speed = mode === 'outdoor' ? OUT_SPEED : INDOOR_SPEED;
      const before = { x: player.x, y: player.y };
      const nx = player.x + (vx / len) * speed * dt;
      const ny = player.y + (vy / len) * speed * dt;
      if (!blocked(nx, player.y)) player.x = nx;
      if (!blocked(player.x, ny)) player.y = ny;
      player.animTime += dt;

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

    // 室内出口：踩门垫自动回岛
    if (mode === 'indoor') {
      const portal = portalAt(map, Math.floor(player.x / TILE), Math.floor(player.y / TILE));
      if (!portal) exitArmed = true;
      else if (exitArmed) {
        const b = BUILDINGS.find((x) => x.id === map.id);
        setOutdoor({ x: b.x, y: buildingDoor(b).y + buildingDoor(b).r + 28 });
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
          const speed = mode === 'outdoor' ? NPC_SPEED : 65;
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
        const tx = n.x + (Math.random() - 0.5) * 320;
        const ty = n.y + (Math.random() - 0.5) * 220;
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
    let best = null;
    let bestD = Infinity;
    if (mode === 'outdoor') {
      for (const b of BUILDINGS) {
        const d = buildingDoor(b);
        const dist = Math.hypot(player.x - d.x, player.y - d.y);
        if (dist < d.r && dist < bestD) {
          best = { type: 'door', building: b, label: `进入${b.label}` };
          bestD = dist;
        }
      }
    }
    for (const n of npcs) {
      const d = Math.hypot(player.x - n.x, player.y - n.y);
      const range = mode === 'outdoor' ? 100 : TILE * 2.2;
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
    const w = g.measureText(text).width + 26;
    const h = fontSize + 16;
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
    g.fillText(text, bx + 13, by + h / 2 + 1);
  }

  function renderOutdoor() {
    ctx.fillStyle = '#9adcf0';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.save();
    ctx.translate(outOffset.x, outOffset.y);
    ctx.scale(outScale, outScale);
    ctx.drawImage(islandImg, 0, 0, WORLD.w, WORLD.h);

    const entities = [];
    for (const b of BUILDINGS) {
      // sprite 原位贴回（与底图像素对齐），深度 = 主体底边 anchorY
      entities.push({
        y: b.anchorY,
        draw: () => ctx.drawImage(buildingImg[b.id], b.box.x, b.box.y, b.box.w, b.box.h),
      });
    }
    for (const n of npcs) {
      entities.push({
        y: n.y,
        draw: () =>
          drawCat(ctx, n.x, n.y, {
            dir: n.dir,
            frame: Math.floor(n.animTime / 0.18) % 2,
            moving: n.moving,
            palette: CAT_PRESETS[n.def.preset],
            scale: CAT_SCALE,
          }),
      });
    }
    entities.push({
      y: player.y,
      draw: () =>
        drawCat(ctx, player.x, player.y, {
          dir: player.dir,
          frame: Math.floor(player.animTime / 0.15) % 2,
          moving: player.moving,
          palette: CAT_PRESETS.player,
          scale: CAT_SCALE,
        }),
    });
    entities.sort((a, b) => a.y - b.y).forEach((e) => e.draw());

    if (moveTarget && !moveTarget.action) {
      ctx.strokeStyle = 'rgba(255,255,255,.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(moveTarget.x, moveTarget.y, 14, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (hotspot && !paused) {
      drawPrompt(ctx, player.x, player.y - 118, `Ⓔ ${hotspot.label}（或点击）`);
    }
    ctx.restore();
  }

  function renderIndoor() {
    ctx.fillStyle = '#3a3046';
    ctx.fillRect(0, 0, view.w, view.h);
    if (!indoorBg.has(map.id)) indoorBg.set(map.id, renderIndoorBackground(map));
    ctx.save();
    ctx.translate(indoorOffset.x, indoorOffset.y);
    ctx.scale(indoorScale, indoorScale);
    ctx.drawImage(indoorBg.get(map.id), 0, 0);
    const entities = [
      ...npcs.map((n) => ({
        y: n.y,
        draw: () =>
          drawCat(ctx, n.x, n.y, {
            dir: n.dir,
            frame: Math.floor(n.animTime / 0.18) % 2,
            moving: n.moving,
            palette: CAT_PRESETS[n.def.preset],
            scale: INDOOR_CAT_SCALE,
          }),
      })),
      {
        y: player.y,
        draw: () =>
          drawCat(ctx, player.x, player.y, {
            dir: player.dir,
            frame: Math.floor(player.animTime / 0.15) % 2,
            moving: player.moving,
            palette: CAT_PRESETS.player,
            scale: INDOOR_CAT_SCALE,
          }),
      },
    ].sort((a, b) => a.y - b.y);
    entities.forEach((e) => e.draw());
    if (hotspot && !paused) {
      drawPrompt(ctx, player.x, player.y - 76, `Ⓔ ${hotspot.label}（或点击）`, 13);
    }
    ctx.restore();
  }

  function render() {
    if (mode === 'outdoor') renderOutdoor();
    else renderIndoor();
    const fade = Math.max(0, ((fadeUntil - last) / 350) * 0.9);
    if (fade > 0) {
      ctx.fillStyle = `rgba(20,16,28,${fade.toFixed(3)})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
  }

  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (!paused) {
      updatePlayer(dt);
      updateNpcs(dt);
      hotspot = findHotspot();
    }
    render();
    requestAnimationFrame(loop);
  }

  resize();
  const params = new URLSearchParams(location.search);
  const debugMap = params.get('map');
  const debugPos = (params.get('pos') ?? '').split(',').map(Number);
  if (debugMap && MAPS[debugMap]) setIndoor(debugMap);
  else if (debugPos.length === 2 && debugPos.every(Number.isFinite)) setOutdoor({ x: debugPos[0], y: debugPos[1] });
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
  };
}
