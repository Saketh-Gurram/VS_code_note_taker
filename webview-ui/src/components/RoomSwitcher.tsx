import type { RoomId } from '../types';

interface Props {
  room: RoomId;
  onSwitch: (r: RoomId) => void;
}

export function RoomSwitcher({ room, onSwitch }: Props) {
  return (
    <div className="room-switcher">
      <button
        className={`room-tab ${room === 'note' ? 'active' : ''}`}
        onClick={() => onSwitch('note')}
      >
        📝 Office
      </button>
      <button
        className={`room-tab ${room === 'break' ? 'active' : ''}`}
        onClick={() => onSwitch('break')}
      >
        ☕ Break
      </button>
    </div>
  );
}
