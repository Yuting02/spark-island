// 游戏微引擎：键盘输入、移动与碰撞、行走动画、渲染、门口交互检测。
import { TILE, buildPlayerSprites } from './sprites.js';
import { MAP_W, MAP_H, SPAWN, blocked, nearDoor, renderBackground } from './map.js';

const SCALE = 3;
const SPEED = 3.4 * TILE; // 像素/秒（逻辑像素）

export function createGame(canvas, { onEnter }) {
  canvas.width = MAP_W * TILE * SCALE;
  canvas.height = MAP_H * TILE * SCALE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.scale(SCALE, SCALE);

  const sprites = buildPlayerSprites();
  const backgrounds = [renderBackground(0), renderBackground(1)];

  const player = {
    x: SPAWN.x * TILE + 2, // 精灵 12px 宽，水平居中于 16px 瓦片
    y: SPAWN.y * TILE,
    dir: 'down',
    moving: false,
    animTime: 0,
  };

  const keys = new Set();
  let paused = false;
  let nearBuilding = null;

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
    } else if (k === 'e' && nearBuilding) {
      onEnter(nearBuilding);
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));

  // 玩家碰撞盒：脚部 10×6（相对精灵左上角 x+1..x+11, y+10..y+16）
  function hitsWall(px, py) {
    const corners = [
      [px + 1, py + 10], [px + 11, py + 10],
      [px + 1, py + 15], [px + 11, py + 15],
    ];
    return corners.some(([cx, cy]) => blocked(Math.floor(cx / TILE), Math.floor(cy / TILE)));
  }

  function feetTile() {
    return { tx: Math.floor((player.x + 6) / TILE), ty: Math.floor((player.y + 13) / TILE) };
  }

  function update(dt) {
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
      if (!hitsWall(nx, player.y)) player.x = nx; // 分轴判定，贴墙可滑动
      if (!hitsWall(player.x, ny)) player.y = ny;
      player.animTime += dt;
    }
    const { tx, ty } = feetTile();
    nearBuilding = nearDoor(tx, ty);
  }

  let waveTimer = 0;
  let waveFrame = 0;

  function render() {
    ctx.drawImage(backgrounds[waveFrame], 0, 0);

    const frame = player.moving ? Math.floor(player.animTime / 0.18) % 2 : 0;
    ctx.drawImage(sprites[player.dir][frame], Math.round(player.x), Math.round(player.y));

    if (nearBuilding && !paused) {
      const text = `按 E 进入${nearBuilding.label}`;
      ctx.font = '8px "Microsoft YaHei", sans-serif';
      const w = ctx.measureText(text).width + 10;
      const bx = Math.round(player.x + 6 - w / 2);
      const by = Math.round(player.y - 14);
      ctx.fillStyle = 'rgba(20,18,28,.82)';
      ctx.fillRect(bx, by, w, 12);
      ctx.fillStyle = '#ffd54f';
      ctx.fillRect(bx, by + 11, w, 1);
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, bx + 5, by + 6);
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    waveTimer += dt;
    if (waveTimer > 0.6) {
      waveTimer = 0;
      waveFrame = 1 - waveFrame;
    }
    if (!paused) update(dt);
    render();
    requestAnimationFrame(loop);
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
