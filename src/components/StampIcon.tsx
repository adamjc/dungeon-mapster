import { getIcon, ICON_VIEWBOX } from '../model/icons';
import type { IconShape } from '../model/icons';

/**
 * Renders an icon from the bundled set.
 *
 * Icons are authored as line art on a 24x24 grid. Stroke width is specified in
 * that same space so an icon keeps its weight whatever size it is drawn at.
 */

interface ShapeProps {
  shape: IconShape;
  colour: string;
  strokeWidth: number;
}

function Shape({ shape, colour, strokeWidth }: ShapeProps) {
  const solid = 'solid' in shape && shape.solid === true;
  const common = {
    fill: solid ? colour : 'none',
    stroke: colour,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if ('circle' in shape) {
    const [cx, cy, r] = shape.circle;
    return <circle cx={cx} cy={cy} r={r} {...common} />;
  }

  if ('rect' in shape) {
    const [x, y, width, height] = shape.rect;
    return <rect x={x} y={y} width={width} height={height} {...common} />;
  }

  if ('line' in shape) {
    const [x1, y1, x2, y2] = shape.line;
    return <line x1={x1} y1={y1} x2={x2} y2={y2} {...common} stroke={colour} fill="none" />;
  }

  const points = shape.poly.join(' ');
  return shape.closed ? (
    <polygon points={points} {...common} />
  ) : (
    <polyline points={points} {...common} fill="none" />
  );
}

interface IconShapesProps {
  icon: string;
  colour: string;
  strokeWidth?: number;
}

/** The icon's shapes in their own 24x24 space, for placing inside a transform. */
export function IconShapes({ icon, colour, strokeWidth = 2 }: IconShapesProps) {
  return (
    <>
      {getIcon(icon).shapes.map((shape, index) => (
        <Shape key={index} shape={shape} colour={colour} strokeWidth={strokeWidth} />
      ))}
    </>
  );
}

interface IconProps {
  icon: string;
  colour: string;
  size?: number;
  title?: string;
}

/** A standalone icon, used in the toolbar and palette. */
export function Icon({ icon, colour, size = 24, title }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      role={title ? 'img' : 'presentation'}
      aria-label={title}
    >
      <IconShapes icon={icon} colour={colour} />
    </svg>
  );
}

interface MapGlyphProps {
  icon: string;
  colour: string;
  /** Centre of the glyph, in pixels. */
  cx: number;
  cy: number;
  /** Width and height of the glyph box, in pixels. */
  size: number;
  opacity?: number;
}

/** An icon positioned on the map canvas. */
export function MapGlyph({ icon, colour, cx, cy, size, opacity }: MapGlyphProps) {
  const scale = size / ICON_VIEWBOX;
  return (
    <g
      transform={`translate(${cx - size / 2} ${cy - size / 2}) scale(${scale})`}
      opacity={opacity}
    >
      <IconShapes icon={icon} colour={colour} strokeWidth={2.2} />
    </g>
  );
}
