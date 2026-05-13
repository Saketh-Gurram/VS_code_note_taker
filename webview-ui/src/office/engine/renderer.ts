import { TILE_SIZE, SCALE, THEME } from '../../constants';
import type { CharState } from './characters';
import { getFrameRect, CHAR_FRAME_W, CHAR_FRAME_H } from './characters';
import type { Decoration } from '../decorations';
import type { EggState } from '../rooms/NoteRoom';

export interface TileMap {
  cols: number;
  rows: number;
  // 0 = void, 1 = floor, 2 = wall
  tiles: number[];
}

export interface FurnitureSprite {
  image: HTMLImageElement;
  x: number;  // tile col
  y: number;  // tile row
  w: number;  // tile width
  h: number;  // tile height
  zY: number; // sort key
}

export interface RenderScene {
  tileMap: TileMap;
  furniture: FurnitureSprite[];
  characters: CharState[];
  charImages: Map<number, HTMLImageElement>;
  floorColor: string;
  wallColor: string;
  decorations?: Decoration[];
  time?: number; // elapsed seconds, for animated canvas characters (cat)
  celebrateTimer?: number; // countdown for celebration sparkle effect
  eggs?: EggState;
}

const PIXEL = TILE_SIZE * SCALE;

export function renderScene(ctx: CanvasRenderingContext2D, scene: RenderScene): void {
  const { tileMap, furniture, characters, charImages } = scene;

  ctx.imageSmoothingEnabled = false;

  // Draw tiles
  for (let row = 0; row < tileMap.rows; row++) {
    for (let col = 0; col < tileMap.cols; col++) {
      const tile = tileMap.tiles[row * tileMap.cols + col];
      const x = col * PIXEL;
      const y = row * PIXEL;

      if (tile === 1) {
        // Floor — alternating subtle checker
        const light = (col + row) % 2 === 0;
        ctx.fillStyle = light ? scene.floorColor : darken(scene.floorColor, 0.06);
        ctx.fillRect(x, y, PIXEL, PIXEL);
      } else if (tile === 2) {
        // Wall
        ctx.fillStyle = scene.wallColor;
        ctx.fillRect(x, y, PIXEL, PIXEL);
        // Top highlight
        ctx.fillStyle = lighten(scene.wallColor, 0.15);
        ctx.fillRect(x, y, PIXEL, Math.round(PIXEL * 0.1));
      }
    }
  }

  // Z-sort drawables (decorations + furniture + characters) by y-bottom
  const drawables: Array<{ zY: number; draw: () => void }> = [];

  for (const dec of scene.decorations ?? []) {
    drawables.push({ zY: dec.zY, draw: () => dec.draw(ctx) });
  }

  for (const furn of furniture) {
    drawables.push({
      zY: (furn.y + furn.h) * PIXEL,
      draw: () => drawFurniture(ctx, furn),
    });
  }

  const time = scene.time ?? 0;
  for (const char of characters) {
    drawables.push({
      zY: char.y * SCALE + CHAR_FRAME_H * SCALE * 0.5,
      draw: () => drawCharacter(ctx, char, charImages, time),
    });
  }

  drawables.sort((a, b) => a.zY - b.zY);
  for (const d of drawables) d.draw();

  // Celebration sparkle effect
  if (scene.celebrateTimer && scene.celebrateTimer > 0) {
    const scribe = characters[0]; // main character is first
    if (scribe) {
      const progress = 1.8 - scene.celebrateTimer; // 0 → 1.8
      const sparkColors = ['#f9e2af', '#a6e3a1', '#89b4fa', '#cba6f7'];
      const cx3 = Math.round(scribe.x * SCALE);
      const cy3 = Math.round(scribe.y * SCALE - CHAR_FRAME_H * SCALE * 0.5);
      ctx.save();
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const dist2 = progress * 40;
        const sx2 = cx3 + Math.cos(angle) * dist2;
        const sy2 = cy3 + Math.sin(angle) * dist2;
        const alpha = Math.max(0, 1 - progress / 1.8);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = sparkColors[i % sparkColors.length];
        ctx.fillRect(Math.round(sx2) - 2, Math.round(sy2) - 2, 4, 4);
      }
      ctx.restore();
    }
  }

  // ── Easter egg overlays ──────────────────────────────────────────────────────
  const eggs = scene.eggs;
  if (eggs) {
    // Disco floor: rainbow semi-transparent tile overlay
    if (eggs.disco > 0) {
      const progress = eggs.disco / 8.0;
      ctx.save();
      ctx.globalAlpha = 0.28 * Math.min(1, progress * 4); // fade in/out
      for (let row = 1; row < tileMap.rows - 1; row++) {
        for (let col = 1; col < tileMap.cols - 1; col++) {
          const tile = tileMap.tiles[row * tileMap.cols + col];
          if (tile !== 1) continue;
          const hue = ((col + row) * 22 + (time ?? 0) * 80) % 360;
          ctx.fillStyle = `hsl(${hue},90%,60%)`;
          ctx.fillRect(col * PIXEL, row * PIXEL, PIXEL, PIXEL);
        }
      }
      ctx.restore();
    }

    // Big confetti (milestone) - rain from top of canvas
    if (eggs.bigConfetti > 0) {
      const prog = 3.0 - eggs.bigConfetti;
      const confColors = ['#f9e2af','#a6e3a1','#89b4fa','#cba6f7','#f38ba8','#94e2d5'];
      ctx.save();
      for (let i = 0; i < 24; i++) {
        const angle = (i / 24) * Math.PI * 2;
        const spd = 60 + (i % 4) * 20;
        const cx4 = Math.round(tileMap.cols * PIXEL / 2 + Math.cos(angle) * prog * spd);
        const cy4 = Math.round(prog * spd * 0.8 + Math.sin(i) * 10);
        const alpha = Math.max(0, 1 - prog / 3.0);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = confColors[i % confColors.length];
        ctx.fillRect(cx4 - 3, cy4 - 3, 6, 6);
      }
      ctx.restore();
    }

    // Meow bubble above cat
    if (eggs.catMeow > 0 && characters[2]) {
      const cat = characters[2]; // cat is index 2 in NoteRoomState
      const bx = Math.round(cat.x * SCALE) - 24;
      const by = Math.round(cat.y * SCALE) - 52;
      ctx.save();
      ctx.globalAlpha = Math.min(1, eggs.catMeow);
      // Bubble background
      ctx.fillStyle = '#f5e8d0';
      ctx.fillRect(bx, by, 52, 18);
      ctx.strokeStyle = '#3d2010';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, 52, 18);
      // Bubble tail
      ctx.fillStyle = '#f5e8d0';
      ctx.fillRect(bx + 6, by + 17, 6, 6);
      ctx.fillStyle = '#3d2010';
      ctx.fillRect(bx + 6, by + 23, 6, 2);
      // Text
      ctx.font = `bold ${3 * SCALE}px monospace`;
      ctx.fillStyle = '#1e1e2e';
      ctx.textAlign = 'center';
      ctx.fillText('meow ~', bx + 26, by + 13);
      ctx.restore();
    }

    // Sudo bubble above scribe
    if (eggs.sudo > 0 && characters[0]) {
      const scribe = characters[0];
      const bx2 = Math.round(scribe.x * SCALE) - 52;
      const by2 = Math.round(scribe.y * SCALE) - 80;
      ctx.save();
      ctx.globalAlpha = Math.min(1, eggs.sudo);
      ctx.fillStyle = '#1e1e2e';
      ctx.fillRect(bx2, by2, 108, 20);
      ctx.strokeStyle = '#a6e3a1';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx2, by2, 108, 20);
      ctx.font = `bold ${3 * SCALE}px monospace`;
      ctx.fillStyle = '#a6e3a1';
      ctx.textAlign = 'center';
      ctx.fillText('root access granted', bx2 + 54, by2 + 14);
      ctx.restore();
    }

    // Coffee spark ⚡ floating above mug position
    if (eggs.coffeeSpark > 0) {
      const mugX = 7 * PIXEL + 14, mugY = 7 * PIXEL + 12;
      const phase = 1.5 - eggs.coffeeSpark;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - phase / 1.5);
      ctx.font = `bold ${5 * SCALE}px monospace`;
      ctx.fillStyle = '#f9e2af';
      ctx.textAlign = 'center';
      ctx.fillText('⚡', mugX + 11, mugY - phase * 30);
      ctx.restore();
    }
  }
}

