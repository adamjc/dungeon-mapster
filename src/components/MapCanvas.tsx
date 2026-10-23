import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  cellsAlongLine,
  edgesAlongLine,
  edgeWithin,
  parseCellKey,
  parseEdgeKey,
  pointsAlongLine,
} from '../model/coords';
import {
  applyErase,
  drawRoom,
  EDGE_HIT_TOLERANCE,
  edgeInBounds,
  eraseTargetAt,
  getEdge,
  setEdges,
  setFloors,
} from '../model/operations';
import type { Cell, Edge, EdgeKind, Level } from '../model/types';
import { activeLevel } from '../state/editor';
import type { EditorAction, EditorState } from '../state/editor';

/** World units per dungeon square, before the view scale is applied. */
export const CELL = 32;

const MIN_SCALE = 0.3;
const MAX_SCALE = 4;

type PaintMode =
  | { tool: 'floor' }
  | { tool: 'edge'; kind: EdgeKind; remove: boolean }
  | { tool: 'eraser' };

type DragState =
  | { kind: 'pan'; startX: number; startY: number; originTx: number; originTy: number }
  | { kind: 'paint'; working: Level; lastFx: number; lastFy: number; mode: PaintMode }
  | { kind: 'rect'; anchor: Cell };

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  onHoverChange: (cell: Cell | null) => void;
}

