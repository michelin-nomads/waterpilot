import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/authContext';
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Notice,
  Select,
  Textarea,
} from '../../components';
import { newIdempotencyKey, unwrapPayload } from '../../graphql/client';
import {
  AddProjectExpenseDocument,
  ImplementationProjectDocument,
  MyImplementationProjectsDocument,
  ObservationsDocument,
  RecordObservationDocument,
  StartImplementationProjectDocument,
  TrackingReportDocument,
  TrackingReportsDocument,
  UpdateMilestoneDocument,
  UpdateProjectStatusDocument,
} from '../../graphql/generated/graphql';
import { useGraphQLMutation, useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { PageHeader } from '../../shell/PageHeader';
import styles from './Tracking.module.scss';

const PAGE = { first: 50 };
const UNIT_OPTIONS = [
  ['LITRE', 'L'],
  ['LITRES_PER_DAY', 'L/day'],
  ['RATIO', 'ratio'],
  ['METRES_BELOW_GROUND', 'm_bgl'],
  ['MILLIMETRE', 'mm'],
  ['SQUARE_METRE', 'm2'],
  ['DAY', 'day'],
  ['MG_PER_LITRE', 'mg/L'],
  ['NTU', 'NTU'],
  ['MICROSIEMENS_PER_CM', 'uS/cm'],
  ['PH', 'pH'],
  ['CFU_PER_100ML', 'CFU/100mL'],
  ['COUNT', 'count'],
] as const;

function displayUnit(unit: string): string {
  return UNIT_OPTIONS.find(([value]) => value === unit)?.[1] ?? unit;
}

const moneyLabel = (money: { minorUnits: string; currency: string } | null | undefined) =>
  money ? `${money.minorUnits} ${money.currency} minor units` : 'Amount unavailable';

function TrackingHome() {
  const auth = useAuth();
  const permanent = auth.status === 'ready' && auth.user?.kind === 'permanent';
  const projects = useGraphQLQuery(
    queryKeys.projects.mine(PAGE),
    MyImplementationProjectsDocument,
    PAGE,
    { enabled: permanent },
  );
  return (
    <main className={styles.page}>
      <PageHeader
        title="Implementation projects"
        subtitle="Track work from a finalized report. Recorded tasks and measurements remain separate from claims of water improvement."
      />
      <div className={styles.actions}>
        <ButtonLink to="/tracking/new">Start a project</ButtonLink>
        <ButtonLink to="/reports" variant="secondary">
          View reports
        </ButtonLink>
      </div>
      {!permanent ? (
        <EmptyState icon="lock" title="Sign in to view implementation projects">
          <p>Guest planning remains available. Saving a project requires a permanent account.</p>
          <Button
            onClick={() => void auth.ensurePermanent('Sign in to manage implementation projects.')}
          >
            Sign in
          </Button>
        </EmptyState>
      ) : projects.isPending ? (
        <p role="status">Loading projects…</p>
      ) : projects.isError ? (
        <ErrorState
          title="Projects could not load"
          onRetry={() => void projects.refetch()}
          retrying={projects.isFetching}
        >
          Retry to view saved project work.
        </ErrorState>
      ) : projects.data.myImplementationProjects.nodes.length === 0 ? (
        <EmptyState icon="layers" title="No implementation projects yet">
          <p>Start from one of your finalized reports.</p>
        </EmptyState>
      ) : (
        <ul className={styles.projectList}>
          {projects.data.myImplementationProjects.nodes.map((p) => (
            <li key={p.id} className={styles.projectCard}>
              <div>
                <p className={styles.meta}>
                  {p.status} · {p.sharedWithCommunity ? 'Shared with report community' : 'Private'}
                </p>
                <h2>
                  <Link to={`/tracking/${p.id}`}>{p.title}</Link>
                </h2>
                <p>
                  Report snapshot v{p.reportVersion} · project area {p.areaId}
                </p>
              </div>
              <Link className={styles.open} to={`/tracking/${p.id}`}>
                Open project
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

type MilestoneDraft = {
  title: string;
  plannedOn: string;
  responsibleIdentity: string;
  tasks: string;
};

function TrackingCreate() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const permanent = auth.status === 'ready' && auth.user?.kind === 'permanent';
  const reports = useGraphQLQuery(
    queryKeys.reports.list({ status: 'FINALIZED' }, PAGE),
    TrackingReportsDocument,
    PAGE,
    { enabled: permanent },
  );
  const create = useGraphQLMutation(
    'startImplementationProject',
    StartImplementationProjectDocument,
  );
  const [reportId, setReportId] = useState(() => searchParams.get('reportId') ?? '');
  const [title, setTitle] = useState('');
  const [share, setShare] = useState(false);
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { title: '', plannedOn: '', responsibleIdentity: '', tasks: '' },
  ]);
  const [error, setError] = useState('');
  const key = useRef<{ payload: string; value: string } | null>(null);
  const report = useMemo(
    () => reports.data?.reports.nodes.find((item) => item.id === reportId) ?? null,
    [reports.data, reportId],
  );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      if (
        !(await auth.ensurePermanent(
          'Saving a project preserves the selected finalized report version. Sign in to continue.',
        ))
      )
        return;
      const input = {
        reportId,
        title: title.trim(),
        shareWithCommunity: share,
        milestones: milestones
          .filter((m) => m.title.trim() && m.plannedOn)
          .map((m) => ({
            title: m.title.trim(),
            plannedOn: m.plannedOn,
            responsibleIdentity: m.responsibleIdentity.trim() || null,
            tasks: m.tasks
              .split('\n')
              .map((v) => v.trim())
              .filter(Boolean),
          })),
      };
      const payload = JSON.stringify(input);
      if (key.current?.payload !== payload) key.current = { payload, value: newIdempotencyKey() };
      const result = await create.mutateAsync({ ...input, idempotencyKey: key.current.value });
      const { project } = unwrapPayload(result.startImplementationProject);
      if (!project) throw new Error('No project was returned.');
      navigate(`/tracking/${project.id}`);
    } catch (e) {
      setError((e as Error).message || 'The project could not be saved.');
    }
  }
  return (
    <main className={styles.page}>
      <PageHeader
        title="Start an implementation project"
        subtitle="Use a finalized report snapshot. New projects are private unless you explicitly share them with the report community."
      />
      <div className={styles.actions}>
        <ButtonLink to="/tracking" variant="secondary">
          Back to projects
        </ButtonLink>
      </div>
      {!permanent ? (
        <EmptyState icon="lock" title="Sign in to create a project">
          <p>Your guest planning session remains unchanged.</p>
          <Button
            onClick={() =>
              void auth.ensurePermanent('Save an implementation project from a finalized report.')
            }
          >
            Sign in
          </Button>
        </EmptyState>
      ) : reports.isPending ? (
        <p role="status">Loading finalized reports…</p>
      ) : reports.isError ? (
        <ErrorState
          title="Finalized reports could not load"
          onRetry={() => void reports.refetch()}
          retrying={reports.isFetching}
        >
          Retry before starting a project.
        </ErrorState>
      ) : reports.data.reports.nodes.length === 0 ? (
        <EmptyState icon="file" title="A finalized report is required">
          <p>Finalize a report first, then use its immutable snapshot here.</p>
          <Link to="/reports">Open reports</Link>
        </EmptyState>
      ) : (
        <form className={styles.form} onSubmit={(e) => void submit(e)}>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <Field label="Finalized report" required>
            {(control) => (
              <Select
                {...control}
                value={reportId}
                required
                onChange={(e) => {
                  setReportId(e.target.value);
                  setShare(false);
                }}
              >
                <option value="">Choose a report</option>
                {reports.data!.reports.nodes.map((r) => (
                  <option value={r.id} key={r.id}>
                    {r.title} · {new Date(r.finalizedAt).toLocaleDateString()} · v{r.version}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Project name" required>
            {(control) => (
              <Input
                {...control}
                value={title}
                required
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>
          <section className={styles.permission} aria-labelledby="project-permissions">
            <h2 id="project-permissions">Permissions checklist</h2>
            <ul>
              <li>The source report must be finalized and visible to you.</li>
              <li>You and report community coordinators can update this project.</li>
              <li>Other community members can read it only when you opt in below.</li>
              <li>
                Measurements are manual records; tasks completed do not prove water improvement.
              </li>
            </ul>
          </section>
          {report?.communityId && (
            <label className={styles.checkbox}>
              <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />{' '}
              Share project details and manual observations with the report community
            </label>
          )}
          {milestones.map((m, i) => (
            <section className={styles.section} key={i}>
              <h2>Milestone {i + 1}</h2>
              <Field label="Milestone name">
                {(control) => (
                  <Input
                    {...control}
                    value={m.title}
                    onChange={(e) =>
                      setMilestones((all) =>
                        all.map((x, n) => (n === i ? { ...x, title: e.target.value } : x)),
                      )
                    }
                  />
                )}
              </Field>
              <div className={styles.grid}>
                <Field label="Target date">
                  {(control) => (
                    <Input
                      {...control}
                      type="date"
                      value={m.plannedOn}
                      onChange={(e) =>
                        setMilestones((all) =>
                          all.map((x, n) => (n === i ? { ...x, plannedOn: e.target.value } : x)),
                        )
                      }
                    />
                  )}
                </Field>
                <Field label="Responsible person or team">
                  {(control) => (
                    <Input
                      {...control}
                      maxLength={120}
                      value={m.responsibleIdentity}
                      onChange={(e) =>
                        setMilestones((all) =>
                          all.map((x, n) =>
                            n === i ? { ...x, responsibleIdentity: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  )}
                </Field>
              </div>
              <Field label="Tasks" hint="One task per line.">
                {(control) => (
                  <Textarea
                    {...control}
                    rows={3}
                    value={m.tasks}
                    onChange={(e) =>
                      setMilestones((all) =>
                        all.map((x, n) => (n === i ? { ...x, tasks: e.target.value } : x)),
                      )
                    }
                  />
                )}
              </Field>
            </section>
          ))}
          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setMilestones((m) => [
                  ...m,
                  { title: '', plannedOn: '', responsibleIdentity: '', tasks: '' },
                ])
              }
              disabled={milestones.length >= 30}
            >
              Add milestone
            </Button>
            <Button type="submit" disabled={create.isPending || !reportId || !title.trim()}>
              {create.isPending ? 'Saving…' : 'Create project'}
            </Button>
          </div>
        </form>
      )}
    </main>
  );
}

function TrackingDetail({ projectId }: { projectId: string }) {
  const auth = useAuth();
  const projectQuery = useGraphQLQuery(
    queryKeys.projects.detail(projectId),
    ImplementationProjectDocument,
    { id: projectId },
  );
  const project = projectQuery.data?.implementationProject;
  const reportQuery = useGraphQLQuery(
    queryKeys.reports.detail(project?.reportId ?? ''),
    TrackingReportDocument,
    { id: project?.reportId ?? '' },
    { enabled: Boolean(project) },
  );
  const observationsQuery = useGraphQLQuery(
    queryKeys.projects.observations(projectId, PAGE),
    ObservationsDocument,
    { projectId, ...PAGE },
  );
  const updateMilestone = useGraphQLMutation('updateMilestone', UpdateMilestoneDocument);
  const record = useGraphQLMutation('recordObservation', RecordObservationDocument);
  const expense = useGraphQLMutation('addProjectExpense', AddProjectExpenseDocument);
  const statusMutation = useGraphQLMutation('updateProjectStatus', UpdateProjectStatusDocument);
  const [error, setError] = useState('');
  const [observation, setObservation] = useState({
    metricId: '',
    value: '',
    unit: 'LITRES_PER_DAY',
    observedOn: '',
    method: '',
    sourceType: 'USER_RECORDED' as 'USER_RECORDED' | 'PERMITTED_DOCUMENT',
    source: '',
    permitted: false,
    windowStart: '',
    windowEnd: '',
    coverage: '',
  });
  const [expenseDraft, setExpenseDraft] = useState({
    description: '',
    spentOn: '',
    minorUnits: '',
    currency: 'INR',
    source: '',
  });
  const report = reportQuery.data?.report;
  const metrics = report?.impact?.metrics ?? [];
  const permanent = auth.status === 'ready' && auth.user?.kind === 'permanent';
  if (projectQuery.isPending)
    return (
      <main className={styles.page}>
        <p role="status">Loading project…</p>
      </main>
    );
  if (projectQuery.isError || !project)
    return (
      <main className={styles.page}>
        <ErrorState
          title="Project could not load"
          onRetry={() => void projectQuery.refetch()}
          retrying={projectQuery.isFetching}
        >
          Check your connection or access and retry.
        </ErrorState>
      </main>
    );
  const projectAreaId = project.areaId;
  const projectVersion = project.version;
  const milestones = project.milestones.nodes;
  const observations = observationsQuery.data?.implementationProject?.observations.nodes ?? [];
  async function milestoneStatus(
    m: (typeof milestones)[number],
    status: 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED',
  ) {
    setError('');
    try {
      const result = await updateMilestone.mutateAsync({
        id: m.id,
        expectedVersion: m.version,
        status,
        completedOn: status === 'DONE' ? new Date().toISOString().slice(0, 10) : null,
      });
      unwrapPayload(result.updateMilestone);
    } catch (e) {
      setError(
        (e as Error).message || 'The milestone changed elsewhere. Reload current data and retry.',
      );
    }
  }
  async function submitObservation(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      if (
        !(await auth.ensurePermanent(
          'Recording a manual observation requires a signed-in account.',
        ))
      )
        return;
      const expected =
        Math.floor(
          (new Date(`${observation.windowEnd}T00:00:00Z`).getTime() -
            new Date(`${observation.windowStart}T00:00:00Z`).getTime()) /
            86400000,
        ) + 1;
      const result = await record.mutateAsync({
        projectId,
        metricId: observation.metricId,
        observedOn: observation.observedOn,
        quantity: { value: observation.value, unit: observation.unit as never },
        method: observation.method.trim(),
        sourceType: observation.sourceType,
        source: observation.source.trim(),
        permittedSourceConfirmed:
          observation.sourceType === 'PERMITTED_DOCUMENT' && observation.permitted,
        areaId: projectAreaId,
        windowStart: observation.windowStart,
        windowEnd: observation.windowEnd,
        coverageObservedDays: Number(observation.coverage),
        coverageExpectedDays: expected,
        note: '',
        idempotencyKey: newIdempotencyKey(),
      });
      unwrapPayload(result.recordObservation);
      setObservation((o) => ({ ...o, value: '', source: '', method: '' }));
    } catch (e) {
      setError((e as Error).message || 'The observation could not be recorded.');
    }
  }
  async function addExpense(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const result = await expense.mutateAsync({
        projectId,
        expectedVersion: projectVersion,
        description: expenseDraft.description.trim(),
        spentOn: expenseDraft.spentOn,
        amount: { minorUnits: expenseDraft.minorUnits, currency: expenseDraft.currency },
        source: expenseDraft.source.trim(),
      });
      unwrapPayload(result.addProjectExpense);
      setExpenseDraft({
        description: '',
        spentOn: '',
        minorUnits: '',
        currency: expenseDraft.currency,
        source: '',
      });
    } catch (e) {
      setError(
        (e as Error).message ||
          'Expense was not saved. Reload the project if it changed elsewhere.',
      );
    }
  }
  async function setProjectStatus(status: 'COMPLETED' | 'ARCHIVED') {
    setError('');
    if (
      status === 'ARCHIVED' &&
      !window.confirm(
        'Archive this project? Its history will remain available and become read-only.',
      )
    )
      return;
    try {
      const result = await statusMutation.mutateAsync({
        projectId,
        expectedVersion: projectVersion,
        status,
      });
      unwrapPayload(result.updateProjectStatus);
    } catch (e) {
      setError((e as Error).message || 'The project changed elsewhere. Reload and retry.');
    }
  }
  return (
    <main className={styles.page}>
      <PageHeader
        title={project.title}
        subtitle={`Report snapshot v${project.reportVersion} · project status ${project.status}`}
      />
      <div className={styles.actions}>
        <ButtonLink to="/tracking" variant="secondary">
          All projects
        </ButtonLink>
        <Link to={`/reports/${project.reportId}`}>Open source report</Link>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <Notice
        kind="info"
        title={project.sharedWithCommunity ? 'Shared project' : 'Private project'}
      >
        {project.sharedWithCommunity
          ? 'Active members of the report community can view project details. The owner and coordinators can edit.'
          : 'Only the owner can view project details. Sharing was not enabled.'}{' '}
        The report remains an immutable snapshot. Completing tasks does not establish a water
        outcome.
      </Notice>
      {report && (
        <section className={styles.section}>
          <h2>Source and permissions</h2>
          <dl className={styles.details}>
            <div>
              <dt>Report version</dt>
              <dd>
                v{project.reportVersion} · {report.title}
              </dd>
            </div>
            <div>
              <dt>Area</dt>
              <dd>{project.areaId}</dd>
            </div>
            <div>
              <dt>Sharing</dt>
              <dd>{project.sharedWithCommunity ? 'Community' : 'Owner only'}</dd>
            </div>
            <div>
              <dt>Agent writes</dt>
              <dd>
                AI assistance is disabled for this project screen; no observation is generated
                automatically.
              </dd>
            </div>
          </dl>
        </section>
      )}
      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <h2>Milestones and tasks</h2>
          <span>
            {milestones.filter((m) => m.status === 'DONE').length} of {milestones.length} milestones
            complete
          </span>
        </div>
        {milestones.length === 0 ? (
          <p>No milestones have been added.</p>
        ) : (
          <ul className={styles.list}>
            {milestones.map((m) => (
              <li key={m.id} className={styles.item}>
                <div>
                  <h3>{m.title}</h3>
                  <p>
                    Target {m.plannedOn}
                    {m.completedOn ? ` · completed ${m.completedOn}` : ''}
                    {m.responsibleIdentity ? ` · ${m.responsibleIdentity}` : ''}
                  </p>
                  {m.tasks.length > 0 && (
                    <ul>
                      {m.tasks.map((task, i) => (
                        <li key={i}>{task}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <label className={styles.statusField}>
                  Status{' '}
                  <Select
                    aria-label={`Status for ${m.title}`}
                    value={m.status}
                    disabled={
                      !permanent || project.status !== 'ACTIVE' || updateMilestone.isPending
                    }
                    onChange={(e) =>
                      void milestoneStatus(
                        m,
                        e.target.value as 'PLANNED' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED',
                      )
                    }
                  >
                    <option value="PLANNED">Planned</option>
                    <option value="IN_PROGRESS">In progress</option>
                    <option value="DONE">Done</option>
                    <option value="SKIPPED">Skipped</option>
                  </Select>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.section}>
        <h2>Expenses</h2>
        {project.expenses.length === 0 ? (
          <p>No expenses recorded.</p>
        ) : (
          <ul className={styles.list}>
            {project.expenses.map((e, i) => (
              <li key={`${e.spentOn}-${i}`} className={styles.expense}>
                <strong>{e.description}</strong>
                <span>
                  {moneyLabel(e.amount)} · {e.spentOn}
                </span>
                <small>{e.source}</small>
              </li>
            ))}
          </ul>
        )}
        {permanent && project.status === 'ACTIVE' && (
          <form className={styles.form} onSubmit={(e) => void addExpense(e)}>
            <h3>Record an expense</h3>
            <div className={styles.grid}>
              <Field label="Description" required>
                {(c) => (
                  <Input
                    {...c}
                    required
                    value={expenseDraft.description}
                    onChange={(e) =>
                      setExpenseDraft((d) => ({ ...d, description: e.target.value }))
                    }
                  />
                )}
              </Field>
              <Field label="Date" required>
                {(c) => (
                  <Input
                    {...c}
                    type="date"
                    required
                    value={expenseDraft.spentOn}
                    onChange={(e) => setExpenseDraft((d) => ({ ...d, spentOn: e.target.value }))}
                  />
                )}
              </Field>
              <Field
                label="Exact amount in minor units"
                hint="No rounding or currency conversion."
                required
              >
                {(c) => (
                  <Input
                    {...c}
                    inputMode="numeric"
                    pattern="[0-9]+"
                    required
                    value={expenseDraft.minorUnits}
                    onChange={(e) => setExpenseDraft((d) => ({ ...d, minorUnits: e.target.value }))}
                  />
                )}
              </Field>
              <Field label="Currency" required>
                {(c) => (
                  <Input
                    {...c}
                    maxLength={3}
                    required
                    value={expenseDraft.currency}
                    onChange={(e) =>
                      setExpenseDraft((d) => ({ ...d, currency: e.target.value.toUpperCase() }))
                    }
                  />
                )}
              </Field>
            </div>
            <Field label="Source or receipt reference" required>
              {(c) => (
                <Input
                  {...c}
                  required
                  value={expenseDraft.source}
                  onChange={(e) => setExpenseDraft((d) => ({ ...d, source: e.target.value }))}
                />
              )}
            </Field>
            <Button type="submit" disabled={expense.isPending}>
              Add expense
            </Button>
          </form>
        )}
      </section>
      <section className={styles.section}>
        <h2>Predicted vs observed</h2>
        <p>
          Record the exact value and unit with method, source, time window and coverage. Permitted
          documents require your permission attestation. No files are uploaded here.
        </p>
        {metrics.length > 0 && (
          <dl className={styles.details}>
            {metrics.map((metric) => (
              <div key={metric.metricId}>
                <dt>{metric.metricId.replaceAll('_', ' ').toLowerCase()} · report forecast</dt>
                <dd>
                  {metric.projectedLow.quantity
                    ? `${metric.projectedLow.quantity.value} ${displayUnit(metric.projectedLow.quantity.unit)}`
                    : 'Unknown'}
                  {' – '}
                  {metric.projectedHigh.quantity
                    ? `${metric.projectedHigh.quantity.value} ${displayUnit(metric.projectedHigh.quantity.unit)}`
                    : 'Unknown'}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {observationsQuery.isError ? (
          <ErrorState
            title="Observations could not load"
            onRetry={() => void observationsQuery.refetch()}
            retrying={observationsQuery.isFetching}
          >
            Retry to view recorded evidence.
          </ErrorState>
        ) : observationsQuery.isPending ? (
          <p role="status">Loading observations…</p>
        ) : observations.length === 0 ? (
          <p>No observations recorded. Missing evidence remains unknown.</p>
        ) : (
          <ul className={styles.list}>
            {observations.map((o) => (
              <li className={styles.item} key={o.id}>
                <div>
                  <h3>
                    {o.metricId}: {o.quantity.value} {displayUnit(o.quantity.unit)}
                  </h3>
                  <p>
                    {o.observedOn} · {o.method} · source: {o.source}
                    {o.sourceType === 'PERMITTED_DOCUMENT'
                      ? o.permittedSourceConfirmed
                        ? ' · permission confirmed'
                        : ' · permission unconfirmed'
                      : ''}
                  </p>
                  <p>
                    Window {o.windowStart ?? 'unknown'} to {o.windowEnd ?? 'unknown'} · coverage{' '}
                    {o.coverageObservedDays}/{o.coverageExpectedDays} days ·{' '}
                    {o.evidence.toLowerCase()}
                  </p>
                  <p>
                    <strong>
                      {o.comparison.status === 'COMPARABLE'
                        ? `Comparable forecast: ${o.comparison.relation} projected range`
                        : 'Outcome comparison: unknown'}
                    </strong>{' '}
                    — {o.comparison.reason}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {permanent && project.status === 'ACTIVE' && (
          <form className={styles.form} onSubmit={(e) => void submitObservation(e)}>
            <h3>Enter an observation</h3>
            <div className={styles.grid}>
              <Field
                label="Metric definition identifier"
                hint="Use a finalized report metric to compare; other definitions remain unclassified."
                required
              >
                {(c) => (
                  <>
                    <Input
                      {...c}
                      required
                      list="forecast-metric-identifiers"
                      value={observation.metricId}
                      onChange={(e) => {
                        const id = e.target.value;
                        const matched = metrics.find((m) => m.metricId === id);
                        setObservation((o) => ({
                          ...o,
                          metricId: id,
                          unit: matched?.projectedLow.quantity?.unit ?? o.unit,
                        }));
                      }}
                    />
                    <datalist id="forecast-metric-identifiers">
                      {metrics.map((m) => (
                        <option key={m.metricId} value={m.metricId} />
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
              <Field label="Exact observed value" required>
                {(c) => (
                  <Input
                    {...c}
                    required
                    inputMode="decimal"
                    pattern="-?[0-9]+(\.[0-9]+)?"
                    value={observation.value}
                    onChange={(e) => setObservation((o) => ({ ...o, value: e.target.value }))}
                  />
                )}
              </Field>
              <Field label="Canonical unit" required>
                {(c) => (
                  <Select
                    {...c}
                    required
                    value={observation.unit}
                    onChange={(e) => setObservation((o) => ({ ...o, unit: e.target.value }))}
                  >
                    {UNIT_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Observed on" required>
                {(c) => (
                  <Input
                    {...c}
                    type="date"
                    required
                    value={observation.observedOn}
                    onChange={(e) => setObservation((o) => ({ ...o, observedOn: e.target.value }))}
                  />
                )}
              </Field>
              <Field label="Measurement window starts" required>
                {(c) => (
                  <Input
                    {...c}
                    type="date"
                    required
                    value={observation.windowStart}
                    onChange={(e) => setObservation((o) => ({ ...o, windowStart: e.target.value }))}
                  />
                )}
              </Field>
              <Field label="Measurement window ends" required>
                {(c) => (
                  <Input
                    {...c}
                    type="date"
                    required
                    value={observation.windowEnd}
                    onChange={(e) => setObservation((o) => ({ ...o, windowEnd: e.target.value }))}
                  />
                )}
              </Field>
              <Field
                label="Days with observed coverage"
                hint="Expected days are derived from the inclusive time window."
                required
              >
                {(c) => (
                  <Input
                    {...c}
                    type="number"
                    min="0"
                    max="36600"
                    required
                    value={observation.coverage}
                    onChange={(e) => setObservation((o) => ({ ...o, coverage: e.target.value }))}
                  />
                )}
              </Field>
              <Field label="Method" required>
                {(c) => (
                  <Input
                    {...c}
                    required
                    value={observation.method}
                    onChange={(e) => setObservation((o) => ({ ...o, method: e.target.value }))}
                  />
                )}
              </Field>
              <Field label="Source type" required>
                {(c) => (
                  <Select
                    {...c}
                    value={observation.sourceType}
                    onChange={(e) =>
                      setObservation((o) => ({
                        ...o,
                        sourceType: e.target.value as typeof o.sourceType,
                      }))
                    }
                  >
                    <option value="USER_RECORDED">Manual reading</option>
                    <option value="PERMITTED_DOCUMENT">Permitted document reference</option>
                  </Select>
                )}
              </Field>
            </div>
            <Field label="Source name or permitted reference" required>
              {(c) => (
                <Input
                  {...c}
                  required
                  value={observation.source}
                  onChange={(e) => setObservation((o) => ({ ...o, source: e.target.value }))}
                />
              )}
            </Field>
            {observation.sourceType === 'PERMITTED_DOCUMENT' && (
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={observation.permitted}
                  onChange={(e) => setObservation((o) => ({ ...o, permitted: e.target.checked }))}
                />{' '}
                I have permission to use and cite this document.
              </label>
            )}
            <Button type="submit" disabled={record.isPending || !observation.metricId}>
              Record observation
            </Button>
          </form>
        )}
      </section>
      {permanent && project.status !== 'ARCHIVED' && (
        <div className={styles.actions}>
          <Button
            variant="secondary"
            disabled={statusMutation.isPending || project.status === 'COMPLETED'}
            onClick={() => void setProjectStatus('COMPLETED')}
          >
            Mark project complete
          </Button>
          <Button
            variant="secondary"
            disabled={statusMutation.isPending}
            onClick={() => void setProjectStatus('ARCHIVED')}
          >
            Archive project
          </Button>
        </div>
      )}
    </main>
  );
}

export default function TrackingPage() {
  const { projectId } = useParams();
  if (projectId === 'new') return <TrackingCreate />;
  return projectId ? <TrackingDetail projectId={projectId} /> : <TrackingHome />;
}
