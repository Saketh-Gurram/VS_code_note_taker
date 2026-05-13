import { useEffect, useRef } from 'react';
import { TILE_SIZE, SCALE, NOTE_ROOM_COLS, NOTE_ROOM_ROWS } from '../constants';
import { createGameLoop } from '../office/engine/gameLoop';
import { renderScene } from '../office/engine/renderer';
import {
  createNoteRoom, updateNoteRoom, setEditing, noteRoomScene,
  eggCoffeeMug, eggCatClick, eggMonitor, eggPlant, eggBookshelf,
  eggKonami, eggSudo, eggHello, eggMilestone,
} from '../office/rooms/NoteRoom';
import type { FurnitureSprite } from '../office/engine/renderer';

interface Props {
  isEditing: boolean;
  savedAt?: number;
  noteTitle?: string;
  milestoneCount?: number;
}

const W = NOTE_ROOM_COLS * TILE_SIZE * SCALE;
const H = NOTE_ROOM_ROWS * TILE_SIZE * SCALE;

export function OfficeCanvas({ isEditing, savedAt, noteTitle, milestoneCount }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({
    noteRoom: createNoteRoom(),
    charImages: new Map<number, HTMLImageElement>(),
    furniture: [] as FurnitureSprite[],
  });

  useEffect(() => {
    setEditing(stateRef.current.noteRoom, isEditing);
  }, [isEditing]);

  useEffect(() => {
    if (!savedAt) return;
    stateRef.current.noteRoom.celebrateTimer = 1.8;
  }, [savedAt]);

  // sudo / hello title easter eggs
  useEffect(() => {
    const t = (noteTitle ?? '').trim().toLowerCase();
    if (t === 'sudo') eggSudo(stateRef.current.noteRoom);
    if (t === 'hello') eggHello(stateRef.current.noteRoom);
  }, [noteTitle]);

  // milestone note count easter egg
  useEffect(() => {
    if (!milestoneCount) return;
    eggMilestone(stateRef.current.noteRoom);
  }, [milestoneCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const s = stateRef.current;

    // Load character sprites via the webview-safe URI injected by the extension host
    const charBase = (window as unknown as Record<string, string>)['__CHAR_BASE__'];
    if (charBase) {
      for (let i = 0; i < 6; i++) {
        const img = new Image();
        img.src = `${charBase}/char_${i}.png`;
        s.charImages.set(i, img);
      }
    }

    const loop = createGameLoop(
      (dt) => updateNoteRoom(s.noteRoom, dt),
      () => {
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, W, H);
        renderScene(ctx, noteRoomScene(s.noteRoom, s.furniture, s.charImages));
      }
    );

    loop.start();

    // Hit-test helper: canvas pixel → tile coords
    function tileAt(e: MouseEvent): { col: number; row: number } {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const cx5 = (e.clientX - rect.left) * scaleX;
      const cy5 = (e.clientY - rect.top) * scaleY;
      return { col: cx5 / (TILE_SIZE * SCALE), row: cy5 / (TILE_SIZE * SCALE) };
    }

    function onCanvasClick(e: MouseEvent) {
      const { col, row } = tileAt(e);
      const room = s.noteRoom;
      // Coffee mug: col 7.0-7.8, row 7.0-7.6
      if (col >= 7.0 && col <= 7.8 && row >= 7.0 && row <= 7.6) { eggCoffeeMug(room); return; }
      // Monitor: col 9-11, row 5-7
      if (col >= 9 && col <= 11 && row >= 5 && row <= 7) { eggMonitor(room); return; }
      // Plant: col 18-20, row 10-12
      if (col >= 18 && col <= 20 && row >= 10 && row <= 12) { eggPlant(room); return; }
      // Bookshelf: col 12-18, row 0-3
      if (col >= 12 && col <= 18 && row >= 0 && row <= 3) { eggBookshelf(room); return; }
      // Cat: within 1.5 tiles of cat position
      const cat = room.cat;
      const catCol = cat.x / TILE_SIZE, catRow = cat.y / TILE_SIZE;
      if (Math.hypot(col - catCol, row - catRow) < 1.5) { eggCatClick(room); return; }
    }
    canvas.addEventListener('click', onCanvasClick);

    // Konami code listener
    const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    const keyBuffer: string[] = [];
    function onKey(e: KeyboardEvent) {
      keyBuffer.push(e.key);
      if (keyBuffer.length > KONAMI.length) keyBuffer.shift();
      if (keyBuffer.length === KONAMI.length && keyBuffer.every((k, i) => k === KONAMI[i])) {
        eggKonami(s.noteRoom);
        keyBuffer.length = 0;
      }
    }
    window.addEventListener('keydown', onKey);

    return () => {
      loop.stop();
      canvas.removeEventListener('click', onCanvasClick);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ width: '100%', height: 'auto', imageRendering: 'pixelated', display: 'block' }}
    />
  );
}
