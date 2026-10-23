# Dungeon Mapper

A 100% vibe-coded project.

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
| Select | `V` | Click a square, wall, door or stamp to edit it in the properties panel |
| Floor | `F` | Paint explored squares. Drag to paint a run |
| Room | `R` | Drag out a rectangular room with walls around it |
| Wall | `W` | Draw walls along edges. Click an existing wall to remove it |
| Door | `D` | Place a door on an edge. Click an existing door to remove it |
| Stamp | `S` | Place symbols: keyholes, buttons, pits, stairs, notes and more |
| Eraser | `E` | Remove a stamp, wall, door, or floor square |
| Pan | `H` | Drag to move the map |

Also available:

- **Undo / redo** with `Ctrl+Z` and `Ctrl+Shift+Z`. A whole drag undoes in one step.
- **Pan** by holding `Space` with any tool, or dragging with the middle mouse button.
- **Zoom** with the mouse wheel, centred on the pointer.
- **Escape** clears the current selection.

The Room tool is additive: it never replaces an existing door with a wall, so
drawing a room against one you have already mapped keeps the doorway between
them intact.

## Stamps

Stamps are the symbols you put on a map. The Stamp tool opens a palette with a
searchable catalogue grouped into doors and locks, mechanisms, hazards and
movement, scenery, contents, and annotation.

Some stamps go **in a square** — pits, teleporters, stairs, wells, chests,
monsters. Others are **mounted on a wall face** — keyholes, secret buttons,
levers, alcoves, wall runes. This distinction matters in these games: a keyhole
is on one side of a particular wall and is only visible from that side, so a
wall stamp also records which square it is seen from. The editor only offers
placements a stamp actually allows, and a wall-only stamp snaps to the nearest
wall however roughly you click.

Select a stamp to give it a label, a longer note, or a different colour.
Stairs and teleporters can also point at another level, with a button to follow
the link.

Several stamps can share a square: they arrange themselves into quadrants, and
a crowded square collapses into a `+N` badge.

### Custom stamps

Choose **New stamp…** in the palette to make your own from the bundled icon
set: pick a symbol and colour, give it a name, and say whether it goes in a
square, on a wall, or either.

Custom stamps are stored **with the dungeon**, not with the browser, so an
exported map always carries the symbols it needs and opens correctly elsewhere.
Deleting a custom stamp leaves any you have already placed on the map, shown as
a neutral placeholder, rather than silently erasing them.

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
that face a specific direction. Stamps anchor to the same two spaces: either a
square, or one named face of one edge.

Saved files record a schema version. Maps written by earlier versions are
migrated when they are opened, whether they come from a file or from local
storage.

## Project layout

```
src/
  model/        Dungeon data model and pure editing operations
    types.ts        Dungeon, Level, Cell, Edge and Stamp types
    coords.ts       Canonical edge addressing, hit-testing, drag sampling
    dungeon.ts      Factories for dungeons and levels
    operations.ts   Floor, wall, room, stamp and eraser edits
    icons.ts        The bundled icon set, as shapes on a 24x24 grid
    stamps.ts       Built-in stamp catalogue and lookup
    stampLayout.ts  Where stamps are drawn, shared with hit-testing
  persistence/
    storage.ts        IndexedDB reads and writes
    serialisation.ts  Versioned JSON export, validated import, migration
    usePersistence.ts Debounced autosave and startup restore
    fileTransfer.ts   Browser file download and read helpers
  state/
    editor.ts     Reducer holding the dungeon, tools, view and undo history
  components/
    MapCanvas.tsx          SVG grid, rendering and pointer handling
    Toolbar.tsx            Tool buttons and keyboard shortcuts
    StampPalette.tsx       Stamp catalogue, search and the custom stamp editor
    StampIcon.tsx          Icon rendering for the map and the palette
    PropertiesPanel.tsx    Editing for the current selection
    StatusBar.tsx          Level switching, coordinates and zoom
    DungeonFileControls.tsx Save status, new, export and import
```

The dungeon model has no dependency on the UI, and all edits are immutable, so
undo history is just a list of previous dungeon references.

One module, `stampLayout.ts`, decides where every stamp is drawn. Rendering,
hit-testing and placement previews all read from it, because if they each
worked out their own geometry they would eventually disagree and clicking a
symbol would select something else.

## Status

Phases 1 to 3 are complete:

- **Phase 1** — grid, pan and zoom, drawing tools, selection, undo/redo, and
  multiple levels.
- **Phase 2** — autosave to browser storage, restore on startup, and versioned
  JSON export/import.
- **Phase 3** — the stamp system: built-in catalogue, square and wall-face
  anchoring, labels and notes, cross-level links, and custom stamps.

Ideas for later:

- A library for managing several dungeons at once.
- PNG and print export, and a legend generated from the stamps in use.
- Search across labels and notes, filtered by stamp type.
- Marking secrets as found or still outstanding, and counting what remains.
