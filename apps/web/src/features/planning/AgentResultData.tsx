/** Tool-owned data only; React escapes all strings. No model-produced components or HTML. */
const label = (key: string) => key.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ');
const hidden =
  /^(id|.*Id|.*Ids|version|inputsRevision|confirmationToken|parameters|requiresConfirmation)$/;

export function AgentResultData({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined) return <span>Unavailable</span>;
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'number') return <span>{new Intl.NumberFormat().format(value)}</span>;
  if (typeof value !== 'object') return <span>{String(value)}</span>;
  if (Array.isArray(value))
    return (
      <ul>
        {value.slice(0, 20).map((item, index) => (
          <li key={index}>
            <AgentResultData value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  const entries = Object.entries(value).filter(([key]) => !hidden.test(key));
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
  return depth > 0 ? (
    <details>
      <summary>View details</summary>
      {content}
    </details>
  ) : (
    content
  );
}
