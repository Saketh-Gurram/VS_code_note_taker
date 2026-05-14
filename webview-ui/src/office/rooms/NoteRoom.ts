import { NOTE_ROOM_COLS, NOTE_ROOM_ROWS, TILE_SIZE, THEME } from '../../constants';
import {
  createChar, createWanderer, updateChar, updateWanderer,
  setCharAnim, type CharState, type WandererState, type CharAnim, type Direction,
} from '../engine/characters';
import { getNoteRoomDecorations } from '../decorations';
import type { TileMap, FurnitureSprite, RenderScene } from '../engine/renderer';

export interface EggState {
  coffeeBoost: number;   // scribe types faster (5s)
  coffeeSpark: number;   // ⚡ float above mug (1.5s)
  catMeow: number;       // meow bubble (2.5s)
  catSpin: number;       // cat spins (1s)
  matrix: number;        // monitor goes Matrix (3s)
  plantWiggle: number;   // plant bounces (1.5s)
  disco: number;         // disco floor (8s)
  clockLook: number;     // all chars look right at clock (2s)
  fivePM: number;        // end-of-day mode (30s)
  npcBook: number;       // NPC heads to bookshelf to read (14s)
  bigConfetti: number;   // milestone celebration (3s)
  sudo: number;          // root access bubble (3s)
  hello: number;         // NPCs wave (3s)
}

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

// Safe floor waypoints — avoid desk (cols 7–13, rows 7–9),
// bookshelf (cols 12–18, rows 0–2), and walls
const WAYPOINTS: ReadonlyArray<{ x: number; y: number }> = [
  // Left open floor
  [3, 9], [4, 11], [2, 11], [3, 12], [5, 12], [2, 9], [5, 10],
  // Right open floor
  [17, 9], [18, 11], [20, 11], [19, 12], [17, 12], [20, 9], [16, 10],
  // Top-left area (safely left of bookshelf, which starts at col 12)
  [2, 3], [4, 2], [6, 4], [10, 2], [11, 3],
  // Top-right area (safely right of bookshelf, which ends at col 18)
  [19, 3], [20, 4], [20, 2],
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

export interface NpcDialogue {
  charIdx: number;   // index into scene.characters array
  text: string;
  timer: number;
}

export interface NoteRoomState {
  tileMap: TileMap;
  character: CharState;         // main scribe at desk
  wanderers: SmartWandererState[];   // roaming NPCs
  cat: WandererState;           // canvas-drawn cat (spriteIndex = 6)
  isEditing: boolean;
  time: number;
  celebrateTimer: number;
  eggs: EggState;
  typingWpm: number;
  dialogue?: NpcDialogue;
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
    eggs: {
      coffeeBoost:0, coffeeSpark:0, catMeow:0, catSpin:0, matrix:0,
      plantWiggle:0, disco:0, clockLook:0, fivePM:0, npcBook:0,
      bigConfetti:0, sudo:0, hello:0,
    },
    typingWpm: 0,
    dialogue: undefined,
  };
}

// Walk speed for smart wanderer (px/s)
const SMART_WALK_SPEED = 28;

// Solid obstacles in world-pixel space that NPCs must not walk through.
const OBSTACLES = [
  // Desk body (rows 7–8.5) — row 9+ is open floor in front
  { x1: 7  * TILE_SIZE + 2,  x2: 13 * TILE_SIZE - 2, y1: 7   * TILE_SIZE, y2: 8.5 * TILE_SIZE },
  // Bookshelf (cols 12–18, rows 0–2) — wall-mounted, completely impassable
  { x1: 12 * TILE_SIZE,      x2: 18 * TILE_SIZE,      y1: 0,               y2: 3   * TILE_SIZE },
];

