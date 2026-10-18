import { useId } from 'react';

import { Badge, Icon, Skeleton, Tooltip, type IconName } from '../../components';
import {
  baselineUnits,
  formatLocalDate,
  formatWindow,
  formatQuantity,
  quantityText,
  type Baseline,
} from './baselineFormat';
import styles from './AreaConditions.module.scss';

type Condition = {
  key: string;
  label: string;
  icon: IconName;
  tone: string;
  description: string;
  help: string;
};

const CONDITIONS: readonly Condition[] = [
  {
    key: 'water_stress',
    label: 'Water stress',
    icon: 'alert',
    tone: 'warning',
    description: 'Pressure on local water resources',
    help: 'A reviewed assessment of demand relative to available water resources. A local supply gap alone does not establish regional water stress.',
  },
  {
    key: 'rainfall',
    label: 'Rainfall',
    icon: 'droplet',
    tone: 'info',
    description: 'Rain received over the reporting period',
    help: 'Rainfall observations for the selected area. The source, reporting period and spatial resolution determine what this estimate represents.',
  },
  {
    key: 'dependable_supply_ratio',
    label: 'Reliable supply',
    icon: 'check',
    tone: 'accent',
    description: 'Share of demand covered dependably',
    help: 'Reliable supply as a percentage of demand. This requires demand and daily supply records; satellite imagery alone cannot establish it.',
  },
  {
    key: 'deficit',
    label: 'Current water deficit',
    icon: 'chart',
    tone: 'info',
    description: 'Daily gap between demand and reliable supply',
    help: 'Water demand minus reliable supply, with a minimum of zero. MLD means million litres per day.',
  },
  {
    key: 'shortage_days',
    label: 'Water shortage days',
    icon: 'calendar',
    tone: 'danger',
    description: 'Days with less supply than demand',
    help: 'Days when supply falls below demand during the reporting period. This is not an annual or summer estimate unless the source period supports that interpretation.',
  },
  {
    key: 'groundwater',
    label: 'Groundwater',
    icon: 'layers',
    tone: 'accent',
    description: 'Local groundwater conditions',
    help: 'Groundwater observations require a suitable source and reporting method. Satellite estimates may describe a wider region than your planning area.',
  },
];

interface Props {
  selected?: boolean;
  baseline?: Baseline | null;
  unitSystem?: 'METRIC' | 'US_CUSTOMARY';
  loading?: boolean;
  failed?: boolean;
  onRetry?: () => void;
}

