import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import { Button, ButtonLink } from '../../components/Button/Button';
import { Notice } from '../../components/Notice/Notice';
import { EmptyState, ErrorState } from '../../components/StatePanel/StatePanel';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import { ArchiveReportDocument, ReportDocument } from '../../graphql/generated/graphql';
import { useGraphQLMutation, useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { PageHeader } from '../../shell/PageHeader';
import { PrivateArtifactButton } from '../proposals/PrivateArtifactButton';
import styles from './Reports.module.scss';

const money = (
  value: { minorUnits: string; currency: string; exponent?: number } | null | undefined,
) => (value ? `${value.minorUnits} ${value.currency} minor units` : 'Not recorded');

const measured = (value: {
  availability: string;
  quantity: { value: string; unit: string } | null;
  reason: string | null;
}) =>
  value.quantity
    ? `${value.quantity.value} ${value.quantity.unit}`
    : (value.reason ?? value.availability);

export default function ReportDetailPage() {
  const { reportId = '' } = useParams();
  const [searchParams] = useSearchParams();
  const justCreated = searchParams.get('created') === '1';
  const query = useGraphQLQuery(queryKeys.reports.detail(reportId), ReportDocument, {
    id: reportId,
  });
  const archive = useGraphQLMutation('archiveReport', ArchiveReportDocument);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'evidence' | 'implementation'>('overview');
  const snapshotHeading = useRef<HTMLHeadingElement>(null);

  const openReport = () => {
    setTab('overview');
    requestAnimationFrame(() => {
      snapshotHeading.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
      snapshotHeading.current?.focus({ preventScroll: true });
    });
  };

  if (query.isPending)
    return (
      <main className={styles.page}>
        <LoadingRegion label="Loading report">
          <Skeleton />
          <Skeleton width="three-quarters" />
        </LoadingRegion>
      </main>
    );
  if (query.isError)
    return (
      <main className={styles.page}>
        <ErrorState
          title="Report could not load"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        >
          The report may be unavailable to this account.
        </ErrorState>
      </main>
    );
  const report = query.data.report;
  if (!report)
    return (
      <main className={styles.page}>
        <EmptyState
          title="Report not found"
          actions={<ButtonLink to="/reports">All reports</ButtonLink>}
        >
          This report may belong to another account.
        </EmptyState>
      </main>
    );

  const runArchive = async () => {
    if (!window.confirm('Archive this report? It will remain available as a read-only snapshot.'))
      return;
    setError(null);
    try {
      await archive.mutateAsync({ id: report.id, expectedVersion: report.version });
    } catch {
      setError('This report could not be archived. Refresh to check its current status.');
    }
  };

  const economics = report.economics;
  return (
    <main className={styles.page}>
      <PageHeader
        title={report.title}
        subtitle={`${report.area?.name ?? 'Location unavailable'} · finalized ${new Date(report.finalizedAt).toLocaleString()} · immutable version ${report.version}`}
      />
      {justCreated && (
        <section className={styles.created} aria-labelledby="report-created-title" role="status">
          <span className={styles.createdMark} aria-hidden="true">
            ✓
          </span>
          <div>
            <h2 id="report-created-title">Report created</h2>
            <p>Your finalized plan is saved as an immutable snapshot.</p>
          </div>
          <Button onClick={openReport} variant="secondary">
            Open report
          </Button>
        </section>
      )}
      <div className={styles.actions}>
        {report.status === 'FINALIZED' && (
          <ButtonLink to={`/proposals/new?reportId=${encodeURIComponent(report.id)}`}>
            Prepare proposal
          </ButtonLink>
        )}
        {report.status === 'FINALIZED' && (
          <ButtonLink
            to={`/communities/new?reportId=${encodeURIComponent(report.id)}`}
            variant="secondary"
          >
            Share with community
          </ButtonLink>
        )}
        {report.status === 'FINALIZED' && (
          <Button variant="secondary" disabled aria-describedby="report-pdf-status">
            Download PDF
          </Button>
        )}
        <ButtonLink to="/reports" variant="secondary">
          All reports
        </ButtonLink>
        {report.status === 'FINALIZED' && (
          <Button variant="ghost" loading={archive.isPending} onClick={() => void runArchive()}>
            Archive report
          </Button>
        )}
      </div>
      {report.status === 'FINALIZED' && (
        <Notice kind="info" announce={false}>
          <span id="report-pdf-status">
            Standalone report PDF export is not available in this build. Proposal PDFs use private,
            durable document jobs and appear in Overview with their current status.
          </span>
        </Notice>
      )}
      {report.status === 'ARCHIVED' && (
        <Notice kind="archived" announce={false}>
          This report is archived and read-only. Its proposal files remain private to your account.
        </Notice>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.reportTabs} role="tablist" aria-label="Report sections">
        {(['overview', 'evidence', 'implementation'] as const).map((section) => (
          <button
            key={section}
            type="button"
            role="tab"
            id={`report-tab-${section}`}
            aria-selected={tab === section}
            aria-controls="report-tab-panel"
            onClick={() => setTab(section)}
          >
            {section[0].toUpperCase() + section.slice(1)}
          </button>
        ))}
      </div>
      <section
        className={styles.reportTabPanel}
        id="report-tab-panel"
        role="tabpanel"
        aria-labelledby={`report-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 'overview' && (
          <div className={styles.tabContent}>
            <section className={styles.review} aria-labelledby="snapshot-heading">
              <h2 id="snapshot-heading" ref={snapshotHeading} tabIndex={-1}>
                Finalized snapshot
              </h2>
              <dl>
                <div>
                  <dt>Location</dt>
                  <dd>{report.area?.name ?? report.areaId}</dd>
                </div>
                <div>
                  <dt>Goal</dt>
                  <dd>
                    {report.goal.description || report.goal.kind.replaceAll('_', ' ').toLowerCase()}
                  </dd>
                </div>
                <div>
                  <dt>Selected plan</dt>
                  <dd>{report.planName ?? report.planOptionId}</dd>
                </div>
                <div>
                  <dt>Impact record</dt>
                  <dd>
                    {report.impact
                      ? `${report.impact.provenance.evidence} evidence`
                      : 'Not recorded in this report version'}
                  </dd>
                </div>
              </dl>
            </section>
            <section className={styles.review} aria-labelledby="economics-heading">
              <h2 id="economics-heading">Costs and returns</h2>
              {economics ? (
                <dl>
                  <div>
                    <dt>Currency and units</dt>
                    <dd>{economics.currency}; values shown as exact minor-unit integers</dd>
                  </div>
                  <div>
                    <dt>Upfront total</dt>
                    <dd>
                      {money(economics.upfrontTotal.low)} – {money(economics.upfrontTotal.high)}
                    </dd>
                  </div>
                  <div>
                    <dt>Annual net benefit</dt>
                    <dd>
                      {money(economics.netAnnual?.low)} – {money(economics.netAnnual?.high)}
                    </dd>
                  </div>
                  <div>
                    <dt>Funding gap</dt>
                    <dd>
                      {money(economics.funding.gap.low)} – {money(economics.funding.gap.high)}
                    </dd>
                  </div>
                  <div>
                    <dt>Funding note</dt>
                    <dd>{economics.funding.note}</dd>
                  </div>
                </dl>
              ) : (
                <p>Economics were not recorded in this report version.</p>
              )}
              <p className={styles.meta}>
                The report snapshot preserves its original values even when the planning session
                changes.
              </p>
            </section>
            <section className={styles.section} aria-labelledby="proposal-heading">
              <h2 id="proposal-heading">Proposals</h2>
              {report.proposals.nodes.length === 0 ? (
                <EmptyState icon="file" title="No proposal versions yet">
                  Prepare a proposal from this report and a verified catalogue scheme.
                </EmptyState>
              ) : (
                <ul className={styles.list}>
                  {report.proposals.nodes.map((proposal) => (
                    <li className={styles.card} key={proposal.id}>
                      <div>
                        <h3>
                          Proposal {proposal.id.slice(-8)} · v{proposal.version}
                        </h3>
                        <p>
                          {proposal.status.replaceAll('_', ' ')}
                          {proposal.job
                            ? ` · ${proposal.job.stage ?? proposal.job.status.toLowerCase()}`
                            : ''}
                        </p>
                      </div>
                      <div className={styles.actions}>
                        {proposal.previewPath && (
                          <PrivateArtifactButton
                            path={proposal.previewPath}
                            label="Open HTML review"
                            preview
                          />
                        )}
                        {proposal.downloadPath && (
                          <PrivateArtifactButton
                            path={proposal.downloadPath}
                            label="Download PDF"
                          />
                        )}
                        {proposal.job && (
                          <Link to={`/jobs/${proposal.job.id}`}>Track document job</Link>
                        )}
                        {proposal.status === 'FAILED' && (
                          <Link to={`/proposals/new?reportId=${encodeURIComponent(report.id)}`}>
                            Correct details and regenerate
                          </Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className={styles.meta}>
                <Link to="/proposals">Proposal preparation</Link> keeps external submission in your
                hands.
              </p>
            </section>
          </div>
        )}
        {tab === 'evidence' && (
          <section className={styles.review} aria-labelledby="evidence-heading">
            <h2 id="evidence-heading">Impact evidence</h2>
            {!report.impact ? (
              <p>No impact assessment was recorded in this report version.</p>
            ) : (
              <>
                <p>
                  Evidence quality: <strong>{report.impact.provenance.evidence}</strong> · assessed{' '}
                  {new Date(report.impact.provenance.asOf).toLocaleString()}
                </p>
                {report.impact.metrics.length ? (
                  <dl>
                    {report.impact.metrics.map((metric) => (
                      <div key={metric.metricId}>
                        <dt>{metric.metricId.replaceAll('_', ' ').toLowerCase()}</dt>
                        <dd>
                          Baseline: {measured(metric.baseline)} · projected range:{' '}
                          {measured(metric.projectedLow)} – {measured(metric.projectedHigh)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p>No comparable metric values were recorded.</p>
                )}
                {report.impact.assumptions.length > 0 && (
                  <>
                    <h3>Assumptions</h3>
                    <ul className={styles.assumptions}>
                      {report.impact.assumptions.map((assumption) => (
                        <li key={assumption}>{assumption}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className={styles.meta}>
                  Evidence is preserved from the finalized snapshot; it is not a guarantee of
                  outcome.
                </p>
              </>
            )}
          </section>
        )}
        {tab === 'implementation' && (
          <section className={styles.review} aria-labelledby="implementation-heading">
            <h2 id="implementation-heading">Implementation</h2>
            <p>
              Implementation tracking is optional and keeps work tasks separate from measured water
              outcomes.
            </p>
            {report.status === 'FINALIZED' ? (
              <ButtonLink to={`/tracking/new?reportId=${encodeURIComponent(report.id)}`}>
                Start a project from this report
              </ButtonLink>
            ) : (
              <p>This archived report is read-only; no project can be started from it.</p>
            )}
          </section>
        )}
      </section>
    </main>
  );
}
