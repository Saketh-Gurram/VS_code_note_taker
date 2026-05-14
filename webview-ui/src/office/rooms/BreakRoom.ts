import { NOTE_ROOM_COLS, NOTE_ROOM_ROWS, TILE_SIZE } from '../../constants';
import { createWanderer, updateChar, setCharAnim, type WandererState, type Direction } from '../engine/characters';
import type { TileMap, RenderScene } from '../engine/renderer';
import type { Decoration } from '../decorations';

const COLS = NOTE_ROOM_COLS;  // 20
const ROWS = NOTE_ROOM_ROWS;  // 11
const P    = TILE_SIZE * 3;   // 48 px — canvas pixels per tile
const TS   = TILE_SIZE;       // 16 px — world-pixel unit used by character positions

function r(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// ── Hit-test regions (tile coords) — read by OfficeCanvas click handler ────────
export const ARCADE_PONG_REGION     = { col1: 1,  col2: 3,  row1: 2, row2: 6  };
export const ARCADE_BREAKOUT_REGION = { col1: 19, col2: 21, row1: 2, row2: 6  };
export const TV_REGION              = { col1: 8,  col2: 13, row1: 0, row2: 3  };
export const FOOSBALL_REGION        = { col1: 7,  col2: 14, row1: 7, row2: 10 };
export const COFFEE_REGION          = { col1: 5,  col2: 7,  row1: 4, row2: 7  };
export const COUCH_REGION           = { col1: 14, col2: 19, row1: 5, row2: 7  };

// ── Obstacle bounding boxes in world-pixel space ───────────────────────────────
const BREAK_OBSTACLES = [
  { x1:  1 * TS, x2:  3 * TS, y1: 2 * TS, y2: 6 * TS },  // Pong arcade
  { x1: 18 * TS, x2: 20 * TS, y1: 2 * TS, y2: 6 * TS },  // Breakout arcade
  { x1:  8 * TS, x2: 13 * TS, y1: 0,      y2: 3 * TS },  // TV
  { x1:  5 * TS, x2:  7 * TS, y1: 4 * TS, y2: 7 * TS },  // Coffee machine
  { x1: 14 * TS, x2: 20 * TS, y1: 5 * TS, y2: 7 * TS },  // Couch
  { x1:  7 * TS, x2: 14 * TS, y1: 7 * TS, y2: 10 * TS }, // Foosball table
  { x1: 14 * TS, x2: 18 * TS, y1: 9 * TS, y2: 10 * TS }, // Snack table
];

function pathCrossesObstacle(ax: number, ay: number, bx: number, by: number): boolean {
  for (const { x1, x2, y1, y2 } of BREAK_OBSTACLES) {
    const dx = bx - ax, dy = by - ay;
    let tMin = 0, tMax = 1;
    if (Math.abs(dx) < 0.001) {
      if (ax < x1 || ax > x2) continue;
    } else {
      const t1 = (x1 - ax) / dx, t2 = (x2 - ax) / dx;
      tMin = Math.max(tMin, Math.min(t1, t2));
      tMax = Math.min(tMax, Math.max(t1, t2));
      if (tMin > tMax) continue;
    }
    if (Math.abs(dy) < 0.001) {
      if (ay < y1 || ay > y2) continue;
    } else {
      const t3 = (y1 - ay) / dy, t4 = (y2 - ay) / dy;
      tMin = Math.max(tMin, Math.min(t3, t4));
      tMax = Math.min(tMax, Math.max(t3, t4));
    }
    if (tMin <= tMax) return true;
  }
  return false;
}

// ── Safe floor waypoints (verified clear of all obstacles) ─────────────────────
const BREAK_WAYPOINTS: ReadonlyArray<{ x: number; y: number }> = ([
  [4, 2], [6, 2],          // top-left of TV
  [15, 2], [17, 2],        // top-right of TV
  [4, 4], [4, 6], [4, 8],  // left corridor
  [10, 4], [11, 5], [10, 6], // centre open floor
  [16, 4],                 // right-centre above couch
  [2, 7], [2, 8], [5, 9],  // bottom-left
  [16, 8], [17, 9],        // bottom-right
] as [number, number][]).map(([tc, tr]) => ({ x: (tc + 0.5) * TS, y: (tr + 0.5) * TS }));

// ── State ─────────────────────────────────────────────────────────────────────
export interface BreakRoomState {
  tileMap: TileMap;
  wanderers: WandererState[];
  time: number;
  tvMode: 'static' | 'show';
  // egg timers
  foosballTurbo: number;  // seconds remaining
  coffeeRush: number;     // seconds remaining
  couchNap: number;       // seconds remaining
  partyMode: boolean;
}

function buildTileMap(): TileMap {
  const tiles: number[] = [];
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++)
      tiles.push(row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1 ? 2 : 1);
  return { cols: COLS, rows: ROWS, tiles };
}

