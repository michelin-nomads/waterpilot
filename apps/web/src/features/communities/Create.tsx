import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useAuth } from '../../auth/authContext';
import { Button, ButtonLink, Select } from '../../components';
import { Notice } from '../../components/Notice/Notice';
import { EmptyState, ErrorState, PermissionState } from '../../components/StatePanel/StatePanel';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import {
  CommunitySourceReportsDocument,
  CreateCommunityDocument,
} from '../../graphql/generated/graphql';
import { newIdempotencyKey, unwrapPayload } from '../../graphql/client';
import { useGraphQLMutation, useGraphQLQuery } from '../../graphql/hooks';
import { PageHeader } from '../../shell/PageHeader';
import styles from './Communities.module.scss';

const PAGE = { first: 50 };
const filter = { status: 'FINALIZED' as const };

export default function CreateCommunityPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const permanent = auth.status === 'ready' && auth.user?.kind === 'permanent';
  const reports = useGraphQLQuery(
    ['reports', 'community-source', filter, PAGE],
    CommunitySourceReportsDocument,
    { filter, ...PAGE },
    { enabled: permanent },
  );
  const create = useGraphQLMutation('createCommunity', CreateCommunityDocument);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [reportId, setReportId] = useState(() => searchParams.get('reportId') ?? '');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [shareContactName, setShareContactName] = useState(false);
  const [shareContactEmail, setShareContactEmail] = useState(false);
  const [shareArea, setShareArea] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<{ payload: string; key: string } | null>(null);
  const selectedReport = useMemo(
    () => reports.data?.reports.nodes.find((report) => report.id === reportId) ?? null,
    [reportId, reports.data],
  );
  const canShareArea = Boolean(selectedReport?.area && !selectedReport.area.private);

  const submit = async () => {
    if (
      !selectedReport ||
      !name.trim() ||
      !contactName.trim() ||
      (shareContactEmail && !contactEmail.trim())
    )
      return;
    setError(null);
    const input = {
      name: name.trim(),
      description: description.trim(),
      reportId: selectedReport.id,
      areaId: shareArea && canShareArea ? (selectedReport.area?.id ?? null) : null,
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim() || null,
      shareContactName,
      shareContactEmail,
    };
    const payload = JSON.stringify(input);
    if (request.current?.payload !== payload)
      request.current = { payload, key: newIdempotencyKey() };
    try {
      if (
        !(await auth.ensurePermanent(
          'Creating a community saves its contact consent and report summary. Sign in to continue.',
        ))
      )
        return;
      const result = await create.mutateAsync({ ...input, idempotencyKey: request.current.key });
      const { community } = unwrapPayload(result.createCommunity);
      if (!community) throw new Error('No community was returned.');
      navigate(`/communities/${community.id}`);
    } catch {
      setError(
        'The community could not be created. Your form is still here; review it and try again.',
      );
    }
  };

  return (
    <main className={styles.page}>
      <PageHeader
        title="Create a community"
        subtitle="Start from a finalized report. Contact details remain private unless you choose specific fields to publish."
      />
      <div className={styles.actions}>
        <ButtonLink to="/communities" variant="secondary">
          Back to communities
        </ButtonLink>
      </div>
      {auth.status === 'loading' ? (
        <LoadingRegion label="Checking your account">
          <Skeleton />
        </LoadingRegion>
      ) : !permanent ? (
        <PermissionState
          title="Sign in to create a community"
          actions={
            <Button
              onClick={() =>
                void auth.ensurePermanent(
                  'Sign in to create a community and select one of your finalized reports.',
                )
              }
            >
              Sign in
            </Button>
          }
        >
          Guest planning stays available. Your finalized reports and this form are available after
          you sign in.
        </PermissionState>
      ) : reports.isPending ? (
        <LoadingRegion label="Loading finalized reports">
          <Skeleton />
          <Skeleton width="three-quarters" />
        </LoadingRegion>
      ) : reports.isError ? (
        <ErrorState
          title="Your reports could not load"
          onRetry={() => void reports.refetch()}
          retrying={reports.isFetching}
        >
          Retry before creating a community.
        </ErrorState>
      ) : reports.data.reports.nodes.length === 0 ? (
        <EmptyState icon="file" title="A finalized report is required">
          Finalize a report first. Community creation does not publish the report itself or its
          documents.
          <p>
            <Link to="/reports">Review your reports</Link>
          </p>
        </EmptyState>
      ) : (
        <section className={styles.section} aria-labelledby="create-community-fields">
          <h2 id="create-community-fields">Community details</h2>
          <Notice kind="info" title="Only a safe report summary is shared">
            The community shows the report’s goal category and finalized date. It never exposes its
            title, address, applicant details, source documents or attachments.
          </Notice>
          <div className={styles.formGrid}>
            <h3 className={styles.wide}>Community details</h3>
            <label className={styles.label} htmlFor="community-name">
              Name
              <input
                id="community-name"
                className={styles.input}
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <h3 className={styles.wide}>Location, goal and report</h3>
            <label className={styles.label} htmlFor="source-report">
              Finalized report
              <Select
                id="source-report"
                value={reportId}
                onChange={(event) => {
                  setReportId(event.target.value);
                  setShareArea(false);
                }}
              >
                <option value="">Choose your report</option>
                {reports.data.reports.nodes.map((report) => (
                  <option value={report.id} key={report.id}>
                    {report.title} · {new Date(report.finalizedAt).toLocaleDateString()}
                  </option>
                ))}
              </Select>
            </label>
            {selectedReport && (
              <p className={`${styles.meta} ${styles.wide}`}>
                {selectedReport.area?.name ?? 'Location not shared'} ·{' '}
                {selectedReport.goal.kind.replaceAll('_', ' ').toLowerCase()} · finalized{' '}
                {new Date(selectedReport.finalizedAt).toLocaleDateString()}
              </p>
            )}
            <label className={`${styles.label} ${styles.wide}`} htmlFor="community-description">
              Description (public)
              <textarea
                id="community-description"
                className={styles.textarea}
                maxLength={2000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the group. Do not include private addresses or applicant information."
              />
            </label>
            <h3 className={styles.wide}>Coordinator contact and consent</h3>
            <label className={styles.label} htmlFor="contact-name">
              Your contact name
              <input
                id="contact-name"
                className={styles.input}
                maxLength={120}
                autoComplete="name"
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
              />
            </label>
            <label className={styles.label} htmlFor="contact-email">
              Contact email (private by default)
              <input
                id="contact-email"
                className={styles.input}
                type="email"
                maxLength={254}
                autoComplete="email"
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
              />
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={shareContactName}
                onChange={(event) => setShareContactName(event.target.checked)}
              />
              Publish my contact name to community visitors.
            </label>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={shareContactEmail}
                disabled={!contactEmail.trim()}
                onChange={(event) => setShareContactEmail(event.target.checked)}
              />
              Publish my contact email to community visitors. I consent to sharing it.
            </label>
            {selectedReport && canShareArea && (
              <label className={`${styles.checkbox} ${styles.wide}`}>
                <input
                  type="checkbox"
                  checked={shareArea}
                  onChange={(event) => setShareArea(event.target.checked)}
                />
                Share the report’s approximate public area for nearby discovery (
                {selectedReport.area?.name}). No address or coordinates are shown.
              </label>
            )}
          </div>
          <p className={styles.meta}>
            You become the coordinator. Joining is immediate. Archived communities disappear from
            nearby search, cannot accept joins or start new sessions, and retain existing member
            history as read-only.
          </p>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <div className={styles.actions}>
            <Button
              loading={create.isPending}
              disabled={
                !name.trim() ||
                !reportId ||
                !contactName.trim() ||
                (shareContactEmail && !contactEmail.trim())
              }
              onClick={() => void submit()}
            >
              Create community
            </Button>
            <ButtonLink to="/communities" variant="secondary">
              Cancel
            </ButtonLink>
          </div>
        </section>
      )}
    </main>
  );
}
