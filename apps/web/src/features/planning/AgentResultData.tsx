/** Tool-owned data only; React escapes all strings. No model-produced components or HTML. */
const label = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const hidden =
  /^(id|.*Id|.*Ids|.*_id|.*_ids|uid|owner_uid|ownerUid|created_at|createdAt|updated_at|updatedAt|inputs_revision|inputsRevision|revision|version|mode|status|baseline_reviewed|baselineReviewed|confirmation_token|confirmationToken|parameters|requires_confirmation|requiresConfirmation|needsClarification|needs_clarification|question|query|engine_version|engineVersion|as_of|asOf|assessed_at|assessedAt|basis|window_days|windowDays|demo|sources?|source_snapshots?|sourceSnapshots?|checksum|hash|raw_payload|rawPayload|observed_version|observedVersion|admin|types|radius_m|radiusM)$/i;

export function AgentResultData({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) return <span>Unavailable</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'number') return <span>{new Intl.NumberFormat().format(value)}</span>;
  if (typeof value !== 'object') return <span>{String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return (
      <ul>
        {value.slice(0, 20).map((item, index) => (
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
    if (typeof val === 'string' && val.trim() === '') return false;
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
          ? String((value as Record<string, unknown>).name)
          : 'title' in value
            ? String((value as Record<string, unknown>).title)
            : 'Details'
        : 'Details';
    return (
      <details open={depth === 1}>
        <summary>{summaryLabel}</summary>
        {content}
      </details>
    );
  }

  return content;
}