/** Area overview. Only reviewed API results are displayed; absent sources remain explicit. */
export function AreaConditions({
  selected = false,
  baseline,
  unitSystem = 'METRIC',
  loading = false,
  failed = false,
  onRetry,
}: Props) {
  const id = useId();
  const units = baseline ? baselineUnits(baseline, unitSystem) : null;
  const rows = CONDITIONS.map((condition) => {
    const metric = baseline?.metrics.find((m) => m.metric === condition.key);
    const indicator =
      condition.key === 'rainfall' || condition.key === 'groundwater'
        ? baseline?.indicators.find(
            (i) =>
              (condition.key === 'rainfall'
                ? i.capability === 'RAINFALL'
                : i.capability === 'GROUNDWATER_LEVEL' ||
                  i.capability === 'GROUNDWATER_ABSTRACTION') &&
              i.value !== null,
          )
        : undefined;
    const result = metric ?? indicator;
    const available =
      result?.value != null && result.unit != null && result.availability !== 'UNAVAILABLE';
    let value =
      available && units ? quantityText(formatQuantity(result.value!, result.unit!, units)) : null;
    if (value && condition.key === 'water_stress') {
      const ratioNum = Number(result?.value ?? '0');
      const level = ratioNum >= 0.7 ? 'High Stress' : ratioNum >= 0.4 ? 'Moderate' : 'Low Stress';
      value = `${level} (${value})`;
    }
    return { ...condition, result, value, window: indicator?.window ?? baseline?.window };
  });
  const count = rows.filter((row) => row.value !== null).length;
  return (
    <section className={styles.overview} aria-labelledby={`${id}-title`} aria-busy={loading}>
      <header className={styles.header}>
        <div>
          <h2 id={`${id}-title`}>Water conditions</h2>
        </div>
        <Badge tone={count ? 'accent' : 'neutral'}>
          {loading ? 'Checking data' : `${count} of 6 available`}
        </Badge>
      </header>
      <p className={styles.intro}>
        {selected
          ? 'Available evidence for your selected area. Review source details for coverage and reporting periods.'
          : 'Select a location to see the water conditions that shape your community’s plan.'}
      </p>
      {failed && (
        <p role="alert" className={styles.failure}>
          We couldn’t load the area’s water data.{' '}
          <button type="button" onClick={onRetry}>
            Retry area data
          </button>
        </p>
      )}
      <div className={styles.grid}>
        {rows.map((row) => (
          <article key={row.key} className={`${styles.condition} ${styles[row.tone]}`}>
            <div className={styles.cardHead}>
              <span className={styles.icon}>
                <Icon name={row.icon} />
              </span>
              <h3>{row.label}</h3>
              <Tooltip label={`About ${row.label.toLowerCase()}`}>{row.help}</Tooltip>
            </div>
            {loading ? (
              <Skeleton width="half" />
            ) : (
              <p className={row.value ? styles.value : styles.empty}>
                {row.value ?? '—'}
                {!row.value && <span>{selected ? 'Data unavailable' : 'Select an area'}</span>}
              </p>
            )}
            <p className={styles.description}>
              {row.value && (row.key === 'rainfall' || row.key === 'groundwater')
                ? row.result?.name
                : row.description}
            </p>
            {row.value && row.window && <p className={styles.period}>{formatWindow(row.window)}</p>}
            <div className={styles.meta}>
              {row.value ? (
                <>
                  <Badge tone={row.result?.demo ? 'warning' : 'neutral'}>
                    {row.result?.demo
                      ? 'Synthetic demo'
                      : row.result?.origin === 'MEASURED'
                        ? 'Measured'
                        : row.result?.origin === 'USER_ESTIMATE'
                          ? 'Your estimate'
                          : 'Modelled'}
                  </Badge>
                  {row.result?.availability === 'PROVISIONAL' && <span>Provisional</span>}
                </>
              ) : (
                <span>
                  {row.key === 'dependable_supply_ratio' ||
                  row.key === 'deficit' ||
                  row.key === 'shortage_days'
                    ? 'Needs demand & supply records'
                    : 'Needs a reviewed public source'}
                </span>
              )}
            </div>
          </article>
        ))}
      </div>
      <div className={styles.insight}>
        <span className={styles.insightIcon}>
          <Icon name="bulb" size="lg" />
        </span>
        <div>
          <h3>
            {count ? 'What this means for your plan' : 'Every good plan starts with local context'}
          </h3>
          <p>
            {count
              ? `${count} of the six conditions have supporting data. Review the source periods and any remaining gaps before using these figures to plan.`
              : selected
                ? 'Your area is selected. Public observations can describe the environment; your community’s demand and supply records complete the picture in the next step.'
                : 'Choose your area on the map or search for a place. We’ll bring together the available evidence and show where more information is needed.'}
          </p>
        </div>
      </div>
      <details className={styles.sources}>
        <summary>
          <Icon name="layers" size="sm" /> Data sources & how to read this{' '}
          <Icon name="chevron-down" size="sm" />
        </summary>
        <div className={styles.sourceBody}>
          <p>
            Satellite and public datasets describe environmental conditions. Reliable supply,
            deficits and shortage days also need local demand and supply records. Missing data never
            means zero.
          </p>
          {rows.map((row) => (
            <div key={row.key} className={styles.sourceRow}>
              <strong>{row.label}</strong>
              <p>
                {row.result?.name}
                {row.result?.name && ' · '}
                {row.value ??
                  row.result?.reasons[0] ??
                  'No reviewed source is connected for this condition yet.'}
              </p>
              {row.result?.evidence.map((e, index) => (
                <p key={`${e.snapshotId}-${index}`}>
                  {e.url && /^https?:\/\//.test(e.url) ? (
                    <a href={e.url} target="_blank" rel="noreferrer">
                      {e.title}
                    </a>
                  ) : (
                    e.title
                  )}
                  {e.publisher && ` · ${e.publisher}`}
                  {e.asOf && ` · ${formatLocalDate(e.asOf)}`}
                  {e.method && ` · ${e.method}`}
                  {e.uncertainty && ` · ${e.uncertainty}`}
                </p>
              ))}
              {'window' in (row.result ?? {}) &&
                (() => {
                  const window = (row.result as Baseline['indicators'][number]).window;
                  return window ? (
                    <p>
                      {formatLocalDate(window.start)} – {formatLocalDate(window.endExclusive)} (end
                      exclusive)
                    </p>
                  ) : null;
                })()}
            </div>
          ))}
          {baseline?.window && (
            <p>
              Baseline as of {formatLocalDate(baseline.asOf)} ·{' '}
              {formatLocalDate(baseline.window.start)} to{' '}
              {formatLocalDate(baseline.window.endExclusive)} (end exclusive).
            </p>
          )}
        </div>
      </details>
    </section>
  );
}
