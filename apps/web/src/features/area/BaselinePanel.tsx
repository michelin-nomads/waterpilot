import type { ReactNode } from 'react';

import {
  Accordion,
  Badge,
  ButtonLink,
  ErrorState,
  EvidenceBadge,
  Icon,
  LineChart,
  LoadingRegion,
  MetricCard,
  Notice,
  PermissionState,
  Skeleton,
  StepActions,
  type MetricDisplay,
} from '../../components';
import {
  AreaBaselineDocument,
  type Availability,
  type ValueOrigin,
} from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { GraphQLRequestError } from '../../graphql/requestError';
import { formatPercentFromRatio } from '../../lib/format';
import { evidenceFromApi } from '../../lib/status';
import {
  HEADLINE_METRICS,
  INPUT_LABEL,
  INPUT_UNLOCKS,
  METRIC_HELP,
  ORIGIN_LABEL,
  SYNTHETIC_ORIGIN,
  baselineChart,
  baselineUnits,
  formatLocalDate,
  formatQuantity,
  formatWindow,
  originLabel,
  partialCoverage,
  quantityText,
  unitNote,
  type Baseline,
  type BaselineIndicator,
  type BaselineMetric,
  type EvidenceLink,
  type Units,
} from './baselineFormat';
import { CAPABILITY_LABEL, METRIC_LABEL } from './readinessLabels';
import styles from './Baseline.module.scss';

function OriginBadge({ origin, demo = false }: { origin: ValueOrigin; demo?: boolean }) {
  const { label, tone, icon } = originLabel(origin, demo);
  return (
    <span data-origin={origin} data-synthetic={demo && origin === 'MEASURED' ? '' : undefined}>
      <Badge tone={tone} icon={icon}>
        {label}
      </Badge>
    </span>
  );
}

const AVAILABILITY: Record<Availability, 'available' | 'provisional' | 'unavailable'> = {
  AVAILABLE: 'available',
  PROVISIONAL: 'provisional',
  UNAVAILABLE: 'unavailable',
};

function display(metric: BaselineMetric, units: Units): MetricDisplay {
  if (metric.value === null) {
    return { availability: 'unavailable', reason: metric.reasons[0] ?? 'Not available yet.' };
  }
  const q = formatQuantity(metric.value, metric.unit, units);
  const availability = AVAILABILITY[metric.availability];
  const partial = partialCoverage(metric);
  return {
    availability: availability === 'unavailable' ? 'provisional' : availability,
    value: q.value,
    unit: q.unit || undefined,
    caption: (
      <span className={styles.caption}>
        {metric.origin && <OriginBadge origin={metric.origin} demo={metric.demo} />}
        {metric.asOf && <span>As of {formatLocalDate(metric.asOf)}</span>}
        {partial && <span data-coverage="">{partial}</span>}
      </span>
    ),
  };
}

function Card({ metric, units }: { metric: BaselineMetric; units: Units }) {
  return (
    <div data-baseline-metric={metric.metric}>
      <MetricCard
        label={METRIC_LABEL[metric.metric] ?? metric.name}
        metric={display(metric, units)}
        evidence={metric.demo ? 'synthetic' : undefined}
        definition={METRIC_HELP[metric.metric]}
      />
    </div>
  );
}

function decimalProduct(left: string, right: string): string {
  const [leftWhole = '0', leftFraction = ''] = left.split('.');
  const [rightWhole = '0', rightFraction = ''] = right.split('.');
  const scale = leftFraction.length + rightFraction.length;
  const product = BigInt(leftWhole + leftFraction) * BigInt(rightWhole + rightFraction);
  const padded = product.toString().padStart(scale + 1, '0');
  const whole = scale ? padded.slice(0, -scale) : padded;
  const fraction = scale ? padded.slice(-scale).replace(/0+$/, '') : '';
  return fraction ? `${whole}.${fraction}` : whole;
}

