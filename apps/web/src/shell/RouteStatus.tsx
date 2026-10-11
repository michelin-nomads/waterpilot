import { isRouteErrorResponse, useNavigation, useRouteError } from 'react-router-dom';

import { ButtonLink } from '../components/Button/Button';
import { EmptyState, ErrorState } from '../components/StatePanel/StatePanel';
import { VisuallyHidden } from '../components/VisuallyHidden/VisuallyHidden';
import { PageHeader } from './PageHeader';
import styles from './RouteStatus.module.scss';

/** Indeterminate bar while a lazy route chunk loads. No percentage is ever shown. */
export function RouteProgress() {
  const navigation = useNavigation();
  if (navigation.state === 'idle') return null;
  return (
    <div className={styles.progress} role="status">
      <span className={styles.bar} aria-hidden="true" />
      <VisuallyHidden>Loading page…</VisuallyHidden>
    </div>
  );
}

function isChunkLoadError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /dynamically imported module|Importing a module script failed|error loading dynamically/i.test(
      error.message,
    )
  );
}

/** Route-level error boundary: explains what failed and offers the action that helps. */
export function RouteError() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  const chunkError = isChunkLoadError(error);
  return (
    <div className={styles.page}>
      <PageHeader title={chunkError ? 'This page could not be loaded' : 'Something went wrong'} />
      <ErrorState
        title={
          chunkError ? 'Part of the app failed to download' : 'The page hit an unexpected error'
        }
        onRetry={() => window.location.reload()}
      >
        <p>
          {chunkError
            ? 'The connection may have dropped, or a newer version of WaterLens was published. Reloading fetches the current version.'
            : 'Reload the page to try again. If it keeps happening, note the time and what you were doing so it can be investigated.'}
        </p>
      </ErrorState>
    </div>
  );
}

export function NotFoundPage() {
  return (
    <div className={styles.page}>
      <PageHeader title="Page not found" />
      <EmptyState
        icon="map"
        title="There is no page at this address"
        actions={
          <ButtonLink to="/area" endIcon="arrow-right">
            Go to Understand Your Area
          </ButtonLink>
        }
      >
        <p>The link may be outdated. What-if scenarios now live inside the planning workspace.</p>
      </EmptyState>
    </div>
  );
}
