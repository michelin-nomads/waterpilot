import type { ReactNode } from 'react';

import type { EvidenceQuality, StatusTone } from '../../lib/status';
import { Badge, EvidenceBadge } from '../Badge/Badge';
import { Icon, type IconName } from '../Icon/Icon';
import { Tooltip } from '../Tooltip/Tooltip';
import styles from './MetricCard.module.scss';

/**
 * A metric is either computed (with a pre-formatted display value) or unavailable with a
 * reason. There is deliberately no way to pass a value for an unavailable metric, so the
 * card can never show 0 or a default in place of missing evidence.
 */
export type MetricDisplay =
  | {
      availability: 'available' | 'provisional';
      value: string;
      unit?: string;
      caption?: ReactNode;
    }
  | { availability: 'unavailable'; reason: ReactNode };

export interface MetricDelta {
  text: string;
  sentiment: 'improves' | 'worsens' | 'neutral';
}

interface MetricCardProps {
  label: string;
  metric: MetricDisplay;
  evidence?: EvidenceQuality;
  /** Definition shown in the info tooltip; link to the metric dictionary wording. */
  definition?: ReactNode;
  icon?: IconName;
  tone?: Exclude<StatusTone, 'neutral'>;
  delta?: MetricDelta;
  headingLevel?: 2 | 3 | 4;
}

export function MetricCard({
  label,
  metric,
  evidence,
  definition,
  icon,
  tone = 'accent',
  delta,
  headingLevel = 3,
}: MetricCardProps) {
  const Heading = `h${headingLevel}` as const;
  const unavailable = metric.availability === 'unavailable';

  return (
    <div className={`${styles.card} ${styles[tone]}`} data-availability={metric.availability}>
      {icon && (
        <span className={styles.icon}>
          <Icon name={icon} size="lg" />
        </span>
      )}
      <div className={styles.body}>
        <div className={styles.header}>
          <Heading className={styles.label}>{label}</Heading>
          {definition && <Tooltip label={`About ${label.toLowerCase()}`}>{definition}</Tooltip>}
        </div>
        {unavailable ? (
          <>
            <p className={styles.unavailable}>Unavailable</p>
            <p className={styles.caption}>{metric.reason}</p>
          </>
        ) : (
          <>
            <p className={styles.value}>
              {metric.value}
              {metric.unit && <span className={styles.unit}> {metric.unit}</span>}
            </p>
            {metric.caption && <p className={styles.caption}>{metric.caption}</p>}
            {delta && <p className={`${styles.delta} ${styles[delta.sentiment]}`}>{delta.text}</p>}
          </>
        )}
        {(metric.availability === 'provisional' || evidence) && (
          <div className={styles.badges}>
            {metric.availability === 'provisional' && <Badge tone="warning">Provisional</Badge>}
            {evidence && <EvidenceBadge quality={evidence} />}
          </div>
        )}
      </div>
    </div>
  );
}
