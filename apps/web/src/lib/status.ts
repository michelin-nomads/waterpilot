/** Status axes from docs/domain/conventions.md §5 — kept separate, never merged. */

export type Availability = 'available' | 'provisional' | 'unavailable';

export type EvidenceQuality =
  'unreviewed' | 'validated' | 'provisional' | 'quarantined' | 'synthetic';

/** GraphQL enums are upper-case; the display axis is lower-case. */
export function evidenceFromApi(value: Uppercase<EvidenceQuality>): EvidenceQuality {
  return value.toLowerCase() as EvidenceQuality;
}

export type StatusTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';

export const EVIDENCE_LABEL: Record<EvidenceQuality, { label: string; tone: StatusTone }> = {
  unreviewed: { label: 'Unreviewed source', tone: 'neutral' },
  validated: { label: 'Validated source', tone: 'success' },
  provisional: { label: 'Provisional evidence', tone: 'warning' },
  quarantined: { label: 'Quarantined', tone: 'danger' },
  synthetic: { label: 'Synthetic demo data', tone: 'info' },
};

export const AVAILABILITY_LABEL: Record<Availability, { label: string; tone: StatusTone }> = {
  available: { label: 'Available', tone: 'success' },
  provisional: { label: 'Provisional', tone: 'warning' },
  unavailable: { label: 'Unavailable', tone: 'neutral' },
};
