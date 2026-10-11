import { useId } from 'react';
import { Link } from 'react-router-dom';

import { Accordion, Badge, Button, Notice } from '../../components';
import type {
  ComparedOptionFieldsFragment,
  PlanComparisonQuery,
} from '../../graphql/generated/graphql';
import {
  formatDays,
  formatLitres,
  formatMetric,
  formatMoneyRange,
  formatRange,
  ORIGIN_LABEL,
  STATUS,
  TIMING_LABEL,
} from './plansFormat';
import styles from './Plans.module.scss';
import { ImpactContextPanel, OptionImpact } from './WiderImpactView';

export type Comparison = NonNullable<PlanComparisonQuery['planningSession']>['planComparison'];

interface Props {
  comparison: Comparison;
  selectedId: string | null;
  /** True while a choice (or another edit) is being saved. */
  busy: boolean;
  onChoose: (optionId: string) => void;
}

function OptionCard({
  option,
  comparison,
  selected,
  busy,
  onChoose,
}: {
  option: ComparedOptionFieldsFragment;
  comparison: Comparison;
  selected: boolean;
  busy: boolean;
  onChoose: () => void;
}) {
  const headingId = useId();
  const unit = comparison.unit ?? 'RATIO';
  return (
    <li className={styles.option} aria-labelledby={headingId} data-option-id={option.id}>
      <div className={styles.optionHead}>
        <h3 id={headingId} className={styles.optionTitle}>
          <span className={styles.rank}>Plan {option.rank}</span> {option.name}
        </h3>
        {selected && <Badge tone="accent">Chosen</Badge>}
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Result with your estimates</dt>
          <dd>{formatRange(option.pessimistic, option.optimistic, unit)}</dd>
        </div>
        <div>
          <dt>Past the target, at your low estimates</dt>
          <dd>{formatMetric(option.margin, unit)}</dd>
        </div>
        <div>
          <dt>Cost (your estimates)</dt>
          <dd>{formatMoneyRange(option.cost)}</dd>
        </div>
        <div>
          <dt>Build time (your estimates)</dt>
          <dd>{formatDays(option.buildDays)}</dd>
        </div>
        <div>
          <dt>First benefit</dt>
          <dd>{TIMING_LABEL[option.firstBenefit]}</dd>
        </div>
        <div>
          <dt>Water saved or added</dt>
          <dd>
            {option.waterLow && option.waterHigh
              ? formatRange(option.waterLow, option.waterHigh, 'LITRES_PER_DAY')
              : 'Not known'}
          </dd>
        </div>
      </dl>
      <div className={styles.block}>
        <h4 className={styles.blockTitle}>Measures</h4>
        <ul className={styles.list}>
          {option.measures.map((m) => (
            <li key={m.interventionId}>
              <strong>{m.name}</strong>:{' '}
              {m.waterLow && m.waterHigh
                ? formatRange(m.waterLow, m.waterHigh, 'LITRES_PER_DAY')
                : 'effect not known'}
              {m.cost ? `, ${formatMoneyRange(m.cost)}` : ''}
              {m.buildDays ? `, ${formatDays(m.buildDays)}` : ''}
              {m.effects.length > 0 && (
                <ul className={styles.list} aria-label={`What ${m.name} is computed from`}>
                  {m.effects.map((e) => (
                    <li key={e.key} data-effect-origin={e.origin}>
                      {e.label}: {formatRange(e.low, e.high, e.unit)} ({ORIGIN_LABEL[e.origin]})
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
        <p className={styles.muted}>
          Each line counts only what the measures before it leave, so the lines add up without
          double counting. Effect values are your estimates unless marked otherwise; the catalogue
          supplies none.
        </p>
      </div>
      <OptionImpact impact={option.impact} />
      <Accordion
        items={[
          {
            id: `${option.id}-why`,
            title: 'Why this plan, tradeoffs and uncertainty',
            content: (
              <div className={styles.stack}>
                <p className={styles.text}>{option.why}</p>
                {option.tradeoffs.length > 0 && (
                  <ul className={styles.list}>
                    {option.tradeoffs.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                )}
                <ul className={styles.list}>
                  {option.uncertainty.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
                {option.uncountedHigh && (
                  <p className={styles.muted}>
                    Not counted: up to {formatLitres(option.uncountedHigh)} beyond the tanker
                    deliveries it would replace.
                  </p>
                )}
              </div>
            ),
          },
          {
            id: `${option.id}-sensitivity`,
            title: 'Sensitivity and stress tests',
            content: (
              <div className={styles.stack}>
                {option.sensitivity.length > 0 ? (
                  <ul className={styles.list}>
                    {option.sensitivity.map((s) => (
                      <li key={`${s.interventionId}.${s.key}`}>
                        {s.label} ({s.interventionId.replace(/_/g, ' ')}): moves the result by{' '}
                        {formatMetric(s.swing, unit)} from low to high.
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.muted}>Your estimates for this plan have no range.</p>
                )}
                <table className={styles.table}>
                  <caption className={styles.caption}>At your low estimates</caption>
                  <thead>
                    <tr>
                      <th scope="col">Stress</th>
                      <th scope="col">Result</th>
                      <th scope="col">Meets the target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {option.stress.map((s) => (
                      <tr key={s.key}>
                        <th scope="row">{s.label}</th>
                        <td>{s.value ? formatMetric(s.value, unit) : 'Does not apply'}</td>
                        <td>
                          {s.meetsTarget === null ? 'Does not apply' : s.meetsTarget ? 'Yes' : 'No'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ),
          },
        ]}
      />
      <div className={styles.actions}>
        <Button
          variant={selected ? 'secondary' : 'primary'}
          disabled={selected || busy}
          onClick={onChoose}
        >
          {selected ? (busy ? 'Saving your choice…' : 'Chosen plan') : 'Choose this plan'}
        </Button>
      </div>
    </li>
  );
}

export function PlanComparisonView({ comparison, selectedId, busy, onChoose }: Props) {
  const status = STATUS[comparison.status];
  const unit = comparison.unit ?? 'RATIO';
  const r = comparison.rejections;
  const shiftedByScenario =
    comparison.baselineValue &&
    comparison.scenarioValue &&
    comparison.baselineValue.exact !== comparison.scenarioValue.exact;
  return (
    <div className={styles.stack} data-status={comparison.status}>
      <div className={styles.head}>
        <Badge tone={status.tone}>{status.label}</Badge>
        <p className={styles.summary}>{comparison.summary}</p>
      </div>
      {comparison.metric && (
        <dl className={styles.facts}>
          <div>
            <dt>Baseline</dt>
            <dd>{formatMetric(comparison.baselineValue, unit)}</dd>
          </div>
          {shiftedByScenario && (
            <div>
              <dt>Under your what-if</dt>
              <dd>{formatMetric(comparison.scenarioValue, unit)}</dd>
            </div>
          )}
          <div>
            <dt>Target</dt>
            <dd>{formatMetric(comparison.targetLevel, unit)}</dd>
          </div>
        </dl>
      )}
      {comparison.needs.length > 0 && (
        <Notice kind="partial" title="What would let more be compared" announce={false}>
          <ul className={styles.list}>
            {comparison.needs.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <Link to="/goals">Update your goal, site and estimates</Link>
        </Notice>
      )}
      {comparison.status === 'NO_FEASIBLE_PLAN' && r.evaluated > 0 && (
        <Notice kind="info" title="Why no plan is shown" announce={false}>
          <ul className={styles.list}>
            {r.onlyOptimistic > 0 && (
              <li>{r.onlyOptimistic} would meet the target only with optimistic estimates.</li>
            )}
            {r.missedTarget > 0 && <li>{r.missedTarget} fall short of the target.</li>}
            {r.overBudget + r.budgetUncertain > 0 && (
              <li>{r.overBudget + r.budgetUncertain} could exceed your budget.</li>
            )}
            {r.tooSlow + r.timeUncertain > 0 && (
              <li>{r.tooSlow + r.timeUncertain} could take longer than you allowed.</li>
            )}
          </ul>
          <p className={styles.muted}>
            Plans are shown only when they pass at the low end of every estimate. Narrow your
            estimate ranges, adjust the target, budget or time limit, or add measures.
          </p>
        </Notice>
      )}
      {comparison.options.length > 0 && (
        <ol className={styles.options} aria-label="Feasible plans">
          {comparison.options.map((o) => (
            <OptionCard
              key={o.id}
              option={o}
              comparison={comparison}
              selected={o.id === selectedId}
              busy={busy}
              onChoose={() => onChoose(o.id)}
            />
          ))}
        </ol>
      )}
      {comparison.options.length > 0 && (
        <section className={styles.block} aria-labelledby="impact-context">
          <h3 id="impact-context" className={styles.blockTitle}>
            What the wider effects rest on
          </h3>
          <ImpactContextPanel
            context={comparison.impactContext}
            engineVersion={comparison.impactEngineVersion}
          />
        </section>
      )}
      <Accordion
        items={[
          {
            id: 'assumptions',
            title: 'Assumptions, ranking and versions',
            content: (
              <div className={styles.stack}>
                <ul className={styles.list}>
                  {comparison.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
                {comparison.ranking && <p className={styles.text}>Ranking: {comparison.ranking}</p>}
                <p className={styles.muted}>
                  Up to {comparison.maxOptions} plans are shown, never more than pass. Stress tests:{' '}
                  {comparison.stressTests.join('; ')}.
                </p>
                {comparison.excluded.length > 0 && (
                  <>
                    <h4 className={styles.blockTitle}>Not considered</h4>
                    <ul className={styles.list}>
                      {comparison.excluded.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className={styles.muted}>
                  Option engine {comparison.engineVersion}, scenario engine{' '}
                  {comparison.scenarioEngineVersion}, catalogue {comparison.catalogueVersion}.
                  {r.evaluated > 0 && ` ${r.evaluated} combinations checked.`}
                  {r.truncated && ' The combination limit was reached.'}
                </p>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
