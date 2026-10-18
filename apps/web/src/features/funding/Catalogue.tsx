import { LoadingRegion } from '../../components/Skeleton/Skeleton';
import { useState } from 'react';
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  Input,
  Select,
} from '../../components';
import { FundingCatalogueDocument } from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { formatMoney } from '../plans/plansFormat';
import styles from './Matches.module.scss';

/** Browse authoritative catalogue records; listing does not assert applicant eligibility. */
export function Catalogue({ onChoose }: { onChoose?: (name: string) => void }) {
  const [search, setSearch] = useState('');
  const [amount, setAmount] = useState('any');
  const [project, setProject] = useState('');
  const [sort, setSort] = useState('name');
  const [after, setAfter] = useState<string | null>(null);
  const [earlier, setEarlier] = useState<NonNullable<typeof query.data>['fundingSchemes']['nodes']>(
    [],
  );
  const query = useGraphQLQuery(['funding', 'catalogue', after], FundingCatalogueDocument, {
    first: 50,
    after,
  });
  const records = [...earlier, ...(query.data?.fundingSchemes.nodes ?? [])];
  const projects = [...new Set(records.flatMap((scheme) => scheme.interventions))].sort();
  const term = search.trim().toLocaleLowerCase();
  const schemes = records
    .filter((scheme) => {
      const text = `${scheme.name} ${scheme.funder} ${scheme.summary}`.toLocaleLowerCase();
      return (
        (!term || text.includes(term)) &&
        (!project || scheme.interventions.includes(project)) &&
        (amount === 'any' ||
          (scheme.maxAmount?.currency === 'INR' &&
            BigInt(scheme.maxAmount.minorUnits) >= BigInt(amount)))
      );
    })
    .sort((a, b) =>
      sort === 'verified'
        ? b.lastVerifiedAt.localeCompare(a.lastVerifiedAt)
        : a.name.localeCompare(b.name),
    );
  return (
    <section className={styles.catalogue} aria-label="Funding catalogue">
      <div className={styles.filters}>
        <Field label="Search funding programmes">
          {(control) => (
            <Input
              {...control}
              type="search"
              placeholder="Search funding programmes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
        </Field>
        <Field label="Amount">
          {(control) => (
            <Select {...control} value={amount} onChange={(e) => setAmount(e.target.value)}>
              <option value="any">Any amount</option>
              <option value="50000000">Cap at least ₹5 lakh (INR)</option>
              <option value="100000000">Cap at least ₹10 lakh (INR)</option>
            </Select>
          )}
        </Field>
        <Field label="Project type">
          {(control) => (
            <Select {...control} value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">All project types</option>
              {projects.map((value) => (
                <option key={value} value={value}>
                  {value.replaceAll('_', ' ')}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Button
          variant="ghost"
          onClick={() => {
            setSearch('');
            setAmount('any');
            setProject('');
          }}
        >
          Clear filters
        </Button>
      </div>
      <div className={styles.resultHeading}>
        <strong role="status">
          {schemes.length} opportunities found
          {query.data?.fundingSchemes.pageInfo.hasNextPage ? ' in loaded records' : ''}
        </strong>
        <Field label="Sort opportunities">
          {(control) => (
            <Select {...control} value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="name">Name</option>
              <option value="verified">Latest verification date</option>
            </Select>
          )}
        </Field>
      </div>
      {query.isLoading && <LoadingRegion label="Loading funding catalogue…" />}
      {query.isError && (
        <ErrorState title="Funding catalogue unavailable" onRetry={() => void query.refetch()}>
          {query.error.message}
        </ErrorState>
      )}
      {!query.isLoading && !query.isError && schemes.length === 0 && (
        <EmptyState title="No funding opportunities found">
          Try clearing filters. Real schemes appear only after curated source verification.
        </EmptyState>
      )}
      <div className={styles.results}>
        {schemes.map((scheme) => (
          <article key={scheme.id} className={styles.opportunity}>
            <div className={styles.schemeIcon}>
              <Icon name="droplet" size="lg" />
            </div>
            <div className={styles.schemeBody}>
              <h2>{scheme.name}</h2>
              <p className={styles.publisher}>
                {scheme.funder} ·{' '}
                <Badge tone={scheme.evidence === 'SYNTHETIC' ? 'warning' : 'neutral'}>
                  {scheme.evidence === 'SYNTHETIC'
                    ? 'Synthetic demo · not real funding'
                    : scheme.officialSource
                      ? 'Official source recorded'
                      : 'Unverified source'}
                </Badge>
              </p>
              <p>{scheme.summary}</p>
              <div className={styles.tags}>
                <span>
                  {scheme.maxAmount ? `Up to ${formatMoney(scheme.maxAmount)}` : 'Amount unknown'}
                </span>
                {scheme.interventions.map((value) => (
                  <span key={value}>{value.replaceAll('_', ' ')}</span>
                ))}
              </div>
              <details>
                <summary>Source and scheme details</summary>
                <p>
                  Status: {scheme.status.replaceAll('_', ' ')} · Verified: {scheme.lastVerifiedAt}
                </p>
                <p>{scheme.amountRules || 'Amount rules unknown'}</p>
                <p>Source: {scheme.sourceUrl}</p>
              </details>
            </div>
            <div className={styles.schemeAction}>
              <Badge tone="warning">
                {scheme.evidence === 'SYNTHETIC' ? 'Demo only' : 'Check eligibility'}
              </Badge>
              {onChoose ? (
                <Button onClick={() => onChoose(scheme.name)}>
                  Choose opportunity <Icon name="arrow-right" />
                </Button>
              ) : (
                <ButtonLink to="/plans">
                  Choose a plan <Icon name="arrow-right" />
                </ButtonLink>
              )}
            </div>
          </article>
        ))}
      </div>
      {query.data?.fundingSchemes.pageInfo.hasNextPage && (
        <Button
          variant="secondary"
          onClick={() => {
            setEarlier(records);
            setAfter(query.data!.fundingSchemes.pageInfo.endCursor);
          }}
        >
          Load more opportunities
        </Button>
      )}
    </section>
  );
}