export function createBreakRoom(): BreakRoomState {
  const w1 = createWanderer('br_npc1', 4,  5, TS, 1);
  const w2 = createWanderer('br_npc2', 16, 4, TS, 2);
  w1.waitTimer = 3 + Math.random() * 3;
  w2.waitTimer = 1 + Math.random() * 2;
  return {
    tileMap: buildTileMap(), wanderers: [w1, w2],
    time: 0, tvMode: 'static',
    foosballTurbo: 0, coffeeRush: 0, couchNap: 0, partyMode: false,
  };
}

// ── Easter egg triggers ────────────────────────────────────────────────────────
/** Click foosball → 5-second turbo match */
export function eggFoosball(state: BreakRoomState): void {
  state.foosballTurbo = 5;
}

/** Click coffee machine → NPCs rush over, COFFEE BREAK text for 8s */
export function eggCoffeeRush(state: BreakRoomState): void {
  state.coffeeRush = 8;
  // Pull both NPCs toward the coffee machine immediately
  const spots = [{ x: 5.5 * TS, y: 8 * TS }, { x: 6.5 * TS, y: 8 * TS }];
  state.wanderers.forEach((w, i) => {
    const t = spots[i % spots.length];
    w.targetX = t.x; w.targetY = t.y; w.waitTimer = 0;
    const dx = t.x - w.x, dy = t.y - w.y;
    const dir: Direction = Math.abs(dx) >= Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    setCharAnim(w, 'walk', dir);
  });
}

/** Click the couch → NPCs shuffle over and nap for 12s */
export function eggCouchNap(state: BreakRoomState): void {
  state.couchNap = 12;
  const spots = [{ x: 15.5 * TS, y: 6 * TS }, { x: 17.5 * TS, y: 6 * TS }];
  state.wanderers.forEach((w, i) => {
    const t = spots[i % spots.length];
    w.targetX = t.x; w.targetY = t.y; w.waitTimer = 0;
    setCharAnim(w, 'walk', 'right');
  });
}

/** Konami code in break room → toggle party mode */
export function eggBreakParty(state: BreakRoomState): void {
  state.partyMode = !state.partyMode;
}

// ── NPC update (obstacle-aware, speed-multiplier support) ─────────────────────
function updateBreakWanderer(w: WandererState, dt: number, speedMult = 1): void {
  if (w.waitTimer > 0) {
    w.waitTimer -= dt;
    if (w.waitTimer <= 0) {
      const safe = BREAK_WAYPOINTS.filter(wp =>
        Math.hypot(wp.x - w.x, wp.y - w.y) > 2 * TS &&
        !pathCrossesObstacle(w.x, w.y, wp.x, wp.y)
      );
      const pool = safe.length > 0 ? safe : BREAK_WAYPOINTS;
      const wp = pool[Math.floor(Math.random() * pool.length)];
      w.targetX = wp.x; w.targetY = wp.y;
      const dx = wp.x - w.x, dy = wp.y - w.y;
      const dir: Direction = Math.abs(dx) >= Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      setCharAnim(w, 'walk', dir);
    }
    updateChar(w, dt);
    return;
  }
  const dx = w.targetX - w.x, dy = w.targetY - w.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 3) {
    w.x = w.targetX; w.y = w.targetY;
    w.waitTimer = 2.5 + Math.random() * 4;
    setCharAnim(w, 'idle', w.dir);
  } else {
    const step = Math.min(28 * speedMult * dt, dist);
    w.x += (dx / dist) * step; w.y += (dy / dist) * step;
    w.dir = Math.abs(dx) >= Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }
  updateChar(w, dt);
}

