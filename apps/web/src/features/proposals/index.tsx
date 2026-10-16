import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/authContext';
import { Button, ButtonLink, Select } from '../../components';
import { Notice } from '../../components/Notice/Notice';
import { EmptyState, ErrorState } from '../../components/StatePanel/StatePanel';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import {
  FundingSchemesDocument,
  GenerateProposalDocument,
  ReportDocument,
} from '../../graphql/generated/graphql';
import { newIdempotencyKey, unwrapPayload } from '../../graphql/client';
import { useGraphQLMutation, useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { PageHeader } from '../../shell/PageHeader';
import styles from '../reports/Reports.module.scss';

const SCHEME_PAGE = { first: 100 };
const FINALIZE_REASON =
  'Preparing a proposal saves applicant details and a private proposal version to your account.';

export default function ProposalsPage() {
  const [params] = useSearchParams();
  const reportId = params.get('reportId') ?? '';
  const auth = useAuth();
  const navigate = useNavigate();
  const reportQuery = useGraphQLQuery(
    queryKeys.reports.detail(reportId),
    ReportDocument,
    { id: reportId },
    { enabled: Boolean(reportId) },
  );
  const schemesQuery = useGraphQLQuery(
    ['funding', 'schemes', SCHEME_PAGE],
    FundingSchemesDocument,
    SCHEME_PAGE,
  );
  const mutation = useGraphQLMutation('generateProposal', GenerateProposalDocument);
  const [schemeId, setSchemeId] = useState(() => params.get('schemeId') ?? '');
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [category, setCategory] = useState('');
  const [email, setEmail] = useState('');
  const [assumptions, setAssumptions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'summary' | 'budget' | 'documents'>('summary');

  if (!reportId) {
    return (
      <main className={styles.page}>
        <PageHeader title="Prepare a proposal" />
        <EmptyState icon="file" title="Choose a finalized report first">
          <Link to="/reports">Open your reports</Link>.
        </EmptyState>
      </main>
    );
  }
  if (reportQuery.isPending || schemesQuery.isPending)
    return (
      <main className={styles.page}>
        <LoadingRegion label="Loading proposal inputs">
          <Skeleton />
          <Skeleton width="three-quarters" />
        </LoadingRegion>
      </main>
    );
  if (reportQuery.isError || schemesQuery.isError)
    return (
      <main className={styles.page}>
        <ErrorState
          title="Proposal inputs could not load"
          onRetry={() => {
            void reportQuery.refetch();
            void schemesQuery.refetch();
          }}
        >
          Check your connection and retry.
        </ErrorState>
      </main>
    );
  const report = reportQuery.data.report;
  if (!report || report.status === 'ARCHIVED')
    return (
      <main className={styles.page}>
        <EmptyState title="This report cannot start a proposal">
          <Link to="/reports">Return to reports</Link>. Archived reports are read-only.
        </EmptyState>
      </main>
    );
  const schemes = schemesQuery.data.fundingSchemes.nodes.filter(
    (scheme) =>
      (scheme.status === 'ACTIVE' && scheme.officialSource && Boolean(scheme.sourceHash)) ||
      (scheme.status === 'DEMO' && scheme.evidence === 'SYNTHETIC'),
  );
  const selected = schemes.find((scheme) => scheme.id === schemeId);

  const submit = async () => {
    if (!selected || !name.trim() || !organization.trim() || !category.trim()) return;
    setError(null);
    try {
      if (!(await auth.ensurePermanent(FINALIZE_REASON))) return;
      const result = await mutation.mutateAsync({
        reportId: report.id,
        schemeId: selected.id,
        applicant: {
          name: name.trim(),
          organization: organization.trim(),
          category: category.trim(),
          contactEmail: email.trim() || null,
          assumptions: assumptions
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        },
        sections: ['EXECUTIVE_SUMMARY', 'PLAN', 'COSTS', 'FUNDING', 'ASSUMPTIONS', 'SOURCES'],
        idempotencyKey: newIdempotencyKey(),
      });
      const { proposal } = unwrapPayload(result.generateProposal);
      if (!proposal) throw new Error('No proposal was returned.');
      navigate(proposal.job?.id ? `/jobs/${proposal.job.id}` : `/reports/${report.id}`);
    } catch {
      setError('The proposal could not be queued. Check your details and try again.');
    }
  };

  return (
    <main className={styles.page}>
      <PageHeader
        title="Prepare a proposal"
        subtitle={`From ${report.title} · immutable report v${report.version}`}
      />
      {report.economics ? (
        <Notice kind="info" title="Financial values come from the saved report">
          Total cost {report.economics.funding.totalCost.low.minorUnits}–
          {report.economics.funding.totalCost.high.minorUnits} {report.economics.currency} minor
          units · funding gap {report.economics.funding.gap.low.minorUnits}–
          {report.economics.funding.gap.high.minorUnits} {report.economics.currency} minor units.
          Wording cannot change these values.
        </Notice>
      ) : (
        <Notice kind="caution" title="This report has no saved economics">
          Cost and return figures will be marked as not recorded.
        </Notice>
      )}
      {schemes.length === 0 ? (
        <EmptyState icon="file" title="No verified catalogue schemes are available">
          A real scheme needs an official publisher, source hash and verification date. Synthetic
          demo entries stay labelled and cannot be published as real funding.
        </EmptyState>
      ) : (
        <section className={styles.review} aria-labelledby="proposal-form-title">
          <h2 id="proposal-form-title">Proposal preparation</h2>
          <div className={styles.reportTabs} role="tablist" aria-label="Proposal sections">
            {(['summary', 'budget', 'documents'] as const).map((section) => (
              <button
                type="button"
                role="tab"
                key={section}
                id={`proposal-tab-${section}`}
                aria-controls="proposal-tab-panel"
                aria-selected={tab === section}
                onClick={() => setTab(section)}
              >
                {section[0].toUpperCase() + section.slice(1)}
              </button>
            ))}
          </div>
          <div
            id="proposal-tab-panel"
            role="tabpanel"
            aria-labelledby={`proposal-tab-${tab}`}
            tabIndex={0}
          >
            {tab === 'summary' && (
              <div className={styles.tabContent}>
                <h3>Applicant and scheme</h3>
                <label className={styles.label} htmlFor="scheme">
                  Funding scheme
                </label>
                <Select
                  id="scheme"
                  value={schemeId}
                  onChange={(event) => setSchemeId(event.target.value)}
                >
                  <option value="">Choose a scheme</option>
                  {schemes.map((scheme) => (
                    <option key={scheme.id} value={scheme.id}>
                      {scheme.status === 'DEMO' ? '[SYNTHETIC DEMO] ' : ''}
                      {scheme.name} · {scheme.funder}
                    </option>
                  ))}
                </Select>
                {selected && (
                  <div className={styles.source}>
                    {selected.status === 'DEMO' ? (
                      <Notice kind="caution" title="Synthetic scheme">
                        This example is not real funding and must not be submitted.
                      </Notice>
                    ) : null}
                    <p>{selected.summary}</p>
                    <p>
                      Publisher: {selected.funder} · verified{' '}
                      {new Date(selected.lastVerifiedAt).toLocaleDateString()}
                    </p>
                    <p>
                      Source hash: <code>{selected.sourceHash ?? 'Unknown'}</code>
                    </p>
                    <p>
                      <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
                        Open publisher source
                      </a>
                    </p>
                  </div>
                )}
                <div className={styles.formGrid}>
                  <label className={styles.label} htmlFor="applicant-name">
                    Applicant name
                    <input
                      id="applicant-name"
                      className={styles.input}
                      autoComplete="name"
                      maxLength={200}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                  <label className={styles.label} htmlFor="organization">
                    Organization
                    <input
                      id="organization"
                      className={styles.input}
                      autoComplete="organization"
                      maxLength={200}
                      value={organization}
                      onChange={(event) => setOrganization(event.target.value)}
                    />
                  </label>
                  <label className={styles.label} htmlFor="category">
                    Applicant category
                    <input
                      id="category"
                      className={styles.input}
                      maxLength={100}
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      placeholder="As specified by the scheme"
                    />
                  </label>
                  <label className={styles.label} htmlFor="contact-email">
                    Contact email (optional)
                    <input
                      id="contact-email"
                      className={styles.input}
                      autoComplete="email"
                      type="email"
                      maxLength={254}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  <label className={`${styles.label} ${styles.wide}`} htmlFor="assumptions">
                    Assumptions and corrections, one per line
                    <textarea
                      id="assumptions"
                      className={styles.input}
                      rows={4}
                      maxLength={6000}
                      value={assumptions}
                      onChange={(event) => setAssumptions(event.target.value)}
                    />
                  </label>
                </div>
              </div>
            )}
            {tab === 'budget' && (
              <div className={styles.tabContent}>
                <h3>Authoritative budget</h3>
                {report.economics ? (
                  <dl>
                    <div>
                      <dt>Currency</dt>
                      <dd>{report.economics.currency}; exact minor units</dd>
                    </div>
                    <div>
                      <dt>Upfront cost</dt>
                      <dd>
                        {report.economics.upfrontTotal.low.minorUnits}–
                        {report.economics.upfrontTotal.high.minorUnits} {report.economics.currency}
                      </dd>
                    </div>
                    <div>
                      <dt>Annual net return</dt>
                      <dd>
                        {report.economics.netAnnual
                          ? `${report.economics.netAnnual.low.minorUnits}–${report.economics.netAnnual.high.minorUnits} ${report.economics.currency}`
                          : 'Not recorded'}
                      </dd>
                    </div>
                    <div>
                      <dt>Funding gap</dt>
                      <dd>
                        {report.economics.funding.gap.low.minorUnits}–
                        {report.economics.funding.gap.high.minorUnits} {report.economics.currency}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p>Costs and returns were not recorded in this report version.</p>
                )}
                <p className={styles.meta}>
                  Proposal wording cannot change report figures; possible scheme awards are not
                  approved funding.
                </p>
              </div>
            )}
            {tab === 'documents' && (
              <div className={styles.tabContent}>
                <h3>Documents checklist</h3>
                {selected?.requiredDocuments.length ? (
                  <ul className={styles.assumptions}>
                    {selected.requiredDocuments.map((document) => (
                      <li key={document}>{document}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No checklist was supplied by the catalogue.</p>
                )}
                <p className={styles.meta}>
                  This is a preparation checklist; files are not attached or submitted
                  automatically.
                </p>
                <p className={styles.meta}>
                  Generated HTML/PDF artifacts are private. Review every version before any external
                  submission.
                </p>
              </div>
            )}
          </div>
          {error && (
            <p role="alert" className={styles.error}>
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <Button
              loading={mutation.isPending}
              disabled={!schemeId || !name.trim() || !organization.trim() || !category.trim()}
              onClick={() => void submit()}
            >
              Generate proposal for review
            </Button>
            <ButtonLink to={`/reports/${report.id}`} variant="secondary">
              Back to report
            </ButtonLink>
          </div>
        </section>
      )}
    </main>
  );
}