export function MapCanvas({ state, dispatch, onHoverChange }: Props) {
  const level = activeLevel(state);
  const { view, tool } = state;

  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hover, setHover] = useState<{ fx: number; fy: number } | null>(null);

  const dragRef = useRef<DragState | null>(null);
  const spaceRef = useRef(false);
  const viewRef = useRef(view);
  viewRef.current = view;

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceRef.current = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spaceRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Registered natively so the wheel handler can be non-passive and cancel
  // the browser's own page zoom.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const current = viewRef.current;

      const worldX = (screenX - current.tx) / current.scale;
      const worldY = (screenY - current.ty) / current.scale;
      const factor = Math.exp(-event.deltaY * 0.0015);
      const scale = Math.min(Math.max(current.scale * factor, MIN_SCALE), MAX_SCALE);

      dispatch({
        type: 'setView',
        view: {
          scale,
          tx: screenX - worldX * scale,
          ty: screenY - worldY * scale,
        },
      });
    };

    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [dispatch]);

  const toCellUnits = useCallback((clientX: number, clientY: number) => {
    const element = containerRef.current;
    if (!element) return { fx: 0, fy: 0 };

    const rect = element.getBoundingClientRect();
    const current = viewRef.current;
    return {
      fx: (clientX - rect.left - current.tx) / current.scale / CELL,
      fy: (clientY - rect.top - current.ty) / current.scale / CELL,
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent) => {
    const element = containerRef.current;
    if (!element) return;
    element.setPointerCapture(event.pointerId);

    const wantsPan = event.button === 1 || spaceRef.current || tool === 'pan';
    if (wantsPan) {
      dragRef.current = {
        kind: 'pan',
        startX: event.clientX,
        startY: event.clientY,
        originTx: view.tx,
        originTy: view.ty,
      };
      return;
    }

    if (event.button !== 0) return;
    const { fx, fy } = toCellUnits(event.clientX, event.clientY);
    const cell = { x: Math.floor(fx), y: Math.floor(fy) };

    switch (tool) {
      case 'select': {
        const edge = edgeWithin(fx, fy, EDGE_HIT_TOLERANCE);
        if (edge && edgeInBounds(level, edge) && getEdge(level, edge) !== null) {
          dispatch({ type: 'select', selection: { type: 'edge', edge } });
        } else {
          dispatch({ type: 'select', selection: { type: 'cell', cell } });
        }
        return;
      }

      case 'rectangle':
        dragRef.current = { kind: 'rect', anchor: cell };
        dispatch({ type: 'setRectPreview', rect: { a: cell, b: cell } });
        return;

      case 'floor': {
        const working = setFloors(level, [cell], true);
        dragRef.current = {
          kind: 'paint',
          working,
          lastFx: fx,
          lastFy: fy,
          mode: { tool: 'floor' },
        };
        dispatch({ type: 'beginStroke' });
        dispatch({ type: 'previewLevel', level: working });
        return;
      }

      case 'wall':
      case 'door': {
        const kind: EdgeKind = tool === 'wall' ? 'wall' : 'door';
        const edge = edgeWithin(fx, fy, 0.5);
        if (!edge || !edgeInBounds(level, edge)) return;

        // Clicking an edge that already holds this feature removes it, and the
        // rest of the drag repeats whichever action the first click chose.
        const remove = getEdge(level, edge) === kind;
        const working = setEdges(level, [edge], remove ? null : kind);
        dragRef.current = {
          kind: 'paint',
          working,
          lastFx: fx,
          lastFy: fy,
          mode: { tool: 'edge', kind, remove },
        };
        dispatch({ type: 'beginStroke' });
        dispatch({ type: 'previewLevel', level: working });
        return;
      }

      case 'eraser': {
        const working = applyErase(level, eraseTargetAt(level, fx, fy));
        dragRef.current = {
          kind: 'paint',
          working,
          lastFx: fx,
          lastFy: fy,
          mode: { tool: 'eraser' },
        };
        dispatch({ type: 'beginStroke' });
        dispatch({ type: 'previewLevel', level: working });
        return;
      }

      default:
        return;
    }
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const { fx, fy } = toCellUnits(event.clientX, event.clientY);
    setHover({ fx, fy });

    const cell = { x: Math.floor(fx), y: Math.floor(fy) };
    onHoverChange(
      cell.x >= 0 && cell.y >= 0 && cell.x < level.width && cell.y < level.height
        ? cell
        : null,
    );

    const drag = dragRef.current;
    if (!drag) return;

    if (drag.kind === 'pan') {
      dispatch({
        type: 'setView',
        view: {
          ...viewRef.current,
          tx: drag.originTx + (event.clientX - drag.startX),
          ty: drag.originTy + (event.clientY - drag.startY),
        },
      });
      return;
    }

    if (drag.kind === 'rect') {
      dispatch({ type: 'setRectPreview', rect: { a: drag.anchor, b: cell } });
      return;
    }

    // Edits accumulate on the drag's own working copy rather than on the
    // rendered level, so a fast drag cannot drop strokes while React catches up.
    let working = drag.working;
    switch (drag.mode.tool) {
      case 'floor':
        working = setFloors(
          working,
          cellsAlongLine(drag.lastFx, drag.lastFy, fx, fy),
          true,
        );
        break;

      case 'edge': {
        const edges = edgesAlongLine(drag.lastFx, drag.lastFy, fx, fy);
        working = setEdges(working, edges, drag.mode.remove ? null : drag.mode.kind);
        break;
      }

      case 'eraser':
        for (const point of pointsAlongLine(drag.lastFx, drag.lastFy, fx, fy)) {
          working = applyErase(working, eraseTargetAt(working, point.fx, point.fy));
        }
        break;
    }

    drag.working = working;
    drag.lastFx = fx;
    drag.lastFy = fy;
    dispatch({ type: 'previewLevel', level: working });
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    const element = containerRef.current;
    if (element?.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }

    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (drag.kind === 'rect') {
      const { fx, fy } = toCellUnits(event.clientX, event.clientY);
      const corner = { x: Math.floor(fx), y: Math.floor(fy) };
      dispatch({ type: 'setRectPreview', rect: null });
      dispatch({ type: 'commitLevel', level: drawRoom(level, drag.anchor, corner) });
      return;
    }

    if (drag.kind === 'paint') dispatch({ type: 'endStroke' });
  };

  const cancelDrag = () => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;

    if (drag.kind === 'rect') {
      dispatch({ type: 'setRectPreview', rect: null });
    } else if (drag.kind === 'paint') {
      dispatch({ type: 'endStroke' });
    }
  };

  const handlePointerLeave = () => {
    setHover(null);
    onHoverChange(null);
  };

  const cursor =
    tool === 'pan'
      ? 'grab'
      : tool === 'select'
        ? 'default'
        : 'crosshair';

  return (
    <div
      ref={containerRef}
      className="map-canvas"
      style={{ cursor }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelDrag}
      onPointerLeave={handlePointerLeave}
    >
      <svg width={size.width} height={size.height} role="presentation">
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          <LevelBackground level={level} />
          <GridLines level={level} view={view} size={size} />
          <Floors level={level} />
          <Edges level={level} />
          {state.rectPreview && <RectPreview rect={state.rectPreview} level={level} />}
          <HoverIndicator tool={tool} hover={hover} level={level} />
          <SelectionOverlay state={state} />
        </g>
      </svg>
    </div>
  );
}