export function updateBreakRoom(state: BreakRoomState, dt: number): void {
  state.time += dt;
  if (state.foosballTurbo > 0) state.foosballTurbo = Math.max(0, state.foosballTurbo - dt);
  if (state.coffeeRush    > 0) state.coffeeRush    = Math.max(0, state.coffeeRush    - dt);
  if (state.couchNap      > 0) state.couchNap      = Math.max(0, state.couchNap      - dt);
  const speedMult = state.coffeeRush > 0 ? 2.5 : 1;
  for (const w of state.wanderers) updateBreakWanderer(w, dt, speedMult);
}

export function toggleTv(state: BreakRoomState): void {
  state.tvMode = state.tvMode === 'static' ? 'show' : 'static';
}

// ── Draw helpers ───────────────────────────────────────────────────────────────
function drawTV(ctx: CanvasRenderingContext2D, time: number, tvMode: 'static' | 'show', party: boolean) {
  const tx = 8 * P, ty = P * 0.4, tw = 5 * P, th = 2.5 * P, bezel = 7;
  r(ctx, '#2a2a3a', tx, ty, tw, th);
  r(ctx, '#1a1a2a', tx, ty, tw, 4);
  const scx = tx + bezel, scy = ty + bezel, scw = tw - bezel * 2, sch = th - bezel * 2 - 8;
  if (party) {
    // Rainbow colour-cycling screen
    for (let i = 0; i < 6; i++) {
      const hue = ((time * 80 + i * 60) % 360);
      ctx.fillStyle = `hsl(${hue},70%,55%)`;
      ctx.fillRect(Math.round(scx + i * scw / 6), scy, Math.ceil(scw / 6), sch);
    }
  } else if (tvMode === 'static') {
    ctx.save();
    for (let i = 0; i < 80; i++) {
      const nx = scx + (Math.sin(i * 7.3 + time * 20) * 0.5 + 0.5) * scw;
      const ny = scy + (Math.cos(i * 5.1 + time * 17) * 0.5 + 0.5) * sch;
      const v  = Math.floor((Math.sin(i + time * 30) * 0.5 + 0.5) * 200);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.round(nx), Math.round(ny), 3, 2);
    }
    ctx.restore();
  } else {
    r(ctx, '#1a0a2a', scx, scy, scw, sch);
    const b2 = Math.sin(time * 3) * 2;
    r(ctx, '#f5c5a3', scx + 20, scy + 10 + b2, 10, 16);
    r(ctx, '#89b4fa', scx + 20, scy + 18 + b2, 10, 8);
    r(ctx, '#f38ba8', scx + scw - 30, scy + 12 - b2, 10, 16);
    r(ctx, '#a6e3a1', scx + scw - 30, scy + 20 - b2, 10, 8);
  }
  r(ctx, '#2a2a3a', tx + tw / 2 - 14, ty + th - 2, 28, 14);
  r(ctx, '#1a1a2a', tx + tw / 2 - 36, ty + th + 10, 72, 8);
  r(ctx, tvMode === 'show' || party ? '#a6e3a1' : '#f38ba8', tx + tw - 14, ty + th - 14, 6, 6);
}

