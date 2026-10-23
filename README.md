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

## Saving

Your dungeon is **saved automatically** to the browser's local storage as you
draw, and reopens when you come back. The top bar shows the current save state.

Use **Export** to write the whole dungeon, including every level, to a
`.dungeon.json` file, and **Import** to open one again. Imported files are
validated, and a file that cannot be read is reported without disturbing the map
you already have open.

> **Back up your maps.** Browser storage is convenient but it is not a backup:
> clearing your browsing data will delete any dungeon stored there. Export to a
> file for anything you want to keep.

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
  persistence/
    storage.ts        IndexedDB reads and writes
    serialisation.ts  Versioned JSON export and validated import
    usePersistence.ts Debounced autosave and startup restore
    fileTransfer.ts   Browser file download and read helpers
  state/
    editor.ts     Reducer holding the dungeon, tools, view and undo history
  components/
    MapCanvas.tsx          SVG grid, rendering and pointer handling
    Toolbar.tsx            Tool buttons and keyboard shortcuts
    PropertiesPanel.tsx    Editing for the current selection
    StatusBar.tsx          Level switching, coordinates and zoom
    DungeonFileControls.tsx Save status, new, export and import
```

The dungeon model has no dependency on the UI, and all edits are immutable, so
undo history is just a list of previous dungeon references.

## Status

Phases 1 and 2 are complete:

- **Phase 1** — grid, pan and zoom, the drawing tools above, selection,
  undo/redo, and multiple levels.
- **Phase 2** — autosave to browser storage, restore on startup, and versioned
  JSON export/import.

Still to come:

- **Phase 3** — the stamp system: a catalogue of symbols such as keyholes, secret
  buttons, levers, pits, teleporters, wells, stairs, and notes. Stamps anchor
  either to a square or to a wall face, since in these games buttons and
  keyholes are mounted on walls and face into a specific square. Custom stamps
  are built from a bundled icon set and stored with the dungeon so exported maps
  stay portable.
- **Later** — a library for managing several dungeons at once, PNG and print
  export, a generated legend, and search across notes.
