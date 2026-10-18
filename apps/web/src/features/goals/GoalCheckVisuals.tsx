import type { CSSProperties } from 'react';

import { Icon } from '../../components';
import type { GoalAssessmentFieldsFragment } from '../../graphql/generated/graphql';
import { shiftDecimalRight } from '../../lib/format';
import { UNIT_LABEL } from './goalLabels';
import styles from './Goals.module.scss';

type Assessment = GoalAssessmentFieldsFragment;

/** Charts only returned evidence; missing values never become zero or a forecast. */
export function GoalCheckVisuals({ assessment: a }: { assessment: Assessment }) {
  const { baseline, targetLevel, unit } = a.target;
  const values = [baseline, targetLevel].map((value) => (value === null ? null : Number(value)));
  const canCompare = values.every(
    (value) =>
      value !== null && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER,
  );
  const max = canCompare ? Math.max(...(values as number[])) : 0;
  const display = (value: string | null) =>
    value === null ? 'Unavailable' : unit === 'RATIO' ? `${shiftDecimalRight(value, 2)}%` : value;
  const relevant = a.interventions.filter((fit) => fit.relevant);
  const fits = relevant.filter((fit) => fit.site.outcome === 'FEASIBLE').length;
  const excluded = relevant.filter((fit) => fit.site.outcome === 'INFEASIBLE').length;
  const unknown = relevant.length - fits - excluded;
  const fitEnd = relevant.length ? (fits / relevant.length) * 100 : 0;
  const excludedEnd = relevant.length ? ((fits + excluded) / relevant.length) * 100 : 0;

  return (
    <div className={styles.checkVisuals}>
      <figure className={styles.targetChart} aria-label="Baseline and target comparison">
        <figcaption>
          <Icon name="chart" size="sm" /> Baseline & target
        </figcaption>
        <div className={styles.targetChartRows}>
          {(
            [
              { label: 'Baseline', value: baseline },
              { label: 'Your target', value: targetLevel },
            ] as const
          ).map((row, i) => (
            <div className={styles.chartRow} key={row.label}>
              <div>
                <span>{row.label}</span>
                <strong>{display(row.value)}</strong>
              </div>
              {canCompare ? (
                <div className={styles.barTrack} aria-hidden="true">
                  <span
                    data-target={i === 1}
                    style={{ width: `${max ? (values[i]! / max) * 100 : 0}%` }}
                  />
                </div>
              ) : (
                <div
                  className={styles.dataMarker}
                  data-missing={row.value === null}
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
        <p className={styles.muted}>
          {canCompare
            ? `${unit ? (UNIT_LABEL[unit] ?? unit) : 'Values'} · baseline and desired level`
            : 'Matching baseline data is needed for a comparison.'}
        </p>
      </figure>
      <figure
        className={styles.fitChart}
        aria-label={`Site suitability: ${fits} fit, ${excluded} ruled out, ${unknown} need details`}
      >
        <figcaption>
          <Icon name="layers" size="sm" /> Site suitability
        </figcaption>
        {relevant.length ? (
          <div className={styles.fitChartBody}>
            <div
              className={styles.fitDonut}
              aria-hidden="true"
              style={
                { '--fit-end': `${fitEnd}%`, '--excluded-end': `${excludedEnd}%` } as CSSProperties
              }
            >
              <div>
                <strong>{relevant.length}</strong>
                <span>measures</span>
              </div>
            </div>
            <ul className={styles.chartLegend}>
              <li data-fit="fits">
                <span>Fit your site</span>
                <strong>{fits}</strong>
              </li>
              <li data-fit="excluded">
                <span>Ruled out</span>
                <strong>{excluded}</strong>
              </li>
              <li data-fit="unknown">
                <span>Need details</span>
                <strong>{unknown}</strong>
              </li>
            </ul>
          </div>
        ) : (
          <div className={styles.chartEmpty}>
            <Icon name="layers" />
            <span>No matching measures yet</span>
          </div>
        )}
      </figure>
    </div>
  );
}