function drawArcadeCabinet(
  ctx: CanvasRenderingContext2D, time: number,
  x: number, label: string, screenColor: string, accentColor: string,
) {
  const cw = P * 2, ch = P * 4, cy = P * 2;
  r(ctx, '#1a1a2a', x, cy, cw, ch);
  r(ctx, '#2a2a3a', x + 2, cy + 2, cw - 4, ch - 4);
  r(ctx, accentColor, x, cy, cw, 6);
  const sx = x + 10, sy = cy + 14, sw = cw - 20, sh = P * 1.4;
  r(ctx, '#0a0a14', sx, sy, sw, sh);
  const pulse = 0.7 + Math.sin(time * 1.5) * 0.15;
  ctx.save(); ctx.globalAlpha = pulse;
  r(ctx, screenColor, sx + 3, sy + 3, sw - 6, sh - 6);
  r(ctx, '#ffffff', sx + 5, sy + sh / 2 - 2, 4, Math.round(sh * 0.5));
  r(ctx, '#ffffff', sx + sw - 9, sy + sh / 2 - 8, 4, Math.round(sh * 0.5));
  const bx = sx + 5 + (Math.sin(time * 3) * 0.5 + 0.5) * (sw - 20);
  const by = sy + 4 + (Math.cos(time * 2.3) * 0.5 + 0.5) * (sh - 12);
  r(ctx, '#ffffff', bx, by, 5, 5);
  ctx.restore();
  r(ctx, '#222232', x, cy + sh + 16, cw, P * 0.8);
  r(ctx, accentColor, x + cw / 2 - 8, cy + sh + 22, 16, 16);
  r(ctx, '#888', x + cw / 2 - 3, cy + sh + 18, 6, 14);
  r(ctx, accentColor, x + 12, cy + sh + 28, 10, 10);
  r(ctx, '#f38ba8', x + cw - 22, cy + sh + 28, 10, 10);
  r(ctx, '#888', x + cw / 2 - 10, cy + ch - 20, 20, 6);
  ctx.save();
  ctx.font = `bold 9px "Press Start 2P", monospace`;
  ctx.fillStyle = accentColor; ctx.textAlign = 'center';
  ctx.fillText(label, x + cw / 2, cy + ch - 4);
  ctx.restore();
  r(ctx, accentColor, x, cy + 8, 3, ch - 16);
  r(ctx, accentColor, x + cw - 3, cy + 8, 3, ch - 16);
  ctx.save();
  ctx.globalAlpha = 0.5 + Math.sin(time * 2) * 0.3;
  ctx.font = `7px monospace`; ctx.fillStyle = '#cdd6f4'; ctx.textAlign = 'center';
  ctx.fillText('CLICK', x + cw / 2, cy + 10);
  ctx.restore();
}

function drawFoosball(ctx: CanvasRenderingContext2D, time: number, turbo: number) {
  const turboMult = turbo > 0 ? 6 : 1;
  const t = time * turboMult;
  const fx = 7 * P, fy = 7 * P, fw = 7 * P, fh = P * 2.5;
  r(ctx, '#3d2010', fx, fy, fw, fh);
  r(ctx, '#5c3414', fx, fy, fw, 5);
  r(ctx, '#2a6a1a', fx + 10, fy + 10, fw - 20, fh - 20);
  r(ctx, '#ffffff', fx + fw / 2 - 1, fy + 10, 2, fh - 20);
  ctx.save();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(fx + fw / 2, fy + fh / 2, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  const bx = fx + fw / 2 + Math.sin(t * 3.5) * 30;
  const by = fy + fh / 2 + Math.cos(t * 2.8) * 18;
  r(ctx, '#f5f5f5', Math.round(bx) - 4, Math.round(by) - 4, 8, 8);
  const rodPositions = [0.2, 0.38, 0.62, 0.8];
  rodPositions.forEach((rp, i) => {
    const rx = fx + fw * rp;
    r(ctx, '#888', Math.round(rx) - 3, fy, 6, fh);
    const playerY = fy + fh / 2 + Math.sin(t * 2 + i) * 20;
    const col = i < 2 ? '#4488ff' : '#ff4444';
    r(ctx, col, Math.round(rx) - 6, Math.round(playerY) - 8, 12, 16);
  });
  r(ctx, '#2a1508', fx + 12, fy + fh, 10, 16);
  r(ctx, '#2a1508', fx + fw - 22, fy + fh, 10, 16);
  r(ctx, '#888', fx - 12, fy + fh * 0.2, 12, 8);
  r(ctx, '#888', fx - 12, fy + fh * 0.8, 12, 8);
  r(ctx, '#888', fx + fw, fy + fh * 0.2, 12, 8);
  r(ctx, '#888', fx + fw, fy + fh * 0.8, 12, 8);
  // TURBO label
  if (turbo > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, turbo) * (0.7 + Math.sin(time * 10) * 0.3);
    ctx.font = `bold 11px "Press Start 2P", monospace`;
    ctx.fillStyle = '#f9e2af'; ctx.textAlign = 'center';
    ctx.fillText('⚡ TURBO ⚡', fx + fw / 2, fy - 6);
    ctx.restore();
  }
}

