import { AGENT_ROOM_COLS, AGENT_ROOM_ROWS, TILE_SIZE, THEME, AGENT_ROLES, ANIM } from '../../constants';
import { createChar, updateChar, setCharAnim, type CharState } from '../engine/characters';
import type { TileMap, FurnitureSprite, RenderScene } from '../engine/renderer';
import type { AIStatus } from '../../types';

function buildTileMap(): TileMap {
  const tiles: number[] = [];
  for (let row = 0; row < AGENT_ROOM_ROWS; row++) {
    for (let col = 0; col < AGENT_ROOM_COLS; col++) {
      const isEdge = row === 0 || row === AGENT_ROOM_ROWS - 1 || col === 0 || col === AGENT_ROOM_COLS - 1;
      tiles.push(isEdge ? 2 : 1);
    }
  }
  return { cols: AGENT_ROOM_COLS, rows: AGENT_ROOM_ROWS, tiles };
}

// Four agents at evenly spaced desks across the room
const AGENT_POSITIONS = [
  { col: 4, row: 4 },
  { col: 8, row: 4 },
  { col: 13, row: 4 },
  { col: 17, row: 4 },
];

export interface AgentRoomState {
  tileMap: TileMap;
  characters: CharState[];
  aiStatus: AIStatus;
  processingTimer: number;
}

export function createAgentRoom(): AgentRoomState {
  const characters = AGENT_POSITIONS.map((pos, i) =>
    createChar(`agent-${i}`, pos.col, pos.row, TILE_SIZE, i + 1, AGENT_ROLES[i])
  );
  return {
    tileMap: buildTileMap(),
    characters,
    aiStatus: 'idle',
    processingTimer: 0,
  };
}

export function updateAgentRoom(state: AgentRoomState, dt: number): void {
  if (state.aiStatus === 'processing') {
    state.processingTimer -= dt;
    if (state.processingTimer <= 0) {
      state.aiStatus = 'idle';
      state.characters.forEach(c => setCharAnim(c, 'idle'));
    }
  }
  state.characters.forEach(c => updateChar(c, dt));
}

export function setAgentStatus(state: AgentRoomState, status: AIStatus): void {
  state.aiStatus = status;
  if (status === 'processing') {
    state.processingTimer = ANIM.AI_PROCESSING_DUR;
    state.characters.forEach(c => setCharAnim(c, 'type', 'down'));
  } else {
    state.characters.forEach(c => setCharAnim(c, 'idle'));
  }
}

export function agentRoomScene(
  state: AgentRoomState,
  furniture: FurnitureSprite[],
  charImages: Map<number, HTMLImageElement>
): RenderScene {
  return {
    tileMap: state.tileMap,
    furniture,
    characters: state.characters,
    charImages,
    floorColor: THEME.FLOOR2,
    wallColor: THEME.WALL,
  };
}
