import { Link } from 'react-router-dom';

import { Badge } from '../../components/Badge/Badge';
import { Button, ButtonLink } from '../../components/Button/Button';
import { Icon } from '../../components/Icon/Icon';
import type { CommunityItem } from './useCommunityDirectory';
import styles from './Workspace.module.scss';

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
      <h3 className={styles.cardTitle}>
        <Link to={href}>{community.name}</Link>
      </h3>
      <p className={styles.place}>{community.area?.name ?? 'Area not published'}</p>
      <ul className={styles.facts}>
        <li>
          <Icon name="users" size="sm" />
          {community.memberCount} {community.memberCount === 1 ? 'member' : 'members'}
        </li>
        {distanceMeters !== null && (
          <li>
            <Icon name="map" size="sm" />
            {distanceMeters.toLocaleString()} m away
          </li>
        )}
      </ul>
      <p className={styles.description}>{community.description || 'No description provided.'}</p>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.cardFooter}>
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
