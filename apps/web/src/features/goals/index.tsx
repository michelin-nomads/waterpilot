import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  Button,
  ButtonLink,
  ErrorState,
  LoadingRegion,
  Notice,
  Skeleton,
  Tooltip,
} from '../../components';
import { graphqlRequest } from '../../graphql/client';
import {
  CheckGoalDocument,
  GoalAreaDocument,
  GoalAssessmentDocument,
  InterventionCatalogueDocument,
  type CheckGoalQuery,
  type GoalInput,
  type InterventionCatalogueQuery,
} from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { usePlanningSession } from '../../session/sessionContext';
import { sameValue, type SessionState } from '../../session/sessionState';
import { StagePage } from '../planning/StagePage';
import { GoalAssessmentView } from './GoalAssessmentView';
import {
  draftField,
  emptyDraft,
  fromGoalInput,
  toGoalInput,
  type DraftErrors,
  type EffectUnits,
  type GoalDraft,
} from './goalDraft';
import { GoalForm } from './GoalForm';
import styles from './Goals.module.scss';

function serverErrors(errors: CheckGoalQuery['checkGoal']['errors']): DraftErrors {
  const out: DraftErrors = {};
  for (const e of errors) out[draftField(e.field)] ??= e.message;
  return out;
}

type Catalogue = InterventionCatalogueQuery['interventionCatalogue'];

/** Saved effect ranges are shown in their catalogue units, so the catalogue loads first. */
function GoalWorkspace({ session }: { session: SessionState }) {
  const catalogue = useGraphQLQuery(queryKeys.goals.catalogue(), InterventionCatalogueDocument, {});
  if (catalogue.data) {
    return <GoalEditor session={session} catalogue={catalogue.data.interventionCatalogue} />;
  }
  if (catalogue.isError) {
    return (
      <ErrorState
        title="The list of measures did not load"
        onRetry={() => void catalogue.refetch()}
        retrying={catalogue.isFetching}
      >
        Your saved goal is safe. Check your connection and try again.
      </ErrorState>
    );
  }
  return (
    <LoadingRegion label="Loading measures">
      <Skeleton shape="block" />
    </LoadingRegion>
  );
}

function effectUnits(catalogue: Catalogue): EffectUnits {
  const out: Record<string, Catalogue['interventions'][number]['effectInputs'][number]['unit']> =
    {};
  for (const i of catalogue.interventions)
    for (const e of i.effectInputs) out[`${i.id}.${e.key}`] = e.unit;
  return out;
}