function drawCouch(ctx: CanvasRenderingContext2D) {
  const ox = 14 * P + 4, oy = 5 * P, sw = 6 * P - 8;
  r(ctx, '#4a2060', ox, oy, sw, P * 0.75);
  r(ctx, '#7a40a0', ox, oy, sw, 4);
  r(ctx, '#2a1040', ox + sw / 2 - 1, oy, 2, P * 0.75);
  r(ctx, '#2a1040', ox, oy, 10, P * 1.4);
  r(ctx, '#2a1040', ox + sw - 10, oy, 10, P * 1.4);
  r(ctx, '#4a2060', ox + 14, oy + P * 0.72, sw - 28, P * 0.65);
  r(ctx, '#6a30a0', ox + 14, oy + P * 0.72, sw - 28, 4);
  r(ctx, '#1e100a', ox + 14, oy + P * 1.37, 8, 10);
  r(ctx, '#1e100a', ox + sw - 22, oy + P * 1.37, 8, 10);
}

function drawCoffeeMachine(ctx: CanvasRenderingContext2D, time: number, rush: number) {
  const cx = 5 * P, cy = 4 * P, mw = P * 2, mh = P * 3;
  r(ctx, '#2a2a2a', cx, cy, mw, mh);
  r(ctx, '#3a3a3a', cx, cy, mw, 6);
  r(ctx, '#1e3040', cx + 6, cy + 10, mw - 12, 20);
  r(ctx, '#2a6080', cx + 8, cy + 12, mw - 16, 16);
  const brewActive = rush > 0 || Math.sin(time * 0.5) > 0.8;
  r(ctx, brewActive ? '#a6e3a1' : '#4a6a4a', cx + mw / 2 - 8, cy + 38, 16, 10);
  r(ctx, '#1a1a1a', cx + mw / 2 - 4, cy + mh - 30, 8, 20);
  r(ctx, '#1a1a1a', cx + mw / 2 - 10, cy + mh - 18, 20, 6);
  r(ctx, '#383838', cx - 4, cy + mh - 10, mw + 8, 10);
  const smokeCount = rush > 0 ? 6 : 2;
  for (let i = 0; i < smokeCount; i++) {
    const phase = ((time * (rush > 0 ? 3 : 1.5) + i * 0.7) % 1);
    ctx.save(); ctx.globalAlpha = (1 - phase) * (rush > 0 ? 0.8 : 0.5);
    r(ctx, '#d8d0c8', cx + mw / 2 + (i % 3) * 5 - 5, cy + mh - 34 - phase * 18, 2, 4);
    ctx.restore();
  }
}

function drawSnackTable(ctx: CanvasRenderingContext2D, time: number) {
  const tx = 14 * P, ty = 9.5 * P, tw = 4 * P, th = P * 0.6;
  r(ctx, '#5c3414', tx, ty, tw, th);
  r(ctx, '#8a5030', tx, ty, tw, 3);
  r(ctx, '#2a1508', tx + 8, ty + th, 8, 12);
  r(ctx, '#2a1508', tx + tw - 16, ty + th, 8, 12);
  const mugColors = ['#f0ece0', '#c43028', '#2848c4'];
  for (let i = 0; i < 3; i++) {
    const mx = tx + 14 + i * 36;
    r(ctx, mugColors[i], mx, ty + 2, 16, 12);
    r(ctx, '#3d1a0a', mx + 2, ty + 5, 12, 7);
    const phase = ((time * 1.2 + i * 0.4) % 1);
    ctx.save(); ctx.globalAlpha = (1 - phase) * 0.4;
    r(ctx, '#d8d0c8', mx + 6, ty - phase * 8, 2, 5);
    ctx.restore();
  }
}

// ── Overlay decorations for egg effects ────────────────────────────────────────
const W_PX = NOTE_ROOM_COLS * TILE_SIZE * 3;  // canvas width in px
const H_PX = NOTE_ROOM_ROWS * TILE_SIZE * 3;  // canvas height in px

