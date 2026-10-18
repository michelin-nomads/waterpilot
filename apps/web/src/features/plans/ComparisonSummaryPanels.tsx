import { Icon } from '../../components';
import type { Comparison } from './PlanComparisonView';
import { formatMetric, formatOutcomeRange } from './plansFormat';
import { ImpactContextPanel } from './WiderImpactView';
import styles from './Plans.module.scss';

/** Compare the modelled ranges actually returned, rather than inventing a yearly forecast. */
export function ComparisonSummaryPanels({
  comparison,
  selectedId,
}: {
  comparison: Comparison;
  selectedId: string | null;
}) {
  const unit = comparison.unit ?? 'RATIO';
  const preview = comparison.options.find((o) => o.id === selectedId) ?? comparison.options[0];
  const values = [
    comparison.baselineValue,
    comparison.targetLevel,
    ...comparison.options.flatMap((o) => [o.pessimistic, o.optimistic]),
  ]
    .map((n) => (n ? Number(n.value) : NaN))
    .filter(Number.isFinite);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const position = (v: number) => Math.max(0, Math.min(100, ((v - min) / span) * 100));
  const metric = comparison.metric
    ? comparison.metric.toLowerCase().replaceAll('_', ' ')
    : 'your goal';
  return (
    <div className={styles.summaryPanels}>
      <section className={styles.summaryPanel} aria-labelledby="outlook-title">
        <header className={styles.supportHead}>
          <span className={styles.supportIcon}>
            <Icon name="chart" />
          </span>
          <div>
            <h3 id="outlook-title">Projected outcomes</h3>
            <p className={styles.muted}>Compare {metric} under each plan.</p>
          </div>
        </header>
        <div className={styles.chartContext}>
          <span>Current: {formatMetric(comparison.baselineValue, unit)}</span>
          <span>Target: {formatMetric(comparison.targetLevel, unit)}</span>
        </div>
        <ul className={styles.rangeChart} aria-label="Projected outcome ranges">
          {comparison.options.map((o) => {
            const a = o.pessimistic == null ? NaN : Number(o.pessimistic.value);
            const b = o.optimistic == null ? NaN : Number(o.optimistic.value);
            return (
              <li key={o.id} data-chosen={o.id === selectedId || undefined}>
                <div className={styles.rangeLabel}>
                  <span>Plan {o.rank}</span>
                  <strong>{formatOutcomeRange(o.pessimistic, o.optimistic, unit)}</strong>
                </div>
                <div className={styles.rangeTrack} aria-hidden="true">
                  {Number.isFinite(a) && Number.isFinite(b) && (
                    <span
                      className={styles.rangeBand}
                      style={{
                        left: `${Math.min(99.4, position(Math.min(a, b)))}%`,
                        width: `${Math.max(0.6, position(Math.max(a, b)) - Math.min(99.4, position(Math.min(a, b))))}%`,
                      }}
                    />
                  )}
                  {comparison.targetLevel && (
                    <span
                      className={styles.targetMarker}
                      style={{ left: `${position(Number(comparison.targetLevel.value))}%` }}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p className={styles.chartNote}>
          <span /> Low-to-high estimate range <i /> Goal target
        </p>
        <p className={styles.muted}>
          Outcomes use your current estimates. Time-based projections are not yet available.
        </p>
      </section>
      <section className={styles.summaryPanel} aria-labelledby="neighbourhood-title">
        <header className={styles.supportHead}>
          <span className={styles.supportIcon}>
            <Icon name="map" />
          </span>
          <div>
            <h3 id="neighbourhood-title">Neighbourhood impact</h3>
            <p className={styles.muted}>Understand the connections beyond your site.</p>
          </div>
        </header>
        {preview && (
          <div className={styles.impactPreview}>
            <span className={styles.muted}>
              {preview.id === selectedId ? 'Selected plan' : 'Preview'} · Plan {preview.rank}
            </span>
            <strong>
              {preview.impact.externalities.length
                ? `${preview.impact.externalities.length} possible wider ${preview.impact.externalities.length === 1 ? 'effect' : 'effects'} recorded`
                : 'Wider impact needs review'}
            </strong>
            <p className={styles.muted}>
              Review the plan’s impact details for benefits, trade-offs and uncertainties.
            </p>
          </div>
        )}
        <div className={styles.nearbySummary}>
          <Icon name="users" size="sm" />
          <p>
            {comparison.impactContext.nearby.length
              ? `${comparison.impactContext.nearby.length} nearby ${comparison.impactContext.nearby.length === 1 ? 'community' : 'communities'} recorded within ${comparison.impactContext.nearbyRadiusM / 1000} km.`
              : 'No nearby communities recorded in the current evidence.'}
          </p>
        </div>
        <p className={styles.muted}>
          Proximity alone does not establish a shared aquifer, catchment or water network.
        </p>
        <details className={styles.quickDetails}>
          <summary>
            Connections, sources & limitations <Icon name="chevron-down" size="sm" />
          </summary>
          <div className={styles.evidenceContent}>
            <ImpactContextPanel
              context={comparison.impactContext}
              engineVersion={comparison.impactEngineVersion}
            />
          </div>
        </details>
      </section>
    </div>
  );
}
