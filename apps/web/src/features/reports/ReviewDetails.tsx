import { Badge, ErrorState, Icon, LoadingRegion, Skeleton } from '../../components';
import { AreaLocationDocument, FundingMatchesDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { LocationSummaryView } from '../location/LocationSummary';
import { GoalSummary } from '../goals/GoalSummary';
import { fromGoalInput } from '../goals/goalDraft';
import { SCALE_LABEL } from '../goals/goalLabels';
import { PlanDetails } from '../plans/PlanComparisonView';
import {
  formatMetric,
  formatMoney,
  formatMoneyRange,
  formatOutcomeRange,
} from '../plans/plansFormat';
import { areaExtent, type ReviewData, type ReviewPanel } from './reviewData';
import planStyles from '../plans/Plans.module.scss';
import fundingStyles from '../funding/Matches.module.scss';
import styles from './ReviewWorkspace.module.scss';

/** Review uses the source screens' presentation components without editable controls. */
export function ReviewDetails({ panel, ...data }: ReviewData & { panel: ReviewPanel }) {
  if (panel === 'area') return <AreaReview {...data} />;
  if (panel === 'goal') return <GoalReview {...data} />;
  if (panel === 'plan')
    return (
      <div className={styles.readonlyBody}>
        <PlanDetails option={data.selected} comparison={data.comparison} compact />
      </div>
    );
  if (panel === 'funding') return <FundingReview {...data} />;
  if (panel === 'impact') return <ImpactReview {...data} />;
  return <EvidenceReview {...data} />;
}

function AreaReview({ current }: ReviewData) {
  const query = useGraphQLQuery(
    queryKeys.areas.detail(current.areaId ?? ''),
    AreaLocationDocument,
    { id: current.areaId ?? '' },
    { enabled: Boolean(current.areaId) },
  );
  if (query.isPending)
    return (
      <LoadingRegion label="Loading saved area">
        <Skeleton />
      </LoadingRegion>
    );
  if (query.isError)
    return (
      <ErrorState title="Location details could not load" onRetry={() => void query.refetch()}>
        Your saved planning area is unchanged.
      </ErrorState>
    );
  return (
    <div className={styles.readonlyBody}>
      {query.data?.area ? (
        <LocationSummaryView area={query.data.area} onChange={() => undefined} readOnly />
      ) : (
        <section className={styles.card}>
          <h3>{current.areaName ?? 'Selected area'}</h3>
          <p className={styles.reviewMuted}>{areaExtent(current)}</p>
        </section>
      )}
    </div>
  );
}

function GoalReview({ current }: ReviewData) {
  const goal = current.goal;
  if (!goal) return <p className={styles.reviewMuted}>No goal recorded.</p>;
  const draft = fromGoalInput(goal, goal.budget?.currency ?? '');
  const site = goal.site;
  const hasSite =
    site &&
    (site.scale ||
      site.roofArea ||
      site.openGround ||
      site.storageSpace != null ||
      site.pipedSupply != null ||
      site.groundwaterUse != null);
  return (
    <div className={styles.readonlyBody}>
      <GoalSummary draft={draft} />
      {hasSite && (
        <details className={styles.reviewDisclosure}>
          <summary>Saved site details</summary>
          <dl className={styles.facts}>
            {site.scale && (
              <div>
                <dt>Scale</dt>
                <dd>{SCALE_LABEL[site.scale]}</dd>
              </div>
            )}
            {site.roofArea && (
              <div>
                <dt>Roof area you can collect from</dt>
                <dd>{site.roofArea.value} m²</dd>
              </div>
            )}
            {site.openGround && (
              <div>
                <dt>Open or unpaved ground</dt>
                <dd>{site.openGround.value} m²</dd>
              </div>
            )}
            {site.storageSpace != null && (
              <div>
                <dt>Space for a tank</dt>
                <dd>{site.storageSpace ? 'Available' : 'Not available'}</dd>
              </div>
            )}
            {site.pipedSupply != null && (
              <div>
                <dt>Piped supply</dt>
                <dd>{site.pipedSupply ? 'Available' : 'Not available'}</dd>
              </div>
            )}
            {site.groundwaterUse != null && (
              <div>
                <dt>Borewell / groundwater use</dt>
                <dd>{site.groundwaterUse ? 'Yes' : 'No'}</dd>
              </div>
            )}
          </dl>
        </details>
      )}
    </div>
  );
}

function EvidenceReview({ comparison, selected }: ReviewData) {
  const assumptions = [
    ...new Set([...(comparison.assumptions ?? []), ...(selected.uncertainty ?? [])]),
  ];
  const findings = selected.impact
    ? [
        ...selected.impact.localBenefits,
        ...selected.impact.externalities,
        ...selected.impact.tradeoffs,
        ...selected.impact.falseResilience,
      ]
    : [];
  const citations = [
    ...new Map(findings.flatMap((f) => f.citations).map((c) => [`${c.kind}:${c.ref}`, c])).values(),
  ];
  return (
    <div className={styles.readonlyBody}>
      <section className={styles.card}>
        <h3>Assumptions & limitations</h3>
        {assumptions.length ? (
          <ul className={styles.reviewListText}>
            {assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.reviewMuted}>No additional assumptions recorded.</p>
        )}
      </section>
      {!!comparison.needs?.length && (
        <details className={styles.reviewDisclosure}>
          <summary>Information still needed ({comparison.needs.length})</summary>
          <ul className={styles.reviewListText}>
            {comparison.needs.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      )}
      {!!citations.length && (
        <details className={styles.reviewDisclosure}>
          <summary>Supporting sources ({citations.length})</summary>
          <ul className={styles.reviewListText}>
            {citations.map((c) => (
              <li key={`${c.kind}:${c.ref}`}>
                {c.label}
                {c.asOf ? ` · ${c.asOf}` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ImpactReview({ comparison, selected }: ReviewData) {
  const unit = comparison.unit ?? 'RATIO';
  const outcome = formatOutcomeRange(selected.pessimistic, selected.optimistic, unit);
  const nums = [
    comparison.baselineValue,
    comparison.targetLevel,
    selected.pessimistic,
    selected.optimistic,
  ].map((v) => (v == null ? null : Number(v.value)));
  const finite = nums.filter((v): v is number => v != null && Number.isFinite(v));
  const min = Math.min(0, ...finite),
    max = Math.max(0, ...finite),
    span = max - min;
  const rows = [
    {
      label: 'Reference',
      low: nums[0],
      high: nums[0],
      text: formatMetric(comparison.baselineValue, unit),
    },
    {
      label: 'Goal',
      low: nums[1],
      high: nums[1],
      text: formatMetric(comparison.targetLevel, unit),
    },
    { label: 'Plan estimate', low: nums[2], high: nums[3], text: outcome },
  ];
  const findings = selected.impact
    ? [
        ...selected.impact.localBenefits,
        ...selected.impact.externalities,
        ...selected.impact.tradeoffs,
        ...selected.impact.falseResilience,
      ]
    : [];
  return (
    <div className={styles.readonlyBody}>
      <dl className={planStyles.detailKpis}>
        <div>
          <dt>Baseline to target</dt>
          <dd>{`${formatMetric(comparison.baselineValue, unit)} → ${formatMetric(comparison.targetLevel, unit)}`}</dd>
        </div>
        <div>
          <dt>Estimated outcome</dt>
          <dd>{outcome}</dd>
        </div>
      </dl>
      {span > 0 && (
        <section className={styles.card}>
          <h3>{comparison.metric?.replaceAll('_', ' ').toLowerCase() || 'Expected outcome'}</h3>
          {rows.map((r) => (
            <div key={r.label} className={styles.chartRow}>
              <span>{r.label}</span>
              <div className={styles.track} aria-hidden="true">
                {r.low != null &&
                  r.high != null &&
                  Number.isFinite(r.low) &&
                  Number.isFinite(r.high) && (
                    <span
                      style={{
                        left: `${((Math.min(r.low, r.high) - min) / span) * 100}%`,
                        width: `${(Math.abs(r.high - r.low) / span) * 100}%`,
                      }}
                    />
                  )}
              </div>
              <strong>{r.text}</strong>
            </div>
          ))}
          <p className={styles.reviewMuted}>
            Estimated range, not a measured result or guaranteed outcome.
          </p>
        </section>
      )}
      {findings.length > 0 && (
        <details className={styles.reviewDisclosure}>
          <summary>Effects at your site and beyond</summary>
          <ul className={styles.reviewListText}>
            {findings.map((f) => (
              <li key={f.id}>
                {f.statement}
                {f.uncertainty && <p className={styles.reviewMuted}>{f.uncertainty}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function FundingReview({ current, selected }: ReviewData) {
  const query = useGraphQLQuery(
    queryKeys.sessions.fundingMatches(current.id, current.inputsRevision, selected.id, {
      first: 100,
    }),
    FundingMatchesDocument,
    { sessionId: current.id, planOptionId: selected.id, first: 100 },
  );
  const funding = selected.economics?.funding;
  const lines = current.goal?.funding ?? [];
  return (
    <div className={styles.readonlyBody}>
      <section className={fundingStyles.pictureCard}>
        <h3>Your funding picture</h3>
        {funding ? (
          <dl className={styles.facts}>
            <div>
              <dt>Approved funding</dt>
              <dd>{funding.approved ? formatMoney(funding.approved) : 'Not recorded'}</dd>
            </div>
            <div>
              <dt>Funding gap</dt>
              <dd>{formatMoneyRange(funding.gap)}</dd>
            </div>
          </dl>
        ) : (
          <p className={styles.reviewMuted}>
            No funding contributions have been declared for this plan.
          </p>
        )}
        {lines.length > 0 && (
          <ul className={styles.reviewListText}>
            {lines.map((l, i) => (
              <li key={`${l.label}-${i}`}>
                {l.label} · {l.status.toLowerCase()}
              </li>
            ))}
          </ul>
        )}
      </section>
      {query.isPending ? (
        <LoadingRegion label="Loading funding opportunities">
          <Skeleton />
        </LoadingRegion>
      ) : query.isError ? (
        <ErrorState
          title="Funding opportunities could not load"
          onRetry={() => void query.refetch()}
        >
          Recorded funding declarations remain available above.
        </ErrorState>
      ) : !query.data?.fundingMatches.nodes.length ? (
        <p className={styles.reviewMuted}>
          No funding matches have been recorded for this selected plan.
        </p>
      ) : (
        query.data.fundingMatches.nodes.map((m) => (
          <article key={m.id} className={fundingStyles.fundCard}>
            <div className={fundingStyles.fundCardHead}>
              <span className={fundingStyles.fundTile}>
                <Icon name="wallet" />
              </span>
              <div className={fundingStyles.fundTitles}>
                <h3>{m.scheme.name}</h3>
                <p>{m.scheme.funder}</p>
              </div>
            </div>
            <div className={styles.reviewFundingStatus}>
              <Badge
                tone={
                  m.eligibility === 'ELIGIBLE'
                    ? 'success'
                    : m.eligibility === 'INELIGIBLE'
                      ? 'danger'
                      : 'warning'
                }
              >
                {m.eligibility === 'ELIGIBLE'
                  ? 'Meets listed rules'
                  : m.eligibility === 'INELIGIBLE'
                    ? 'Ineligible'
                    : 'Needs information'}
              </Badge>
              {m.scheme.evidence === 'SYNTHETIC' && (
                <Badge tone="warning">Synthetic demonstration scheme</Badge>
              )}
            </div>
            <p className={fundingStyles.fundAmount}>
              {m.scheme.maxAmount ? formatMoney(m.scheme.maxAmount) : 'Amount not recorded'}
            </p>
            <details className={styles.reviewDisclosure}>
              <summary>Eligibility & source</summary>
              <p className={styles.reviewMuted}>{m.scheme.summary}</p>
              <ul className={styles.reviewListText}>
                {m.eligibilityEvidence.map((e, i) => (
                  <li key={`${e.criterionId}-${i}`}>{e.reason}</li>
                ))}
              </ul>
              <p className={styles.reviewMuted}>Last checked: {m.scheme.lastVerifiedAt}</p>
            </details>
          </article>
        ))
      )}
    </div>
  );
}
