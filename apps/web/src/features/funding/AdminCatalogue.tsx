import { LoadingRegion } from '../../components/Skeleton/Skeleton';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { components } from '@waterpilot/contracts';
import { useAuth } from '../../auth/authContext';
import { Button, EmptyState, ErrorState, Field, Input, Notice, Textarea } from '../../components';
import { env } from '../../config/env';
import { getAuthToken } from '../../lib/authToken';
import { PageHeader } from '../../shell/PageHeader';
import styles from './AdminCatalogue.module.scss';

type Scheme = components['schemas']['FundingScheme'];

async function request(body?: unknown): Promise<Scheme | Scheme[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getAuthToken({ forceRefresh: attempt === 1 });
    if (!token) throw new Error('Sign in with an administrator account to open this catalogue.');
    const response = await fetch(`${env.apiBaseUrl}/v1/admin/funding-catalogue`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    if (response.status === 401 && attempt === 0) continue;
    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new Error(error?.detail?.message ?? 'Catalogue unavailable. Try again.');
    }
    return response.json();
  }
  throw new Error('Authentication refresh failed. Sign in again.');
}

export default function AdminCatalogue() {
  const client = useQueryClient();
  const { user } = useAuth();
  const epoch = useRef(0);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const loaded = user?.kind === 'permanent' && loadedFor !== null && loadedFor === user.uid;
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [metadata, setMetadata] = useState('');
  const [revision, setRevision] = useState(0);
  const [reviewed, setReviewed] = useState(false);
  const [document, setDocument] = useState<File | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const current = ++epoch.current;
    setBusy(true);
    setError('');
    try {
      const data = (await request()) as Scheme[];
      if (current !== epoch.current) return;
      setSchemes(data);
      setLoadedFor(user?.uid ?? null);
    } catch (e) {
      if (current !== epoch.current) return;
      setLoadedFor(null);
      setSchemes([]);
      setError((e as Error).message);
    } finally {
      if (current === epoch.current) setBusy(false);
    }
  }, [user?.uid]);
  const invalidatePending = useCallback(() => {
    ++epoch.current;
  }, []);
  useEffect(() => {
    setLoadedFor(null);
    setSchemes([]);
    setMetadata('');
    setDocument(null);
    setReviewed(false);
    setRevision(0);
    setNotice('');
    void load();
    return invalidatePending;
  }, [user?.uid, user?.kind, load, invalidatePending]);

  function edit(scheme: Scheme) {
    setMetadata(JSON.stringify(scheme, null, 2));
    setRevision(scheme.revision ?? 1);
    setReviewed(false);
    setDocument(null);
    setNotice('Editing saved metadata. Review the source before publishing changes.');
    window.setTimeout(() => window.document.getElementById('scheme-json')?.focus(), 0);
  }

  async function save() {
    const current = epoch.current;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const scheme: unknown = JSON.parse(metadata);
      let source: string | undefined;
      if (document) {
        const limit = document.type === 'application/pdf' ? 5 * 1024 * 1024 : 256 * 1024;
        if (
          !['application/pdf', 'application/json'].includes(document.type) ||
          document.size > limit
        ) {
          throw new Error('Use a permitted PDF (up to 5 MiB) or JSON document (up to 256 KiB).');
        }
        source = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = () => reject(new Error('Could not read the selected document.'));
          reader.readAsDataURL(document);
        });
      }
      await request({
        scheme,
        expected_revision: revision,
        human_reviewed: reviewed,
        source_document_base64: source,
        source_content_type: document?.type ?? 'application/json',
      });
      if (current !== epoch.current) return;
      await client.invalidateQueries({
        predicate: (q) => q.queryKey.includes('fundingMatches') || q.queryKey[0] === 'funding',
      });
      setNotice('Saved. Previous matches for this scheme must be recalculated.');
      setMetadata('');
      setDocument(null);
      setReviewed(false);
      setRevision(0);
      const refreshed = (await request()) as Scheme[];
      if (current === epoch.current) setSchemes(refreshed);
    } catch (e) {
      if (current === epoch.current) setError((e as Error).message);
    } finally {
      if (current === epoch.current) setBusy(false);
    }
  }

  return (
    <section className={styles.page}>
      <PageHeader
        title="Funding catalogue administration"
        subtitle="Curated publisher records. Funding fits are not awards or guaranteed money."
      />
      <Notice kind="info">
        Human review controls publication. Synthetic demo schemes are labelled and cannot become
        active real funding. This importer never fetches URLs.
      </Notice>
      {error && (
        <ErrorState title="Catalogue action failed" onRetry={() => void load()}>
          {error}
        </ErrorState>
      )}
      {notice && <p role="status">{notice}</p>}
      {!loaded && !error && <LoadingRegion label="Loading catalogue…" />}
      {loaded && schemes.length === 0 && (
        <EmptyState title="No curated funding schemes yet">
          Import a permitted publisher document with reviewed metadata. Unknown amounts and
          deadlines stay unknown.
        </EmptyState>
      )}
      <div className={styles.grid}>
        <div>
          {loaded &&
            schemes.map((scheme) => (
              <article className={styles.card} key={scheme.id}>
                <h2>{scheme.name}</h2>
                <p>
                  <strong>
                    {scheme.evidence === 'synthetic' ? 'SYNTHETIC — not real funding · ' : ''}
                    {scheme.status}
                  </strong>{' '}
                  · revision {scheme.revision}
                </p>
                <p>
                  {scheme.funder} · {scheme.summary}
                </p>
                <dl>
                  <dt>Geography</dt>
                  <dd>{scheme.geography?.join(', ') || 'Unknown'}</dd>
                  <dt>Applicants</dt>
                  <dd>{scheme.applicant_categories?.join(', ') || 'Unknown'}</dd>
                  <dt>Interventions</dt>
                  <dd>{scheme.interventions?.join(', ') || 'Unknown'}</dd>
                  <dt>Amount rules</dt>
                  <dd>
                    {scheme.amount_rules || 'Unknown'} ({scheme.currency}; no conversion)
                  </dd>
                  <dt>Maximum amount</dt>
                  <dd>
                    {scheme.max_amount
                      ? `${scheme.max_amount.minor_units} ${scheme.max_amount.currency} minor units`
                      : 'Unknown'}
                  </dd>
                  <dt>Deadline</dt>
                  <dd>
                    {scheme.deadline_at || scheme.closes_on || 'Unknown'} ·{' '}
                    {scheme.deadline_timezone || 'timezone unknown'}
                  </dd>
                  <dt>Documents</dt>
                  <dd>{scheme.required_documents.join(', ') || 'Unknown'}</dd>
                  <dt>Verified</dt>
                  <dd>{scheme.last_verified_at}</dd>
                  <dt>Source hash</dt>
                  <dd>{scheme.source_hash || 'Not recorded'}</dd>
                  <dt>Unknown fields</dt>
                  <dd>{scheme.unknown_fields?.join(', ') || 'None explicitly recorded'}</dd>
                </dl>
                <p>{scheme.source_url}</p>
                <Button startIcon="edit" iconOnly variant="secondary" onClick={() => edit(scheme)}>
                  Edit / withdraw
                </Button>
              </article>
            ))}
        </div>
        {loaded && (
          <form
            className={styles.card}
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <h2>Import or update a scheme</h2>
            <p>
              Use the documented scheme JSON. Set status to draft, active, withdrawn or demo. Expiry
              is derived from the publisher deadline; closes_on is an exclusive date. Enter exact
              money in minor-unit strings.
            </p>
            <Field label="Scheme metadata JSON" id="scheme-json" required>
              {(control) => (
                <Textarea
                  {...control}
                  rows={20}
                  value={metadata}
                  onChange={(event) => setMetadata(event.target.value)}
                />
              )}
            </Field>
            <Field
              label="Expected revision"
              hint="0 creates a new record; editing loads the saved revision."
            >
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={0}
                  value={revision}
                  onChange={(event) => setRevision(Number(event.target.value))}
                />
              )}
            </Field>
            <Field
              label="Permitted source document"
              hint="PDF ≤ 5 MiB; JSON ≤ 256 KiB. Required for first real publication or a changed source."
            >
              {(control) => (
                <Input
                  {...control}
                  type="file"
                  accept="application/pdf,application/json"
                  onChange={(event) => setDocument(event.target.files?.[0] ?? null)}
                />
              )}
            </Field>
            <label>
              <input
                type="checkbox"
                checked={reviewed}
                onChange={(event) => setReviewed(event.target.checked)}
              />{' '}
              I reviewed this official source and recorded permission, verification date and unknown
              fields.
            </label>
            <Button type="submit" loading={busy} disabled={!metadata.trim()}>
              Save reviewed metadata
            </Button>
          </form>
        )}
      </div>
    </section>
  );
}
