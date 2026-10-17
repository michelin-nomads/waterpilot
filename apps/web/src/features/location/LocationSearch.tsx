import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';

import { Badge, Button, Spinner } from '../../components';
import {
  isFixturePlace,
  PlacesUnavailable,
  type Place,
  type PlacesAdapter,
  type Suggestion,
} from './types';
import { MIN_CHARS, useSuggestions } from './useSuggestions';
import styles from './Location.module.scss';

interface LocationSearchProps {
  adapter: PlacesAdapter;
  onSelect: (place: Place) => void;
  action?: ReactNode;
  showHint?: boolean;
}

function statusText(
  status: ReturnType<typeof useSuggestions>['status'],
  count: number,
  query: string,
): string {
  switch (status) {
    case 'idle':
      return '';
    case 'loading':
      return 'Searching…';
    case 'unavailable':
      return 'Place search is unavailable right now. Use your device location.';
    case 'error':
      return 'Search failed. Check your connection and try again.';
    case 'ready':
      if (count === 0) return `No place matched “${query}”. Check the spelling.`;
      if (count === 1) return `1 place matches “${query}”. Choose it to review it.`;
      return `${count} places match “${query}”. Choose the one you mean.`;
  }
}

/**
 * Accessible place search (WAI-ARIA combobox with a listbox popup). Accepts any country.
 * Choosing a result opens a review; nothing is saved until the person confirms.
 */
export function LocationSearch({
  adapter,
  onSelect,
  action,
  showHint = true,
}: LocationSearchProps) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(true);
  const [selecting, setSelecting] = useState(false);
  const [selectError, setSelectError] = useState<string | null>(null);
  const state = useSuggestions(adapter, text, attempt);
  const { suggestions } = state;
  const expanded = open && suggestions.length > 0;
  const query = text.trim();

  async function choose(suggestion: Suggestion) {
    setSelecting(true);
    setSelectError(null);
    try {
      const place = await adapter.select(suggestion);
      setOpen(false);
      onSelect(place);
    } catch (error) {
      setSelectError(
        error instanceof PlacesUnavailable
          ? `${error.message} Try again.`
          : 'Could not load that place. Try again.',
      );
    } finally {
      setSelecting(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (event.key === 'Enter' && expanded && active >= 0) {
      event.preventDefault();
      const suggestion = suggestions[active];
      if (suggestion) void choose(suggestion);
    } else if (event.key === 'Escape') {
      setOpen(false);
      setActive(-1);
    }
  }

  const status =
    'message' in state ? state.message : statusText(state.status, suggestions.length, query);
  return (
    <div className={styles.search}>
      <label htmlFor={id} className={styles.label}>
        Search for a place
      </label>
      {showHint && (
        <p id={`${id}-hint`} className={styles.hint}>
          Type at least {MIN_CHARS} characters, for example a town, district or neighbourhood.
        </p>
      )}
      <div className={styles.inputRow}>
        <div className={styles.searchControl}>
          <input
            id={id}
            className={styles.input}
            type="search"
            role="combobox"
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-describedby={showHint ? `${id}-hint ${id}-status` : `${id}-status`}
            aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setActive(-1);
              setOpen(true);
              setSelectError(null);
            }}
            onKeyDown={onKeyDown}
          />
          {(state.status === 'loading' || selecting) && <Spinner size="sm" />}
        </div>
        {action}
      </div>
      <p id={`${id}-status`} role="status" className={styles.hint}>
        {status}
      </p>
      <ul
        id={listId}
        role="listbox"
        aria-label="Matching places"
        className={styles.listbox}
        hidden={!expanded}
      >
        {suggestions.map((s, index) => (
          <li
            key={s.id}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === active}
            className={styles.option}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void choose(s)}
          >
            <span className={styles.optionPrimary}>
              {s.primary}{' '}
              {s.place && isFixturePlace(s.place) && <Badge tone="warning">Test place</Badge>}
            </span>
            {s.secondary && <span className={styles.optionSecondary}>{s.secondary}</span>}
          </li>
        ))}
      </ul>
      {selectError && (
        <p role="alert" className={styles.error}>
          {selectError}
        </p>
      )}
      <div className={styles.searchFooter}>
        <span className={styles.attribution}>{adapter.attribution}</span>
        {(state.status === 'error' || state.status === 'unavailable') && (
          <Button size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
            Search again
          </Button>
        )}
      </div>
    </div>
  );
}
