import { Link } from 'react-router-dom';

import { Badge } from '../../components/Badge/Badge';
import { Button, ButtonLink } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import type { CommunityItem } from './useCommunityDirectory';
import styles from './CommunityDirectory.module.scss';

interface CommunityCardProps {
  community: CommunityItem;
  joined: boolean;
  distanceMeters: number | null;
  joining: boolean;
  error: string | null;
  onJoin: () => void;
}

/** One community in the directory, in the same card shell as a report. */
export function CommunityCard({
  community,
  joined,
  distanceMeters,
  joining,
  error,
  onJoin,
}: CommunityCardProps) {
  const archived = community.status === 'ARCHIVED';
  const href = `/communities/${community.id}`;
  return (
    <li className={styles.card}>
      <div className={styles.art} aria-hidden="true">
        <Icon name="users" size="lg" />
      </div>
      <div className={styles.content}>
        <h3>
          <Link to={href}>{community.name}</Link>
        </h3>
        <p>{community.description || 'No description provided.'}</p>
        <div className={styles.facts}>
          {community.sharedReport && (
            <span>
              <Icon name="target" size="sm" />
              {community.sharedReport.goal.replaceAll('_', ' ').toLowerCase()}
            </span>
          )}
          <span>
            <Icon name="users" size="sm" />
            {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}
          </span>
          <span>
            <Icon name="map" size="sm" />
            {distanceMeters !== null
              ? `${(distanceMeters / 1000).toLocaleString()} km`
              : (community.area?.name ?? 'Area not published')}
          </span>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </div>
      <div className={styles.actions}>
        {archived && (
          <Badge tone="neutral" icon="archive">
            Archived
          </Badge>
        )}
        {joined && (
          <Badge tone="success" icon="check">
            Joined
          </Badge>
        )}
        <ButtonLink to={href} variant="secondary" size="sm">
          Details
        </ButtonLink>
        {!joined && !archived && (
          <Button size="sm" loading={joining} onClick={onJoin}>
            Join
          </Button>
        )}
      </div>
    </li>
  );
}
