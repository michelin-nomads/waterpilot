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

  const baselineNum = comparison.baselineValue ? Number(comparison.baselineValue.value) : NaN;
  const targetNum = comparison.targetLevel ? Number(comparison.targetLevel.value) : NaN;
  const isReduction =
    comparison.metric === 'SHORTAGE_DAYS' ||
    comparison.metric === 'TANKER_DEPENDENCE' ||
    (Number.isFinite(baselineNum) && Number.isFinite(targetNum) && baselineNum >= targetNum);

  // If reduction metric: scale 0% = 0 days saved (baseline), 100% = baselineNum days saved (zero shortage)
  const targetSaved =
    Number.isFinite(baselineNum) && Number.isFinite(targetNum)
      ? Math.max(0, baselineNum - targetNum)
      : 0;

  const targetPct =
    Number.isFinite(baselineNum) && baselineNum > 0
      ? Math.max(0, Math.min(100, (targetSaved / baselineNum) * 100))
      : 50;

  // Fallback scale for non-reduction metrics
  const values = [
    comparison.baselineValue,
    comparison.targetLevel,
    ...comparison.options.flatMap((o) => [o.pessimistic, o.optimistic]),
  ]
    .map((n) => (n ? Number(n.value) : NaN))
    .filter(Number.isFinite);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(0, ...values);
  const span = maxVal - minVal || 1;
  const genericPosition = (v: number) => Math.max(0, Math.min(100, ((v - minVal) / span) * 100));

  const metricLabel =
    comparison.metric === 'TANKER_DEPENDENCE'
      ? 'tanker dependence'
      : 'water shortage days';

  return (
    <div className={styles.summaryPanels}>
      <section className={styles.summaryPanel} aria-labelledby="outlook-title">
        <header className={styles.supportHead}>
          <span className={styles.supportIcon}>
            <Icon name="chart" />
          </span>
          <div>
            <h3 id="outlook-title">Projected outcomes</h3>
            <p className={styles.muted}>
              Compare expected {metricLabel} and progress toward your goal under each plan.
            </p>
          </div>
        </header>

        <div className={styles.chartContext}>
          <span className={styles.contextPill}>
            Current baseline: {formatMetric(comparison.baselineValue, unit)}
          </span>
          {comparison.targetLevel && (
            <span className={styles.contextPill}>
              Target: {formatMetric(comparison.targetLevel, unit)}
              {targetSaved > 0 && ` (≥${targetSaved} days saved needed)`}
            </span>
          )}
        </div>

        <ul className={styles.rangeChart} aria-label="Projected outcome ranges">
          {comparison.options.map((o) => {
            const opt = o.optimistic == null ? NaN : Number(o.optimistic.value);
            const pess = o.pessimistic == null ? NaN : Number(o.pessimistic.value);
            const remLow = Math.min(opt, pess);
            const remHigh = Math.max(opt, pess);

            const savedLow = Number.isFinite(baselineNum) ? Math.max(0, baselineNum - remHigh) : 0;
            const savedHigh = Number.isFinite(baselineNum) ? Math.max(0, baselineNum - remLow) : 0;

            const pctMin =
              isReduction && Number.isFinite(baselineNum) && baselineNum > 0
                ? Math.max(0, Math.min(100, (savedLow / baselineNum) * 100))
                : genericPosition(remLow);
            const pctMax =
              isReduction && Number.isFinite(baselineNum) && baselineNum > 0
                ? Math.max(0, Math.min(100, (savedHigh / baselineNum) * 100))
                : genericPosition(remHigh);

            const bufferMin = Number.isFinite(targetNum) ? targetNum - remHigh : 0;
            const bufferMax = Number.isFinite(targetNum) ? targetNum - remLow : 0;
            const meetsTarget = bufferMin >= 0;
            const exceedsTarget = bufferMin >= 10;

            return (
              <li
                key={o.id}
                data-chosen={o.id === selectedId || undefined}
                className={styles.rangeItem}
              >
                <div className={styles.rangeLabel}>
                  <div className={styles.planIdentityRow}>
                    <span className={styles.planRank}>Plan {o.rank}</span>
                    <span className={styles.planItemName}>· {o.name}</span>
                    {exceedsTarget ? (
                      <span className={styles.badgeExceeds}>
                        ★ Exceeds target (+{bufferMin === bufferMax ? bufferMin : `${bufferMin}–${bufferMax}`}d buffer)
                      </span>
                    ) : meetsTarget ? (
                      <span className={styles.badgeMeets}>
                        ✓ Meets target (+{bufferMin === bufferMax ? bufferMin : `${bufferMin}–${bufferMax}`}d buffer)
                      </span>
                    ) : null}
                  </div>
                  <div className={styles.outcomeMetricsRow}>
                    <strong className={styles.remainingFigure}>
                      {formatOutcomeRange(o.pessimistic, o.optimistic, unit)}
                    </strong>
                    {isReduction && savedHigh > 0 && (
                      <span className={styles.savingsFigure}>
                        ↓{' '}
                        {savedLow === savedHigh
                          ? `${savedLow} days`
                          : `${savedLow} to ${savedHigh} days`}{' '}
                        saved ({Math.round((savedHigh / baselineNum) * 100)}% reduction)
                      </span>
                    )}
                  </div>
                </div>

                <div className={styles.rangeTrack} aria-hidden="true">
                  {/* Base guaranteed reduction bar (solid teal) */}
                  <span
                    className={styles.rangeBandSolid}
                    style={{
                      left: '0%',
                      width: `${Math.max(1, pctMin)}%`,
                    }}
                  />
                  {/* Range extension (optimistic) */}
                  {pctMax > pctMin && (
                    <span
                      className={styles.rangeBandRange}
                      style={{
                        left: `${pctMin}%`,
                        width: `${Math.max(1, pctMax - pctMin)}%`,
                      }}
                    />
                  )}
                  {/* Target milestone marker */}
                  {comparison.targetLevel && (
                    <span
                      className={styles.targetMarker}
                      style={{
                        left: `${isReduction ? targetPct : genericPosition(Number(comparison.targetLevel.value))}%`,
                      }}
                      title={`Target threshold: ${targetNum} days`}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {/* Scale Axis */}
        {isReduction && Number.isFinite(baselineNum) && baselineNum > 0 && (
          <div className={styles.scaleRuler} aria-hidden="true">
            <span className={styles.scaleStart}>0 days saved (Baseline: {baselineNum}d)</span>
            {comparison.targetLevel && (
              <span className={styles.scaleTarget} style={{ left: `${targetPct}%` }}>
                ▲ Target: {targetNum}d ({targetSaved}d saved)
              </span>
            )}
            <span className={styles.scaleEnd}>{baselineNum} days saved (Zero shortage)</span>
          </div>
        )}

        {/* Legend */}
        <div className={styles.chartNote}>
          <span className={styles.legendSolid} /> Guaranteed reduction (conservative)
          <span className={styles.legendRange} /> Additional potential reduction (optimistic)
          <i className={styles.legendTargetLine} /> Goal target threshold
        </div>

        <p className={styles.muted}>
          Outcomes use baseline data and CPHEEO municipal engineering models. Higher bars indicate
          greater water security and reduction in tanker dependence.
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
