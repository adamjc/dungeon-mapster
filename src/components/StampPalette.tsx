import { useMemo, useState } from 'react';
import { newId } from '../model/dungeon';
import { ICON_IDS } from '../model/icons';
import {
  allStamps,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  STAMP_COLOURS,
} from '../model/stamps';
import type { StampAnchorKind, StampDefinition } from '../model/types';
import type { EditorAction, EditorState } from '../state/editor';
import { Icon } from './StampIcon';

interface Props {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
}

export function StampPalette({ state, dispatch }: Props) {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const stamps = useMemo(() => allStamps(state.dungeon), [state.dungeon]);

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return null;
    return stamps.filter((stamp) => stamp.name.toLowerCase().includes(term));
  }, [stamps, search]);

  const recents = state.recentStampIds
    .map((id) => stamps.find((stamp) => stamp.id === id))
    .filter((stamp): stamp is StampDefinition => Boolean(stamp))
    .slice(0, 6);

  const select = (stampId: string) => dispatch({ type: 'setActiveStamp', stampId });

  return (
    <div className="palette" aria-label="Stamps">
      <input
        type="search"
        className="palette__search"
        placeholder="Search stamps…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        aria-label="Search stamps"
      />

      {matches ? (
        <StampGrid
          stamps={matches}
          activeStampId={state.activeStampId}
          onSelect={select}
          emptyMessage="No stamps match that."
        />
      ) : (
        <>
          {recents.length > 0 && (
            <section className="palette__section">
              <h3>Recent</h3>
              <StampGrid
                stamps={recents}
                activeStampId={state.activeStampId}
                onSelect={select}
              />
            </section>
          )}

          {CATEGORY_ORDER.map((category) => {
            const group = stamps.filter((stamp) => stamp.category === category);
            if (group.length === 0) return null;

            return (
              <section className="palette__section" key={category}>
                <h3>{CATEGORY_LABELS[category]}</h3>
                <StampGrid
                  stamps={group}
                  activeStampId={state.activeStampId}
                  onSelect={select}
                  onDelete={(stamp) => deleteCustomStamp(state, dispatch, stamp)}
                />
              </section>
            );
          })}
        </>
      )}

      {creating ? (
        <CustomStampForm
          state={state}
          dispatch={dispatch}
          onClose={() => setCreating(false)}
        />
      ) : (
        <button
          type="button"
          className="palette__new"
          onClick={() => setCreating(true)}
        >
          New stamp…
        </button>
      )}
    </div>
  );
}

