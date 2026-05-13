import { useEffect, useRef } from 'react';
import { TILE_SIZE, SCALE, NOTE_ROOM_COLS, NOTE_ROOM_ROWS } from '../constants';
import { createGameLoop } from '../office/engine/gameLoop';
import { renderScene } from '../office/engine/renderer';
import { createNoteRoom, updateNoteRoom, setEditing, noteRoomScene } from '../office/rooms/NoteRoom';
import type { FurnitureSprite } from '../office/engine/renderer';

interface Props {
  isEditing: boolean;
  savedAt?: number;
}

const W = NOTE_ROOM_COLS * TILE_SIZE * SCALE;
const H = NOTE_ROOM_ROWS * TILE_SIZE * SCALE;

export function OfficeCanvas({ isEditing, savedAt }: Props) {
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
    return () => loop.stop();
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
