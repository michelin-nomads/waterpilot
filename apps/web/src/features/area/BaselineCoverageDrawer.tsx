import { ErrorState, LoadingRegion, PermissionState, Skeleton } from '../../components';
import { AreaBaselineDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { GraphQLRequestError } from '../../graphql/requestError';
import { queryKeys } from '../../graphql/queryKeys';
import { formatLocalDate } from './baselineFormat';
import styles from './BaselineCoverageDrawer.module.scss';

interface Props {
  areaId: string;
  sessionId: string | null;
}

function statusLabel(value: string): string {
  return value === 'AVAILABLE' ? 'Available' : value === 'PROVISIONAL' ? 'Partial' : 'Unavailable';
}

function sourceLabel(publisher: string | null, title: string, note: string | null): string {
  const source = publisher ? `${publisher} · ${title}` : title;
  return note ? `${source} — ${note}` : source;
}

/** Shows the current backend's provenance and coverage without filling unknown fields. */
export function BaselineCoverageDrawer({ areaId, sessionId }: Props) {
  const query = useGraphQLQuery(queryKeys.baseline.area(areaId, sessionId), AreaBaselineDocument, {
    areaId,
    sessionId,
  });

  if (query.isPending) {
    return (
      <LoadingRegion label="Loading data coverage">
        <Skeleton />
        <Skeleton shape="block" />
      </LoadingRegion>
    );
  }
  if (query.isError) {
    const code = query.error instanceof GraphQLRequestError ? query.error.code : null;
    if (code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'UNAUTHENTICATED') {
      return (
        <PermissionState title="Data coverage is not available">
          The selected area or planning session is no longer available to you.
        </PermissionState>
      );
    }
    return (
      <ErrorState
        title="Data coverage could not load"
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        requestId={
          query.error instanceof GraphQLRequestError
            ? (query.error.requestId ?? undefined)
            : undefined
        }
      >
        The baseline remains open. Check your connection and try again.
      </ErrorState>
    );
  }

  const area = query.data.area;
  if (!area) {
    return (
      <PermissionState title="Data coverage is not available">
        The selected area no longer exists.
      </PermissionState>
    );
  }

  const baseline = area.baseline;
  const rows = [
    ...baseline.metrics.flatMap((metric) =>
      metric.evidence.length > 0
        ? metric.evidence.map((evidence, index) => ({
            id: `${metric.metric}-${evidence.snapshotId ?? evidence.manualInputId ?? index}`,
            dataset: metric.name,
            source: sourceLabel(evidence.publisher, evidence.title, evidence.note),
            url: evidence.url,
            date: evidence.asOf ?? metric.asOf,
            resolution: evidence.method
              ? evidence.method.toLowerCase().replace(/_/g, ' ')
              : metric.daily
                ? 'Daily records'
                : 'Summary value',
            coverage:
              metric.periodDays !== null
                ? metric.recordedDays !== null
                  ? `${metric.recordedDays} of ${metric.periodDays} days`
                  : `Not reported within ${metric.periodDays} days`
                : 'Not reported',
            status: statusLabel(metric.availability),
          }))
        : [
            {
              id: `${metric.metric}-no-source`,
              dataset: metric.name,
              source: 'Source not recorded',
              url: null,
              date: metric.asOf,
              resolution: metric.daily ? 'Daily records' : 'Summary value',
              coverage:
                metric.periodDays !== null
                  ? metric.recordedDays !== null
                    ? `${metric.recordedDays} of ${metric.periodDays} days`
                    : `Not reported within ${metric.periodDays} days`
                  : 'Not reported',
              status: statusLabel(metric.availability),
            },
          ],
    ),
    ...baseline.indicators.flatMap((indicator) =>
      indicator.evidence.length > 0
        ? indicator.evidence.map((evidence, index) => ({
            id: `${indicator.indicator}-${evidence.snapshotId ?? evidence.manualInputId ?? index}`,
            dataset: indicator.parameter
              ? `${indicator.name} · ${indicator.parameter}`
              : indicator.name,
            source: sourceLabel(evidence.publisher, evidence.title, evidence.note),
            url: evidence.url,
            date: evidence.asOf ?? indicator.observedOn,
            resolution:
              evidence.method?.toLowerCase().replace(/_/g, ' ') ??
              (indicator.statistic === 'LATEST' ? 'Most recent reading' : 'Summary window'),
            coverage: indicator.window ? `${indicator.window.days}-day window` : 'Not reported',
            status: statusLabel(indicator.availability),
          }))
        : [
            {
              id: `${indicator.indicator}-no-source`,
              dataset: indicator.parameter
                ? `${indicator.name} · ${indicator.parameter}`
                : indicator.name,
              source: 'Source not recorded',
              url: null,
              date: indicator.observedOn,
              resolution:
                indicator.statistic === 'LATEST' ? 'Most recent reading' : 'Summary window',
              coverage: indicator.window ? `${indicator.window.days}-day window` : 'Not reported',
              status: statusLabel(indicator.availability),
            },
          ],
    ),
  ];
  const limitations = [
    ...baseline.notes,
    ...baseline.metrics.flatMap((metric) => [
      ...metric.reasons.map((reason) => `${metric.name}: ${reason}`),
      ...metric.assumptions.map((assumption) => `${metric.name}: ${assumption}`),
      ...metric.evidence.map((evidence) => `${metric.name}: ${evidence.uncertainty}`),
    ]),
    ...baseline.indicators.flatMap((indicator) =>
      indicator.reasons.map((reason) => `${indicator.name}: ${reason}`),
    ),
  ];

  return (
    <div className={styles.content}>
      <div
        className={styles.tableScroller}
        role="region"
        aria-label="Data coverage table"
        tabIndex={0}
      >
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Dataset</th>
              <th scope="col">Source</th>
              <th scope="col">Date</th>
              <th scope="col">Resolution</th>
              <th scope="col">Coverage</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} data-status={row.status}>
                <th scope="row">{row.dataset}</th>
                <td>
                  {row.url ? (
                    <a href={row.url} target="_blank" rel="noopener noreferrer">
                      {row.source}
                    </a>
                  ) : (
                    row.source
                  )}
                </td>
                <td>{row.date ? formatLocalDate(row.date) : 'Not reported'}</td>
                <td>{row.resolution}</td>
                <td>{row.coverage}</td>
                <td>
                  <span className={styles.status}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className={styles.limitations}>
        <summary>Limitations and assumptions</summary>
        {limitations.length > 0 ? (
          <ul>
            {[...new Set(limitations)].map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        ) : (
          <p>No additional limitations were returned for this baseline.</p>
        )}
      </details>
    </div>
  );
}
