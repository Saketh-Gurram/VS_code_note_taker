import { ANIM } from '../../constants';

export type Direction = 'down' | 'left' | 'right' | 'up';
export type CharAnim = 'idle' | 'walk' | 'type' | 'fidget' | 'read';

// Sprite sheet layout: 112×96 px — 7 cols × 3 rows, each frame 16×32
// Rows: 0=down, 1=up, 2=right  (left is right flipped horizontally)
// Cols: 0-2=walk frames, 3-4=type frames, 5-6=read frames
export const CHAR_FRAME_W = 16;
export const CHAR_FRAME_H = 32;
export const DIR_ROW: Record<Direction, number> = { down: 0, up: 1, right: 2, left: 2 };

export interface CharState {
  id: string;
  x: number;        // pixel position (tile center)
  y: number;
  dir: Direction;
  anim: CharAnim;
  frame: number;
  frameTimer: number;
  spriteIndex: number; // 0–5 = char PNG, 6 = canvas-drawn cat
  label?: string;
  idleTimer: number;
  fidgetDir?: Direction;
}

// Extended state for NPCs that wander the room
export interface WandererState extends CharState {
  targetX: number;   // pixel coords of current destination
  targetY: number;
  waitTimer: number; // seconds remaining at current spot
}

export function createWanderer(
  id: string,
  tileX: number,
  tileY: number,
  tileSize: number,
  spriteIndex: number,
): WandererState {
  return {
    ...createChar(id, tileX, tileY, tileSize, spriteIndex),
    targetX: (tileX + 0.5) * tileSize,
    targetY: (tileY + 0.5) * tileSize,
    waitTimer: Math.random() * 2,
  };
}

// Walk speed in pixels/second for NPCs
const WALK_SPEED = 28;

export function updateWanderer(
  w: WandererState,
  dt: number,
  waypoints: ReadonlyArray<{ x: number; y: number }>
): void {
  if (w.waitTimer > 0) {
    w.waitTimer -= dt;
    if (w.waitTimer <= 0) {
      // pick a new random waypoint that's not too close
      const candidates = waypoints.filter(
        wp => Math.hypot(wp.x - w.x, wp.y - w.y) > 32
      );
      const wp = candidates[Math.floor(Math.random() * candidates.length)];
      w.targetX = wp.x;
      w.targetY = wp.y;
      const dx = wp.x - w.x, dy = wp.y - w.y;
      const dir: Direction = Math.abs(dx) >= Math.abs(dy)
        ? (dx > 0 ? 'right' : 'left')
        : (dy > 0 ? 'down'  : 'up');
      setCharAnim(w, 'walk', dir);
    }
    updateChar(w, dt);
    return;
  }

  // Move toward target
  const dx = w.targetX - w.x;
  const dy = w.targetY - w.y;
  const dist = Math.hypot(dx, dy);

  if (dist < 3) {
    w.x = w.targetX;
    w.y = w.targetY;
    w.waitTimer = 2.5 + Math.random() * 4;
    setCharAnim(w, 'idle', w.dir);
  } else {
    const step = Math.min(WALK_SPEED * dt, dist);
    w.x += (dx / dist) * step;
    w.y += (dy / dist) * step;
    // keep facing direction locked to movement
    w.dir = Math.abs(dx) >= Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down'  : 'up');
  }
  updateChar(w, dt);
}

export function createChar(
  id: string,
  tileX: number,
  tileY: number,
  tileSize: number,
  spriteIndex: number,
  label?: string
): CharState {
  return {
    id,
    x: (tileX + 0.5) * tileSize,
    y: (tileY + 0.5) * tileSize,
    dir: 'down',
    anim: 'idle',
    frame: 0,
    frameTimer: 0,
    spriteIndex,
    label,
    idleTimer: Math.random() * ANIM.IDLE_FIDGET_INTERVAL,
  };
}

export function updateChar(char: CharState, dt: number): void {
  const frameDur = (char.anim === 'type' || char.anim === 'read') ? ANIM.TYPE_FRAME_DUR : ANIM.WALK_FRAME_DUR;
  const frameCount = char.anim === 'type' ? 2 : char.anim === 'read' ? 2 : char.anim === 'walk' ? 4 : 1;

  char.frameTimer += dt;
  if (char.frameTimer >= frameDur) {
    char.frameTimer -= frameDur;
    char.frame = (char.frame + 1) % frameCount;
  }

  // Idle fidget cycle
  if (char.anim === 'idle') {
    char.idleTimer -= dt;
    if (char.idleTimer <= 0) {
      char.idleTimer = ANIM.IDLE_FIDGET_INTERVAL + Math.random() * 2;
      triggerFidget(char);
    }
  }
}

function triggerFidget(char: CharState): void {
  const dirs: Direction[] = ['down', 'left', 'right', 'up'];
  const dirs2 = dirs.filter(d => d !== char.dir);
  char.fidgetDir = dirs2[Math.floor(Math.random() * dirs2.length)];
  const prev = char.dir;
  char.dir = char.fidgetDir;
  // Return to original direction after 600ms
  setTimeout(() => { char.dir = prev; }, 600);
}

export function setCharAnim(char: CharState, anim: CharAnim, dir?: Direction): void {
  char.anim = anim;
  char.frame = 0;
  char.frameTimer = 0;
  if (dir) char.dir = dir;
}

// Walk cols: 0→1→2→1 (4-frame cycle using 3 stored frames)
const WALK_COLS = [0, 1, 2, 1];

export function getFrameRect(char: CharState): { sx: number; sy: number } {
  const row = DIR_ROW[char.dir];
  let col: number;
  if (char.anim === 'type') {
    col = 3 + (char.frame % 2);   // cols 3–4
  } else if (char.anim === 'read') {
    col = 5 + (char.frame % 2);   // cols 5–6
  } else if (char.anim === 'walk') {
    col = WALK_COLS[char.frame % 4];
  } else {
    col = 0; // idle — first walk pose
  }
  return { sx: col * CHAR_FRAME_W, sy: row * CHAR_FRAME_H };
}