function LevelBackground({ level }: { level: Level }) {
  return (
    <rect
      x={0}
      y={0}
      width={level.width * CELL}
      height={level.height * CELL}
      className="level-bounds"
    />
  );
}

function GridLines({
  level,
  view,
  size,
}: {
  level: Level;
  view: EditorState['view'];
  size: { width: number; height: number };
}) {
  // Only the visible slice of the grid is emitted, so large levels stay cheap
  // to render while zoomed in.
  const left = (0 - view.tx) / view.scale / CELL;
  const top = (0 - view.ty) / view.scale / CELL;
  const right = (size.width - view.tx) / view.scale / CELL;
  const bottom = (size.height - view.ty) / view.scale / CELL;

  const x0 = Math.max(0, Math.floor(left));
  const x1 = Math.min(level.width, Math.ceil(right));
  const y0 = Math.max(0, Math.floor(top));
  const y1 = Math.min(level.height, Math.ceil(bottom));

  const lines = [];
  for (let x = x0; x <= x1; x++) {
    lines.push(
      <line
        key={`v${x}`}
        x1={x * CELL}
        y1={y0 * CELL}
        x2={x * CELL}
        y2={y1 * CELL}
        className={x % 5 === 0 ? 'grid-line grid-line--major' : 'grid-line'}
      />,
    );
  }
  for (let y = y0; y <= y1; y++) {
    lines.push(
      <line
        key={`h${y}`}
        x1={x0 * CELL}
        y1={y * CELL}
        x2={x1 * CELL}
        y2={y * CELL}
        className={y % 5 === 0 ? 'grid-line grid-line--major' : 'grid-line'}
      />,
    );
  }
  return <g>{lines}</g>;
}

function Floors({ level }: { level: Level }) {
  return (
    <g>
      {Object.keys(level.cells).map((key) => {
        const { x, y } = parseCellKey(key);
        return (
          <rect
            key={key}
            x={x * CELL}
            y={y * CELL}
            width={CELL}
            height={CELL}
            className="floor"
            fill={level.cells[key].colour}
          />
        );
      })}
    </g>
  );
}

function edgeGeometry(edge: Edge) {
  return edge.o === 'H'
    ? {
        x1: edge.x * CELL,
        y1: edge.y * CELL,
        x2: (edge.x + 1) * CELL,
        y2: edge.y * CELL,
      }
    : {
        x1: edge.x * CELL,
        y1: edge.y * CELL,
        x2: edge.x * CELL,
        y2: (edge.y + 1) * CELL,
      };
}

function Edges({ level }: { level: Level }) {
  return (
    <g>
      {Object.keys(level.edges).map((key) => (
        <EdgeShape key={key} edge={parseEdgeKey(key)} kind={level.edges[key].kind} />
      ))}
    </g>
  );
}

