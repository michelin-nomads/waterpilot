import { useState } from 'react';
import { ButtonLink } from '../../components/Button/Button';
import { Select } from '../../components/Field/Field';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import { EmptyState, ErrorState } from '../../components/StatePanel/StatePanel';
import { CommunityCard } from './CommunityCard';
import { useCommunityDirectory, type DirectoryView } from './useCommunityDirectory';
import styles from './CommunityDirectory.module.scss';
import { LocationSearch } from '../location/LocationSearch';
import { usePlaces } from '../location/placesContext';
import { CommunityMap } from './CommunityMap';

const VIEWS: ReadonlyArray<{ id: DirectoryView; label: string }> = [
  { id: 'all', label: 'All communities' },
  { id: 'mine', label: 'My communities' },
];

function emptyTitle(search: string, view: DirectoryView, archived: boolean): string {
  if (search) return 'No communities found';
  if (view === 'mine' && archived) return 'No archived communities you belong to';
  if (archived) return 'No archived communities';
  return 'No communities found';
}

function emptyText(search: string, view: DirectoryView): string {
  if (search) return 'No community matches this search. Try a shorter search.';
  if (view === 'nearby') return 'No active communities were found within this radius.';
  if (view === 'mine') return 'Join a community to see it here.';
  return 'Create the first community to get started.';
}

/** Communities in the same layout as Reports: toolbar, cards, and clear empty states. */
export default function CommunitiesTab() {
  const directory = useCommunityDirectory();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const places = usePlaces();
  const { view, rows } = directory;

  let body;
  if (directory.noCentre) {
    body = (
      <EmptyState icon="map" title="No location to search around">
        Choose a place in the search above, or use the location of one of your reports. Distance is
        geographic only; it does not establish a shared aquifer, catchment or supply network.
      </EmptyState>
    );
  } else if (directory.pending) {
    body = (
      <LoadingRegion label="Loading communities">
        <Skeleton shape="block" />
        <Skeleton width="three-quarters" />
      </LoadingRegion>
    );
  } else if (directory.failed) {
    body = (
      <ErrorState
        title="Communities could not load"
        onRetry={directory.retry}
        retrying={directory.retrying}
      >
        Check your connection and try again.
      </ErrorState>
    );
  } else if (rows.length === 0) {
    body = (
      <EmptyState icon="users" title={emptyTitle(directory.search, view, directory.showArchived)}>
        {emptyText(directory.search, view)}
      </EmptyState>
    );
  } else {
    body = (
      <ul className={styles.list} aria-label="Communities">
        {rows.map((community) => (
          <CommunityCard
            key={community.id}
            community={community}
            selected={selectedId === community.id}
            onSelect={() => setSelectedId(community.id)}
            joined={directory.isJoined(community)}
            distanceMeters={directory.distanceMeters(community.id)}
            joining={directory.joining}
            error={
              directory.actionError?.id === community.id ? directory.actionError.message : null
            }
            onJoin={() => void directory.joinCommunity(community.id, false)}
            onLeave={() => void directory.leaveCommunity(community)}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <div className={styles.intro}>
          <h1>Communities</h1>
          <p>
            Join a community to share knowledge, access local insights and work together for better
            water outcomes.
          </p>
        </div>
        <div className={styles.searchRow}>
          <div className={styles.placeSearch}>
            <LocationSearch
              showHint={false}
              adapter={places}
              onSelect={(place) =>
                directory.selectSearchCentre({
                  areaId: place.placeId,
                  label: place.name,
                  latitude: place.latitude,
                  longitude: place.longitude,
                })
              }
            />
          </div>
          <label className={styles.radiusField}>
            <span>Radius</span>
            <Select
              className={styles.radius}
              aria-label="Search radius"
              value={directory.radius}
              onChange={(event) => {
                directory.setRadius(Number(event.target.value));
                directory.changeView('nearby');
              }}
            >
              {[1000, 5000, 10000, 25000, 50000].map((meters) => (
                <option key={meters} value={meters}>
                  Within {meters / 1000} km
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>
      <div className={styles.layout}>
        <div className={styles.results}>
          <div className={styles.tabs} role="group" aria-label="Community view">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={view === item.id || (view === 'nearby' && item.id === 'all')}
                onClick={() => directory.changeView(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className={styles.utilities}>
            <ButtonLink to="/communities/new" variant="secondary" size="sm" startIcon="plus">
              Create a community
            </ButtonLink>
          </div>
          {body}
        </div>
        <CommunityMap
          rows={rows}
          selectedCommunityId={selectedId}
          onSelectCommunity={setSelectedId}
          centre={view === 'nearby' ? directory.centre : null}
          radius={directory.radius}
          isJoined={directory.isJoined}
          distanceMeters={directory.distanceMeters}
          joining={directory.joining}
          actionError={directory.actionError}
          onJoin={(id) => void directory.joinCommunity(id, false)}
          onLeave={(community) => void directory.leaveCommunity(community)}
        />
      </div>
    </div>
  );
}
