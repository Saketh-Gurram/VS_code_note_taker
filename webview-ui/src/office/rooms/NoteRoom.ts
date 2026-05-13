import { NOTE_ROOM_COLS, NOTE_ROOM_ROWS, TILE_SIZE, THEME } from '../../constants';
import {
  createChar, createWanderer, updateChar, updateWanderer,
  setCharAnim, type CharState, type WandererState, type CharAnim, type Direction,
} from '../engine/characters';
import { getNoteRoomDecorations } from '../decorations';
import type { TileMap, FurnitureSprite, RenderScene } from '../engine/renderer';

// 0=void  1=floor  2=wall
function buildTileMap(): TileMap {
  const tiles: number[] = [];
  for (let row = 0; row < NOTE_ROOM_ROWS; row++) {
    for (let col = 0; col < NOTE_ROOM_COLS; col++) {
      const isEdge = row === 0 || row === NOTE_ROOM_ROWS - 1 || col === 0 || col === NOTE_ROOM_COLS - 1;
      tiles.push(isEdge ? 2 : 1);
    }
  }
  return { cols: NOTE_ROOM_COLS, rows: NOTE_ROOM_ROWS, tiles };
}

// Safe floor waypoints — avoid desk (cols 7–13, rows 7–9) and walls
const WAYPOINTS: ReadonlyArray<{ x: number; y: number }> = [
  // Left open floor
  [3, 9], [4, 11], [2, 11], [3, 12], [5, 12], [2, 9], [5, 10],
  // Right open floor
  [17, 9], [18, 11], [20, 11], [19, 12], [17, 12], [20, 9], [16, 10],
  // Top area (behind desk)
  [2, 3], [4, 2], [6, 4], [10, 2], [14, 2], [18, 3], [20, 4],
  // In front of desk
  [8, 10], [10, 11], [12, 10], [9, 12], [11, 12], [13, 11],
].map(([tx, ty]) => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE }));

// Special interest spots — NPC arrives here, does a specific animation
const INTEREST_SPOTS = [
  // Reading nook (in front of left sofa near bookshelf)
  { x: 13 * TILE_SIZE, y: 5 * TILE_SIZE, anim: 'read' as const, dir: 'up' as const, minWait: 8, maxWait: 14 },
  // Reading nook (in front of right sofa near bookshelf)
  { x: 17 * TILE_SIZE, y: 5 * TILE_SIZE, anim: 'read' as const, dir: 'up' as const, minWait: 8, maxWait: 14 },
  // Sit on left sofa
  { x: 13 * TILE_SIZE, y: 4 * TILE_SIZE, anim: 'idle' as const, dir: 'down' as const, minWait: 5, maxWait: 9 },
  // Sit on right sofa
  { x: 17 * TILE_SIZE, y: 4 * TILE_SIZE, anim: 'idle' as const, dir: 'down' as const, minWait: 5, maxWait: 9 },
] as const;

// Cat waypoints — lower, more open areas only
const CAT_WAYPOINTS: ReadonlyArray<{ x: number; y: number }> = [
  [3, 9], [4, 11], [3, 12], [5, 12], [2, 11],
  [17, 9], [18, 11], [19, 12], [16, 10],
  [8, 10], [10, 11], [12, 10], [11, 12],
].map(([tx, ty]) => ({ x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE }));

// Extended wanderer state tracking interest spot mode
export interface SmartWandererState extends WandererState {
  mode: 'wander' | 'interest';
  interestSpotIdx?: number;
}

export interface NoteRoomState {
  tileMap: TileMap;
  character: CharState;         // main scribe at desk
  wanderers: SmartWandererState[];   // roaming NPCs
  cat: WandererState;           // canvas-drawn cat (spriteIndex = 6)
  isEditing: boolean;
  time: number;
  celebrateTimer: number;
}

export function createNoteRoom(): NoteRoomState {
  const w1Base = createWanderer('npc1', 3,  9, TILE_SIZE, 1);
  const w2Base = createWanderer('npc2', 18, 11, TILE_SIZE, 3);
  // Give them different initial wait timers so they don't move in sync
  w1Base.waitTimer = 1 + Math.random() * 2;
  w2Base.waitTimer = 2 + Math.random() * 3;

  const w1: SmartWandererState = { ...w1Base, mode: 'wander' };
  const w2: SmartWandererState = { ...w2Base, mode: 'wander' };

  const cat = createWanderer('cat', 5, 12, TILE_SIZE, 6) as WandererState;
  cat.waitTimer = 3 + Math.random() * 2;

  return {
    tileMap: buildTileMap(),
    character: createChar('scribe', 10, 10, TILE_SIZE, 0),
    wanderers: [w1, w2],
    cat,
    isEditing: false,
    time: 0,
    celebrateTimer: 0,
  };
}

// Walk speed for smart wanderer (px/s)
const SMART_WALK_SPEED = 28;

// Desk obstacle in world-pixel space — only the solid desk body (rows 7–8.5).
// Row 9+ is the open floor in front of the desk where walking is fine.
const DESK_OBS = {
  x1: 7  * TILE_SIZE + 2,   //  114
  x2: 13 * TILE_SIZE - 2,   //  206
  y1: 7  * TILE_SIZE,        //  112
  y2: 8.5 * TILE_SIZE,       //  136  (stops before the desk front-face strip)
};

