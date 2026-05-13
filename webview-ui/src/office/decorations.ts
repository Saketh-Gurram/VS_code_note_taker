import { TILE_SIZE, SCALE } from '../constants';

const P = TILE_SIZE * SCALE; // 48 px per tile

function r(ctx: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export interface Decoration {
  zY: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

// Character at row 10 has zY = (10.5×16×3) + 36 = 540.
// Desk, monitor, lamp, mug, desk front, chair all draw BEFORE character (zY < 540).
export function getNoteRoomDecorations(time: number): Decoration[] {
  const now = new Date();
  const realHour = now.getHours();
  const realMin = now.getMinutes();
  return [
    { zY: 0,        draw: (c) => drawWindow(c, time, realHour, realMin) },
    { zY: P * 0.8,  draw: (c) => drawWhiteboard(c) },
    { zY: P * 0.9,  draw: (c) => drawClock(c, time, realHour, realMin) },
    { zY: P * 1.5,  draw: (c) => drawBookshelf(c) },
    { zY: P * 4,    draw: (c) => drawRug(c) },
    { zY: P * 4.8,  draw: (c) => drawSofaLeft(c) },
    { zY: P * 4.8,  draw: (c) => drawSofaRight(c) },
    { zY: P * 5.5,  draw: (c) => drawDeskSurface(c) },
    { zY: P * 5.6,  draw: (c) => drawMonitor(c, time) },
    { zY: P * 5.7,  draw: (c) => drawLamp(c) },
    { zY: P * 5.8,  draw: (c) => drawCoffeeMug(c, time) },
    { zY: P * 9.5,  draw: (c) => drawDeskFront(c) },
    { zY: P * 9.8,  draw: (c) => drawChair(c) },         // chair in front of desk
    // ── character renders here at zY ≈ 540 ──
    { zY: P * 11.5, draw: (c) => drawPlant(c) },
  ];
}

// ── Window ────────────────────────────────────────────────────────────────────
// Position: cols 2–9, row 0  →  x=96, y=0, w=336, h=48
function drawWindow(ctx: CanvasRenderingContext2D, time: number, realHour: number, realMin: number) {
  const wx = 2 * P, wy = 0, ww = 7 * P, wh = P;
  const f = 6; // frame thickness

  // Determine sky color and features based on hour
  let skyColor: string;
  let showStars = false;
  let showSun = false;
  let showMoon = false;
  let rainNight = false;

  if (realHour >= 0 && realHour < 6) {
    skyColor = '#0a0e1a'; showStars = true; showMoon = true; rainNight = true;
  } else if (realHour < 8) {
    skyColor = '#1a1030'; showStars = true; showMoon = true;
  } else if (realHour < 17) {
    skyColor = '#3a6a9a'; showSun = true;
  } else if (realHour < 20) {
    skyColor = '#8b3a20';
  } else {
    skyColor = '#0a0e1a'; showStars = true; showMoon = true; rainNight = true;
  }

  // Sky background
  r(ctx, skyColor, wx + f, wy + f, ww - f * 2, wh - f * 2);

  // Sunset gradient overlay
  if (realHour >= 17 && realHour < 20) {
    ctx.save();
    const grad = ctx.createLinearGradient(wx + f, wy + f, wx + f, wy + wh - f);
    grad.addColorStop(0, 'rgba(255,140,60,0.3)');
    grad.addColorStop(1, 'rgba(180,60,20,0.1)');
    ctx.fillStyle = grad;
    ctx.fillRect(wx + f, wy + f, ww - f * 2, wh - f * 2);
    ctx.restore();
  }

  // Sun
  if (showSun) {
    const sx2 = wx + ww - 56, sy2 = wy + f + 6;
    ctx.save();
    ctx.fillStyle = '#f9e060';
    ctx.beginPath();
    ctx.arc(sx2 + 8, sy2 + 8, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff8a0';
    ctx.beginPath();
    ctx.arc(sx2 + 6, sy2 + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Moon (crescent silhouette)
  if (showMoon) {
    const mx2 = wx + ww - 48, my2 = wy + f + 4;
    r(ctx, '#f5e6c8', mx2, my2, 16, 16);
    r(ctx, skyColor, mx2 + 6, my2 - 2, 14, 14); // cutout → crescent
  }

  // Stars — fixed positions, half twinkle
  if (showStars) {
    const stars = [
      [18, 8], [44, 18], [72, 10], [110, 22], [148, 12],
      [58, 6], [180, 20], [26, 28], [96, 28], [134, 8],
    ];
    const starDim = realHour >= 6 && realHour < 8;
    const blink = Math.sin(time * 2.4) > 0;
    stars.forEach(([sx3, sy3], i) => {
      if (i % 2 === 0 || blink) {
        ctx.save();
        ctx.globalAlpha = starDim ? 0.4 : 1.0;
        r(ctx, i % 3 === 0 ? '#ffffff' : '#aaccee', wx + f + sx3, wy + f + sy3 - f, 2, 2);
        ctx.restore();
      }
    });
  }

  // Rain streaks (nighttime)
  if (rainNight) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 12; i++) {
      const yOff = ((time * 60 + i * 17) % wh);
      const xOff = (i * 18) % (ww - f * 2);
      const rx2 = wx + f + xOff - yOff * 0.3;
      const ry2 = wy + f + yOff;
      ctx.fillStyle = 'rgba(160,200,255,0.5)';
      ctx.fillRect(Math.round(rx2), Math.round(ry2), 1, 6);
    }
    ctx.restore();
  }

  // Wood frame
  r(ctx, '#c8a06e', wx, wy, ww, f);
  r(ctx, '#9a7840', wx, wy + wh - f, ww, f);
  r(ctx, '#c8a06e', wx, wy, f, wh);
  r(ctx, '#9a7840', wx + ww - f, wy, f, wh);
  r(ctx, '#d4aa70', wx, wy, ww, 2); // top highlight
  // Centre mullion
  r(ctx, '#c8a06e', wx + ww / 2 - 3, wy, f, wh);

  // Suppress unused warning
  void realMin;
}

// ── Whiteboard ────────────────────────────────────────────────────────────────
// Position: cols 9-11, rows 0-3  →  x=9*P, y=2, w=3*P, h=2.5*P
function drawWhiteboard(ctx: CanvasRenderingContext2D) {
  const wx = 9 * P, wy = 2, ww = 3 * P, wh = Math.round(2.5 * P);
  const fr = 6; // frame thickness

  // Dark wood border
  r(ctx, '#3d2010', wx, wy, ww, wh);
  // Board surface off-white
  r(ctx, '#e8e4d8', wx + fr, wy + fr, ww - fr * 2, wh - fr * 2 - 8);

  const bx = wx + fr + 4, by = wy + fr + 4;
  const bw = ww - fr * 2 - 8;

  // Code scribble lines (simulate text rows)
  r(ctx, '#2244aa', bx,       by,       bw * 0.7, 2);
  r(ctx, '#2244aa', bx,       by + 6,   bw * 0.5, 2);
  r(ctx, '#228844', bx,       by + 12,  bw * 0.6, 2);
  r(ctx, '#228844', bx,       by + 18,  bw * 0.4, 2);
  r(ctx, '#aa2222', bx,       by + 24,  bw * 0.55, 2);
  r(ctx, '#2244aa', bx + 8,   by + 30,  bw * 0.45, 2);
  r(ctx, '#228844', bx,       by + 36,  bw * 0.35, 2);

  // Small box diagram (flowchart)
  const boxX = bx + Math.round(bw * 0.6), boxY = by + 8;
  r(ctx, '#2244aa', boxX,        boxY,       28, 2);  // top
  r(ctx, '#2244aa', boxX,        boxY + 14,  28, 2);  // bottom
  r(ctx, '#2244aa', boxX,        boxY,       2,  16);  // left
  r(ctx, '#2244aa', boxX + 26,   boxY,       2,  16);  // right
  r(ctx, '#aa2222', boxX + 4,    boxY + 4,   20, 2);   // inner line
  r(ctx, '#aa2222', boxX + 4,    boxY + 9,   14, 2);   // inner line 2

  // Whiteboard tray at bottom
  r(ctx, '#5c3414', wx + fr, wy + wh - fr - 8, ww - fr * 2, 8);
  // Marker icons in tray
  r(ctx, '#2244aa', wx + fr + 4,  wy + wh - fr - 6, 6, 4);
  r(ctx, '#aa2222', wx + fr + 12, wy + wh - fr - 6, 6, 4);
  r(ctx, '#228844', wx + fr + 20, wy + wh - fr - 6, 6, 4);
}

// ── Clock ─────────────────────────────────────────────────────────────────────
// Position: right side wall, col 20, row 1-2  →  x=20*P+8, y=P+8, size 40×40
function drawClock(ctx: CanvasRenderingContext2D, time: number, realHour: number, realMin: number) {
  const cx2 = 20 * P + 8 + 28; // center x
  const cy2 = P + 8 + 28;      // center y
  const radius = 28;

  ctx.save();

  // Clock face
  ctx.beginPath();
  ctx.arc(cx2, cy2, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#f5e8d0';
  ctx.fill();
  ctx.strokeStyle = '#3d2010';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Hour tick marks
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const inner = i % 3 === 0 ? radius - 8 : radius - 5;
    const outer = radius - 1;
    const tx1 = cx2 + Math.cos(angle) * inner;
    const ty1 = cy2 + Math.sin(angle) * inner;
    const tx2 = cx2 + Math.cos(angle) * outer;
    const ty2 = cy2 + Math.sin(angle) * outer;
    ctx.beginPath();
    ctx.moveTo(tx1, ty1);
    ctx.lineTo(tx2, ty2);
    ctx.strokeStyle = '#3d2010';
    ctx.lineWidth = i % 3 === 0 ? 2 : 1;
    ctx.stroke();
  }

  // Hour hand
  const hourAngle = ((realHour % 12) / 12 + realMin / 720) * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(cx2, cy2);
  ctx.lineTo(cx2 + Math.cos(hourAngle) * (radius - 10), cy2 + Math.sin(hourAngle) * (radius - 10));
  ctx.strokeStyle = '#1e1e2e';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Minute hand
  const minAngle = (realMin / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(cx2, cy2);
  ctx.lineTo(cx2 + Math.cos(minAngle) * (radius - 5), cy2 + Math.sin(minAngle) * (radius - 5));
  ctx.strokeStyle = '#1e1e2e';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Second hand (animated)
  const secAngle = ((time % 60) / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.beginPath();
  ctx.moveTo(cx2, cy2);
  ctx.lineTo(cx2 + Math.cos(secAngle) * (radius - 4), cy2 + Math.sin(secAngle) * (radius - 4));
  ctx.strokeStyle = '#e64444';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(cx2, cy2, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#1e1e2e';
  ctx.fill();

  ctx.restore();
}

// ── Sofa Left ─────────────────────────────────────────────────────────────────
// Reading nook left sofa. Position: cols 12-13, rows 3-5
function drawSofaLeft(ctx: CanvasRenderingContext2D) {
  const ox = 12 * P + 4, oy = 3 * P;

  // Back cushion
  r(ctx, '#2a4a3a', ox, oy, Math.round(P * 1.5), Math.round(P * 0.7));
  r(ctx, '#4a8a6a', ox, oy, Math.round(P * 1.5), 4); // top highlight
  r(ctx, '#1e3028', ox + Math.round(P * 0.75) - 1, oy, 2, Math.round(P * 0.7)); // center divider

  // Left arm
  r(ctx, '#1e3028', ox, oy, 8, Math.round(P * 1.3));
  // Right arm
  r(ctx, '#1e3028', ox + Math.round(P * 1.5) - 8, oy, 8, Math.round(P * 1.3));

  // Seat cushion
  r(ctx, '#2a4a3a', ox + 12, oy + Math.round(P * 0.65), Math.round(P * 1.5) - 16, Math.round(P * 0.6));
  r(ctx, '#3a6a52', ox + 12, oy + Math.round(P * 0.65), Math.round(P * 1.5) - 16, 4); // top highlight
  r(ctx, '#1a2a22', ox + 12, oy + Math.round(P * 0.65) + Math.round(P * 0.6) - 4, Math.round(P * 1.5) - 16, 4); // bottom shadow

  // Legs
  r(ctx, '#3d2010', ox + 12,                            oy + Math.round(P * 1.3), 6, 8);
  r(ctx, '#3d2010', ox + Math.round(P * 1.5) - 18,      oy + Math.round(P * 1.3), 6, 8);
}

// ── Sofa Right ────────────────────────────────────────────────────────────────
// Reading nook right sofa. Position: cols 16-17, rows 3-5
function drawSofaRight(ctx: CanvasRenderingContext2D) {
  const ox = 16 * P + 4, oy = 3 * P;

  // Back cushion
  r(ctx, '#2a4a3a', ox, oy, Math.round(P * 1.5), Math.round(P * 0.7));
  r(ctx, '#4a8a6a', ox, oy, Math.round(P * 1.5), 4); // top highlight
  r(ctx, '#1e3028', ox + Math.round(P * 0.75) - 1, oy, 2, Math.round(P * 0.7)); // center divider

  // Left arm
  r(ctx, '#1e3028', ox, oy, 8, Math.round(P * 1.3));
  // Right arm
  r(ctx, '#1e3028', ox + Math.round(P * 1.5) - 8, oy, 8, Math.round(P * 1.3));

  // Seat cushion
  r(ctx, '#2a4a3a', ox + 12, oy + Math.round(P * 0.65), Math.round(P * 1.5) - 16, Math.round(P * 0.6));
  r(ctx, '#3a6a52', ox + 12, oy + Math.round(P * 0.65), Math.round(P * 1.5) - 16, 4); // top highlight
  r(ctx, '#1a2a22', ox + 12, oy + Math.round(P * 0.65) + Math.round(P * 0.6) - 4, Math.round(P * 1.5) - 16, 4); // bottom shadow

  // Legs
  r(ctx, '#3d2010', ox + 12,                            oy + Math.round(P * 1.3), 6, 8);
  r(ctx, '#3d2010', ox + Math.round(P * 1.5) - 18,      oy + Math.round(P * 1.3), 6, 8);
}

// ── Bookshelf ─────────────────────────────────────────────────────────────────
// Position: cols 12–18, rows 0–2  →  x=576, y=0, w=288, h=144
function drawBookshelf(ctx: CanvasRenderingContext2D) {
  const bx = 12 * P, by = 0, bw = 6 * P, bh = 3 * P;
  const f = 8;

  // Back panel
  r(ctx, '#2e1a08', bx, by, bw, bh);

  // Shelf boards
  for (let s = 0; s < 3; s++) {
    const sy = by + (s + 1) * P - 6;
    r(ctx, '#5c3414', bx, sy, bw, 8);
    r(ctx, '#3d2010', bx, sy + 8, bw, 4);
  }

  // Books
  const bookPalettes = [
    ['#c43028', '#e84838', '#a82018'],
    ['#2848c4', '#3858d4', '#1838b0'],
    ['#28a840', '#38b850', '#189830'],
    ['#c89820', '#d8a830', '#b08010'],
    ['#a828c4', '#b838d4', '#9018b0'],
    ['#28a8c4', '#38b8d4', '#1898b0'],
    ['#c45828', '#d46838', '#b44818'],
  ];
  for (let shelf = 0; shelf < 3; shelf++) {
    const sy = by + shelf * P + 2;
    let bookX = bx + f;
    let idx = shelf * 4;
    while (bookX < bx + bw - f - 10) {
      const bkw = 12 + (idx % 3) * 4;
      const bkh = P - 10 - (idx % 2) * 6;
      const pal = bookPalettes[idx % bookPalettes.length];
      r(ctx, pal[0], bookX, sy, bkw, bkh);
      r(ctx, pal[1], bookX, sy, 2, bkh);
      r(ctx, pal[2], bookX + bkw - 2, sy, 2, bkh);
      r(ctx, pal[1], bookX, sy, bkw, 3);
      bookX += bkw + 2;
      idx++;
    }
  }

  // Outer frame
  r(ctx, '#6b3d1a', bx, by, f, bh);
  r(ctx, '#4a2810', bx + bw - f, by, f, bh);
  r(ctx, '#6b3d1a', bx, by, bw, f);
  r(ctx, '#4a2810', bx, by + bh - f, bw, f);
  r(ctx, '#8a5030', bx, by, bw, 2);
  r(ctx, '#8a5030', bx, by, 2, bh);

  // Small framed picture on top shelf
  const px2 = bx + bw - f - 34, py2 = by + 4;
  r(ctx, '#3a3a4a', px2, py2, 26, 28);
  r(ctx, '#4a5060', px2 + 2, py2 + 2, 22, 24);
  r(ctx, '#1e2a38', px2 + 5, py2 + 6, 14, 12);
  r(ctx, '#c0d8f0', px2 + 5, py2 + 6, 7, 5);
}

// ── Rug ───────────────────────────────────────────────────────────────────────
// Position: cols 5–15, rows 7–10  →  x=240, y=336, w=480, h=192
function drawRug(ctx: CanvasRenderingContext2D) {
  const rx = 5 * P, ry = 7 * P, rw = 10 * P, rh = 4 * P;
  const b = 8;

  r(ctx, '#3a1428', rx, ry, rw, rh);
  r(ctx, '#5a2040', rx, ry, rw, b);
  r(ctx, '#5a2040', rx, ry + rh - b, rw, b);
  r(ctx, '#5a2040', rx, ry, b, rh);
  r(ctx, '#5a2040', rx + rw - b, ry, b, rh);

  // Diamond grid pattern
  for (let py2 = ry + b + 10; py2 < ry + rh - b - 10; py2 += 26) {
    for (let px3 = rx + b + 14; px3 < rx + rw - b - 14; px3 += 26) {
      r(ctx, '#7a3060', px3 + 4, py2, 8, 2);
      r(ctx, '#7a3060', px3 + 2, py2 + 2, 12, 2);
      r(ctx, '#7a3060', px3, py2 + 4, 16, 2);
      r(ctx, '#7a3060', px3 + 2, py2 + 6, 12, 2);
      r(ctx, '#7a3060', px3 + 4, py2 + 8, 8, 2);
      r(ctx, '#2a0a1e', px3 + 6, py2 + 4, 4, 4);
    }
  }

  // Corner tassels
  [[rx + 2, ry + 2], [rx + rw - 8, ry + 2], [rx + 2, ry + rh - 8], [rx + rw - 8, ry + rh - 8]].forEach(([tx, ty]) => {
    r(ctx, '#c86090', tx, ty, 6, 6);
    r(ctx, '#e080b0', tx + 1, ty + 1, 4, 4);
  });
}

// ── Desk surface (drawn BEFORE character) ─────────────────────────────────────
// Position: cols 7–13, rows 7–8  →  x=336, y=336, w=288, h=96
const DESK = { x: 7 * P, y: 7 * P, w: 6 * P, h: 2 * P };

function drawDeskSurface(ctx: CanvasRenderingContext2D) {
  const { x: dx, y: dy, w: dw, h: dh } = DESK;

  // Surface
  r(ctx, '#6b3d1a', dx, dy, dw, dh);
  for (let i = 0; i < 5; i++) r(ctx, '#7a4820', dx + 22 + i * 50, dy + 5, 2, dh - 10);
  r(ctx, '#8a5030', dx, dy, dw, 3); // top highlight

  // Keyboard (sits on surface toward front)
  const kx = dx + dw / 2 - 44, ky = dy + dh - 36;
  r(ctx, '#3a3a4a', kx, ky, 88, 22);
  r(ctx, '#4a4a5a', kx + 2, ky + 2, 84, 16);
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 11; col++)
      r(ctx, '#5a5a6a', kx + 4 + col * 7, ky + 4 + row * 7, 5, 5);

  // Drawer
  r(ctx, '#5c3414', dx + dw - 84, dy + 18, 72, 44);
  r(ctx, '#3d2010', dx + dw - 84, dy + 18, 72, 3);
  r(ctx, '#c8a060', dx + dw - 84 + 26, dy + 36, 20, 4);
  r(ctx, '#e8c080', dx + dw - 84 + 26, dy + 36, 20, 2);
}

// ── Desk front face (drawn AFTER character to occlude lower body) ──────────────
function drawDeskFront(ctx: CanvasRenderingContext2D) {
  const { x: dx, y: dy, w: dw, h: dh } = DESK;
  r(ctx, '#3d2010', dx, dy + dh - 16, dw, 18); // front panel
  r(ctx, '#2a1508', dx, dy + dh + 2, dw, 3);   // base shadow
  r(ctx, '#4a2818', dx, dy + dh - 16, dw, 2);  // top edge of front panel
  // Legs
  r(ctx, '#2a1508', dx + 8,       dy + dh - 8, 10, 14);
  r(ctx, '#2a1508', dx + dw - 18, dy + dh - 8, 10, 14);
}

// ── Monitor ───────────────────────────────────────────────────────────────────
// Position: cols 9–11, rows 5–7  →  x=432, y=240, w=96, h=144
function drawMonitor(ctx: CanvasRenderingContext2D, time: number) {
  const mx = 9 * P + 8, my = 5 * P + 4, mw = 2 * P - 16, mh = 2 * P - 8;
  const bezel = 5;

  // Body
  r(ctx, '#2a2a3a', mx, my, mw, mh);
  r(ctx, '#1a1a2a', mx, my, mw, 3);
  r(ctx, '#3a3a4a', mx, my + 3, 3, mh - 3);

  // Screen
  const pulse = 0.85 + Math.sin(time * 0.6) * 0.05;
  ctx.fillStyle = `rgba(14,20,44,${pulse})`;
  ctx.fillRect(mx + bezel, my + bezel, mw - bezel * 2, mh - bezel * 2 - 8);

  // Code lines
  const lines = [
    { c: '#4488ff', w: 52 }, { c: '#88ccff', w: 36 },
    { c: '#66ff99', w: 60 }, { c: '#ffcc44', w: 28 },
    { c: '#4488ff', w: 46 }, { c: '#cc88ff', w: 40 },
  ];
  lines.forEach((ln, i) => r(ctx, ln.c, mx + bezel + 4, my + bezel + 4 + i * 9, ln.w, 3));

  // Blinking cursor
  if (Math.floor(time * 1.5) % 2 === 0) {
    r(ctx, '#88ccff', mx + bezel + 4, my + bezel + 4 + lines.length * 9, 5, 6);
  }

  // Screen glow
  ctx.save();
  const gx = mx + mw / 2, gy = my + mh / 2;
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, P * 2.5);
  glow.addColorStop(0, 'rgba(30,60,160,0.14)');
  glow.addColorStop(1, 'rgba(30,60,160,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(mx - P, my - P / 2, mw + P * 2, mh + P);
  ctx.restore();

  // Stand
  r(ctx, '#2a2a3a', mx + mw / 2 - 10, my + mh - 2, 20, 16);
  r(ctx, '#1a1a2a', mx + mw / 2 - 28, my + mh + 12, 56, 8);
}

// ── Desk lamp ─────────────────────────────────────────────────────────────────
// Position: col 13, rows 6–7  →  x=624, y=288
function drawLamp(ctx: CanvasRenderingContext2D) {
  const lx = 13 * P + 4, ly = 6 * P;

  // Warm radial glow first (drawn under everything else at this zY)
  ctx.save();
  const gx = lx + 18, gy = ly + 14;
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, P * 3.5);
  glow.addColorStop(0, 'rgba(255,220,80,0.22)');
  glow.addColorStop(0.4, 'rgba(255,200,60,0.10)');
  glow.addColorStop(1, 'rgba(255,170,30,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(lx - P * 2.5, ly - P / 2, P * 6, P * 4);
  ctx.restore();

  // Base weight
  r(ctx, '#3a3a4a', lx + 6, ly + P + 8, 28, 10);
  // Pole
  r(ctx, '#4a4a5a', lx + 16, ly + 16, 8, P - 8);
  // Shade (trapezoid via 3 rects)
  r(ctx, '#f8e080', lx + 2, ly + 4, 44, 6);
  r(ctx, '#f8e080', lx + 4, ly + 8, 40, 6);
  r(ctx, '#f8e080', lx + 6, ly + 12, 36, 4);
  r(ctx, '#d4b840', lx + 6, ly + 14, 36, 3); // rim shadow
  // Bulb hint
  r(ctx, '#fff8d0', lx + 16, ly + 10, 8, 6);
}

// ── Coffee mug ────────────────────────────────────────────────────────────────
// Position: left side of desk  →  col 7.5, row 7
function drawCoffeeMug(ctx: CanvasRenderingContext2D, time: number) {
  const cx = 7 * P + 14, cy = 7 * P + 12;
  const mw = 22, mh = 18;

  // Mug body
  r(ctx, '#f0ece0', cx, cy, mw, mh);
  r(ctx, '#d4c8b0', cx, cy, mw, 3);
  r(ctx, '#d4c8b0', cx + mw - 3, cy, 3, mh);
  // Coffee surface
  r(ctx, '#3d1a0a', cx + 2, cy + 4, mw - 4, mh - 6);
  // Handle
  r(ctx, '#f0ece0', cx + mw, cy + 3, 6, 4);
  r(ctx, '#f0ece0', cx + mw, cy + 11, 6, 4);
  r(ctx, '#f0ece0', cx + mw + 4, cy + 3, 3, 12);

  // Steam (3 animated wisps)
  for (let i = 0; i < 3; i++) {
    const phase = ((time * 1.4 + i * 0.55) % 1);
    const sx = cx + 4 + i * 6;
    const sy = cy - 6 - phase * 16;
    ctx.save();
    ctx.globalAlpha = (1 - phase) * 0.55;
    r(ctx, '#d8d0c8', sx + Math.sin(phase * Math.PI * 2) * 2, sy, 2, 5);
    ctx.restore();
  }
}

// ── Chair ─────────────────────────────────────────────────────────────────────
// Centered at col 10.5 (x=504), rows 9.5–10.8 — sits in front of the desk
function drawChair(ctx: CanvasRenderingContext2D) {
  const cx = Math.round(10.5 * P); // 504

  // Back rest (two vertical rails + top bar)
  r(ctx, '#3d2010', cx - 22, Math.round(9.5 * P),      44, Math.round(0.55 * P));
  r(ctx, '#5c3414', cx - 22, Math.round(9.5 * P),      44, 6);  // top rail highlight
  r(ctx, '#2a1508', cx - 20, Math.round(9.5 * P) + 6,  8,  Math.round(0.45 * P)); // left post
  r(ctx, '#2a1508', cx + 12, Math.round(9.5 * P) + 6,  8,  Math.round(0.45 * P)); // right post

  // Seat cushion
  const sy = Math.round(10.05 * P);
  r(ctx, '#5a2848', cx - 24, sy,      48, 22); // cushion body
  r(ctx, '#7a3860', cx - 24, sy,      48,  5); // top highlight
  r(ctx, '#8a4870', cx - 23, sy +  1, 46,  2); // sheen
  r(ctx, '#3a1830', cx - 24, sy + 18, 48,  4); // front shadow edge

  // Legs
  r(ctx, '#2a1508', cx - 22, sy + 22,  6, 14);
  r(ctx, '#2a1508', cx + 16, sy + 22,  6, 14);
  // Cross bar
  r(ctx, '#1e1008', cx - 16, sy + 30, 32,  4);
}

// ── Plant ─────────────────────────────────────────────────────────────────────
// Position: cols 18–19, rows 10–12  →  x=864, y=480
function drawPlant(ctx: CanvasRenderingContext2D) {
  const px4 = 18 * P + 4, py4 = 10 * P;

  // Pot
  const potX = px4 + 8, potY = py4 + P * 2 - 26, potW = 36, potH = 28;
  r(ctx, '#c05a20', potX, potY, potW, potH);
  r(ctx, '#e07030', potX, potY, potW, 6);
  r(ctx, '#a04818', potX, potY + potH - 6, potW, 6);
  r(ctx, '#2a1208', potX + 4, potY + 6, potW - 8, 14); // soil

  // Stems
  r(ctx, '#2d5a20', potX + 14, py4 + 10, 4, P * 2 - 34);
  r(ctx, '#2d5a20', potX + 14, py4 + 24, -12, 3);
  r(ctx, '#2d5a20', potX + 16, py4 + 18, 12, 3);

  // Leaves — teardrop shapes built from 3 rects each
  const leaf = (lx: number, ly: number, lw: number, lh: number, dark: boolean) => {
    const c1 = dark ? '#1a4020' : '#2d7040';
    const c2 = dark ? '#234828' : '#3d8050';
    r(ctx, c1, lx, ly, lw, lh);
    r(ctx, c2, lx + 2, ly + 2, lw - 4, lh - 4);
    r(ctx, c1, lx + Math.floor(lw / 2) - 1, ly, 2, lh); // vein
  };

  leaf(px4 + 2,  py4 + 14, 26, 18, true);
  leaf(px4 + 20, py4 + 14, 26, 18, false);
  leaf(px4,      py4 + 2,  22, 16, false);
  leaf(px4 + 22, py4 + 2,  22, 16, true);
  leaf(px4 + 10, py4 - 8,  20, 14, true);
  leaf(px4 + 20, py4 - 6,  20, 14, false);
}