/** Returns true if the straight path from (ax,ay)→(bx,by) passes through any obstacle. */
function pathCrossesDesk(ax: number, ay: number, bx: number, by: number): boolean {
  for (const { x1, x2, y1, y2 } of OBSTACLES) {
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

export function eggCoffeeMug(s: NoteRoomState)  { s.eggs.coffeeBoost=5; s.eggs.coffeeSpark=1.5; }
export function eggCatClick(s: NoteRoomState)   { s.eggs.catMeow=2.5; s.eggs.catSpin=1.0; }
export function eggMonitor(s: NoteRoomState)    { s.eggs.matrix=3.0; }
export function eggPlant(s: NoteRoomState)      { s.eggs.plantWiggle=1.5; }
export function eggBookshelf(s: NoteRoomState)  {
  s.eggs.npcBook=14.0;
  // Force wanderer 0 to walk to bookshelf reading spot
  const w = s.wanderers[0];
  const tx = 15 * TILE_SIZE, ty = 1.5 * TILE_SIZE;
  const dx = tx - w.x, dy = ty - w.y;
  w.targetX = tx; w.targetY = ty; w.waitTimer = 0; w.mode = 'wander';
  const dir: Direction = Math.abs(dx) >= Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up');
  setCharAnim(w, 'walk', dir);
}
export function eggKonami(s: NoteRoomState)     { s.eggs.disco=8.0; }
export function eggSudo(s: NoteRoomState)       { s.eggs.sudo=3.0; }
export function eggHello(s: NoteRoomState)      { s.eggs.hello=3.0; }
export function eggMilestone(s: NoteRoomState)  { s.eggs.bigConfetti=3.0; }

const NPC_QUOTES = [
  "It works on\nmy machine!",
  "Have you tried\nturning it off?",
  "99 bugs in\nthe code...",
  "This is fine.",
  "Fix it later,\nship it now",
  "undefined is\nnot a function",
  "Just one more\nfeature...",
  "git push -f\nshould be ok",
  "Stack Overflow\nto the rescue!",
  "It's not a bug,\nit's a feature",
  "Works in prod?\nShip it!",
  "Have you tried\ncleaning cache?",
];

export function eggNpcClick(s: NoteRoomState, wandererIdx: number): void {
  const quote = NPC_QUOTES[Math.floor(Math.random() * NPC_QUOTES.length)];
  // charIdx: 0=scribe, 1=wanderer0, 2=wanderer1, 3=cat
  s.dialogue = { charIdx: wandererIdx + 1, text: quote, timer: 3.5 };
}

export function setTypingSpeed(s: NoteRoomState, wpm: number): void {
  s.typingWpm = wpm;
}

export function updateNoteRoom(state: NoteRoomState, dt: number): void {
  state.time += dt;

  // Typing speed multiplier — make scribe animate faster when user types fast
  const wpmMult = state.isEditing
    ? (state.typingWpm > 120 ? 3.0 : state.typingWpm > 80 ? 2.0 : state.typingWpm > 40 ? 1.5 : 1.0)
    : 1.0;
  updateChar(state.character, dt * wpmMult);

  for (const w of state.wanderers) updateSmartWanderer(w, dt);
  updateWanderer(state.cat, dt, CAT_WAYPOINTS);
  if (state.celebrateTimer > 0) state.celebrateTimer -= dt;

  // Dialogue bubble timer
  if (state.dialogue) {
    state.dialogue.timer -= dt;
    if (state.dialogue.timer <= 0) state.dialogue = undefined;
  }

  // Decrement egg timers
  const e = state.eggs;
  if (e.coffeeBoost  > 0) e.coffeeBoost  -= dt;
  if (e.coffeeSpark  > 0) e.coffeeSpark  -= dt;
  if (e.catMeow      > 0) e.catMeow      -= dt;
  if (e.catSpin      > 0) e.catSpin      -= dt;
  if (e.matrix       > 0) e.matrix       -= dt;
  if (e.plantWiggle  > 0) e.plantWiggle  -= dt;
  if (e.disco        > 0) e.disco        -= dt;
  if (e.clockLook    > 0) e.clockLook    -= dt;
  if (e.fivePM       > 0) e.fivePM       -= dt;
  if (e.npcBook      > 0) e.npcBook      -= dt;
  if (e.bigConfetti  > 0) e.bigConfetti  -= dt;
  if (e.sudo         > 0) e.sudo         -= dt;
  if (e.hello        > 0) e.hello        -= dt;

  // During hello: all characters face right then idle
  if (e.hello > 0) {
    for (const w of state.wanderers) setCharAnim(w, 'idle', 'right');
  }
  // During clockLook: all chars look right (clock is on right wall)
  if (e.clockLook > 0) {
    setCharAnim(state.character, 'idle', 'right');
    for (const w of state.wanderers) setCharAnim(w, 'idle', 'right');
  }

  // Time-based: clock strikes 12, fire once per event
  const now2 = new Date();
  const rh2 = now2.getHours(), rm2 = now2.getMinutes(), rs2 = now2.getSeconds();
  if ((rh2 === 0 || rh2 === 12) && rm2 === 0 && rs2 < 2 && e.clockLook <= 0) {
    e.clockLook = 2.0;
  }
  if (rh2 === 17 && rm2 === 0 && rs2 < 2 && e.fivePM <= 0) {
    e.fivePM = 30.0;
  }
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
    decorations: getNoteRoomDecorations(state.time, {
      plantWiggle: state.eggs.plantWiggle,
      matrixMode: state.eggs.matrix > 0,
    }),
    time: state.time,
    celebrateTimer: state.celebrateTimer,
    eggs: state.eggs,
    dialogue: state.dialogue,
  };
}