/** Returns true if the straight path from (ax,ay)→(bx,by) passes through the desk. */
function pathCrossesDesk(ax: number, ay: number, bx: number, by: number): boolean {
  const { x1, x2, y1, y2 } = DESK_OBS;
  const dx = bx - ax, dy = by - ay;
  let tMin = 0, tMax = 1;

  // Clip against x slab
  if (Math.abs(dx) < 0.001) {
    if (ax < x1 || ax > x2) return false;
  } else {
    const t1 = (x1 - ax) / dx, t2 = (x2 - ax) / dx;
    tMin = Math.max(tMin, Math.min(t1, t2));
    tMax = Math.min(tMax, Math.max(t1, t2));
    if (tMin > tMax) return false;
  }

  // Clip against y slab
  if (Math.abs(dy) < 0.001) {
    if (ay < y1 || ay > y2) return false;
  } else {
    const t3 = (y1 - ay) / dy, t4 = (y2 - ay) / dy;
    tMin = Math.max(tMin, Math.min(t3, t4));
    tMax = Math.min(tMax, Math.max(t3, t4));
  }

  return tMin <= tMax;
}

function pickTarget(w: SmartWandererState, toX: number, toY: number): void {
  const dx2 = toX - w.x, dy2 = toY - w.y;
  w.targetX = toX;
  w.targetY = toY;
  const dir2: Direction = Math.abs(dx2) >= Math.abs(dy2)
    ? (dx2 > 0 ? 'right' : 'left')
    : (dy2 > 0 ? 'down'  : 'up');
  setCharAnim(w, 'walk', dir2);
}

function updateSmartWanderer(
  w: SmartWandererState,
  dt: number,
): void {
  if (w.waitTimer > 0) {
    w.waitTimer -= dt;
    if (w.waitTimer <= 0) {
      // Filter waypoints: must be far enough away AND not cross through the desk
      const safeWaypoints = WAYPOINTS.filter(wp =>
        Math.hypot(wp.x - w.x, wp.y - w.y) > 32 &&
        !pathCrossesDesk(w.x, w.y, wp.x, wp.y)
      );

      // 30% chance to pick an interest spot (only if path is desk-clear)
      const safeInterest = INTEREST_SPOTS.filter(
        sp => !pathCrossesDesk(w.x, w.y, sp.x, sp.y)
      );

      if (Math.random() < 0.30 && safeInterest.length > 0) {
        const idx = Math.floor(Math.random() * safeInterest.length);
        // Find the original index so we can read anim/dir on arrival
        const spot = safeInterest[idx];
        const origIdx = INTEREST_SPOTS.indexOf(spot as typeof INTEREST_SPOTS[number]);
        w.mode = 'interest';
        w.interestSpotIdx = origIdx >= 0 ? origIdx : 0;
        pickTarget(w, spot.x, spot.y);
      } else {
        w.mode = 'wander';
        const pool = safeWaypoints.length > 0 ? safeWaypoints : WAYPOINTS; // fallback
        const wp = pool[Math.floor(Math.random() * pool.length)];
        pickTarget(w, wp.x, wp.y);
      }
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
    if (w.mode === 'interest' && w.interestSpotIdx !== undefined) {
      const spot = INTEREST_SPOTS[w.interestSpotIdx];
      const spotAnim: CharAnim = spot.anim;
      const spotDir: Direction = spot.dir;
      setCharAnim(w, spotAnim, spotDir);
      w.waitTimer = spot.minWait + Math.random() * (spot.maxWait - spot.minWait);
      w.mode = 'wander';
    } else {
      w.waitTimer = 2.5 + Math.random() * 4;
      setCharAnim(w, 'idle', w.dir);
    }
  } else {
    const step = Math.min(SMART_WALK_SPEED * dt, dist);
    w.x += (dx / dist) * step;
    w.y += (dy / dist) * step;
    w.dir = Math.abs(dx) >= Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down' : 'up');
  }
  updateChar(w, dt);
}

export function updateNoteRoom(state: NoteRoomState, dt: number): void {
  state.time += dt;
  updateChar(state.character, dt);
  for (const w of state.wanderers) updateSmartWanderer(w, dt);
  updateWanderer(state.cat, dt, CAT_WAYPOINTS);
  if (state.celebrateTimer > 0) state.celebrateTimer -= dt;
}

export function setEditing(state: NoteRoomState, editing: boolean): void {
  if (state.isEditing === editing) return;
  state.isEditing = editing;
  setCharAnim(state.character, editing ? 'type' : 'idle', editing ? 'up' : 'down');
}

export function noteRoomScene(
  state: NoteRoomState,
  _furniture: FurnitureSprite[],
  charImages: Map<number, HTMLImageElement>
): RenderScene {
  return {
    tileMap: state.tileMap,
    furniture: [],
    characters: [state.character, ...state.wanderers, state.cat],
    charImages,
    floorColor: THEME.FLOOR1,
    wallColor: THEME.WALL,
    decorations: getNoteRoomDecorations(state.time),
    time: state.time,
    celebrateTimer: state.celebrateTimer,
  };
}
