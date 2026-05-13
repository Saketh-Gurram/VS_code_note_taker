export const TILE_SIZE = 16;
export const SCALE = 3; // 48px logical tile size

export const NOTE_ROOM_COLS = 22;
export const NOTE_ROOM_ROWS = 14;

export const THEME = {
  BG: '#1e1e2e',
  BORDER: '#4a4a6a',
  ACCENT: '#6030ff',
  ACCENT_LIGHT: '#8866ff',
  TEXT: '#cdd6f4',
  TEXT_DIM: '#7f849c',
  SURFACE: '#313244',
  SURFACE2: '#45475a',
  DANGER: '#f38ba8',
  SUCCESS: '#a6e3a1',
  WARNING: '#f9e2af',
  // Room colours — warm night study
  FLOOR1: '#3d2b1f',
  FLOOR2: '#4a3728',
  WALL: '#1f1208',
} as const;

// Animation timings (seconds)
export const ANIM = {
  WALK_FRAME_DUR: 0.15,
  TYPE_FRAME_DUR: 0.3,
  IDLE_FIDGET_INTERVAL: 4.0,
  ROOM_TRANSITION_DUR: 0.35,
  AI_PROCESSING_DUR: 3.0,
} as const;

