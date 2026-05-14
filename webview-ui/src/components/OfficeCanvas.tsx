import { useEffect, useRef, useState } from 'react';
import { TILE_SIZE, SCALE, NOTE_ROOM_COLS, NOTE_ROOM_ROWS } from '../constants';
import { createGameLoop } from '../office/engine/gameLoop';
import { renderScene } from '../office/engine/renderer';
import {
  createNoteRoom, updateNoteRoom, setEditing, noteRoomScene,
  eggCoffeeMug, eggCatClick, eggMonitor, eggPlant, eggBookshelf,
  eggKonami, eggSudo, eggHello, eggMilestone, eggNpcClick, setTypingSpeed,
} from '../office/rooms/NoteRoom';
import {
  createBreakRoom, updateBreakRoom, breakRoomScene, toggleTv,
  ARCADE_PONG_REGION, ARCADE_BREAKOUT_REGION, TV_REGION,
  FOOSBALL_REGION, COFFEE_REGION, COUCH_REGION,
  eggFoosball, eggCoffeeRush, eggCouchNap, eggBreakParty,
} from '../office/rooms/BreakRoom';
import type { FurnitureSprite } from '../office/engine/renderer';
import type { RoomId } from '../types';
import { RoomSwitcher } from './RoomSwitcher';

interface Props {
  isEditing: boolean;
  savedAt?: number;
  noteTitle?: string;
  milestoneCount?: number;
  typingWpm?: number;
  snakeMode?: boolean;
  onExitSnake?: () => void;
}

const PIXEL = TILE_SIZE * SCALE;
const W = NOTE_ROOM_COLS * PIXEL;
const H = NOTE_ROOM_ROWS * PIXEL;

// ── Snake ─────────────────────────────────────────────────────────────────────
interface SnakeState {
  cells: { x: number; y: number }[];
  food: { x: number; y: number };
  dir: { x: number; y: number };
  nextDir: { x: number; y: number };
  score: number; best: number;
  gameOver: boolean; stepTimer: number;
}
function makeSnake(): SnakeState {
  const mx = Math.floor(NOTE_ROOM_COLS / 2), my = Math.floor(NOTE_ROOM_ROWS / 2);
  return { cells: [{ x: mx, y: my }, { x: mx - 1, y: my }, { x: mx - 2, y: my }],
    food: { x: 5, y: 5 }, dir: { x: 1, y: 0 }, nextDir: { x: 1, y: 0 },
    score: 0, best: 0, gameOver: false, stepTimer: 0 };
}
function stepSnake(s: SnakeState) {
  if (s.gameOver) return;
  if (s.nextDir.x !== -s.dir.x || s.nextDir.y !== -s.dir.y) s.dir = s.nextDir;
  const h = s.cells[0], n = { x: h.x + s.dir.x, y: h.y + s.dir.y };
  if (n.x < 1 || n.x >= NOTE_ROOM_COLS - 1 || n.y < 1 || n.y >= NOTE_ROOM_ROWS - 1 ||
      s.cells.some(c => c.x === n.x && c.y === n.y)) {
    s.gameOver = true; s.best = Math.max(s.best, s.score); return;
  }
  s.cells.unshift(n);
  if (n.x === s.food.x && n.y === s.food.y) {
    s.score++;
    let fx: number, fy: number;
    do { fx = 1 + Math.floor(Math.random() * (NOTE_ROOM_COLS - 2));
         fy = 1 + Math.floor(Math.random() * (NOTE_ROOM_ROWS - 2));
    } while (s.cells.some(c => c.x === fx && c.y === fy));
    s.food = { x: fx, y: fy };
  } else s.cells.pop();
}
function renderSnake(ctx: CanvasRenderingContext2D, s: SnakeState) {
  ctx.fillStyle = 'rgba(10,10,20,0.93)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#4a3060';
  ctx.fillRect(0, 0, W, PIXEL); ctx.fillRect(0, H - PIXEL, W, PIXEL);
  ctx.fillRect(0, 0, PIXEL, H); ctx.fillRect(W - PIXEL, 0, PIXEL, H);
  for (let i = s.cells.length - 1; i >= 0; i--) {
    const c = s.cells[i], isHead = i === 0;
    ctx.fillStyle = isHead ? '#a6e3a1' : (i % 2 === 0 ? '#2d7040' : '#3d8050');
    ctx.fillRect(c.x * PIXEL + 3, c.y * PIXEL + 3, PIXEL - 6, PIXEL - 6);
    if (isHead) { ctx.fillStyle = '#1e1e2e'; ctx.fillRect(c.x * PIXEL + 10, c.y * PIXEL + 12, 6, 6); ctx.fillRect(c.x * PIXEL + 32, c.y * PIXEL + 12, 6, 6); }
  }
  ctx.fillStyle = '#f38ba8'; ctx.fillRect(s.food.x * PIXEL + 8, s.food.y * PIXEL + 8, PIXEL - 16, PIXEL - 16);
  ctx.fillStyle = '#a6e3a1'; ctx.fillRect(s.food.x * PIXEL + PIXEL / 2 - 2, s.food.y * PIXEL + 4, 3, 10);
  ctx.font = 'bold 16px "Press Start 2P",monospace'; ctx.fillStyle = '#cba6f7'; ctx.textAlign = 'center';
  ctx.fillText(`Score: ${s.score}  Best: ${s.best}`, W / 2, 28);
  if (s.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(0, H / 2 - 64, W, 130);
    ctx.font = 'bold 14px "Press Start 2P",monospace'; ctx.fillStyle = '#f38ba8'; ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 32);
    ctx.font = '10px "Press Start 2P",monospace'; ctx.fillStyle = '#a6e3a1';
    ctx.fillText('[R] Restart   [Esc] Exit', W / 2, H / 2 + 24);
  } else {
    ctx.font = '9px "Press Start 2P",monospace'; ctx.fillStyle = '#585b70'; ctx.textAlign = 'center';
    ctx.fillText('Arrow keys  •  [Esc] Exit', W / 2, H - 10);
  }
}

