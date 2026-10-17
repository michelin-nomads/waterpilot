import { Badge, Button, Icon, ErrorState, LoadingRegion, Skeleton } from '../../components';
import { AreaBaselineDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { usePlanningSession } from '../../session/sessionContext';
import { sourceDaily } from './supplyMath';
import { quantityText, formatQuantity, baselineUnits } from './baselineFormat';
import { Link } from 'react-router-dom';
import styles from './CommunityBaseline.module.scss';

export function CommunityBaselineOverview({
  areaId,
  sessionId,
  onCoverage,
}: {
  areaId: string;
  sessionId: string;
  onCoverage: () => void;
}) {
  const { view } = usePlanningSession();
  const record = view?.communityBaseline;
  const query = useGraphQLQuery(queryKeys.baseline.area(areaId, sessionId), AreaBaselineDocument, {
    areaId,
    sessionId,
  });
  if (query.isPending)
    return (
      <LoadingRegion label="Loading baseline overview">
        <Skeleton />
      </LoadingRegion>
    );
  if (query.isError || !query.data.area)
    return (
      <ErrorState title="Your baseline could not load" onRetry={() => void query.refetch()}>
        Your saved entries are kept. Try again.
      </ErrorState>
    );
  const baseline = query.data.area.baseline;
  const units = baselineUnits(baseline, query.data.area.unitSystem);
  const metric = (key: string) => baseline.metrics.find((m) => m.metric === key);
  const demand = metric('demand');
  const supply = metric('delivered_supply');
  const gap = metric('average_supply_gap');
  const estimated = record?.demandEstimated || record?.sources.some((s) => s.estimated);
  const known = record?.sources.filter((s) => s.quantity !== null) ?? [];
  const knownTotal = known.reduce((sum, s) => sum + (sourceDaily(s) ?? 0), 0);
  const cards = [
    {
      label: 'Daily water use',
      icon: 'droplet' as const,
      value: demand,
      empty: 'Demand unknown',
      hint: 'Add daily use or accept a household estimate.',
      tag: record
        ? record.demandEstimated
          ? 'Estimated'
          : 'User provided'
        : 'From baseline evidence',
    },
    {
      label: 'Average daily supply',
      icon: 'layers' as const,
      value: supply,
      empty: 'Supply unknown',
      hint: 'Add quantities and confirm that all sources are included.',
      tag: record?.sources.some((s) => s.estimated)
        ? 'Includes estimates'
        : record
          ? 'User provided'
          : 'From baseline evidence',
    },
    {
      label: 'Daily supply gap',
      icon: 'chart' as const,
      value: gap,
      empty: 'Cannot calculate yet',
      hint: 'Both daily use and complete supply quantities are needed.',
      tag: estimated ? 'Estimated gap' : 'Calculated',
    },
  ];
  return (
    <div className={`${styles.form} ${styles.overview}`}>
      <section className={styles.reviewBlock} aria-labelledby="water-balance-title">
        <header className={styles.blockHeader}>
          <span className={styles.blockIndex} aria-hidden="true">
            01
          </span>
          <h2 id="water-balance-title">Water balance</h2>
        </header>
        <div className={styles.metrics}>
          {cards.map((card) => (
            <section className={`${styles.card} ${styles.metricCard}`} key={card.label}>
              <h2 className={styles.cardTitle}>
                <Icon name={card.icon} size="sm" />
                {card.label}
              </h2>
              <strong className={card.value?.value != null ? styles.value : styles.unknownValue}>
                {card.value?.value != null
                  ? quantityText(formatQuantity(card.value.value, card.value.unit, units))
                  : card.empty}
              </strong>
              {card.value?.value != null ? (
                <>
                  <Badge tone="accent">{card.tag}</Badge>
                  <p>
                    {card.label === 'Daily supply gap'
                      ? 'Daily use minus average supply, with a minimum gap of zero. Daily averages do not establish reliable supply.'
                      : card.value.reasons.join(' ')}
                  </p>
                </>
              ) : (
                <>
                  <p>{card.hint}</p>
                  <Link to="/baseline" className={styles.editLink}>
                    {card.label === 'Daily water use' ? 'Add daily use' : 'Add supply details'}
                  </Link>
                </>
              )}
            </section>
          ))}
        </div>
      </section>
      {record && (
        <section className={`${styles.card} ${styles.reviewBlock}`}>
          <div className={`${styles.row} ${styles.blockHeader}`}>
            <h2 className={styles.cardTitle}>
              <span className={styles.blockIndex} aria-hidden="true">
                02
              </span>
              Community details
            </h2>
            <Link to="/baseline" className={styles.editLink}>
              Edit details
            </Link>
          </div>
          <p>
            {view?.siteProfile?.occupiedHomes
              ? `${view.siteProfile.occupiedHomes} occupied homes`
              : 'Occupied homes not stated'}
            {record.residents ? ` · ${record.residents} residents` : ''}
          </p>
          <p>Primary concern: {record.concern || 'Not sure yet'}</p>
          {record.notes && <p>{record.notes}</p>}
        </section>
      )}
      <section className={`${styles.card} ${styles.reviewBlock} ${styles.compositionCard}`}>
        <div className={`${styles.row} ${styles.blockHeader}`}>
          <h2 className={styles.cardTitle}>
            <span className={styles.blockIndex} aria-hidden="true">
              03
            </span>
            Supply composition
          </h2>
          <Link to="/baseline" className={styles.editLink}>
            Edit sources
          </Link>
        </div>
        {!record?.sources.length ? (
          <p>
            No water sources added. Add your delivery logs, meter readings or explicit assumptions.
          </p>
        ) : (
          <>
            {!record.supplyComplete && (
              <p>
                Known daily supply:{' '}
                {known.length
                  ? knownTotal.toLocaleString('en-IN', { maximumFractionDigits: 3 })
                  : 'Unknown'}{' '}
                litres / day · Incomplete. This is not a complete supply total and cannot establish
                a gap.
              </p>
            )}
            {record.supplyComplete && knownTotal > 0 && (
              <div
                className={styles.compositionBar}
                role="img"
                aria-label="Share of daily supply by water source"
              >
                {record.sources.map((source, index) => (
                  <span
                    key={index}
                    style={{
                      width: `${((sourceDaily(source) ?? 0) / knownTotal) * 100}%`,
                      opacity: 1 - (index % 4) * 0.2,
                    }}
                  />
                ))}
              </div>
            )}
            {record.sources.map((source, index) => (
              <div className={styles.supplyRow} key={index}>
                <div className={styles.row}>
                  <h3>
                    {record.supplyComplete && knownTotal > 0 && sourceDaily(source) != null
                      ? `${(((sourceDaily(source) ?? 0) / knownTotal) * 100).toFixed(1)}% · `
                      : ''}
                    {source.name}
                  </h3>
                  <Badge tone="accent">{source.estimated ? 'Estimated' : 'User provided'}</Badge>
                </div>
                <strong>
                  {sourceDaily(source)?.toLocaleString('en-IN', { maximumFractionDigits: 3 }) ??
                    'Unknown'}
                  {source.quantity !== null && ' litres / day'}
                </strong>
                <p>
                  {source.source} · {record.asOf}
                </p>
              </div>
            ))}
          </>
        )}
        <Button variant="secondary" onClick={onCoverage}>
          Data coverage and sources
        </Button>
      </section>
    </div>
  );
}
