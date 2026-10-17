import { useEffect, useState, type FormEvent } from 'react';
import axios from 'axios';
import type { components } from '@waterlens/contracts';

import { Button, Field, Input, Notice } from '../../components';
import { apiClient, getAuthToken } from '../../lib/apiClient';
import { newIdempotencyKey } from '../../lib/idempotency';
import type { SessionState } from '../../session/sessionState';
import styles from './AreaAssumptionPreview.module.scss';

type Result = components['schemas']['PreviewResponse'];
type Status = components['schemas']['AssumptionStatus'];

async function request<T>(path: string, body?: unknown): Promise<T> {
  const send = (token?: string) =>
    apiClient.request<T>({
      url: path,
      method: body ? 'POST' : 'GET',
      data: body,
      timeout: 45_000,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  try {
    return (await send()).data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const token = await getAuthToken({ forceRefresh: true });
      if (token) return (await send(token)).data;
    }
    throw error;
  }
}

/** Read-only synthetic preview. Generation is always an explicit user action. */
export function AreaAssumptionPreview({ session }: { session: SessionState }) {
  const [households, setHouseholds] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const storageKey = `waterlens:area-assumption:${session.id}`;
  const path = '/v1/area-assumptions';

  useEffect(() => {
    let active = true;
    void request<Status>(`${path}/status`).then(
      (value) => {
        if (active) setStatus(value);
      },
      () => {
        if (active) setError('Illustrative AI setup is unavailable. Manual planning still works.');
      },
    );
    // Reload reads an existing request. It never starts another paid call.
    const saved = window.localStorage.getItem(storageKey);
    if (saved && /^[A-Za-z0-9_-]{16,128}$/.test(saved)) {
      setKey(saved);
      void request<Result>(`${path}/${session.id}/${saved}`).then(
        (value) => {
          if (active) setResult(value);
        },
        (error: unknown) => {
          if (active) {
            setNotFound(axios.isAxiosError(error) && error.response?.status === 404);
            setError('Could not recover the preview. Check or retry the same request.');
          }
        },
      );
    }
    return () => {
      active = false;
    };
  }, [session.id, storageKey]);

  async function recover() {
    if (!key) return;
    setBusy(true);
    try {
      setResult(await request<Result>(`${path}/${session.id}/${key}`));
      setError(null);
    } catch (error) {
      setNotFound(axios.isAxiosError(error) && error.response?.status === 404);
      setError('Could not retrieve this request. No new model call was started.');
    } finally {
      setBusy(false);
    }
  }

  async function generate(event: FormEvent) {
    event.preventDefault();
    const count = Number(households);
    if (!Number.isInteger(count) || count < 1 || count > 100_000 || busy) return;
    // A new button submission after a terminal preview is a deliberate new request.
    // Pending requests are read-only; a confirmed 404 can retry with the original key.
    const requestKey = key && !preview ? key : newIdempotencyKey();
    window.localStorage.setItem(storageKey, requestKey);
    setKey(requestKey);
    setResult(null);
    setBusy(true);
    setNotFound(false);
    setError(null);
    try {
      setResult(
        await request<Result>(path, {
          session_id: session.id,
          inputs_revision: session.inputsRevision,
          households: count,
          idempotency_key: requestKey,
        }),
      );
    } catch {
      setError('No result received. Check this existing request before starting another.');
    } finally {
      setBusy(false);
    }
  }

  const preview = result?.preview;
  const assumptions = preview?.assumptions;
  const unresolved = Boolean(key) && (!preview || preview.status === 'pending') && !notFound;
  const stale =
    result?.stale ||
    (preview &&
      (preview.area_id !== session.areaId || preview.inputs_revision !== session.inputsRevision));
  return (
    <section className={styles.panel} aria-labelledby="illustrative-area-title">
      <h2 id="illustrative-area-title">Explore an illustrative society scenario</h2>
      <p>
        Generate assumptions informed by your selected location and household count. These are
        synthetic estimates, not researched city records or groundwater measurements. Your saved
        baseline stays unchanged.
      </p>
      {status?.fake && <Notice kind="info">Local fake inference; no live model is called.</Notice>}
      {status && !status.available && (
        <Notice kind="info">
          AI preview is unavailable ({status.reason ?? 'not configured'}). You can keep entering
          known values yourself.
        </Notice>
      )}
      <form onSubmit={(event) => void generate(event)} className={styles.form}>
        <Field label="Households in this society" required>
          {(control) => (
            <Input
              {...control}
              type="number"
              min="1"
              max="100000"
              step="1"
              value={households}
              onChange={(event) => setHouseholds(event.target.value)}
              disabled={busy}
            />
          )}
        </Field>
        <p>
          This sends the selected location, coordinates and household count to the configured AI
          provider.
        </p>
        <Button type="submit" disabled={busy || !status?.available || unresolved || !households}>
          {busy
            ? 'Preparing scenario…'
            : key && !preview && notFound
              ? 'Retry same request'
              : preview
                ? 'Generate another illustrative scenario'
                : 'Generate illustrative scenario'}
        </Button>
      </form>
      {key && (
        <Button variant="secondary" disabled={busy} onClick={() => void recover()}>
          Check existing request
        </Button>
      )}
      {error && <Notice kind="offline">{error}</Notice>}
      {preview?.status === 'pending' && (
        <Notice kind="info">
          The existing request is pending. Checking it does not repeat inference.
        </Notice>
      )}
      {preview?.status === 'failed' && <Notice kind="caution">{preview.error}</Notice>}
      {stale && (
        <Notice kind="stale">
          The location or planning inputs changed. This preview describes earlier inputs.
        </Notice>
      )}
      {assumptions && (
        <div className={styles.result}>
          <Notice kind="caution" title="Synthetic scenario — review assumptions">
            {result?.notice}
          </Notice>
          <p>
            {preview.households} households × {assumptions.residents_per_home} assumed residents ={' '}
            {preview.population} people.
          </p>
          <table>
            <caption>Assumptions for the selected society; low / representative / high</caption>
            <thead>
              <tr>
                <th scope="col">Input</th>
                <th scope="col">Low</th>
                <th scope="col">Representative</th>
                <th scope="col">High</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Per-person need (L/person/day)', assumptions.per_capita_lpd],
                  ['Delivered including tankers (L/day)', assumptions.delivered_supply_lpd],
                  ['Tanker supply (L/day)', assumptions.tanker_supply_lpd],
                ] as const
              ).map(([label, range]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{range.low}</td>
                  <td>{range.value}</td>
                  <td>{range.high}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>
            Calculated demand: {preview.demand_lpd} L/day. Average supply gap:{' '}
            {preview.average_gap_lpd} L/day. Tanker share: {preview.tanker_dependence ?? 'unknown'}{' '}
            (ratio).
          </p>
          <p>{assumptions.rationale}</p>
          <p>
            Model: {preview.model_id}. No values were applied to your baseline. Use the manual
            fields to record any estimates you independently review, with their synthetic basis.
          </p>
        </div>
      )}
    </section>
  );
}
