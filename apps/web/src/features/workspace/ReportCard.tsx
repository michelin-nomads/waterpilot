import { Link } from 'react-router-dom';

import { ActionMenu } from '../../components/ActionMenu/ActionMenu';
import { Badge } from '../../components/Badge/Badge';
import { Icon } from '../../components/Icon/Icon';
import type { ReportsQuery } from '../../graphql/generated/graphql';
import { ReportMapPreview } from './ReportMapPreview';
import type { BoundingBox } from './extentGeometry';
import { COMMUNITY_TYPE_LABEL, formatDate, formatHomes, formatPlace } from './reportLabels';
import styles from './Workspace.module.scss';

export type ReportListItem = ReportsQuery['reports']['nodes'][number];

/** The wire carries exact decimals as strings; drawing needs plain numbers. */
function toBox(box: NonNullable<ReportListItem['area']>['boundaryBox']): BoundingBox | null {
  return box
    ? {
        minLongitude: Number(box.minLongitude),
        minLatitude: Number(box.minLatitude),
        maxLongitude: Number(box.maxLongitude),
        maxLatitude: Number(box.maxLatitude),
      }
    : null;
}

interface ReportCardProps {
  report: ReportListItem;
  onArchive: (report: ReportListItem) => void;
}

/** One saved report: where, what kind of community, how big, when, and its status. */
export function ReportCard({ report, onArchive }: ReportCardProps) {
  const { area, siteProfile } = report;
  const archived = report.status === 'ARCHIVED';
  const href = `/reports/${report.id}`;

  return (
    <li className={styles.card}>
      <div className={styles.media}>
        {area ? (
          <ReportMapPreview
            name={area.name}
            latitude={Number(area.centroidLat)}
            longitude={Number(area.centroidLon)}
            box={toBox(area.boundaryBox)}
            radiusMeters={
              area.extent === 'USER_RADIUS' && area.radiusMeters != null
                ? Number(area.radiusMeters)
                : null
            }
          />
        ) : (
          <div className={styles.placeholder}>
            <Icon name="map" size="lg" label="Location unavailable" />
          </div>
        )}
        <div className={styles.menu}>
          <ActionMenu
            label={`Actions for ${report.title}`}
            items={[
              { id: 'open', label: 'Open report', to: href },
              ...(archived
                ? []
                : [
                    {
                      id: 'archive',
                      label: 'Archive report',
                      danger: true,
                      onSelect: () => onArchive(report),
                    },
                  ]),
            ]}
          />
        </div>
      </div>
      <h3 className={styles.cardTitle}>
        <Link to={href}>{report.title}</Link>
      </h3>
      <p className={styles.place}>
        {area ? formatPlace(area.name, area.admin.locality) : 'Location unavailable'}
      </p>
      <ul className={styles.facts}>
        {siteProfile?.communityType && (
          <li>
            <Icon name="home" size="sm" />
            {COMMUNITY_TYPE_LABEL[siteProfile.communityType]}
          </li>
        )}
        {siteProfile?.occupiedHomes != null && (
          <li>
            <Icon name="users" size="sm" />
            {formatHomes(siteProfile.occupiedHomes)}
          </li>
        )}
        <li>
          <Icon name="calendar" size="sm" />
          Finalized on {formatDate(report.finalizedAt)}
        </li>
      </ul>
      <div className={styles.cardFooter}>
        <Badge tone={archived ? 'neutral' : 'success'} icon={archived ? 'archive' : 'check'}>
          {archived ? 'Archived' : 'Finalized'}
        </Badge>
      </div>
    </li>
  );
}
