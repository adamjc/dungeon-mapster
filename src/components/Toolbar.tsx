import type { Tool } from '../model/types';

interface ToolDefinition {
  id: Tool;
  label: string;
  shortcut: string;
  hint: string;
  icon: JSX.Element;
}

const TOOLS: ToolDefinition[] = [
  {
    id: 'select',
    label: 'Select',
    shortcut: 'V',
    hint: 'Inspect a square, wall or door',
    icon: <path d="M5 3l11 8-4.6 1-1.9 4.6z" />,
  },
  {
    id: 'floor',
    label: 'Floor',
    shortcut: 'F',
    hint: 'Paint explored squares. Drag to continue',
    icon: <path d="M4 4h12v12H4z" />,
  },
  {
    id: 'rectangle',
    label: 'Room',
    shortcut: 'R',
    hint: 'Drag out a room with walls around it',
    icon: <path d="M3 3h14v14H3zm2 2v10h10V5z" />,
  },
  {
    id: 'wall',
    label: 'Wall',
    shortcut: 'W',
    hint: 'Draw walls along edges. Click a wall to remove it',
    icon: <path d="M2 8h16v4H2z" />,
  },
  {
    id: 'door',
    label: 'Door',
    shortcut: 'D',
    hint: 'Place a door on an edge. Click a door to remove it',
    icon: <path d="M2 8h4v4H2zm12 0h4v4h-4zM7 5h6v10H7z" />,
  },
  {
    id: 'stamp',
    label: 'Stamp',
    shortcut: 'S',
    hint: 'Place keyholes, buttons, pits, stairs, notes and more',
    icon: <path d="M10 2l2.4 5.2 5.6.6-4.2 3.8 1.2 5.6L10 14.4 4.99 17.2l1.2-5.6L2 7.8l5.6-.6zM3 18h14v2H3z" />,
  },
  {
    id: 'eraser',
    label: 'Eraser',
    shortcut: 'E',
    hint: 'Remove a wall, door or floor square',
    icon: <path d="M3 13l7-7 7 7-3 3H6zM2 18h16v-1H2z" />,
  },
  {
    id: 'pan',
    label: 'Pan',
    shortcut: 'H',
    hint: 'Drag to move the map. Hold Space with any tool',
    icon: <path d="M10 2l2 3H8zm0 16l-2-3h4zM2 10l3-2v4zm16 0l-3 2V8zM8 8h4v4H8z" />,
  },
];

interface Props {
  tool: Tool;
  onSelect: (tool: Tool) => void;
}

export function Toolbar({ tool, onSelect }: Props) {
  return (
    <nav className="toolbar" aria-label="Mapping tools">
      {TOOLS.map((definition) => (
        <button
          key={definition.id}
          type="button"
          className={`tool${tool === definition.id ? ' tool--active' : ''}`}
          onClick={() => onSelect(definition.id)}
          aria-pressed={tool === definition.id}
          title={`${definition.label} (${definition.shortcut}) — ${definition.hint}`}
        >
          <svg viewBox="0 0 20 20" aria-hidden="true">
            {definition.icon}
          </svg>
          <span className="tool__label">{definition.label}</span>
          <span className="tool__shortcut">{definition.shortcut}</span>
        </button>
      ))}
    </nav>
  );
}

export const TOOL_SHORTCUTS: Record<string, Tool> = Object.fromEntries(
  TOOLS.map((definition) => [definition.shortcut.toLowerCase(), definition.id]),
);
