/**
 * Bundled icon set.
 *
 * Icons are described as simple shapes on a 24x24 grid rather than as raw SVG
 * path data, which keeps them readable and makes new ones easy to add. They
 * render as line art so that every stamp looks consistent at map scale and in
 * exports, whatever colour it is given.
 */

export type IconShape =
  | { circle: [cx: number, cy: number, r: number]; solid?: boolean }
  | { rect: [x: number, y: number, w: number, h: number]; solid?: boolean }
  | { line: [x1: number, y1: number, x2: number, y2: number] }
  | { poly: number[]; closed?: boolean; solid?: boolean };

export interface IconDefinition {
  shapes: IconShape[];
}

export const ICON_VIEWBOX = 24;

export const ICONS: Record<string, IconDefinition> = {
  keyhole: {
    shapes: [
      { circle: [12, 9, 4] },
      { poly: [10, 12.5, 8.5, 20, 15.5, 20, 14, 12.5], closed: true },
    ],
  },
  padlock: {
    shapes: [
      { rect: [5, 11, 14, 10] },
      { poly: [8.5, 11, 8.5, 7.5, 15.5, 7.5, 15.5, 11] },
      { circle: [12, 16, 1.6], solid: true },
    ],
  },
  key: {
    shapes: [
      { circle: [7, 8, 4] },
      { line: [9.5, 11, 19, 20.5] },
      { line: [16, 17.5, 13.5, 20] },
      { line: [18, 19.5, 16, 21.5] },
    ],
  },
  portcullis: {
    shapes: [
      { line: [4, 3, 4, 21] },
      { line: [12, 3, 12, 21] },
      { line: [20, 3, 20, 21] },
      { line: [3, 8, 21, 8] },
      { line: [3, 15, 21, 15] },
    ],
  },
  button: {
    shapes: [
      { circle: [12, 12, 9] },
      { circle: [12, 12, 4], solid: true },
    ],
  },
  lever: {
    shapes: [
      { rect: [4, 17, 16, 4] },
      { line: [12, 17, 17, 5] },
      { circle: [17.5, 4, 2.2], solid: true },
    ],
  },
  pressurePlate: {
    shapes: [
      { rect: [3, 6, 18, 12] },
      { rect: [7, 10, 10, 4] },
    ],
  },
  wheel: {
    shapes: [
      { circle: [12, 12, 8] },
      { circle: [12, 12, 2.4], solid: true },
      { line: [12, 4, 12, 20] },
      { line: [4, 12, 20, 12] },
    ],
  },
  pit: {
    shapes: [
      { circle: [12, 12, 9] },
      { circle: [12, 12, 5] },
      { circle: [12, 12, 1.8], solid: true },
    ],
  },
  trapdoor: {
    shapes: [
      { rect: [3, 3, 18, 18] },
      { line: [3, 3, 21, 21] },
      { circle: [16.5, 7.5, 1.8] },
    ],
  },
  teleporter: {
    shapes: [
      { circle: [12, 12, 9] },
      { poly: [12, 5, 16, 12, 12, 19, 8, 12], closed: true },
      { circle: [12, 12, 1.6], solid: true },
    ],
  },
  spinner: {
    shapes: [
      { circle: [12, 12, 7] },
      { poly: [12, 2, 16, 6, 8, 6], closed: true, solid: true },
      { poly: [12, 22, 8, 18, 16, 18], closed: true, solid: true },
    ],
  },
  stairsUp: {
    shapes: [
      { poly: [3, 21, 9, 21, 9, 15, 15, 15, 15, 9, 21, 9, 21, 3] },
      { poly: [17, 6, 19, 3, 21, 6], closed: true, solid: true },
    ],
  },
  stairsDown: {
    shapes: [
      { poly: [3, 3, 9, 3, 9, 9, 15, 9, 15, 15, 21, 15, 21, 21] },
      { poly: [17, 18, 19, 21, 21, 18], closed: true, solid: true },
    ],
  },
  darkness: {
    shapes: [
      { circle: [12, 12, 9], solid: true },
      { circle: [12, 12, 9] },
    ],
  },
  well: {
    shapes: [
      { rect: [5, 11, 14, 10] },
      { line: [5, 15, 19, 15] },
      { poly: [7, 11, 12, 4, 17, 11] },
      { line: [12, 4, 12, 11] },
    ],
  },
  fountain: {
    shapes: [
      { poly: [4, 14, 20, 14, 17, 21, 7, 21], closed: true },
      { line: [12, 4, 12, 14] },
      { circle: [12, 4, 2.2] },
    ],
  },
  alcove: {
    shapes: [
      { poly: [6, 21, 6, 11, 12, 5, 18, 11, 18, 21] },
      { line: [9, 21, 9, 13] },
      { line: [15, 21, 15, 13] },
    ],
  },
  altar: {
    shapes: [
      { rect: [4, 8, 16, 4] },
      { poly: [7, 12, 7, 20, 17, 20, 17, 12] },
      { line: [4, 20, 20, 20] },
    ],
  },
  pillar: {
    shapes: [
      { rect: [5, 3, 14, 3] },
      { rect: [5, 18, 14, 3] },
      { line: [8, 6, 8, 18] },
      { line: [16, 6, 16, 18] },
    ],
  },
  torch: {
    shapes: [
      { poly: [12, 3, 15.5, 8, 12, 13, 8.5, 8], closed: true },
      { line: [12, 13, 12, 21] },
    ],
  },
  rubble: {
    shapes: [
      { circle: [8, 16, 3] },
      { circle: [15, 17, 2.4] },
      { circle: [12, 10, 2.8] },
    ],
  },
  chest: {
    shapes: [
      { rect: [3, 9, 18, 12] },
      { line: [3, 14, 21, 14] },
      { poly: [5, 9, 7, 5, 17, 5, 19, 9] },
      { rect: [10.5, 12, 3, 4], solid: true },
    ],
  },
  treasure: {
    shapes: [
      { circle: [9, 15, 4] },
      { circle: [15.5, 15, 4] },
      { circle: [12, 8, 4] },
    ],
  },
  item: {
    shapes: [
      { poly: [12, 3, 21, 8, 21, 16, 12, 21, 3, 16, 3, 8], closed: true },
      { circle: [12, 12, 3], solid: true },
    ],
  },
  monster: {
    shapes: [
      { circle: [12, 10, 7] },
      { circle: [9.5, 9, 1.6], solid: true },
      { circle: [14.5, 9, 1.6], solid: true },
      { poly: [8, 17, 10, 21, 12, 17, 14, 21, 16, 17] },
    ],
  },
  spawner: {
    shapes: [
      { circle: [12, 12, 4] },
      { line: [12, 2, 12, 7] },
      { line: [12, 17, 12, 22] },
      { line: [2, 12, 7, 12] },
      { line: [17, 12, 22, 12] },
    ],
  },
  note: {
    shapes: [
      { poly: [5, 3, 15, 3, 19, 7, 19, 21, 5, 21], closed: true },
      { poly: [15, 3, 15, 7, 19, 7] },
      { line: [8, 12, 16, 12] },
      { line: [8, 16, 14, 16] },
    ],
  },
  question: {
    shapes: [
      { circle: [12, 12, 9] },
      { poly: [9, 9.5, 10.5, 7, 13.5, 7, 15, 9.5, 12, 13, 12, 15] },
      { circle: [12, 18, 1.3], solid: true },
    ],
  },
  warning: {
    shapes: [
      { poly: [12, 3, 22, 20, 2, 20], closed: true },
      { line: [12, 9, 12, 15] },
      { circle: [12, 17.5, 1.2], solid: true },
    ],
  },
  done: {
    shapes: [
      { circle: [12, 12, 9] },
      { poly: [7.5, 12, 11, 15.5, 17, 8.5] },
    ],
  },
  star: {
    shapes: [
      {
        poly: [12, 2, 14.6, 9.2, 22, 9.4, 16.2, 14, 18.2, 21, 12, 16.8, 5.8, 21, 7.8, 14, 2, 9.4, 9.4, 9.2],
        closed: true,
      },
    ],
  },
  flag: {
    shapes: [
      { line: [6, 3, 6, 21] },
      { poly: [6, 4, 19, 7.5, 6, 11], closed: true },
    ],
  },
  rune: {
    shapes: [
      { circle: [12, 12, 9] },
      { poly: [12, 5, 12, 19] },
      { poly: [12, 9, 17, 5] },
      { poly: [12, 13, 7, 9] },
    ],
  },
  eye: {
    shapes: [
      { poly: [2, 12, 7, 6, 17, 6, 22, 12, 17, 18, 7, 18], closed: true },
      { circle: [12, 12, 3.4], solid: true },
    ],
  },
  bars: {
    shapes: [
      { line: [6, 3, 6, 21] },
      { line: [12, 3, 12, 21] },
      { line: [18, 3, 18, 21] },
    ],
  },
  arrowUp: {
    shapes: [
      { line: [12, 21, 12, 5] },
      { poly: [6, 11, 12, 4, 18, 11], closed: true, solid: true },
    ],
  },
  arrowDown: {
    shapes: [
      { line: [12, 3, 12, 19] },
      { poly: [6, 13, 12, 20, 18, 13], closed: true, solid: true },
    ],
  },
  dot: {
    shapes: [{ circle: [12, 12, 6], solid: true }],
  },
  cross: {
    shapes: [
      { line: [5, 5, 19, 19] },
      { line: [19, 5, 5, 19] },
    ],
  },
};

export const ICON_IDS = Object.keys(ICONS);

export const FALLBACK_ICON = 'question';

export function getIcon(id: string): IconDefinition {
  return ICONS[id] ?? ICONS[FALLBACK_ICON];
}
