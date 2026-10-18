import {
  Button,
  ErrorState,
  LoadingRegion,
  Notice,
  PermissionState,
  Skeleton,
} from '../../components';
import {
  AreaLocationDocument,
  type AreaLocationFieldsFragment,
} from '../../graphql/generated/graphql';
import { useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { GraphQLRequestError } from '../../graphql/requestError';
import { EXTENT_LABEL, formatDistance } from './locationLabels';
import styles from './Location.module.scss';
import { LocationSummaryName } from './LocationSummaryName';

interface LocationSummaryProps {
  areaId: string;
  onChange: () => void;
  actionLabel?: string;
  compact?: boolean;
}

/** The confirmed location, its area treatment and its region settings. */
export function LocationSummary({
  areaId,
  onChange,
  actionLabel = 'Change area',
  compact = false,
}: LocationSummaryProps) {
  const query = useGraphQLQuery(queryKeys.areas.detail(areaId), AreaLocationDocument, {
    id: areaId,
  });

  if (query.isPending) {
    return (
      <LoadingRegion label="Loading the location">
        <Skeleton />
        <Skeleton width="three-quarters" />
      </LoadingRegion>
    );
  }
  if (query.isError) {
    const code = query.error instanceof GraphQLRequestError ? query.error.code : null;
    if (code === 'NOT_FOUND' || code === 'FORBIDDEN') {
      return (
        <PermissionState
          title="This location is not available to you"
          actions={<Button onClick={onChange}>Choose a location</Button>}
        >
          It is private to someone else or no longer exists. Choose a location for this session.
        </PermissionState>
      );
    }
    return (
      <ErrorState
        title="The location could not load"
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      >
        Your session is kept. Check your connection and try again.
      </ErrorState>
    );
  }
  const area = query.data.area;
  if (!area) {
    return (
      <PermissionState
        title="This location no longer exists"
        actions={<Button onClick={onChange}>Choose a location</Button>}
      >
        Choose a location for this session again.
      </PermissionState>
    );
  }

  return (
    <LocationSummaryView
      area={area}
      onChange={onChange}
      actionLabel={actionLabel}
      compact={compact}
    />
  );
}

/** Shared location preview for loaded locations and explicitly labelled UI fixtures. */
export function LocationSummaryView({
  area,
  onChange,
  actionLabel = 'Change area',
  compact = false,
}: Omit<LocationSummaryProps, 'areaId'> & { area: AreaLocationFieldsFragment }) {
  return (
    <section
      aria-labelledby="location-summary-title"
      className={`${styles.card} ${compact ? styles.compact : ''}`}
    >
      <div className={styles.summaryHead}>
        <LocationSummaryName area={area} onChange={onChange} />
        {compact && (
          <Button variant="ghost" size="sm" onClick={onChange}>
            {actionLabel}
          </Button>
        )}
      </div>
      {area.providerContentExpired && (
        <Notice
          kind="stale"
          title="Place details need refreshing"
          action={
            <Button size="sm" variant="secondary" onClick={onChange}>
              Choose it again
            </Button>
          }
        >
          Place details from the map provider are kept for at most 30 days. Search for the place
          again to refresh them; your other inputs are kept.
        </Notice>
      )}
      {compact ? (
        <p className={styles.hint}>
          {area.radiusMeters != null
            ? `${formatDistance(area.radiusMeters)} planning radius`
            : EXTENT_LABEL[area.extent]}
        </p>
      ) : (
        <dl className={styles.facts}>
          <div>
            <dt>Area used for calculations</dt>
            <dd>
              {EXTENT_LABEL[area.extent]}
              {area.radiusMeters != null && `, ${formatDistance(area.radiusMeters)} radius`}
            </dd>
          </div>
          {area.accuracyMeters != null && (
            <div>
              <dt>Device accuracy</dt>
              <dd>within about {formatDistance(area.accuracyMeters)}</dd>
            </div>
          )}
          <div>
            <dt>Country</dt>
            <dd>{area.admin.countryName ?? area.countryCode}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>
              {area.currency ?? 'Not known for this country'}
              {area.regionSetByUser.includes('currency') && ' (set by you)'}
            </dd>
          </div>
          <div>
            <dt>Time zone</dt>
            <dd>
              {area.timezone}
              {area.regionSetByUser.includes('timezone') && ' (set by you)'}
            </dd>
          </div>
        </dl>
      )}
      {!compact && !area.hasBoundary && (
        <p className={styles.hint}>
          No boundary is drawn for this location. Steps that need an area use your radius or ask you
          for one.
        </p>
      )}
      {!compact && (
        <div className={styles.actions}>
          <Button variant="secondary" startIcon="map" onClick={onChange}>
            {actionLabel}
          </Button>
        </div>
      )}
    </section>
  );
}
