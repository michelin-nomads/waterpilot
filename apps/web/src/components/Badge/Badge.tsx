import type { ReactNode } from 'react';

import { EVIDENCE_LABEL, type EvidenceQuality, type StatusTone } from '../../lib/status';
import { Icon, type IconName } from '../Icon/Icon';
import styles from './Badge.module.scss';

interface BadgeProps {
  tone?: StatusTone;
  icon?: IconName;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {icon && <Icon name={icon} size="sm" />}
      {children}
    </span>
  );
}

/** Labels the evidence behind a value, e.g. "Synthetic demo data". */
export function EvidenceBadge({ quality }: { quality: EvidenceQuality }) {
  const { label, tone } = EVIDENCE_LABEL[quality];
  return <Badge tone={tone}>{label}</Badge>;
}
