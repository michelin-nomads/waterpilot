import { useRef, useState } from 'react';

import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Notice,
  Textarea,
} from '../../components';
import {
  FundingMatchesDocument,
  MatchFundingDocument,
  type FundingMatchFieldsFragment,
} from '../../graphql/generated/graphql';
import { useGraphQLMutation, useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { formatMoney } from '../plans/plansFormat';
import { usePlanningSession } from '../../session/sessionContext';
import type { SessionState } from '../../session/sessionState';
import { StagePage } from '../planning/StagePage';
import styles from './Matches.module.scss';

const list = (text: string) =>
  text
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter(Boolean);

function MatchCard({ match }: { match: FundingMatchFieldsFragment }) {
  const scheme = match.scheme;
  const label =
    match.eligibility === 'ELIGIBLE'
      ? 'Eligible against listed rules'
      : match.eligibility === 'INELIGIBLE'
        ? 'Ineligible'
        : 'Needs information';
  return (
    <article className={styles.card}>
      <h2>{scheme.name}</h2>
      {scheme.evidence === 'SYNTHETIC' && (
        <Notice kind="caution">SYNTHETIC — demonstration only, not real funding.</Notice>
      )}
      <p>
        <strong>{label}</strong>. Publisher approval and evidence verification are still required.
      </p>
      <p>
        {scheme.funder} · {scheme.summary}
      </p>
      <dl>
        <dt>Funding cap</dt>
        <dd>{scheme.maxAmount ? formatMoney(scheme.maxAmount) : 'Unknown'}</dd>
        <dt>Amount rules</dt>
        <dd>{scheme.amountRules || 'See curated criteria; unstructured rules need checking.'}</dd>
        <dt>Deadline</dt>
        <dd>
          {scheme.deadlineAt || scheme.closesOn || 'Unknown'} ·{' '}
          {scheme.deadlineTimezone || 'timezone unknown'}
        </dd>
        <dt>Source</dt>
        <dd>{scheme.sourceUrl}</dd>
        <dt>Verified</dt>
        <dd>{scheme.lastVerifiedAt}</dd>
        <dt>Source hash</dt>
        <dd>{scheme.sourceHash || 'Not recorded — source verification pending'}</dd>
      </dl>
      <details>
        <summary>Eligibility evidence and missing information</summary>
        <ul>
          {match.eligibilityEvidence.map((e, index) => (
            <li key={`${e.criterionId}-${index}`}>
              <strong>
                {e.status === 'MET' ? 'Met' : e.status === 'NOT_MET' ? 'Not met' : 'Needs checking'}
                :
              </strong>{' '}
              {e.reason}
            </li>
          ))}
        </ul>
      </details>
      <p>
        {match.rankingReason}
        {match.relevanceOrder !== null && ` Relevance order ${match.relevanceOrder}.`}
      </p>
    </article>
  );
}

function FundingWorkspace({ session }: { session: SessionState }) {
  const [applicant, setApplicant] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(session.goal?.budget?.currency ?? '');
  const [documents, setDocuments] = useState('');
  const [information, setInformation] = useState('');
  const [ranking, setRanking] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [error, setError] = useState('');
  const [results, setResults] = useState<FundingMatchFieldsFragment[] | null>(null);
  const [after, setAfter] = useState<string | null>(null);
  const [previous, setPrevious] = useState<FundingMatchFieldsFragment[]>([]);
  const retryKey = useRef<string | null>(null);
  const [lastRequest, setLastRequest] = useState<string | null>(null);
  const query = useGraphQLQuery(
    queryKeys.sessions.fundingMatches(
      session.id,
      session.inputsRevision,
      session.selectedPlanOptionId,
      { first: 50, after },
    ),
    FundingMatchesDocument,
    { sessionId: session.id, planOptionId: session.selectedPlanOptionId, first: 50, after },
  );
  const mutation = useGraphQLMutation('matchFunding', MatchFundingDocument);
  const stored = query.data?.fundingMatches;
  const matches = results ?? [...previous, ...(stored?.nodes ?? [])];
  const candidates = matches.filter((m) => m.eligibility !== 'INELIGIBLE');
  const excluded = matches.filter((m) => m.eligibility === 'INELIGIBLE');
  const busy = mutation.isPending;
  const { inputsPending } = usePlanningSession();

  async function find() {
    setError('');
    if (amount && (!/^(0|[1-9]\d*)$/.test(amount) || !/^[A-Z]{3}$/.test(currency))) {
      setError('Enter a non-negative integer amount in minor units and its three-letter currency.');
      return;
    }
    const payload = {
      sessionId: session.id,
      planOptionId: session.selectedPlanOptionId!,
      information: {
        applicantType: applicant.trim() || null,
        requestedAmount: amount ? { minorUnits: amount, currency } : null,
        availableDocuments: documents.trim() ? list(documents) : null,
        providedInformation: list(information),
      },
      semanticQuery: ranking ? queryText.trim() : null,
    };
    const fingerprint = JSON.stringify(payload);
    const key =
      fingerprint === lastRequest && retryKey.current ? retryKey.current : crypto.randomUUID();
    retryKey.current = key;
    setLastRequest(fingerprint);
    try {
      const response = await mutation.mutateAsync({ ...payload, idempotencyKey: key });
      if (response.matchFunding.error) {
        setError(response.matchFunding.error.message);
        return;
      }
      setResults(response.matchFunding.matches ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className={styles.workspace}>
      <Notice kind="info">
        Eligibility is checked using recorded rules and your declared information. Relevance cannot
        change it. Possible funding is never counted as approved money.
      </Notice>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          void find();
        }}
      >
        <h2>Check your funding eligibility</h2>
        <Field
          label="Applicant type"
          hint="Use the publisher's category, such as community, individual or local authority."
        >
          {(control) => (
            <Input {...control} value={applicant} onChange={(e) => setApplicant(e.target.value)} />
          )}
        </Field>
        <div className={styles.row}>
          <Field
            label="Requested funding in minor units"
            hint="For INR, enter paise; leave blank if unknown."
          >
            {(control) => (
              <Input
                {...control}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            )}
          </Field>
          <Field label="Currency" hint="No currency conversion is applied.">
            {(control) => (
              <Input
                {...control}
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              />
            )}
          </Field>
        </div>
        <Field
          label="Available documents"
          hint="Publisher document names, separated by commas. Availability is a declaration, not verification."
        >
          {(control) => (
            <Textarea
              {...control}
              rows={2}
              value={documents}
              onChange={(e) => setDocuments(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Other required information supplied"
          hint="Curated field names such as registration, separated by commas. Do not paste personal documents here."
        >
          {(control) => (
            <Input
              {...control}
              value={information}
              onChange={(e) => setInformation(e.target.value)}
            />
          )}
        </Field>
        <label>
          <input type="checkbox" checked={ranking} onChange={(e) => setRanking(e.target.checked)} />{' '}
          Optional relevance ordering (fake embeddings locally)
        </label>
        {ranking && (
          <Field
            label="What funding are you looking for?"
            hint="Used only for relevance ordering; all eligibility checks remain deterministic."
          >
            {(control) => (
              <Input
                {...control}
                maxLength={1000}
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
              />
            )}
          </Field>
        )}
        <Button type="submit" disabled={inputsPending} loading={busy}>
          Check funding matches
        </Button>
      </form>
      {inputsPending && (
        <Notice kind="stale">Save your planning edits before checking matches.</Notice>
      )}
      {error && (
        <ErrorState title="Funding check failed" onRetry={() => void find()} retrying={busy}>
          {error}
        </ErrorState>
      )}
      {query.isError && results === null && (
        <ErrorState title="Saved matches unavailable" onRetry={() => void query.refetch()}>
          {query.error.message}
        </ErrorState>
      )}
      {query.isLoading && results === null && <p role="status">Loading saved matches…</p>}
      {results === null && !query.isLoading && !query.isError && matches.length === 0 && (
        <EmptyState title="No funding matches yet">
          Enter what you know, then check the curated catalogue.
        </EmptyState>
      )}
      {(results !== null || matches.length > 0) && candidates.length === 0 && (
        <EmptyState title="No eligible scheme in these results">
          The listed rules exclude these schemes. Review the evidence below; relevance cannot
          override an exclusion.
        </EmptyState>
      )}
      {matches.length > 0 && (
        <p>
          Results reflect the last submitted information. Check again after editing these fields.
        </p>
      )}
      {candidates.length > 0 && (
        <p role="status">
          {candidates.filter((m) => m.eligibility === 'ELIGIBLE').length} eligible ·{' '}
          {candidates.filter((m) => m.eligibility === 'NEEDS_INFORMATION').length} need information
        </p>
      )}
      {matches[0]?.rankingStatus === 'deterministic_fallback' && (
        <Notice kind="info">{matches[0].rankingReason}</Notice>
      )}
      <div className={styles.results}>
        {candidates.map((match) => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
      {excluded.length > 0 && (
        <details>
          <summary>{excluded.length} excluded scheme(s) — show reasons</summary>
          {excluded.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </details>
      )}
      {results === null && stored?.pageInfo.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => {
            setPrevious(matches);
            setAfter(stored.pageInfo.endCursor);
          }}
        >
          Load more saved matches
        </Button>
      )}
      <Notice kind="info">
        Report and proposal review remain separate steps.{' '}
        <ButtonLink to="/reports" variant="ghost">
          Open reports
        </ButtonLink>
      </Notice>
    </div>
  );
}

export default function FundingPage() {
  const { state, inputsPending } = usePlanningSession();
  const session = state.server;
  return (
    <StagePage stageId="funding">
      {!session?.selectedPlanOptionId ? (
        <EmptyState
          title="Choose a plan before matching funding"
          actions={<ButtonLink to="/plans">Compare plans</ButtonLink>}
        >
          Funding checks use your saved location and selected plan.
        </EmptyState>
      ) : inputsPending ? (
        <Notice kind="stale">Save planning changes before viewing authoritative matches.</Notice>
      ) : (
        <FundingWorkspace
          key={`${session.id}:${session.inputsRevision}:${session.selectedPlanOptionId}`}
          session={session}
        />
      )}
    </StagePage>
  );
}