// ── Pong ──────────────────────────────────────────────────────────────────────
const PH = 80, PW = 10, BALL_BASE = 5;
interface PongState {
  ball: { x: number; y: number; vx: number; vy: number };
  playerY: number; aiY: number;
  playerScore: number; aiScore: number;
  gameOver: boolean; winner: string;
}
function makePong(): PongState {
  const angle = (Math.random() * 0.6 - 0.3);
  const spd = 220;
  return { ball: { x: W / 2, y: H / 2, vx: spd * Math.cos(angle) * (Math.random() < 0.5 ? 1 : -1), vy: spd * Math.sin(angle) },
    playerY: H / 2 - PH / 2, aiY: H / 2 - PH / 2, playerScore: 0, aiScore: 0, gameOver: false, winner: '' };
}
function updatePong(p: PongState, dt: number, playerTarget: number) {
  if (p.gameOver) return;
  const spd = Math.hypot(p.ball.vx, p.ball.vy);
  p.ball.x += p.ball.vx * dt;
  p.ball.y += p.ball.vy * dt;
  // Wall bounce
  if (p.ball.y < BALL_BASE) { p.ball.y = BALL_BASE; p.ball.vy = Math.abs(p.ball.vy); }
  if (p.ball.y > H - BALL_BASE) { p.ball.y = H - BALL_BASE; p.ball.vy = -Math.abs(p.ball.vy); }
  // Player paddle (right)
  p.playerY += (playerTarget - p.playerY - PH / 2) * dt * 12;
  p.playerY = Math.max(0, Math.min(H - PH, p.playerY));
  // AI paddle (left) — tracks with slight lag and imperfection
  const aiTarget = p.ball.y - PH / 2 + (Math.sin(p.ball.x * 0.03) * 20);
  p.aiY += (aiTarget - p.aiY) * dt * 4;
  p.aiY = Math.max(0, Math.min(H - PH, p.aiY));
  // Paddle collision — player (right)
  const px = W - PW - 20;
  if (p.ball.x >= px && p.ball.y >= p.playerY && p.ball.y <= p.playerY + PH && p.ball.vx > 0) {
    p.ball.vx = -(spd * 1.05);
    p.ball.vy = ((p.ball.y - (p.playerY + PH / 2)) / (PH / 2)) * spd * 0.8;
    p.ball.x = px - 1;
  }
  // AI (left)
  const ax = PW + 20;
  if (p.ball.x <= ax && p.ball.y >= p.aiY && p.ball.y <= p.aiY + PH && p.ball.vx < 0) {
    p.ball.vx = spd * 1.05;
    p.ball.vy = ((p.ball.y - (p.aiY + PH / 2)) / (PH / 2)) * spd * 0.8;
    p.ball.x = ax + 1;
  }
  // Score
  if (p.ball.x < 0) { p.playerScore++; if (p.playerScore >= 5) { p.gameOver = true; p.winner = 'YOU WIN!'; } else Object.assign(p.ball, makePong().ball); }
  if (p.ball.x > W) { p.aiScore++;    if (p.aiScore    >= 5) { p.gameOver = true; p.winner = 'AI WINS';  } else Object.assign(p.ball, makePong().ball); }
}
function renderPong(ctx: CanvasRenderingContext2D, p: PongState) {
  ctx.fillStyle = '#0a0a14'; ctx.fillRect(0, 0, W, H);
  // Centre line
  ctx.setLineDash([10, 10]); ctx.strokeStyle = '#333'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke(); ctx.setLineDash([]);
  // Paddles
  ctx.fillStyle = '#a6e3a1';
  ctx.fillRect(W - PW - 20, p.playerY, PW, PH);  // player
  ctx.fillStyle = '#f38ba8';
  ctx.fillRect(20, p.aiY, PW, PH);                // AI
  // Ball
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(Math.round(p.ball.x) - 6, Math.round(p.ball.y) - 6, 12, 12);
  // Scores
  ctx.font = 'bold 28px "Press Start 2P",monospace'; ctx.textAlign = 'center';
  ctx.fillStyle = '#f38ba8'; ctx.fillText(`${p.aiScore}`, W / 2 - 60, 44);
  ctx.fillStyle = '#a6e3a1'; ctx.fillText(`${p.playerScore}`, W / 2 + 60, 44);
  ctx.font = '9px "Press Start 2P",monospace'; ctx.fillStyle = '#444';
  ctx.fillText('AI', W / 2 - 60, 60); ctx.fillText('YOU', W / 2 + 60, 60);
  if (p.gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, H / 2 - 70, W, 140);
    ctx.font = 'bold 18px "Press Start 2P",monospace';
    ctx.fillStyle = p.winner.startsWith('YOU') ? '#a6e3a1' : '#f38ba8';
    ctx.textAlign = 'center'; ctx.fillText(p.winner, W / 2, H / 2 - 20);
    ctx.font = '10px "Press Start 2P",monospace'; ctx.fillStyle = '#cdd6f4';
    ctx.fillText('[R] Rematch   [Esc] Exit', W / 2, H / 2 + 24);
  } else {
    ctx.font = '9px "Press Start 2P",monospace'; ctx.fillStyle = '#333'; ctx.textAlign = 'center';
    ctx.fillText('Move mouse  •  [Esc] Exit', W / 2, H - 10);
  }
}

