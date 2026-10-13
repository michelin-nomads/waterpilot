import { Accordion, Badge } from '../../components';
import type { ComparedOptionFieldsFragment } from '../../graphql/generated/graphql';
import {
  FUNDING_STATUS_LABEL,
  PAYBACK_LABEL,
  formatMoney,
  formatMoneyRange,
  formatPaybackRange,
  formatPercentFromDecimal,
} from './plansFormat';
import styles from './Plans.module.scss';

type Economics = NonNullable<ComparedOptionFieldsFragment['economics']>;

/**
 * Read-only economics for one option (ADR 0014): costs, recurring spend, avoided tanker
 * spending, net benefit, payback and a funding gap kept separate from cost. Every figure
 * is the person's own estimate; unknowns say so and nothing is converted or invented.
 */
export function EconomicsCard({ economics }: { economics: Economics }) {
  const e = economics;
  return (
    <section className={styles.block} data-testid="economics" aria-label="Costs and funding">
      <h4 className={styles.blockTitle}>Costs, benefits and funding (your estimates)</h4>
      <dl className={styles.facts}>
        <div>
          <dt>Upfront cost</dt>
          <dd data-testid="econ-upfront">
            {formatMoneyRange(e.upfrontTotal)}
            {e.contingency && (
              <span className={styles.muted}>
                {' '}
                (includes {formatPercentFromDecimal(e.contingency.ratio)} contingency you set)
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt>Recurring cost each year</dt>
          <dd>
            {e.recurringAnnual ? (
              formatMoneyRange(e.recurringAnnual)
            ) : (
              <span className={styles.muted}>{e.recurringReason}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Avoided tanker spending each year</dt>
          <dd data-testid="econ-avoided">
            {e.avoidedTankerAnnual ? (
              formatMoneyRange(e.avoidedTankerAnnual)
            ) : (
              <span className={styles.muted}>{e.avoidedReason}</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Net benefit each year</dt>
          <dd>
            {e.netAnnual ? (
              formatMoneyRange(e.netAnnual)
            ) : (
              <span className={styles.muted}>Waiting on recurring cost and a tanker price.</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Payback</dt>
          <dd data-payback={e.payback?.outcome ?? 'none'}>
            {e.payback ? (
              <>
                <Badge tone={PAYBACK_LABEL[e.payback.outcome].tone}>
                  {PAYBACK_LABEL[e.payback.outcome].label}
                </Badge>{' '}
                {e.payback.outcome !== 'NEVER' &&
                  formatPaybackRange(e.payback.optimisticDays, e.payback.pessimisticDays)}
              </>
            ) : (
              <span className={styles.muted}>Not computed without recurring cost.</span>
            )}
          </dd>
        </div>
        {e.horizon && (
          <div>
            <dt>Net over the {Math.round(e.horizon.days / 365)}-year horizon</dt>
            <dd data-testid="econ-horizon">
              {e.horizon.net ? (
                <>
                  {formatMoneyRange(e.horizon.net)}{' '}
                  {e.horizon.netPositive ? (
                    <Badge tone="success">Positive even at your low estimates</Badge>
                  ) : (
                    <Badge tone="neutral">Not assured at your low estimates</Badge>
                  )}
                </>
              ) : (
                <span className={styles.muted}>{e.horizon.reason}</span>
              )}
            </dd>
          </div>
        )}
      </dl>
      {e.payback && <p className={styles.muted}>{e.payback.note}</p>}

      <h4 className={styles.blockTitle}>Funding</h4>
      <dl className={styles.facts}>
        <div>
          <dt>Total cost</dt>
          <dd>{formatMoneyRange(e.funding.totalCost)}</dd>
        </div>
        <div>
          <dt>Approved funding</dt>
          <dd>{formatMoney(e.funding.approved)}</dd>
        </div>
        <div>
          <dt>Still to find (funding gap)</dt>
          <dd data-testid="econ-gap">
            {formatMoneyRange(e.funding.gap)}{' '}
            {e.funding.fullyFunded ? (
              <Badge tone="success">Fully funded</Badge>
            ) : (
              <Badge tone="warning">Not fully funded</Badge>
            )}
          </dd>
        </div>
      </dl>
      {e.funding.lines.length > 0 && (
        <ul className={styles.list} aria-label="Declared funding sources">
          {e.funding.lines.map((line) => (
            <li key={line.label} data-funding-counts={line.counts}>
              <strong>{line.label}</strong>: {formatMoney(line.amount)} —{' '}
              {FUNDING_STATUS_LABEL[line.status]}
              {!line.applicable
                ? ' (different currency: shown, not applied)'
                : line.counts
                  ? ' (counts towards affordability)'
                  : ' (not counted towards affordability)'}
            </li>
          ))}
        </ul>
      )}
      <p className={styles.muted}>{e.funding.note}</p>

      <Accordion
        items={[
          {
            id: 'econ-assumptions',
            title: 'Economic assumptions',
            content: (
              <ul className={styles.list}>
                {[...e.assumptions, ...e.notes].map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            ),
          },
        ]}
      />
    </section>
  );
}
