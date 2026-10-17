import { Button, ButtonLink } from '../../components/Button/Button';
import { Notice } from '../../components/Notice/Notice';
import { Select } from '../../components/Field/Field';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import { EmptyState, ErrorState } from '../../components/StatePanel/StatePanel';
import { CommunityCard } from './CommunityCard';
import { useCommunityDirectory, type DirectoryView } from './useCommunityDirectory';
import styles from './Workspace.module.scss';
import { WorkspacePage } from './WorkspacePage';
import { WorkspaceToolbar } from './WorkspaceToolbar';

const VIEWS: ReadonlyArray<{ id: DirectoryView; label: string }> = [
  { id: 'all', label: 'All communities' },
  { id: 'mine', label: 'My communities' },
  { id: 'nearby', label: 'Discover nearby' },
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
  const { view, rows } = directory;

  let body;
  if (directory.noCentre) {
    body = (
      <EmptyState icon="map" title="No location to search around">
        Nearby search uses the location of one of your reports. Finalize a report first. Distance is
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
      <ul className={styles.grid} aria-label="Communities">
        {rows.map((community) => (
          <CommunityCard
            key={community.id}
            community={community}
            joined={directory.isJoined(community)}
            distanceMeters={directory.distanceMeters(community.id)}
            joining={directory.joining}
            error={
              directory.actionError?.id === community.id ? directory.actionError.message : null
            }
            onJoin={() => void directory.joinCommunity(community.id, false)}
          />
        ))}
      </ul>
    );
  }

  return (
    <WorkspacePage
      title="Communities"
      subtitle="Find community water plans, join one, or start your own."
      action={
        <ButtonLink to="/communities/new" startIcon="plus">
          Create a community
        </ButtonLink>
      }
    >
      <WorkspaceToolbar
        searchLabel="Search communities"
        search={directory.search}
        onSearchChange={directory.setSearch}
        showArchived={directory.showArchived}
        onShowArchivedChange={directory.setShowArchived}
      />
      <div className={styles.toolbar} role="group" aria-label="Community view">
        {VIEWS.map((item) => (
          <Button
            key={item.id}
            variant={view === item.id ? 'primary' : 'secondary'}
            size="sm"
            aria-pressed={view === item.id}
            onClick={() => directory.changeView(item.id)}
          >
            {item.label}
          </Button>
        ))}
        {view === 'nearby' && directory.centres.length > 0 && (
          <>
            <label className={styles.control}>
              Near
              <Select
                value={directory.centre?.areaId ?? ''}
                onChange={(event) => directory.setCentreId(event.target.value)}
              >
                {directory.centres.map((centre) => (
                  <option key={centre.areaId} value={centre.areaId}>
                    {centre.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className={styles.control}>
              Radius
              <Select
                value={directory.radius}
                onChange={(event) => directory.setRadius(Number(event.target.value))}
              >
                {[1000, 5000, 10000, 25000, 50000].map((meters) => (
                  <option key={meters} value={meters}>
                    {meters / 1000} km
                  </option>
                ))}
              </Select>
            </label>
          </>
        )}
      </div>
      {view === 'nearby' && directory.truncated && (
        <Notice kind="caution" title="Dense area: results may be incomplete">
          Reduce the radius to search fewer geospatial cells.
        </Notice>
      )}
      {body}
    </WorkspacePage>
  );
}
