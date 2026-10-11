import { Badge, Notice } from '../../components';
import type {
  ImpactCitationFieldsFragment,
  ImpactContextFieldsFragment,
  ImpactFindingFieldsFragment,
  WiderImpactFieldsFragment,
} from '../../graphql/generated/graphql';
import {
  DIRECTION_LABEL,
  formatMetric,
  formatRange,
  formatReading,
  LINKAGE_LABEL,
  RELIANCE_LABEL,
  SYSTEM_LABEL,
} from './plansFormat';
import styles from './Plans.module.scss';

function Sources({ citations }: { citations: readonly ImpactCitationFieldsFragment[] }) {
  if (citations.length === 0) return null;
  return (
    <p className={styles.muted}>
      Based on:{' '}
      {citations.map((c, i) => (
        <span key={`${c.kind}.${c.ref}`} data-citation={c.ref}>
          {i > 0 && '; '}
          {c.label}
          {c.asOf ? ` (${c.asOf})` : ''}
        </span>
      ))}
    </p>
  );
}

function FindingItem({ finding }: { finding: ImpactFindingFieldsFragment }) {
  return (
    <li data-finding={finding.id} data-linkage={finding.linkage ?? undefined}>
      {finding.system && finding.direction && (
        <span className={styles.tags}>
          <Badge tone="neutral">{SYSTEM_LABEL[finding.system]}</Badge>
          <Badge tone={finding.direction === 'POSSIBLE_BENEFIT' ? 'success' : 'warning'}>
            {DIRECTION_LABEL[finding.direction]}
          </Badge>
          {finding.linkage && <Badge tone="neutral">{LINKAGE_LABEL[finding.linkage]}</Badge>}
        </span>
      )}
      <p className={styles.text}>{finding.statement}</p>
      <p className={styles.muted}>{finding.uncertainty}</p>
    </li>
  );
}

/** One option's wider effects, shown with the option before anything is chosen. */
export function OptionImpact({ impact }: { impact: WiderImpactFieldsFragment }) {
  return (
    <section className={styles.block} aria-label="Effects beyond your site" data-impact={impact.id}>
      <h4 className={styles.blockTitle}>Effects at your site and beyond</h4>
      {impact.falseResilience.map((f) => (
        <Notice key={f.id} kind="caution" title="Possible false resilience" announce={false}>
          <p className={styles.text} data-finding={f.id}>
            {f.statement}
          </p>
          <p className={styles.muted}>{f.uncertainty}</p>
          <Sources citations={f.citations} />
        </Notice>
      ))}
      {impact.localBenefits.map((b) => (
        <div key={b.id} className={styles.stack} data-finding={b.id}>
          <p className={styles.text}>
            <strong>At your site:</strong> {b.statement}
          </p>
          {b.magnitude && (
            <p className={styles.text}>
              {formatMetric(b.magnitude.baseline, b.magnitude.unit)} now;{' '}
              {formatRange(
                b.magnitude.atLowEstimates,
                b.magnitude.atHighEstimates,
                b.magnitude.unit,
              )}{' '}
              with this plan.
            </p>
          )}
          <p className={styles.muted}>{b.uncertainty}</p>
        </div>
      ))}
      <div className={styles.stack}>
        <p className={styles.text}>
          <strong>Possible effects beyond your site</strong> (no size is estimated)
        </p>
        {impact.externalities.length > 0 ? (
          <ul className={styles.findings}>
            {impact.externalities.map((e) => (
              <FindingItem key={e.id} finding={e} />
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>The catalogue records no wider effect for these measures.</p>
        )}
      </div>
      {impact.tradeoffs.length > 0 && (
        <div className={styles.stack}>
          <p className={styles.text}>
            <strong>Tradeoffs</strong>
          </p>
          <ul className={styles.list}>
            {impact.tradeoffs.map((t) => (
              <li key={t.id} data-finding={t.id}>
                {t.statement}
              </li>
            ))}
          </ul>
        </div>
      )}
      {impact.reviews.length > 0 && (
        <div className={styles.stack}>
          <p className={styles.text}>
            <strong>Professional review</strong>
          </p>
          <ul className={styles.list}>
            {impact.reviews.map((r) => (
              <li key={r.kind} data-review={r.kind} data-required={r.required}>
                {r.label}: {r.required ? 'required before building' : 'recommended'}.{' '}
                {r.reasons.join(' ')}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** What the assessments above rest on: boundaries, nearby places, groundwater, quality. */
export function ImpactContextPanel({
  context,
  engineVersion,
}: {
  context: ImpactContextFieldsFragment;
  engineVersion: string;
}) {
  return (
    <div className={styles.stack} data-groundwater={context.groundwater}>
      <table className={styles.table}>
        <caption className={styles.caption}>Influence boundaries</caption>
        <thead>
          <tr>
            <th scope="col">Boundary</th>
            <th scope="col">Connection to your area</th>
            <th scope="col">Detail</th>
          </tr>
        </thead>
        <tbody>
          {context.boundaries.map((b) => (
            <tr key={`${b.level}.${b.system ?? ''}`} data-linkage={b.linkage ?? undefined}>
              <th scope="row">{b.label}</th>
              <td>{b.linkage ? LINKAGE_LABEL[b.linkage] : 'Your own choice'}</td>
              <td>{b.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.stack}>
        <h4 className={styles.blockTitle}>Nearby places (geography only)</h4>
        <p className={styles.muted}>
          Being close does not mean sharing an aquifer, catchment or supply network. A place is
          shown as connected only when a reviewed record names both areas.
        </p>
        {context.nearby.length > 0 ? (
          <ul className={styles.list} aria-label="Nearby places">
            {context.nearby.map((p) => (
              <li key={p.communityId} data-nearby={p.communityId}>
                {p.name}, about {p.distanceM.toLocaleString('en-IN')} m away:{' '}
                {p.links
                  .map((l) => `${SYSTEM_LABEL[l.system]} ${LINKAGE_LABEL[l.linkage].toLowerCase()}`)
                  .join('; ')}
                .
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>
            No communities recorded within {context.nearbyRadiusM / 1000} km.
          </p>
        )}
      </div>
      <div className={styles.stack}>
        <h4 className={styles.blockTitle}>Groundwater use at your site</h4>
        <p className={styles.text}>{RELIANCE_LABEL[context.groundwater]}</p>
        <Sources citations={context.groundwaterCitations} />
      </div>
      <div className={styles.stack}>
        <h4 className={styles.blockTitle}>Water quality readings</h4>
        {context.waterQuality.length > 0 ? (
          <ul className={styles.list}>
            {context.waterQuality.map((q, i) => (
              <li key={i}>{formatReading(q)}</li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>No water quality reading on record for this area.</p>
        )}
        <p className={styles.muted}>{context.waterQualityNote}</p>
      </div>
      {context.unavailable.length > 0 && (
        <div className={styles.stack}>
          <h4 className={styles.blockTitle}>Not assessed</h4>
          <ul className={styles.list} aria-label="Not assessed">
            {context.unavailable.map((u) => (
              <li key={u.key} data-unavailable={u.key}>
                <strong>{u.label}:</strong> {u.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className={styles.muted}>Impact engine {engineVersion}.</p>
    </div>
  );
}
