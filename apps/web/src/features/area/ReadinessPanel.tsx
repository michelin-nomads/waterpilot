import type { ReactNode } from 'react';

import {
  Badge,
  ErrorState,
  LoadingRegion,
  Notice,
  PermissionState,
  Skeleton,
} from '../../components';
import { GraphQLRequestError } from '../../graphql/requestError';
import {
  AreaReadinessDocument,
  type AreaReadinessFieldsFragment,
  type ReadinessState,
} from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { ManualInputForm } from './ManualInputForm';
import {
  CAPABILITY_LABEL,
  METRIC_LABEL,
  STATE_LABEL,
  SUPPORT_LABEL,
  UNIT_SHORT,
} from './readinessLabels';
import styles from './Readiness.module.scss';

type Readiness = AreaReadinessFieldsFragment;

function StateBadge({ state }: { state: ReadinessState }) {
  const { label, tone } = STATE_LABEL[state];
  return <Badge tone={tone}>{label}</Badge>;
}

function Reasons({ reasons }: { reasons: readonly string[] }) {
  if (reasons.length === 0) return null;
  return (
    <ul className={styles.reasons}>
      {reasons.map((r) => (
        <li key={r}>{r}</li>
      ))}
    </ul>
  );
}

function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className={styles.section}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      <p className={styles.intro}>{intro}</p>
      {children}
    </section>
  );
}

function Metrics({ readiness }: { readiness: Readiness }) {
  return (
    <Section
      id="readiness-metrics"
      title="What WaterLens can calculate here"
      intro="Each result needs specific inputs. Your water baseline above shows a value only where the inputs below allow."
    >
      <ul className={styles.rows}>
        {readiness.metrics.map((m) => (
          <li key={m.metric} className={styles.row} data-metric={m.metric}>
            <div className={styles.rowHead}>
              <span className={styles.rowTitle}>{METRIC_LABEL[m.metric] ?? m.metric}</span>
              <StateBadge state={m.state} />
            </div>
            <Reasons reasons={m.reasons} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Capabilities({ readiness }: { readiness: Readiness }) {
  return (
    <Section
      id="readiness-capabilities"
      title="Data coverage"
      intro="Which kinds of data have a reviewed, licensed source for this area. Anything not covered is marked unavailable, never zero."
    >
      <ul className={styles.rows}>
        {readiness.capabilities.map((c) => (
          <li key={c.capability} className={styles.row} data-capability={c.capability}>
            <div className={styles.rowHead}>
              <span className={styles.rowTitle}>{CAPABILITY_LABEL[c.capability]}</span>
              <StateBadge state={c.state} />
            </div>
            <p className={styles.meta}>
              {SUPPORT_LABEL[c.technicalSupport]}
              {c.requiresLocalMeasurement && ' · needs local measurements'}
              {c.requiresReviewedModel && ' · needs a reviewed model'}
              {c.registeredSourceIds.length === 0
                ? ' · no source registered'
                : ` · ${c.registeredSourceIds.length} source(s) registered`}
            </p>
            <Reasons reasons={c.reasons} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Inputs({ readiness, sessionId }: { readiness: Readiness; sessionId: string | null }) {
  return (
    <Section
      id="readiness-inputs"
      title="What you can provide"
      intro="Inputs WaterLens is missing, and how to fill them. Values you enter are labelled as entered by you."
    >
      <ul className={styles.rows}>
        {readiness.inputs.map((i) => (
          <li key={i.input} className={styles.row} data-input={i.input}>
            <div className={styles.rowHead}>
              <span className={styles.rowTitle}>{i.label}</span>
              <StateBadge state={i.state} />
            </div>
            {i.manualValue && (
              <p className={styles.meta}>
                Your value: {i.manualValue} {UNIT_SHORT[i.unit] ?? ''}
              </p>
            )}
            <Reasons reasons={i.reasons} />
            {i.action && <p className={styles.action}>{i.action}</p>}
            {i.ownerPrompt && <p className={styles.meta}>Owner: {i.ownerPrompt}</p>}
            {i.manualEntryAllowed && sessionId && (
              <ManualInputForm
                sessionId={sessionId}
                input={i.input}
                label={i.label}
                maxDate={readiness.asOf}
              />
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

interface ReadinessPanelProps {
  areaId: string;
  /** Include this session's own entered values; requires the session's saved area. */
  sessionId: string | null;
}

/** Data readiness for one area: what can be calculated, coverage and missing inputs. */
export function ReadinessPanel({ areaId, sessionId }: ReadinessPanelProps) {
  const variables = { areaId, sessionId };
  const query = useGraphQLQuery(
    queryKeys.readiness.area(areaId, sessionId),
    AreaReadinessDocument,
    variables,
  );

  if (query.isPending) {
    return (
      <LoadingRegion label="Checking data readiness for this area">
        <Skeleton shape="block" />
        <Skeleton />
        <Skeleton width="three-quarters" />
      </LoadingRegion>
    );
  }
  if (query.isError) {
    const code = query.error instanceof GraphQLRequestError ? query.error.code : null;
    if (code === 'NOT_FOUND' || code === 'FORBIDDEN' || code === 'UNAUTHENTICATED') {
      return (
        <PermissionState title="This area's readiness is not available to you">
          The area or this planning session is not yours, or it no longer exists. Choose a location
          again from this step.
        </PermissionState>
      );
    }
    return (
      <ErrorState
        title="Data readiness could not load"
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        requestId={
          query.error instanceof GraphQLRequestError
            ? (query.error.requestId ?? undefined)
            : undefined
        }
      >
        Your session and inputs are kept. Check your connection and try again.
      </ErrorState>
    );
  }

  const area = query.data.area;
  if (!area) {
    return (
      <PermissionState title="This area is not available">
        The saved location no longer exists. Choose a location again.
      </PermissionState>
    );
  }
  const readiness = area.readiness;
  return (
    <div className={styles.panel}>
      {query.isStale && query.isFetching && (
        <p className={styles.refreshing} role="status">
          Refreshing…
        </p>
      )}
      {readiness.basis === 'USER_INPUT' && (
        <Notice kind="partial" title="User-input assessment" announce={false}>
          WaterLens has no reviewed data source covering this location. You can still complete every
          step: the assessment uses only values you enter, and each result is labelled as based on
          your inputs, not on measured data.
        </Notice>
      )}
      {readiness.basis === 'LIMITED' && (
        <Notice kind="partial" title="Limited data coverage" announce={false}>
          Sources for this location are partial or out of date. Results are labelled where they rely
          on them, and you can add values you know below.
        </Notice>
      )}
      {readiness.demo && (
        <Notice kind="partial" title="Demo data" announce={false}>
          Some sources for {area.name} are synthetic demonstration data. They show how WaterLens
          works and are not facts about any real place.
        </Notice>
      )}
      <Metrics readiness={readiness} />
      <Capabilities readiness={readiness} />
      <Inputs readiness={readiness} sessionId={sessionId} />
    </div>
  );
}