function GoalEditor({ session, catalogue }: { session: SessionState; catalogue: Catalogue }) {
  const { coordinator, state } = usePlanningSession();
  const client = useQueryClient();
  const navigate = useNavigate();
  const areaId = session.areaId;
  const revision = state.server?.inputsRevision ?? session.inputsRevision;
  const savedGoal = state.server?.goal ?? null;
  const goalPending = 'goal' in state.pending;
  const goalSaving = goalPending && state.save === 'saving';

  const area = useGraphQLQuery(
    queryKeys.areas.goalArea(areaId ?? ''),
    GoalAreaDocument,
    { id: areaId ?? '' },
    { enabled: areaId !== null },
  );
  const areaCurrency = area.data?.area?.currency ?? null;

  const [draft, setDraft] = useState<GoalDraft>(() =>
    session.goal ? fromGoalInput(session.goal, '', effectUnits(catalogue)) : emptyDraft(''),
  );
  const effective = draft.currency ? draft : { ...draft, currency: areaCurrency ?? '' };
  const [errors, setErrors] = useState<DraftErrors>({});
  const [checked, setChecked] = useState<{ json: string; input: GoalInput } | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');

  const current = toGoalInput(effective).input;
  const currentJson = current ? JSON.stringify(current) : null;
  const matchesSaved = current !== null && sameValue('goal', savedGoal, current);

  const checkKey = queryKeys.sessions.goalCheck(session.id, revision, checked?.json ?? '');
  const check = useGraphQLQuery(
    checkKey,
    CheckGoalDocument,
    { sessionId: session.id, goal: checked?.input as GoalInput },
    { enabled: checked !== null },
  );
  const saved = useGraphQLQuery(
    queryKeys.sessions.goalAssessment(session.id, revision),
    GoalAssessmentDocument,
    { sessionId: session.id },
    { enabled: savedGoal !== null && !goalPending },
  );

  function prepare(): { json: string; input: GoalInput } | null {
    const { input, errors: local } = toGoalInput(effective);
    setErrors(local);
    if (!input) return null;
    return { json: JSON.stringify(input), input };
  }

  function runCheck() {
    const next = prepare();
    if (next) setChecked(next);
  }

  async function save(compare = false) {
    const next = prepare();
    if (!next || !coordinator) return;
    setChecked(next);
    setFailure('');
    setSaving(true);
    try {
      const result = await client.fetchQuery({
        queryKey: queryKeys.sessions.goalCheck(session.id, revision, next.json),
        queryFn: ({ signal }) =>
          graphqlRequest(
            CheckGoalDocument,
            { sessionId: session.id, goal: next.input },
            { signal },
          ),
      });
      const found = serverErrors(result.checkGoal.errors);
      setErrors(found);
      if (Object.keys(found).length === 0) {
        coordinator.setGoal(next.input);
        await coordinator.flush();
        const persisted = coordinator.getState();
        if (
          persisted.message ||
          persisted.conflict ||
          Object.keys(persisted.pending).length ||
          !sameValue('goal', persisted.server?.goal ?? null, next.input)
        ) {
          throw new Error('Goal save incomplete');
        }
        if (compare) navigate('/plans');
      }
    } catch {
      setFailure(
        'Your goal could not be saved. Your entries are kept. Check the connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  const checkErrors =
    check.data && checked?.json === currentJson ? check.data.checkGoal.errors : [];
  const shownErrors = { ...serverErrors(checkErrors), ...errors };
  const draftAssessment =
    checked && checked.json === currentJson ? (check.data?.checkGoal.assessment ?? null) : null;
  const savedAssessment =
    matchesSaved && !goalPending ? (saved.data?.planningSession?.goalAssessment ?? null) : null;
  const shown = savedAssessment ?? draftAssessment;
  const stale = checked !== null && checked.json !== currentJson && !matchesSaved;

  const shortlist = {
    selected: effective.preferred,
    disabled: saving || goalSaving,
    toggle: (iid: string) =>
      setDraft({
        ...effective,
        preferred: effective.preferred.includes(iid)
          ? effective.preferred.filter((x) => x !== iid)
          : [...effective.preferred, iid],
      }),
  };

  return (
    <div className={styles.page}>
      {!areaId && (
        <Notice kind="info" title="No location yet">
          Targets are compared with your location&apos;s baseline.{' '}
          <Link to="/area">Choose a location</Link> to check them.
        </Notice>
      )}
      <GoalForm
        draft={effective}
        onChange={(d) => {
          setDraft(d);
          setErrors({});
          setFailure('');
        }}
        errors={shownErrors}
        catalogue={catalogue}
        areaCurrency={areaCurrency}
        assessment={shown}
        disabled={saving || goalSaving}
        onCompare={() => void save(true)}
        actions={
          <div className={styles.goalFooter}>
            <ButtonLink to="/baseline/overview" variant="secondary">
              Back to baseline
            </ButtonLink>
            <div className={styles.actions}>
              <Button
                variant="ghost"
                className={styles.textAction}
                onClick={runCheck}
                loading={check.isFetching && !saving}
                disabled={!effective.kind || saving || goalSaving}
              >
                Check goal
              </Button>
              <Button
                variant="secondary"
                onClick={() => void save()}
                loading={saving || goalSaving}
                disabled={!effective.kind || (matchesSaved && !goalPending)}
              >
                {matchesSaved && !goalPending ? 'Goal saved' : 'Save goal'}
              </Button>
              <Button
                type="submit"
                loading={saving || goalSaving}
                disabled={!effective.kind || !areaId}
                endIcon="arrow-right"
              >
                Compare plans
              </Button>
            </div>
          </div>
        }
      />
      {failure && (
        <Notice kind="caution" title="Goal not saved">
          {failure}
        </Notice>
      )}
      {check.isError && (
        <Notice kind="caution" title="The goal check could not load">
          Your entries are kept. Check the connection and try again.
        </Notice>
      )}
      {stale && (
        <Notice kind="stale">You changed the goal after checking it. Check it again.</Notice>
      )}
      {shown ? (
        <div className={styles.panel} data-assessment-source={savedAssessment ? 'saved' : 'draft'}>
          {!savedAssessment && <p className={styles.muted}>Checked, not saved yet.</p>}
          <GoalAssessmentView assessment={shown} shortlist={shortlist} />
        </div>
      ) : check.isFetching || saved.isFetching ? (
        <LoadingRegion label="Checking your goal">
          <Skeleton shape="block" />
        </LoadingRegion>
      ) : null}
    </div>
  );
}

function Body() {
  const { state, view, coordinator } = usePlanningSession();
  if (state.status === 'loading') {
    return (
      <LoadingRegion label="Loading your planning session">
        <Skeleton shape="block" />
      </LoadingRegion>
    );
  }
  if (!view || !coordinator || state.status !== 'ready') {
    return <Notice kind="info">Start a plan to set a goal; it is saved with your plan.</Notice>;
  }
  return <GoalWorkspace key={`${view.id}:${state.server?.inputsRevision ?? 0}`} session={view} />;
}

function GoalLocationContext() {
  const { view } = usePlanningSession();
  const areaId = view?.areaId;
  const area = useGraphQLQuery(
    queryKeys.areas.goalArea(areaId ?? ''),
    GoalAreaDocument,
    { id: areaId ?? '' },
    { enabled: Boolean(areaId) },
  );
  if (!area.data?.area) return null;
  return (
    <section className={styles.locationContext} aria-label="Selected planning location">
      <div>
        <span className={styles.muted}>Planning for</span>
        <Tooltip
          label="Full planning location"
          trigger={<strong className={styles.locationName}>{area.data.area.name}</strong>}
        >
          {area.data.area.name}
        </Tooltip>
      </div>
      <ButtonLink to="/area" variant="ghost" size="sm" className={styles.textAction}>
        Change
      </ButtonLink>
    </section>
  );
}

export default function GoalsPage() {
  return (
    <div className={styles.goalPage}>
      <StagePage
        stageId="goals"
        actions={<GoalLocationContext />}
        title="What would you like to improve?"
        subtitle="Choose a goal. We’ll compare plans against your target and constraints."
      >
        <Body />
      </StagePage>
    </div>
  );
}
