import { useState, type ReactNode } from 'react';
import { Badge, Button, Drawer, Icon, type IconName } from '../../components';
import { AreaLocationDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { LocationName } from '../location/LocationName';
import { KIND_LABEL } from '../goals/goalLabels';
import {
  formatDays,
  formatMoney,
  formatMoneyRange,
  formatOutcomeRange,
} from '../plans/plansFormat';
import { areaExtent, type ReviewData, type ReviewPanel } from './reviewData';
import { ReviewDetails } from './ReviewDetails';
import styles from './ReviewWorkspace.module.scss';

const PANEL: Record<ReviewPanel, { title: string; description: string; icon: IconName }> = {
  area: {
    title: 'Understand Your Area',
    description: 'Saved location, planning extent and available water context.',
    icon: 'map',
  },
  goal: {
    title: 'Set Your Goal',
    description: 'Your saved outcome, target and constraints.',
    icon: 'target',
  },
  plan: {
    title: 'Compare Plans',
    description: 'Your selected plan, cost and implementation.',
    icon: 'clipboard',
  },
  funding: {
    title: 'Make it Happen',
    description: 'Saved funding declarations and opportunities for this plan.',
    icon: 'wallet',
  },
  impact: {
    title: 'Expected impact',
    description: 'Compare your intended goal with the estimated outcomes.',
    icon: 'chart',
  },
  evidence: {
    title: 'Assumptions & evidence',
    description: 'What is known, estimated and still to confirm.',
    icon: 'info',
  },
};

export function ReviewWorkspace({
  current,
  comparison,
  selected,
  signedIn,
  onSignIn,
  onFinalize,
}: ReviewData & {
  signedIn: boolean;
  onSignIn: () => void;
  onFinalize: () => void;
}) {
  const [panel, setPanel] = useState<ReviewPanel | null>(null);
  const areaQuery = useGraphQLQuery(
    queryKeys.areas.detail(current.areaId ?? ''),
    AreaLocationDocument,
    { id: current.areaId ?? '' },
    { enabled: Boolean(current.areaId) },
  );
  const area = areaQuery.data?.area;
  const unit = comparison.unit ?? 'RATIO';
  const goal = current.goal;
  const goalName = goal?.description || (goal ? KIND_LABEL[goal.kind] : 'Not set');
  const outcome = formatOutcomeRange(selected.pessimistic, selected.optimistic, unit);
  const funding = selected.economics?.funding;
  const fundingCount = goal?.funding?.length ?? 0;
  const unknowns = comparison.needs?.length ?? 0;
  const uncertaintyCount = (selected.uncertainty?.length ?? 0) + unknowns;

  const tile = (name: IconName) => (
    <span className={styles.tile}>
      <Icon name={name} />
    </span>
  );
  const row = (
    number: number,
    key: ReviewPanel,
    summary: string,
    status: string,
    tone: 'success' | 'accent' | 'neutral',
  ) => (
    <button
      type="button"
      className={styles.reviewRow}
      onClick={() => setPanel(key)}
      aria-label={`Review ${PANEL[key].title}`}
    >
      {tile(PANEL[key].icon)}
      <span className={styles.rowCopy}>
        <strong>
          {number}. {PANEL[key].title}
        </strong>
        <span>{summary}</span>
      </span>
      <Badge tone={tone}>{status}</Badge>
      <Icon name="chevron-right" size="sm" />
    </button>
  );
  const insight = (key: 'impact' | 'evidence', children: ReactNode) => (
    <button
      type="button"
      className={`${styles.card} ${styles.insight}`}
      onClick={() => setPanel(key)}
      aria-label={`Review ${PANEL[key].title}`}
    >
      {tile(PANEL[key].icon)}
      <span>
        <strong>{PANEL[key].title}</strong>
        <span className={styles.insightText}>{children}</span>
      </span>
      <Icon name="chevron-right" size="sm" />
    </button>
  );

  return (
    <>
      <section className={`${styles.card} ${styles.context}`} aria-label="Selected planning area">
        <div className={styles.contextCopy}>
          <h2>
            <LocationName
              name={area?.name ?? current.areaName ?? 'Selected area'}
              fullAddress={area?.formattedAddress}
              admin={
                area?.admin ?? {
                  admin1: null,
                  admin2: null,
                  countryName: null,
                  locality: null,
                  sublocality: null,
                }
              }
            />
          </h2>
          <p>{areaExtent(current)}</p>
          <span className={styles.planName}>{selected.name}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={styles.textLink}
          onClick={() => setPanel('area')}
        >
          Review area
        </Button>
      </section>
      <div className={styles.columns}>
        <div className={styles.stack}>
          <section aria-labelledby="planning-journey-title">
            <div className={styles.sectionHead}>
              <h2 id="planning-journey-title">Your planning journey</h2>
              <span>Open any section to review</span>
            </div>
            <div className={styles.reviewList}>
              {row(1, 'area', `${areaExtent(current)} · saved water context`, 'Saved', 'success')}
              {row(2, 'goal', goalName, 'Saved', 'success')}
              {row(
                3,
                'plan',
                `${selected.name} · ${formatMoneyRange(selected.cost)}`,
                'Selected',
                'accent',
              )}
              {row(
                4,
                'funding',
                fundingCount
                  ? `${fundingCount} declared funding source${fundingCount === 1 ? '' : 's'} · review approval status`
                  : 'Review funding opportunities and any recorded support',
                fundingCount ? 'Recorded' : 'Optional',
                'neutral',
              )}
            </div>
          </section>
          <section className={styles.card} aria-labelledby="next-title">
            <div className={styles.sectionHead}>
              <h2 id="next-title">What happens next?</h2>
              <Badge>After review</Badge>
            </div>
            <div className={styles.nextGrid}>
              <div>
                {tile('file')}
                <div>
                  <h3>Keep a shared reference</h3>
                  <p>Finalize your report to preserve the selected plan, findings and evidence.</p>
                </div>
              </div>
              <div>
                {tile('wallet')}
                <div>
                  <h3>Move towards implementation</h3>
                  <p>Prepare funding applications, confirm permissions and obtain quotes.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
        <aside className={styles.stack} aria-label="Plan outcomes and evidence">
          {insight(
            'impact',
            <>
              {outcome}
              <br />
              Estimated {comparison.metric?.replaceAll('_', ' ').toLowerCase() || 'plan outcome'}
            </>,
          )}
          {insight(
            'evidence',
            <>
              {uncertaintyCount
                ? `${uncertaintyCount} item${uncertaintyCount === 1 ? '' : 's'} to review`
                : 'Review recorded sources and assumptions'}
              <br />
              Estimates remain labelled
            </>,
          )}
          <section className={styles.card}>
            <h3>Plan at a glance</h3>
            <dl className={styles.metrics}>
              <div>
                <dt>Estimated cost</dt>
                <dd>{formatMoneyRange(selected.cost)}</dd>
              </div>
              <div>
                <dt>Build time</dt>
                <dd>{formatDays(selected.buildDays)}</dd>
              </div>
            </dl>
            {funding && (
              <dl className={styles.fundingFacts}>
                <div>
                  <dt>Approved funding</dt>
                  <dd>{funding.approved ? formatMoney(funding.approved) : 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Funding gap</dt>
                  <dd>{formatMoneyRange(funding.gap)}</dd>
                </div>
              </dl>
            )}
            <p className={styles.note}>
              Funding opportunities are not approved awards. Expected benefits are estimates, not
              measured results.
            </p>
          </section>
        </aside>
      </div>
      <section className={styles.reportStrip} aria-label="Create your report">
        <div className={styles.signInMessage}>
          <Icon name={signedIn ? 'file' : 'lock'} />
          <p>
            {signedIn
              ? 'Ready to finalize and create your report.'
              : 'Sign in to finalize and create your report.'}
          </p>
          {!signedIn && (
            <Button variant="ghost" size="sm" className={styles.textLink} onClick={onSignIn}>
              Sign in
            </Button>
          )}
        </div>
        <Button disabled={!signedIn} onClick={onFinalize}>
          Finalize report
        </Button>
      </section>
      <Drawer
        open={panel !== null}
        onClose={() => setPanel(null)}
        title={panel ? PANEL[panel].title : ''}
        description={panel ? PANEL[panel].description : undefined}
        footer={<Button onClick={() => setPanel(null)}>Done reviewing</Button>}
      >
        {panel && (
          <ReviewDetails
            panel={panel}
            current={current}
            comparison={comparison}
            selected={selected}
          />
        )}
      </Drawer>
    </>
  );
}
