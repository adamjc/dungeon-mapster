# Dungeon Mapper

A grid-based mapping tool for classic first-person "blobber" dungeon crawlers
such as *Dungeon Master*, *Eye of the Beholder*, and *Lands of Lore*.

Draw rooms and corridors as you explore, mark the walls and doors you find, and
keep each dungeon floor on its own level.

## Running it

Requires Node.js 18 or newer.

```bash
npm install
npm run dev      # development server
npm run build    # production build into dist/
npm test         # unit tests
```

## Using the editor

| Tool | Shortcut | What it does |
|---|---|---|
| Select | `V` | Click a square, wall or door to edit it in the properties panel |
| Floor | `F` | Paint explored squares. Drag to paint a run |
| Room | `R` | Drag out a rectangular room with walls around it |
| Wall | `W` | Draw walls along edges. Click an existing wall to remove it |
| Door | `D` | Place a door on an edge. Click an existing door to remove it |
| Eraser | `E` | Remove a wall, door, or floor square |
| Pan | `H` | Drag to move the map |

Also available:

- **Undo / redo** with `Ctrl+Z` and `Ctrl+Shift+Z`. A whole drag undoes in one step.
- **Pan** by holding `Space` with any tool, or dragging with the middle mouse button.
- **Zoom** with the mouse wheel, centred on the pointer.
- **Escape** clears the current selection.

The Room tool is additive: it never replaces an existing door with a wall, so
drawing a room against one you have already mapped keeps the doorway between
them intact.

## How the map is stored

Floors belong to squares; walls and doors belong to the *edges between*
squares. Each edge is stored once in a canonical form, so two neighbouring
squares can never disagree about the wall between them:

```
{ x, y, o: 'H' }  ->  north side of square (x, y)   == south side of (x, y-1)
{ x, y, o: 'V' }  ->  west  side of square (x, y)   == east  side of (x-1, y)
```

This is what allows one-square corridors, rooms that share a wall, and doors
that face a specific direction.

## Project layout

```
src/
  model/        Dungeon data model and pure editing operations
    types.ts        Dungeon, Level, Cell and Edge types
    coords.ts       Canonical edge addressing, hit-testing, drag sampling
    dungeon.ts      Factories for dungeons and levels
    operations.ts   Floor, wall, room and eraser edits
  state/
    editor.ts     Reducer holding the dungeon, tools, view and undo history
  components/
    MapCanvas.tsx       SVG grid, rendering and pointer handling
    Toolbar.tsx         Tool buttons and keyboard shortcuts
    PropertiesPanel.tsx Editing for the current selection
    StatusBar.tsx       Level switching, coordinates and zoom
```

The dungeon model has no dependency on the UI, and all edits are immutable, so
undo history is just a list of previous dungeon references.

## Status

Phase 1 (core editor) is complete: grid, pan and zoom, the drawing tools above,
selection, undo/redo, and multiple levels.

Still to come:

- **Phase 2** — saving to browser storage, a dungeon library, and JSON import/export.
- **Phase 3** — the stamp system: a catalogue of symbols such as keyholes, secret
  buttons, levers, pits, teleporters, wells, stairs, and notes. Stamps anchor
  either to a square or to a wall face, since in these games buttons and
  keyholes are mounted on walls and face into a specific square. Custom stamps
  are built from a bundled icon set and stored with the dungeon so exported maps
  stay portable.

> **Note:** maps currently live only in memory and are lost on reload. Persistence
> arrives in Phase 2.