// ── Breakout ──────────────────────────────────────────────────────────────────
interface BreakoutBlock { x: number; y: number; alive: boolean; color: string; pts: number; }
interface BreakoutState {
  paddle: number; ball: { x: number; y: number; vx: number; vy: number };
  blocks: BreakoutBlock[]; lives: number; score: number; gameOver: boolean; won: boolean;
  launched: boolean;
}
const BK_ROWS = 6, BK_COLS = 10, BK_W = (W - 40) / BK_COLS, BK_H = 22, PAD_W = 90, PAD_H = 12;
const BK_COLORS = ['#f38ba8','#fab387','#f9e2af','#a6e3a1','#89b4fa','#cba6f7'];
function makeBreakout(): BreakoutState {
  const blocks: BreakoutBlock[] = [];
  for (let r = 0; r < BK_ROWS; r++)
    for (let c = 0; c < BK_COLS; c++)
      blocks.push({ x: 20 + c * BK_W, y: 60 + r * (BK_H + 4), alive: true, color: BK_COLORS[r], pts: (BK_ROWS - r) * 10 });
  return { paddle: W / 2 - PAD_W / 2, ball: { x: W / 2, y: H - 80, vx: 180, vy: -220 },
    blocks, lives: 3, score: 0, gameOver: false, won: false, launched: false };
}
function updateBreakout(b: BreakoutState, dt: number, paddleTarget: number) {
  if (b.gameOver || b.won) return;
  b.paddle += (paddleTarget - b.paddle - PAD_W / 2) * dt * 14;
  b.paddle  = Math.max(0, Math.min(W - PAD_W, b.paddle));
  if (!b.launched) { b.ball.x = b.paddle + PAD_W / 2; return; }
  b.ball.x += b.ball.vx * dt; b.ball.y += b.ball.vy * dt;
  if (b.ball.x < 6)  { b.ball.x = 6;  b.ball.vx =  Math.abs(b.ball.vx); }
  if (b.ball.x > W - 6) { b.ball.x = W - 6; b.ball.vx = -Math.abs(b.ball.vx); }
  if (b.ball.y < 6)  { b.ball.y = 6;  b.ball.vy =  Math.abs(b.ball.vy); }
  // Paddle
  const py = H - 60;
  if (b.ball.y >= py && b.ball.y <= py + PAD_H && b.ball.x >= b.paddle && b.ball.x <= b.paddle + PAD_W && b.ball.vy > 0) {
    const rel = (b.ball.x - b.paddle) / PAD_W - 0.5;
    const spd = Math.hypot(b.ball.vx, b.ball.vy) * 1.02;
    b.ball.vx = spd * rel * 2;
    b.ball.vy = -Math.abs(spd * Math.sqrt(Math.max(0, 1 - rel * rel * 4)));
    b.ball.y  = py - 1;
  }
  // Blocks
  for (const bl of b.blocks) {
    if (!bl.alive) continue;
    if (b.ball.x > bl.x && b.ball.x < bl.x + BK_W && b.ball.y > bl.y && b.ball.y < bl.y + BK_H) {
      bl.alive = false; b.score += bl.pts; b.ball.vy *= -1; break;
    }
  }
  // Fall off bottom
  if (b.ball.y > H) { b.lives--; if (b.lives <= 0) b.gameOver = true; else { b.launched = false; b.ball = { x: b.paddle + PAD_W / 2, y: H - 80, vx: 180, vy: -220 }; } }
  if (b.blocks.every(bl => !bl.alive)) b.won = true;
}
function renderBreakout(ctx: CanvasRenderingContext2D, b: BreakoutState) {
  ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, W, H);
  // Blocks
  for (const bl of b.blocks) {
    if (!bl.alive) continue;
    ctx.fillStyle = bl.color; ctx.fillRect(bl.x + 2, bl.y + 2, BK_W - 4, BK_H - 4);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(bl.x + 2, bl.y + 2, BK_W - 4, 4);
  }
  // Paddle
  ctx.fillStyle = '#89b4fa'; ctx.fillRect(b.paddle, H - 60, PAD_W, PAD_H);
  ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(b.paddle + 2, H - 60, PAD_W - 4, 4);
  // Ball
  ctx.fillStyle = '#ffffff'; ctx.beginPath();
  ctx.arc(b.ball.x, b.ball.y, 8, 0, Math.PI * 2); ctx.fill();
  // HUD
  ctx.font = 'bold 14px "Press Start 2P",monospace'; ctx.fillStyle = '#cba6f7'; ctx.textAlign = 'left';
  ctx.fillText(`${b.score}`, 14, 28);
  ctx.fillStyle = '#f38ba8'; ctx.textAlign = 'right';
  ctx.fillText('❤'.repeat(b.lives), W - 14, 28);
  if (!b.launched) {
    ctx.font = '10px "Press Start 2P",monospace'; ctx.fillStyle = '#a6e3a1'; ctx.textAlign = 'center';
    ctx.fillText('[Space] or [Click] to Launch', W / 2, H - 24);
  }
  if (b.gameOver || b.won) {
    ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, H / 2 - 70, W, 140);
    ctx.font = 'bold 16px "Press Start 2P",monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = b.won ? '#a6e3a1' : '#f38ba8';
    ctx.fillText(b.won ? 'YOU WIN!' : 'GAME OVER', W / 2, H / 2 - 20);
    ctx.font = '10px "Press Start 2P",monospace'; ctx.fillStyle = '#cdd6f4';
    ctx.fillText(`Score: ${b.score}`, W / 2, H / 2 + 10);
    ctx.fillStyle = '#a6e3a1'; ctx.fillText('[R] Again   [Esc] Exit', W / 2, H / 2 + 36);
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
type ArcadeGame = 'pong' | 'breakout' | null;