function drawPartyFloor(ctx: CanvasRenderingContext2D, time: number) {
  // Rainbow pulsing tiles over the floor (rows 1-9, within walls)
  const alpha = 0.22 + Math.sin(time * 3) * 0.08;
  for (let row = 1; row < ROWS - 1; row++) {
    for (let col = 1; col < COLS - 1; col++) {
      const hue = (time * 60 + col * 18 + row * 25) % 360;
      ctx.fillStyle = `hsla(${hue},80%,55%,${alpha})`;
      ctx.fillRect(col * P, row * P, P, P);
    }
  }
}

function drawCoffeeRushOverlay(ctx: CanvasRenderingContext2D, time: number, rush: number) {
  const alpha = Math.min(1, rush) * (0.85 + Math.sin(time * 6) * 0.1);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `bold 13px "Press Start 2P", monospace`;
  ctx.fillStyle = '#f9e2af'; ctx.textAlign = 'center';
  ctx.fillText('☕ COFFEE BREAK!', W_PX / 2, H_PX / 2 - 10);
  ctx.font = `8px "Press Start 2P", monospace`;
  ctx.fillStyle = '#cdd6f4';
  ctx.fillText('everyone rushes over', W_PX / 2, H_PX / 2 + 14);
  ctx.restore();
}

function drawCouchNapOverlay(ctx: CanvasRenderingContext2D, time: number) {
  // Floating Zzz bubbles above the couch area
  const couchCx = 16.5 * P;
  for (let i = 0; i < 3; i++) {
    const phase = ((time * 0.6 + i * 0.45) % 1);
    const x = couchCx + (i - 1) * 28 + Math.sin(time + i) * 6;
    const y = 5 * P - phase * 40;
    ctx.save();
    ctx.globalAlpha = (1 - phase) * 0.85;
    ctx.font = `bold ${10 + i * 3}px "Press Start 2P", monospace`;
    ctx.fillStyle = '#89b4fa'; ctx.textAlign = 'center';
    ctx.fillText('z', x, y);
    ctx.restore();
  }
}

// ── Decorations list ───────────────────────────────────────────────────────────
export function getBreakRoomDecorations(state: BreakRoomState): Decoration[] {
  const { time, tvMode, foosballTurbo, coffeeRush, couchNap, partyMode } = state;
  const decos: Decoration[] = [];

  // Party floor — drawn first, behind everything
  if (partyMode) decos.push({ zY: -1, draw: (c) => drawPartyFloor(c, time) });

  decos.push(
    { zY: 0,       draw: (c) => drawTV(c, time, tvMode, partyMode) },
    { zY: P * 2,   draw: (c) => drawArcadeCabinet(c, time, P * 1,  'PONG',     '#001400', '#a6e3a1') },
    { zY: P * 2,   draw: (c) => drawArcadeCabinet(c, time, P * 19, 'BREAKOUT', '#00001a', '#89b4fa') },
    { zY: P * 4.5, draw: (c) => drawCouch(c) },
    { zY: P * 4.8, draw: (c) => drawCoffeeMachine(c, time, coffeeRush) },
    { zY: P * 6,   draw: (c) => drawFoosball(c, time, foosballTurbo) },
    { zY: P * 9,   draw: (c) => drawSnackTable(c, time) },
  );

  // Overlay effects — drawn on top of characters
  if (coffeeRush > 0) decos.push({ zY: 99999, draw: (c) => drawCoffeeRushOverlay(c, time, coffeeRush) });
  if (couchNap   > 0) decos.push({ zY: 99999, draw: (c) => drawCouchNapOverlay(c, time) });

  return decos;
}

export function breakRoomScene(state: BreakRoomState, charImages: Map<number, HTMLImageElement>): RenderScene {
  return {
    tileMap:     state.tileMap,
    furniture:   [],
    characters:  [...state.wanderers],
    charImages,
    floorColor:  '#3d2415',
    wallColor:   '#2a1608',
    decorations: getBreakRoomDecorations(state),
    time:        state.time,
  };
}
