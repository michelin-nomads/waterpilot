import { useId } from 'react';

import { Badge, Icon } from '../../components';
import type { GoalAssessmentFieldsFragment } from '../../graphql/generated/graphql';
import { FIT_LABEL, OUTCOME } from './goalLabels';
import styles from './Goals.module.scss';
import { GoalCheckVisuals } from './GoalCheckVisuals';

type Fit = GoalAssessmentFieldsFragment['interventions'][number];

interface GoalAssessmentViewProps {
  assessment: GoalAssessmentFieldsFragment;
  /** Heading level for the panel title (the agent pane nests it lower). */
  headingLevel?: 2 | 3;
  /** Shortlisting is offered only where the site meets a measure's prerequisites. */
  shortlist?: { selected: readonly string[]; toggle: (id: string) => void; disabled?: boolean };
  compact?: boolean;
}

export function OutcomeBadge({ outcome }: { outcome: GoalAssessmentFieldsFragment['outcome'] }) {
  const o = OUTCOME[outcome];
  return (
    <span data-outcome={outcome}>
      <Badge tone={o.tone} icon={o.icon}>
        {o.label}
      </Badge>
    </span>
  );
}

function FitLine({ label, fit }: { label: string; fit: Fit['site'] | null | undefined }) {
  if (!fit) return null;
  return (
    <li data-fit={label.toLowerCase()} data-outcome={fit.outcome}>
      <strong>
        {label}: {FIT_LABEL[fit.outcome]}.
      </strong>{' '}
      {fit.message}
    </li>
  );
}

function MeasureFit({
  fit,
  shortlist,
}: {
  fit: Fit;
  shortlist: GoalAssessmentViewProps['shortlist'];
}) {
  const siteOk = fit.site.outcome === 'FEASIBLE';
  const chosen = shortlist?.selected.includes(fit.interventionId) ?? false;
  return (
    <li className={styles.measure} data-intervention={fit.interventionId}>
      <div className={styles.measureHead}>
        <span className={styles.measureName}>{fit.name}</span>
        <OutcomeBadge outcome={fit.outcome} />
      </div>
      <ul className={styles.fitList}>
        <FitLine label="Site" fit={fit.site} />
        <FitLine label="Cost" fit={fit.cost} />
        <FitLine label="Build time" fit={fit.time} />
      </ul>
      <p className={styles.muted}>{fit.benefit}</p>
      {shortlist && (
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={chosen}
            disabled={shortlist.disabled || (!siteOk && !chosen)}
            onChange={() => shortlist.toggle(fit.interventionId)}
          />
          Shortlist this measure
          {!siteOk && !chosen && (
            <span className={styles.muted}> (only when your site meets its prerequisites)</span>
          )}
        </label>
      )}
    </li>
  );
}

/**
 * The deterministic goal screen, as returned by the server. It says whether a goal can be
 * planned, cannot be met as set, or cannot be assessed yet, and why; it never promises a
 * result and shows no confidence score.
 */
export function GoalAssessmentView({
  assessment: a,
  headingLevel = 2,
  shortlist,
  compact = false,
}: GoalAssessmentViewProps) {
  const titleId = useId();
  const Heading = `h${headingLevel}` as const;
  const Sub = `h${headingLevel + 1}` as 'h3' | 'h4';
  const relevant = a.interventions.filter((f) => f.relevant);
  const findings = [...a.constraints, ...a.conflicts];
  const moreSteps = compact ? a.nextSteps : a.nextSteps.slice(1);
  return (
    <section
      className={styles.assessment}
      aria-labelledby={titleId}
      data-goal-outcome={a.outcome}
      data-compact={compact}
    >
      <div className={styles.assessmentHead}>
        <Heading id={titleId} className={styles.subTitle}>
          <Icon name="target" /> Goal check
        </Heading>
        <OutcomeBadge outcome={a.outcome} />
      </div>
      <p className={styles.checkSummary}>{a.summary}</p>
      {!compact && <GoalCheckVisuals assessment={a} />}
      {!compact && a.nextSteps.length > 0 && (
        <div className={styles.nextAction}>
          <Icon name="arrow-right" size="sm" />
          <p>
            <strong>Next step</strong> {a.nextSteps[0]}
          </p>
        </div>
      )}
      <details className={styles.checkDetails} open={compact || undefined}>
        <summary>
          <span>View check details</span>
          <Icon name="chevron-down" size="sm" />
        </summary>
        <div className={styles.checkDetailsBody}>
          <div className={styles.assessmentGrid}>
            <div className={styles.block}>
              <Sub className={styles.blockTitle}>Target against your baseline</Sub>
              <p data-target-outcome={a.target.outcome}>{a.target.message}</p>
              {a.target.caveats.length > 0 && (
                <ul className={styles.list}>
                  {a.target.caveats.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
            </div>
            {findings.length > 0 && (
              <div className={styles.block}>
                <Sub className={styles.blockTitle}>Constraints and conflicts</Sub>
                <ul className={styles.list}>
                  {findings.map((f) => (
                    <li key={f.code} data-finding={f.code} data-outcome={f.outcome ?? 'NOTE'}>
                      {f.outcome ? <strong>{OUTCOME[f.outcome].label}: </strong> : null}
                      {f.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {moreSteps.length > 0 && (
              <div className={styles.block}>
                <Sub className={styles.blockTitle}>To assess this further</Sub>
                <ul className={styles.list}>
                  {moreSteps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {!compact && (
            <div className={styles.measureSection}>
              <Sub className={styles.blockTitle}>How each measure fits</Sub>
              {relevant.length === 0 ? (
                <p className={styles.muted}>No catalogue measure serves these goals yet.</p>
              ) : (
                <ul className={styles.measures}>
                  {relevant.map((f) => (
                    <MeasureFit key={f.interventionId} fit={f} shortlist={shortlist} />
                  ))}
                </ul>
              )}
              <p className={styles.muted}>
                Catalogue {a.catalogueVersion}. Costs and build times are only ever your own
                estimates: no sourced figures exist for this location, and effects are not modelled
                yet.
              </p>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