export function OfficeCanvas({ isEditing, savedAt, noteTitle, milestoneCount, typingWpm, snakeMode, onExitSnake }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [room, setRoom] = useState<RoomId>('note');
  const roomRef   = useRef<RoomId>('note');   // kept for game-loop closure reads
  const [activeGame, setActiveGame] = useState<'pong' | 'breakout' | 'snake' | null>(null);
  // Stable ref so the game-loop closure can call setActiveGame without capturing a stale value
  const setActiveGameRef = useRef(setActiveGame);
  const mouseRef  = useRef({ x: W / 2, y: H / 2 });

  const stateRef  = useRef({
    noteRoom:    createNoteRoom(),
    breakRoom:   createBreakRoom(),
    charImages:  new Map<number, HTMLImageElement>(),
    furniture:   [] as FurnitureSprite[],
    snake:       makeSnake(),
    snakeActive: false,
    arcade:      null as ArcadeGame,
    pong:        makePong(),
    breakout:    makeBreakout(),
  });

  useEffect(() => { setEditing(stateRef.current.noteRoom, isEditing); }, [isEditing]);
  useEffect(() => { if (savedAt) stateRef.current.noteRoom.celebrateTimer = 1.8; }, [savedAt]);
  useEffect(() => {
    const t = (noteTitle ?? '').trim().toLowerCase();
    if (t === 'sudo')  eggSudo(stateRef.current.noteRoom);
    if (t === 'hello') eggHello(stateRef.current.noteRoom);
  }, [noteTitle]);
  useEffect(() => { if (milestoneCount) eggMilestone(stateRef.current.noteRoom); }, [milestoneCount]);
  useEffect(() => { if (typingWpm !== undefined) setTypingSpeed(stateRef.current.noteRoom, typingWpm); }, [typingWpm]);
  useEffect(() => {
    if (snakeMode) {
      const b = stateRef.current.snake.best;
      stateRef.current.snake = makeSnake();
      stateRef.current.snake.best = b;
      stateRef.current.snakeActive = true;
      setActiveGame('snake');
    } else {
      stateRef.current.snakeActive = false;
      setActiveGame(g => g === 'snake' ? null : g);
    }
  }, [snakeMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const s = stateRef.current;

    const charBase = (window as unknown as Record<string, string>)['__CHAR_BASE__'];
    if (charBase) for (let i = 0; i < 6; i++) { const img = new Image(); img.src = `${charBase}/char_${i}.png`; s.charImages.set(i, img); }

    const loop = createGameLoop(
      (dt) => {
        if (s.snakeActive) { s.snake.stepTimer += dt; if (s.snake.stepTimer >= 0.15) { s.snake.stepTimer -= 0.15; stepSnake(s.snake); } return; }
        if (s.arcade === 'pong')     { updatePong(s.pong, dt, mouseRef.current.y); return; }
        if (s.arcade === 'breakout') { updateBreakout(s.breakout, dt, mouseRef.current.x); return; }
        if (roomRef.current === 'note') updateNoteRoom(s.noteRoom, dt);
        else updateBreakRoom(s.breakRoom, dt);
      },
      () => {
        ctx.imageSmoothingEnabled = false; ctx.clearRect(0, 0, W, H);
        if (s.snakeActive)           { renderSnake(ctx, s.snake);       return; }
        if (s.arcade === 'pong')     { renderPong(ctx, s.pong);         return; }
        if (s.arcade === 'breakout') { renderBreakout(ctx, s.breakout); return; }
        if (roomRef.current === 'note') renderScene(ctx, noteRoomScene(s.noteRoom, s.furniture, s.charImages));
        else                            renderScene(ctx, breakRoomScene(s.breakRoom, s.charImages));
      }
    );
    loop.start();

    // Mouse tracking for Pong / Breakout
    function onMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: (e.clientX - rect.left) * (W / rect.width),
        y: (e.clientY - rect.top)  * (H / rect.height),
      };
    }
    canvas.addEventListener('mousemove', onMouseMove);

    // Canvas click
    function tileAt(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      return { col: (e.clientX - rect.left) * (W / rect.width) / PIXEL,
               row: (e.clientY - rect.top)  * (H / rect.height) / PIXEL };
    }
    function inRegion(col: number, row: number, reg: { col1: number; col2: number; row1: number; row2: number }) {
      return col >= reg.col1 && col <= reg.col2 && row >= reg.row1 && row <= reg.row2;
    }
    function onCanvasClick(e: MouseEvent) {
      // Breakout: launch ball
      if (s.arcade === 'breakout' && !s.breakout.gameOver && !s.breakout.won) { s.breakout.launched = true; return; }
      if (s.snakeActive || s.arcade) return;
      const { col, row } = tileAt(e);
      if (roomRef.current === 'note') {
        if (col >= 7.0 && col <= 7.8 && row >= 7.0 && row <= 7.6) { eggCoffeeMug(s.noteRoom); return; }
        if (col >= 9   && col <= 11  && row >= 5   && row <= 7)   { eggMonitor(s.noteRoom);   return; }
        if (col >= 18  && col <= 20  && row >= 10  && row <= 12)  { eggPlant(s.noteRoom);     return; }
        if (col >= 12  && col <= 18  && row >= 0   && row <= 3)   { eggBookshelf(s.noteRoom); return; }
        for (let wi = 0; wi < s.noteRoom.wanderers.length; wi++) {
          const w = s.noteRoom.wanderers[wi];
          if (Math.hypot(col - w.x / TILE_SIZE, row - w.y / TILE_SIZE) < 1.5) { eggNpcClick(s.noteRoom, wi); return; }
        }
        const cat = s.noteRoom.cat;
        if (Math.hypot(col - cat.x / TILE_SIZE, row - cat.y / TILE_SIZE) < 1.5) { eggCatClick(s.noteRoom); return; }
      } else {
        // Break room interactions
        if (inRegion(col, row, TV_REGION))              { toggleTv(s.breakRoom);         return; }
        if (inRegion(col, row, ARCADE_PONG_REGION))     { s.arcade = 'pong';     s.pong     = makePong();     setActiveGameRef.current('pong');     return; }
        if (inRegion(col, row, ARCADE_BREAKOUT_REGION)) { s.arcade = 'breakout'; s.breakout = makeBreakout(); setActiveGameRef.current('breakout'); return; }
        // Easter eggs
        if (inRegion(col, row, FOOSBALL_REGION)) { eggFoosball(s.breakRoom);   return; }
        if (inRegion(col, row, COFFEE_REGION))   { eggCoffeeRush(s.breakRoom); return; }
        if (inRegion(col, row, COUCH_REGION))    { eggCouchNap(s.breakRoom);   return; }
      }
    }
    canvas.addEventListener('click', onCanvasClick);

    // Keyboard
    const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    const keyBuf: string[] = [];
    function onKey(e: KeyboardEvent) {
      const s2 = stateRef.current;
      if (s2.snakeActive) {
        if (e.key === 'ArrowUp'   || e.key === 'w') s2.snake.nextDir = { x: 0, y: -1 };
        if (e.key === 'ArrowDown' || e.key === 's') s2.snake.nextDir = { x: 0, y:  1 };
        if (e.key === 'ArrowLeft' || e.key === 'a') s2.snake.nextDir = { x:-1, y:  0 };
        if (e.key === 'ArrowRight'|| e.key === 'd') s2.snake.nextDir = { x: 1, y:  0 };
        if (e.key === 'r' || e.key === 'R') { const b2 = s2.snake.best; Object.assign(s2.snake, makeSnake()); s2.snake.best = b2; }
        if (e.key === 'Escape') onExitSnake?.();
        return;
      }
      if (s2.arcade === 'pong') {
        if (e.key === 'Escape') { s2.arcade = null; setActiveGameRef.current(null); }
        if ((e.key === 'r' || e.key === 'R') && s2.pong.gameOver) s2.pong = makePong();
        return;
      }
      if (s2.arcade === 'breakout') {
        if (e.key === 'Escape') { s2.arcade = null; setActiveGameRef.current(null); }
        if ((e.key === 'r' || e.key === 'R') && (s2.breakout.gameOver || s2.breakout.won)) s2.breakout = makeBreakout();
        if (e.key === ' ') s2.breakout.launched = true;
        return;
      }
      keyBuf.push(e.key);
      if (keyBuf.length > KONAMI.length) keyBuf.shift();
      if (keyBuf.length === KONAMI.length && keyBuf.every((k, i) => k === KONAMI[i])) {
        if (roomRef.current === 'break') eggBreakParty(s2.breakRoom);
        else eggKonami(s2.noteRoom);
        keyBuf.length = 0;
      }
    }
    window.addEventListener('keydown', onKey);

    return () => { loop.stop(); canvas.removeEventListener('click', onCanvasClick); canvas.removeEventListener('mousemove', onMouseMove); window.removeEventListener('keydown', onKey); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRoomSwitch(r: RoomId) {
    roomRef.current = r;            // game loop reads this without triggering a re-render
    setRoom(r);                     // triggers re-render so active tab highlight updates
    stateRef.current.arcade = null; // exit any active arcade game when switching rooms
    setActiveGame(g => (g === 'pong' || g === 'breakout') ? null : g);
  }

  function handleExitGame() {
    if (activeGame === 'snake') {
      onExitSnake?.();
    } else {
      stateRef.current.arcade = null;
      setActiveGame(null);
    }
  }

  return (
    <div className="office-canvas-wrapper">
      <RoomSwitcher room={room} onSwitch={handleRoomSwitch} />
      <div className="canvas-game-area">
        <canvas
          ref={canvasRef}
          width={W} height={H}
          style={{ width: '100%', height: 'auto', imageRendering: 'pixelated', display: 'block' }}
        />
        {activeGame && (
          <button className="game-exit-btn" onClick={handleExitGame} title="Exit game (Esc)">
            ✕ Exit
          </button>
        )}
      </div>
    </div>
  );
}