function StampGrid({
  stamps,
  activeStampId,
  onSelect,
  onDelete,
  emptyMessage,
}: {
  stamps: StampDefinition[];
  activeStampId: string;
  onSelect: (stampId: string) => void;
  onDelete?: (stamp: StampDefinition) => void;
  emptyMessage?: string;
}) {
  if (stamps.length === 0) {
    return <p className="hint">{emptyMessage ?? 'Nothing here yet.'}</p>;
  }

  return (
    <div className="stamp-grid">
      {stamps.map((stamp) => (
        <div className="stamp-grid__item" key={stamp.id}>
          <button
            type="button"
            className={`stamp-button${stamp.id === activeStampId ? ' stamp-button--active' : ''}`}
            onClick={() => onSelect(stamp.id)}
            aria-pressed={stamp.id === activeStampId}
            title={`${stamp.name} — ${describeAnchors(stamp.anchors)}`}
          >
            <Icon icon={stamp.icon} colour={stamp.colour} size={22} />
            <span>{stamp.name}</span>
          </button>
          {onDelete && !stamp.builtIn && (
            <button
              type="button"
              className="stamp-delete"
              onClick={() => onDelete(stamp)}
              aria-label={`Delete ${stamp.name}`}
              title={`Delete ${stamp.name}`}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function describeAnchors(anchors: StampAnchorKind[]): string {
  if (anchors.length === 2) return 'goes in a square or on a wall';
  return anchors[0] === 'edge' ? 'mounted on a wall' : 'placed in a square';
}

function CustomStampForm({
  state,
  dispatch,
  onClose,
}: {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICON_IDS[0]);
  const [colour, setColour] = useState(STAMP_COLOURS[0]);
  const [onCell, setOnCell] = useState(true);
  const [onEdge, setOnEdge] = useState(false);

  const trimmed = name.trim();
  const anchors: StampAnchorKind[] = [
    ...(onCell ? (['cell'] as const) : []),
    ...(onEdge ? (['edge'] as const) : []),
  ];
  const valid = trimmed.length > 0 && anchors.length > 0;

  const create = () => {
    if (!valid) return;

    const definition: StampDefinition = {
      id: `custom-${newId()}`,
      name: trimmed,
      category: 'custom',
      icon,
      colour,
      anchors,
      linkable: false,
      builtIn: false,
    };

    dispatch({
      type: 'commitDungeon',
      dungeon: {
        ...state.dungeon,
        customStamps: [...state.dungeon.customStamps, definition],
        updatedAt: new Date().toISOString(),
      },
    });
    dispatch({ type: 'setActiveStamp', stampId: definition.id });
    onClose();
  };

  return (
    <section className="palette__section palette__form">
      <h3>New stamp</h3>

      <label className="field">
        <span>Name</span>
        <input
          type="text"
          value={name}
          autoFocus
          placeholder="Secret button"
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <div className="field">
        <span>Symbol</span>
        <div className="icon-picker">
          {ICON_IDS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={`icon-choice${candidate === icon ? ' icon-choice--active' : ''}`}
              onClick={() => setIcon(candidate)}
              aria-label={candidate}
              aria-pressed={candidate === icon}
            >
              <Icon icon={candidate} colour={colour} size={20} />
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Colour</span>
        <div className="swatches">
          {STAMP_COLOURS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={`swatch${candidate === colour ? ' swatch--active' : ''}`}
              style={{ background: candidate }}
              onClick={() => setColour(candidate)}
              aria-label={`Colour ${candidate}`}
            />
          ))}
        </div>
      </div>

      <div className="field">
        <span>Can be placed</span>
        <label className="check">
          <input
            type="checkbox"
            checked={onCell}
            onChange={(event) => setOnCell(event.target.checked)}
          />
          In a square
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={onEdge}
            onChange={(event) => setOnEdge(event.target.checked)}
          />
          On a wall face
        </label>
      </div>

      <div className="palette__form-actions">
        <button type="button" onClick={create} disabled={!valid}>
          Create
        </button>
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>

      <p className="hint">
        Custom stamps are saved with this dungeon, so exported maps always carry
        the symbols they need.
      </p>
    </section>
  );
}

function deleteCustomStamp(
  state: EditorState,
  dispatch: React.Dispatch<EditorAction>,
  stamp: StampDefinition,
): void {
  // Placed stamps are left alone and fall back to a neutral symbol, so
  // deleting a definition never silently erases parts of the map.
  const uses = state.dungeon.levels.reduce(
    (total, level) =>
      total +
      Object.values(level.stamps).filter((placed) => placed.stampId === stamp.id)
        .length,
    0,
  );

  const message =
    uses > 0
      ? `Delete "${stamp.name}"? It is used ${uses} time${uses === 1 ? '' : 's'}, and those will show as an unknown symbol.`
      : `Delete "${stamp.name}"?`;

  if (!window.confirm(message)) return;

  dispatch({
    type: 'commitDungeon',
    dungeon: {
      ...state.dungeon,
      customStamps: state.dungeon.customStamps.filter(
        (candidate) => candidate.id !== stamp.id,
      ),
      updatedAt: new Date().toISOString(),
    },
  });

  if (state.activeStampId === stamp.id) {
    dispatch({ type: 'setActiveStamp', stampId: 'keyhole' });
  }
}