function decimalDifference(left: string, right: string): string {
  const leftScale = left.split('.')[1]?.length ?? 0;
  const rightScale = right.split('.')[1]?.length ?? 0;
  const scale = Math.max(leftScale, rightScale);
  const toScaled = (value: string) => {
    const [whole = '0', fraction = ''] = value.split('.');
    return BigInt(whole + fraction.padEnd(scale, '0'));
  };
  const difference = toScaled(left) - toScaled(right);
  const digits = difference.toString().padStart(scale + 1, '0');
  if (!scale) return digits;
  const whole = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

function SupplyComposition({
  delivered,
  tankerShare,
  units,
}: {
  delivered?: BaselineMetric;
  tankerShare?: BaselineMetric;
  units: Units;
}) {
  const ratio = tankerShare?.value;
  const total = delivered?.value;
  const ratioValue = ratio === undefined || ratio === null ? NaN : Number(ratio);
  if (!total || !ratio || !Number.isFinite(ratioValue) || ratioValue < 0 || ratioValue > 1) {
    return (
      <section className={styles.composition} aria-labelledby="baseline-composition">
        <div>
          <h3 id="baseline-composition" className={styles.subTitle}>
            Supply composition
          </h3>
          <p className={styles.muted}>
            Unavailable until compatible delivered-supply and tanker records are provided.
          </p>
        </div>
      </section>
    );
  }
  const tankerAmount = decimalProduct(total, ratio);
  const otherAmount = decimalDifference(total, tankerAmount);
  const tankerPercent = formatPercentFromRatio(ratio);
  const otherPercent = formatPercentFromRatio(decimalDifference('1', ratio));
  const tankerDisplay = quantityText(formatQuantity(tankerAmount, delivered.unit, units));
  const otherDisplay = quantityText(formatQuantity(otherAmount, delivered.unit, units));
  return (
    <section className={styles.composition} aria-labelledby="baseline-composition">
      <div className={styles.compositionHead}>
        <h3 id="baseline-composition" className={styles.subTitle}>
          Supply composition
        </h3>
        <span className={styles.muted}>
          Total {quantityText(formatQuantity(total, delivered.unit, units))}
        </span>
      </div>
      <div
        className={styles.compositionBar}
        role="img"
        aria-label={`Tanker supply ${tankerPercent}; other delivered supply ${otherPercent}`}
      >
        <span style={{ width: `${ratioValue * 100}%` }} />
        <span style={{ width: `${(1 - ratioValue) * 100}%` }} />
      </div>
      <ul className={styles.compositionLegend}>
        <li>
          <span className={styles.tankerSwatch} aria-hidden="true" />
          <span>
            Tanker supply · {tankerPercent} · {tankerDisplay}
          </span>
        </li>
        <li>
          <span className={styles.otherSwatch} aria-hidden="true" />
          <span>
            Other delivered sources (derived remainder) · {otherPercent} · {otherDisplay}
          </span>
        </li>
      </ul>
      {tankerShare.reasons.length > 0 && <List items={tankerShare.reasons} />}
    </section>
  );
}

function List({ items }: { items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className={styles.list}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function Evidence({ links }: { links: readonly EvidenceLink[] }) {
  if (links.length === 0) return <p className={styles.muted}>No evidence: nothing was used.</p>;
  return (
    <ul className={styles.evidence}>
      {links.map((e) => (
        <li key={`${e.snapshotId ?? e.manualInputId ?? e.title}-${e.input ?? ''}`}>
          <p className={styles.evidenceTitle}>
            {e.url ? (
              <a href={e.url} target="_blank" rel="noopener noreferrer">
                {e.title}
                <Icon name="external" size="sm" />
                <span className={styles.srOnly}> (opens in a new tab)</span>
              </a>
            ) : (
              e.title
            )}
          </p>
          <p className={styles.muted}>
            {[
              e.publisher,
              e.asOf ? `as of ${formatLocalDate(e.asOf)}` : null,
              e.method ? e.method.toLowerCase().replace(/_/g, ' ') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {e.quality && <EvidenceBadge quality={evidenceFromApi(e.quality)} />}
          <p className={styles.muted}>Uncertainty: {e.uncertainty}</p>
          {e.note && <p className={styles.muted}>{e.note}</p>}
        </li>
      ))}
    </ul>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.detail}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function MetricDetails({
  metric,
  baseline,
  units,
}: {
  metric: BaselineMetric;
  baseline: Baseline;
  units: Units;
}) {
  const window = metric.daily && metric.value !== null ? baseline.window : null;
  return (
    <dl className={styles.details}>
      <Detail label="Definition">
        {metric.name}: <code>{metric.formula}</code>
        {metric.metric === 'reliable_supply' && ` with p = ${baseline.exceedanceP}`}
      </Detail>
      {metric.value !== null && (
        <Detail label="Exact value">
          <code>{metric.exact}</code> {metric.unit === 'LITRES_PER_DAY' ? 'L/day' : ''}
        </Detail>
      )}
      {window && (
        <Detail label="Window and coverage">
          {formatWindow(window)} ({window.days} of the last {baseline.windowDays} days)
        </Detail>
      )}
      {metric.asOf && <Detail label="As of">{formatLocalDate(metric.asOf)}</Detail>}
      {metric.reasons.length > 0 && (
        <Detail label={metric.value === null ? 'Why it is unavailable' : 'Why it is provisional'}>
          <List items={metric.reasons} />
        </Detail>
      )}
      {metric.assumptions.length > 0 && (
        <Detail label="Assumptions">
          <List items={metric.assumptions} />
        </Detail>
      )}
      {metric.supporting.map((s) => (
        <Detail key={s.key} label="Total shortfall over the window">
          {quantityText(formatQuantity(s.value, s.unit, units))}
        </Detail>
      ))}
      <Detail label="Evidence and uncertainty">
        <Evidence links={metric.evidence} />
      </Detail>
    </dl>
  );
}

function Indicator({ item, units }: { item: BaselineIndicator; units: Units }) {
  const label = item.parameter ? `${item.name}: ${item.parameter}` : item.name;
  return (
    <li className={styles.indicator} data-indicator={item.indicator}>
      <div className={styles.indicatorHead}>
        <span className={styles.indicatorTitle}>{label}</span>
        {item.value !== null && item.unit ? (
          <span className={styles.indicatorValue}>
            {quantityText(formatQuantity(item.value, item.unit, units))}
          </span>
        ) : (
          <span className={styles.unavailable}>Unavailable</span>
        )}
      </div>
      <p className={styles.muted}>
        {CAPABILITY_LABEL[item.capability]}
        {item.observedOn && ` · reading of ${formatLocalDate(item.observedOn)}`}
        {item.window && item.statistic !== 'LATEST' && ` · ${formatWindow(item.window)}`}
      </p>
      <div className={styles.badges}>
        {item.origin && <OriginBadge origin={item.origin} demo={item.demo} />}
        {item.availability === 'PROVISIONAL' && <Badge tone="warning">Provisional</Badge>}
        {item.demo && <EvidenceBadge quality="synthetic" />}
      </div>
      <List items={item.reasons} />
    </li>
  );
}

function Missing({ baseline, sessionId }: { baseline: Baseline; sessionId: string | null }) {
  const missing = [...baseline.missingEssentials, ...baseline.missingOptional];
  if (missing.length === 0) return null;
  return (
    <section aria-labelledby="baseline-missing" className={styles.section}>
      <h3 id="baseline-missing" className={styles.subTitle}>
        What would complete this baseline
      </h3>
      <ul className={styles.missing}>
        {missing.map((input) => (
          <li key={input} data-missing={input}>
            <span className={styles.missingTitle}>{INPUT_LABEL[input] ?? input}</span>
            <span className={styles.muted}>{INPUT_UNLOCKS[input]}</span>
          </li>
        ))}
      </ul>
      <div className={styles.assumptions}>
        <p className={styles.assumptionsTitle}>How values you enter are used</p>
        <ul className={styles.list}>
          <li>They are labelled as your estimate, never as measured data, wherever they appear.</li>
          <li>
            Demand is population × litres per person per day (plus non-domestic use), the same every
            day.
          </li>
          <li>
            A typed supply figure is one average for an unspecified period. Results defined day by
            day (reliable supply, supply gap, shortage days and the reliabilities) stay unavailable
            until daily records are imported.
          </li>
          <li>Tanker dependence from typed values assumes both averages cover the same period.</li>
        </ul>
      </div>
      {!sessionId && (
        <p className={styles.muted}>Values can be entered once your location is saved.</p>
      )}
    </section>
  );
}

interface BaselinePanelProps {
  showActions?: boolean;
  areaId: string;
  /** Include this session's own entered values; requires the session's saved area. */
  sessionId: string | null;
}

/** The Understand result: what is known about the area now, from ready inputs only. */
export function BaselinePanel({ areaId, sessionId, showActions = true }: BaselinePanelProps) {
  const query = useGraphQLQuery(queryKeys.baseline.area(areaId, sessionId), AreaBaselineDocument, {
    areaId,
    sessionId,
  });
  if (query.isPending) {
    return (
      <LoadingRegion label="Calculating your water baseline">
        <Skeleton shape="block" />
        <Skeleton />
      </LoadingRegion>
    );
  }
  if (query.isError) {
    const code = query.error instanceof GraphQLRequestError ? query.error.code : null;
    if (code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'UNAUTHENTICATED') {
      return (
        <PermissionState title="This baseline is not available to you">
          The area or this planning session is not yours, or it no longer exists. Choose a location
          again from this step.
        </PermissionState>
      );
    }
    return (
      <ErrorState
        title="The baseline could not load"
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        requestId={
          query.error instanceof GraphQLRequestError
            ? (query.error.requestId ?? undefined)
            : undefined
        }
      >
        Your session and the values you entered are kept. Check your connection and try again.
      </ErrorState>
    );
  }
  const area = query.data.area;
  if (!area) return null;
  const b = area.baseline;
  const units = baselineUnits(b, area.unitSystem);
  const note = unitNote(units);
  const metric = (id: string) => b.metrics.find((m) => m.metric === id);
  const headline = HEADLINE_METRICS.map(metric).filter((m): m is BaselineMetric => !!m);
  const chart = baselineChart(b, units);
  const firstMissing = b.missingEssentials[0] ?? null;
  const available = b.metrics.some((m) => m.value !== null);

  return (
    <section aria-label="Your water baseline" className={styles.panel} data-baseline-id={b.id}>
      <div className={styles.head}>
        <p className={styles.muted}>
          As of {formatLocalDate(b.asOf)}
          {b.window
            ? ` · daily records ${formatWindow(b.window)} (${b.window.days} of the last ${b.windowDays} days)`
            : ' · no daily records in use'}
        </p>
        {note && <p className={styles.muted}>{note}</p>}
      </div>
      {query.isStale && query.isFetching && (
        <p className={styles.muted} role="status">
          Updating…
        </p>
      )}
      {b.demo && (
        <Notice kind="partial" title="Demo data" announce={false}>
          Some values use synthetic demonstration data. They show how WaterPilot works and are not
          facts about any real place.
        </Notice>
      )}
      {b.notes.length > 0 && (
        <Notice kind="partial" title="About this baseline" announce={false}>
          <List items={b.notes} />
        </Notice>
      )}
      {!available && (
        <p className={styles.muted}>
          Nothing can be calculated yet. Each value below says what it needs; nothing missing is
          shown as zero.
        </p>
      )}
      <ul className={styles.legend} aria-label="Kinds of value">
        {(Object.keys(ORIGIN_LABEL) as ValueOrigin[]).map((o) => (
          <li key={o}>
            <OriginBadge origin={o} /> {ORIGIN_LABEL[o].description}
          </li>
        ))}
        {b.demo && (
          <li>
            <OriginBadge origin="MEASURED" demo /> {SYNTHETIC_ORIGIN.description}
          </li>
        )}
      </ul>

      <div className={styles.grid}>
        {headline.map((m) => (
          <Card key={m.metric} metric={m} units={units} />
        ))}
      </div>
      <SupplyComposition
        delivered={metric('delivered_supply')}
        tankerShare={metric('tanker_dependence')}
        units={units}
      />

      {chart && <LineChart data={chart} />}

      <section aria-labelledby="baseline-details" className={styles.section}>
        <h3 id="baseline-details" className={styles.subTitle}>
          Baseline details
        </h3>
        <Accordion
          headingLevel={4}
          items={[
            {
              id: 'data-sources',
              title: 'Data sources and supply details',
              content: (
                <Accordion
                  headingLevel={5}
                  items={b.metrics.map((m) => ({
                    id: m.metric,
                    title: METRIC_LABEL[m.metric] ?? m.name,
                    summary:
                      m.value === null
                        ? 'Unavailable'
                        : quantityText(formatQuantity(m.value, m.unit, units)),
                    content: <MetricDetails metric={m} baseline={b} units={units} />,
                  }))}
                />
              ),
            },
            {
              id: 'key-assumptions',
              title: 'Key assumptions',
              content: (
                <List
                  items={[
                    ...b.notes,
                    ...b.metrics.flatMap((m) =>
                      m.assumptions.map(
                        (assumption) => `${METRIC_LABEL[m.metric] ?? m.name}: ${assumption}`,
                      ),
                    ),
                  ]}
                />
              ),
            },
          ]}
        />
      </section>

      <section aria-labelledby="baseline-context" className={styles.section}>
        <h3 id="baseline-context" className={styles.subTitle}>
          Area context
        </h3>
        <p className={styles.muted}>
          Descriptive readings beside the baseline. They never change the numbers above and are not
          combined into a score.
        </p>
        <ul className={styles.indicators}>
          {b.indicators.map((item) => (
            <Indicator key={`${item.indicator}-${item.variable ?? ''}`} item={item} units={units} />
          ))}
        </ul>
      </section>

      <Missing baseline={b} sessionId={sessionId} />

      {showActions &&
        (firstMissing && sessionId ? (
          <StepActions
            primary={
              <ButtonLink
                to={firstMissing === 'POPULATION' ? '/baseline' : '/baseline/inputs'}
                aria-describedby="baseline-next-note"
              >
                Add {INPUT_LABEL[firstMissing]?.toLowerCase() ?? 'missing values'}
              </ButtonLink>
            }
            secondary={
              <ButtonLink to="/goals" variant="ghost">
                Continue to your goal
              </ButtonLink>
            }
            note={
              <p id="baseline-next-note" className={styles.muted}>
                Essential values are missing, so demand or supply is unknown. You can still
                continue; later steps will say what they cannot calculate.
              </p>
            }
          />
        ) : (
          <StepActions
            primary={
              <ButtonLink to="/goals" endIcon="target">
                Set your goal
              </ButtonLink>
            }
          />
        ))}
    </section>
  );
}