function drawFurniture(ctx: CanvasRenderingContext2D, furn: FurnitureSprite): void {
  const x = furn.x * PIXEL;
  const y = furn.y * PIXEL;
  const w = furn.w * PIXEL;
  const h = furn.h * PIXEL;
  ctx.drawImage(furn.image, x, y, w, h);
}

// Canvas-fallback palette per character index
const CHAR_SKIN  = ['#f5c5a3','#c68642','#f5c5a3','#8d5524','#f5c5a3','#c68642'];
const CHAR_SHIRT = ['#89b4fa','#a6e3a1','#cba6f7','#f38ba8','#f9e2af','#94e2d5'];
const CHAR_HAIR  = ['#1e1e2e','#6b3a2a','#c4a35a','#1e1e2e','#5a3e85','#2d4a1e'];

// ── Cat (spriteIndex === 6, canvas-drawn) ──────────────────────────────────────
function drawCat(ctx: CanvasRenderingContext2D, char: CharState, time: number): void {
  ctx.save();
  const P = 5; // art-pixels; cat is intentionally smaller than humans
  const cx = Math.round(char.x * SCALE);
  const cy = Math.round(char.y * SCALE - 12 * P);

  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(cx + x * P, cy + y * P, w * P, h * P);
  };

  const facing = char.dir;
  const walking = char.anim === 'walk';
  const walkBob = walking ? Math.floor(char.frame / 2) % 2 : 0; // subtle bob

  // Body
  px(-3, 4 + walkBob, 6, 4, '#9e7a5a');
  px(-3, 4 + walkBob, 6, 1, '#c4a07a'); // top sheen
  px(-3, 7 + walkBob, 6, 1, '#6e4e34'); // bottom shadow

  // Legs — alternate when walking
  if (walking) {
    const a = char.frame % 2 === 0;
    px(-2, 8 + walkBob, 1, 2, a ? '#7a5a3a' : '#5a3a1a');
    px( 0, 8 + walkBob, 1, 2, a ? '#5a3a1a' : '#7a5a3a');
    px( 1, 8 + walkBob, 1, 2, a ? '#7a5a3a' : '#5a3a1a');
  } else {
    px(-2, 8, 1, 2, '#7a5a3a');
    px( 0, 8, 1, 2, '#7a5a3a');
    px( 1, 8, 1, 2, '#7a5a3a');
  }

  // Head
  px(-2, 0 + walkBob, 5, 4, '#9e7a5a');
  px(-2, 0 + walkBob, 5, 1, '#c4a07a');

  // Ears
  px(-2, -2 + walkBob, 2, 2, '#9e7a5a');
  px( 1, -2 + walkBob, 2, 2, '#9e7a5a');
  px(-1, -1 + walkBob, 1, 1, '#f0b0b0'); // inner ear
  px( 2, -1 + walkBob, 1, 1, '#f0b0b0');

  if (facing !== 'up') {
    // Eyes
    const blink = Math.floor(time * 0.7) % 9 === 8;
    if (!blink) {
      px(-1, 1 + walkBob, 1, 1, '#1e1e2e');
      px( 1, 1 + walkBob, 1, 1, '#1e1e2e');
      // eye shine
      px(-1, 1 + walkBob, 1, 1, '#1e1e2e');
    } else {
      px(-1, 2 + walkBob, 2, 1, '#7a5a3a'); // closed eyes
    }
    // Nose + whiskers
    px( 0, 3 + walkBob, 1, 1, '#f08080');
    px(-3, 2 + walkBob, 2, 1, '#c4a07a'); // left whisker
    px( 2, 2 + walkBob, 2, 1, '#c4a07a'); // right whisker
  }

  // Tail — sways based on time
  const swing = Math.round(Math.sin(time * 3.0) * 1.5);
  if (facing === 'left' || facing === 'down') {
    px( 3, 5 + walkBob, 2, 1, '#9e7a5a');
    px( 4 + swing, 3 + walkBob, 1, 2, '#9e7a5a');
    px( 4 + swing, 2 + walkBob, 2, 1, '#c4a07a'); // tip
  } else {
    px(-4, 5 + walkBob, 2, 1, '#9e7a5a');
    px(-5 + swing, 3 + walkBob, 1, 2, '#9e7a5a');
    px(-6 + swing, 2 + walkBob, 2, 1, '#c4a07a');
  }

  ctx.restore();
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  char: CharState,
  images: Map<number, HTMLImageElement>,
  time: number
): void {
  // Cat is drawn entirely with canvas code
  if (char.spriteIndex === 6) { drawCat(ctx, char, time); return; }

  ctx.save();

  const dw = CHAR_FRAME_W * SCALE;
  const dh = CHAR_FRAME_H * SCALE;
  const dx = Math.round(char.x * SCALE - dw / 2);
  const dy = Math.round(char.y * SCALE - dh * 0.8);

  const img = images.get(char.spriteIndex);
  if (img && img.naturalWidth > 0) {
    // PNG sprite sheet: 7 cols × 3 rows, 16×32 px each
    // LEFT direction is a horizontal flip of RIGHT
    const { sx, sy } = getFrameRect(char);
    ctx.imageSmoothingEnabled = false;
    if (char.dir === 'left') {
      ctx.save();
      ctx.translate(dx + dw, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, CHAR_FRAME_W, CHAR_FRAME_H, 0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(img, sx, sy, CHAR_FRAME_W, CHAR_FRAME_H, dx, dy, dw, dh);
    }
  } else {
    // Canvas fallback — drawn pixel-by-pixel at P=4 per art-pixel
    const P = 4;
    const cx = Math.round(char.x * SCALE);
    const cy = Math.round(char.y * SCALE - 17 * P);
    const isTyping = char.anim === 'type';
    const facingUp = char.dir === 'up';
    const walkFrame = char.frame % 2; // 0 or 1 for leg alternation
    const skin  = CHAR_SKIN [char.spriteIndex % CHAR_SKIN.length];
    const shirt = CHAR_SHIRT[char.spriteIndex % CHAR_SHIRT.length];
    const hair  = CHAR_HAIR [char.spriteIndex % CHAR_HAIR.length];

    const px = (x: number, y: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect(cx + x * P, cy + y * P, w * P, h * P);
    };

    // Legs — alternate for walk, static for idle/type
    if (char.anim === 'walk') {
      px(-2, 11, 2, 5, walkFrame === 0 ? '#45475a' : '#2a2c3a');
      px( 1, 11, 2, 5, walkFrame === 0 ? '#2a2c3a' : '#45475a');
      px(-3, 15, 3, 2, '#1e1e2e');
      px( 1, 15, 3, 2, '#1e1e2e');
    } else {
      px(-2, 11, 2, 5, '#45475a');
      px( 1, 11, 2, 5, '#45475a');
      px(-3, 15, 3, 2, '#1e1e2e');
      px( 1, 15, 3, 2, '#1e1e2e');
    }

    px(-3, 5, 7, 7, shirt); // body

    // Arms
    if (isTyping) {
      px(-5, 5, 2, 5, skin); px( 4, 5, 2, 5, skin);
    } else {
      px(-5, 5, 2, 6, skin); px(-5, 10, 2, 2, skin);
      px( 4, 5, 2, 6, skin); px( 4, 10, 2, 2, skin);
    }

    px(-3, 0, 7, 6, skin); // head
    px(-3, 0, 7, 2, hair); // hair
    px(-3, 0, 1, 4, hair);

    if (!facingUp) {
      px(-2, 2, 2, 2, '#1e1e2e'); px( 1, 2, 2, 2, '#1e1e2e'); // eyes
      px(-1, 2, 1, 1, '#cdd6f4'); px( 2, 2, 1, 1, '#cdd6f4'); // shine
      px(-1, 5, 3, 1, isTyping ? '#1e1e2e' : '#c68642');       // mouth
    } else {
      px(-2, 1, 5, 3, hair); // back of head
    }
  }

  if (char.label) {
    ctx.font = `bold ${4 * SCALE}px "Press Start 2P", monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = THEME.ACCENT_LIGHT;
    ctx.fillText(char.label, Math.round(char.x * SCALE), dy - 4);
  }

  ctx.restore();
}

function darken(hex: string, amount: number): string {
  return adjustBrightness(hex, -amount);
}

function lighten(hex: string, amount: number): string {
  return adjustBrightness(hex, amount);
}

function adjustBrightness(hex: string, delta: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v + delta * 255)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}
