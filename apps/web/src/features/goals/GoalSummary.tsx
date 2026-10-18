import { Icon } from '../../components';
import { goalBudgetLabel, goalDurationLabel } from './goalDisplay';
import type { GoalDraft } from './goalDraft';
import { KIND_LABEL, PRIORITY_LABEL, RESTRICTION_LABEL, UNIT_LABEL } from './goalLabels';
import styles from './Goals.module.scss';

export function GoalSummary({ draft }: { draft: GoalDraft }) {
  const target =
    draft.mode && draft.targetValue.trim()
      ? `${draft.targetValue}${draft.mode === 'RELATIVE_REDUCTION' || draft.unit === 'RATIO' ? '%' : ` ${draft.kind === 'CUSTOM' && draft.unit === 'COUNT' ? 'count' : (UNIT_LABEL[draft.unit ?? 'COUNT'] ?? '')}`}${draft.mode === 'RELATIVE_REDUCTION' ? ' reduction' : ''}`
      : 'Not set';
  return (
    <aside className={styles.goalSummary} aria-label="Your goal at a glance">
      <div className={styles.summaryHeader}>
        <Icon name="target" size="sm" />
        Your goal at a glance
      </div>
      <div className={styles.summaryBody}>
        <span className={styles.summaryLabel}>Primary goal</span>
        <h2>{draft.kind ? KIND_LABEL[draft.kind] : 'Choose a goal'}</h2>
        {draft.kind === 'CUSTOM' && draft.description && (
          <p className={styles.customSummary}>{draft.description}</p>
        )}
        <div className={styles.targetPreview}>
          <span className={styles.summaryLabel}>Desired improvement</span>
          <strong>{target}</strong>
          <p>
            {draft.mode === 'RELATIVE_REDUCTION'
              ? 'relative to your baseline'
              : draft.mode
                ? 'your chosen target level'
                : 'Compare options without a numeric target'}
          </p>
        </div>
        <dl className={styles.summaryFacts}>
          <dt>Budget limit</dt>
          <dd>{goalBudgetLabel(draft.budgetAmount, draft.currency)}</dd>
          <dt>Implementation</dt>
          <dd>
            {draft.timelineDays ? `Within ${goalDurationLabel(draft.timelineDays)}` : 'Not set'}
          </dd>
          <dt>Priority</dt>
          <dd>{draft.priority ? PRIORITY_LABEL[draft.priority] : 'No preference'}</dd>
          <dt>Benefits period</dt>
          <dd>{draft.horizonDays ? goalDurationLabel(draft.horizonDays, true) : 'Not set'}</dd>
        </dl>
        <div className={styles.summaryDivider} />
        <span className={styles.summaryLabel}>Site constraints</span>
        <div className={styles.chips}>
          {draft.restrictions.length ? (
            draft.restrictions.map((r) => <span key={r}>{RESTRICTION_LABEL[r]}</span>)
          ) : (
            <p className={styles.muted}>No restrictions specified</p>
          )}
        </div>
      </div>
    </aside>
  );
}
