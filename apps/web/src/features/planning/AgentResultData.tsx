import { SHOW_COMMUNITY_BASELINE } from './visibility';

/** Tool-owned data only; React escapes all strings. No model-produced components or HTML. */
const label = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const hidden =
  /^(id|.*Id|.*Ids|.*_id|.*_ids|uid|owner_uid|ownerUid|created_at|createdAt|updated_at|updatedAt|inputs_revision|inputsRevision|revision|version|mode|status|baseline_reviewed|baselineReviewed|confirmation_token|confirmationToken|parameters|requires_confirmation|requiresConfirmation|needsClarification|needs_clarification|question|query|engine_version|engineVersion|as_of|asOf|assessed_at|assessedAt|basis|window_days|windowDays|demo|sources?|source_snapshots?|sourceSnapshots?|checksum|hash|raw_payload|rawPayload|observed_version|observedVersion|admin|types|radius_m|radiusM)$/i;

const readableText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() && !/^(undefined|null)$/i.test(value.trim())
    ? value.trim()
    : null;

function LocationReview({ value }: { value: unknown }) {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const rawLocation = record.location ?? record.confirmed_area;
  const location =
    rawLocation && typeof rawLocation === 'object' ? (rawLocation as Record<string, unknown>) : {};
  const name = readableText(location.name);
  if (!name) return <p>No confirmed location yet. Review and confirm an area in the workspace.</p>;
  const address = readableText(location.formatted_address ?? location.formattedAddress);
  const timezone = readableText(location.timezone);
  const country = readableText(location.country_code ?? location.countryCode);
  return (
    <div>
      <p>
        <strong>{name}</strong>
      </p>
      {address && address !== name && <p>{address}</p>}
      {(country || timezone) && <p>{[country, timezone].filter(Boolean).join(' · ')}</p>}
      <p>Location saved. You can change the point or radius in the workspace.</p>
    </div>
  );
}

const objectRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function CoverageSummary({ value }: { value: unknown }) {
  const record = objectRecord(value);
  const coverage = objectRecord(record.coverage);
  const items = Array.isArray(coverage.items) ? coverage.items.map(objectRecord) : [];
  const available = items.filter((item) => item.availability === 'available');
  const provisional = items.filter((item) => item.availability === 'provisional');
  const missing = items.filter((item) => item.availability === 'unavailable');
  const names = (rows: Record<string, unknown>[]) =>
    rows
      .slice(0, 3)
      .map((item) => readableText(item.capability))
      .filter((name): name is string => Boolean(name))
      .map(label)
      .join(', ');
  const location = readableText(objectRecord(record.location).name);
  return (
    <div>
      {location && (
        <p>
          <strong>{location}</strong>
        </p>
      )}
      <p>
        {items.length === 0
          ? 'Data coverage has not been recorded yet.'
          : available.length === 0 && provisional.length === 0
            ? 'No usable source data is registered for this area yet.'
            : `${available.length} of ${items.length} data categories available.`}
      </p>
      {available.length > 0 && (
        <p>
          Available: {names(available)}
          {available.length > 3 ? ` and ${available.length - 3} more` : ''}.
        </p>
      )}
      {provisional.length > 0 && (
        <p>
          Needs checking: {names(provisional)}
          {provisional.length > 3 ? ` and ${provisional.length - 3} more` : ''}.
        </p>
      )}
      {missing.length > 0 && (available.length > 0 || provisional.length > 0) && (
        <p>{missing.length} data categories still missing.</p>
      )}
      <p>
        {missing.length > 0 || items.length === 0
          ? SHOW_COMMUNITY_BASELINE
            ? 'Next: add the water-use and supply figures you know in Baseline. Missing evidence stays unknown.'
            : 'Next: review the area data, then test a future scenario. Missing evidence stays unknown.'
          : SHOW_COMMUNITY_BASELINE
            ? 'Next: review the baseline and its source details in the workspace.'
            : 'Next: test a future scenario using the area data in the workspace.'}
      </p>
    </div>
  );
}

export function AgentResultData({
  value,
  depth = 0,
  toolName,
}: {
  value: unknown;
  depth?: number;
  toolName?: string;
}) {
  if (toolName === 'inspect_coverage' && objectRecord(value).coverage)
    return <CoverageSummary value={value} />;
  if (toolName === 'inspect_planning_state') return <LocationReview value={value} />;
  if (value === null || value === undefined) return <span>Unavailable</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  if (typeof value === 'string' && !readableText(value)) return null;
  if (typeof value === 'number') return <span>{new Intl.NumberFormat().format(value)}</span>;
  if (typeof value !== 'object') return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return (
      <ul>
        {value
          .filter((item) => item != null && (typeof item !== 'string' || readableText(item)))
          .slice(0, 20)
          .map((item, index) => (
            <li key={index}>
              <AgentResultData value={item} depth={depth + 1} />
            </li>
          ))}
      </ul>
    );
  }

  const entries = Object.entries(value).filter(([key, val]) => {
    if (hidden.test(key)) return false;
    if (val === null || val === undefined) return false;
    if (typeof val === 'string' && !readableText(val)) return false;
    if (typeof val === 'object' && !Array.isArray(val) && Object.keys(val as object).length === 0)
      return false;
    if (Array.isArray(val) && val.length === 0) return false;
    return true;
  });

  if (entries.length === 0) {
    return depth === 0 ? <span>Session synchronized with current workspace.</span> : null;
  }

  const content = (
    <dl>
      {entries.map(([key, item]) => (
        <div key={key}>
          <dt>{label(key)}</dt>
          <dd>
            <AgentResultData value={item} depth={depth + 1} />
          </dd>
        </div>
      ))}
    </dl>
  );

  if (depth > 0) {
    const summaryLabel =
      typeof value === 'object' && value
        ? 'name' in value
          ? (readableText((value as Record<string, unknown>).name) ?? 'Details')
          : 'title' in value
            ? (readableText((value as Record<string, unknown>).title) ?? 'Details')
            : 'Details'
        : 'Details';
    return (
      <details>
        <summary>{summaryLabel}</summary>
        {content}
      </details>
    );
  }

  return content;
}