function EdgeShape({ edge, kind }: { edge: Edge; kind: EdgeKind }) {
  const { x1, y1, x2, y2 } = edgeGeometry(edge);

  if (kind === 'wall') {
    return <line x1={x1} y1={y1} x2={x2} y2={y2} className="wall" />;
  }

  if (kind === 'secretDoor') {
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} className="wall" />
        <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r={CELL * 0.26} className="secret-door-disc" />
        <text
          x={(x1 + x2) / 2}
          y={(y1 + y2) / 2}
          className="secret-door-mark"
          textAnchor="middle"
          dominantBaseline="central"
        >
          S
        </text>
      </g>
    );
  }

  // Doors render as a gap in the wall with a leaf drawn across it, matching
  // the convention used by printed dungeon maps.
  const horizontal = edge.o === 'H';
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const jamb = CELL * 0.28;
  const leafHalf = CELL * 0.22;
  const leafThickness = CELL * 0.3;

  return (
    <g>
      {horizontal ? (
        <>
          <line x1={x1} y1={y1} x2={x1 + jamb} y2={y1} className="wall" />
          <line x1={x2 - jamb} y1={y2} x2={x2} y2={y2} className="wall" />
          <rect
            x={midX - leafHalf}
            y={midY - leafThickness / 2}
            width={leafHalf * 2}
            height={leafThickness}
            className={kind === 'lockedDoor' ? 'door door--locked' : 'door'}
          />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1} x2={x1} y2={y1 + jamb} className="wall" />
          <line x1={x2} y1={y2 - jamb} x2={x2} y2={y2} className="wall" />
          <rect
            x={midX - leafThickness / 2}
            y={midY - leafHalf}
            width={leafThickness}
            height={leafHalf * 2}
            className={kind === 'lockedDoor' ? 'door door--locked' : 'door'}
          />
        </>
      )}
    </g>
  );
}

function RectPreview({ rect, level }: { rect: { a: Cell; b: Cell }; level: Level }) {
  const x0 = Math.max(0, Math.min(rect.a.x, rect.b.x));
  const y0 = Math.max(0, Math.min(rect.a.y, rect.b.y));
  const x1 = Math.min(level.width - 1, Math.max(rect.a.x, rect.b.x));
  const y1 = Math.min(level.height - 1, Math.max(rect.a.y, rect.b.y));
  if (x1 < x0 || y1 < y0) return null;

  return (
    <rect
      x={x0 * CELL}
      y={y0 * CELL}
      width={(x1 - x0 + 1) * CELL}
      height={(y1 - y0 + 1) * CELL}
      className="rect-preview"
    />
  );
}

/**
 * Shows which edge or cell the active tool would act on. Edges are only a few
 * pixels wide, so without this the wall and door tools feel imprecise.
 */
function HoverIndicator({
  tool,
  hover,
  level,
}: {
  tool: EditorState['tool'];
  hover: { fx: number; fy: number } | null;
  level: Level;
}) {
  if (!hover) return null;

  if (tool === 'wall' || tool === 'door') {
    const edge = edgeWithin(hover.fx, hover.fy, 0.5);
    if (!edge || !edgeInBounds(level, edge)) return null;
    const { x1, y1, x2, y2 } = edgeGeometry(edge);
    return <line x1={x1} y1={y1} x2={x2} y2={y2} className="edge-hover" />;
  }

  if (tool === 'floor' || tool === 'eraser') {
    const cell = { x: Math.floor(hover.fx), y: Math.floor(hover.fy) };
    if (
      cell.x < 0 ||
      cell.y < 0 ||
      cell.x >= level.width ||
      cell.y >= level.height
    ) {
      return null;
    }

    if (tool === 'eraser') {
      const target = eraseTargetAt(level, hover.fx, hover.fy);
      if (target?.type === 'edge') {
        const { x1, y1, x2, y2 } = edgeGeometry(target.edge);
        return <line x1={x1} y1={y1} x2={x2} y2={y2} className="edge-hover edge-hover--erase" />;
      }
    }

    return (
      <rect
        x={cell.x * CELL}
        y={cell.y * CELL}
        width={CELL}
        height={CELL}
        className="cell-hover"
      />
    );
  }

  return null;
}

function SelectionOverlay({ state }: { state: EditorState }) {
  const selection = state.selection;
  if (!selection) return null;

  if (selection.type === 'cell') {
    return (
      <rect
        x={selection.cell.x * CELL}
        y={selection.cell.y * CELL}
        width={CELL}
        height={CELL}
        className="selection selection--cell"
      />
    );
  }

  const { x1, y1, x2, y2 } = edgeGeometry(selection.edge);
  return <line x1={x1} y1={y1} x2={x2} y2={y2} className="selection selection--edge" />;
}
