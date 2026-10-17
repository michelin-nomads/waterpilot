import { useMemo, useState } from 'react';

import { Button } from '../../components/Button/Button';
import { Dialog } from '../../components/Dialog/Dialog';
import { LoadingRegion, Skeleton } from '../../components/Skeleton/Skeleton';
import { EmptyState, ErrorState } from '../../components/StatePanel/StatePanel';
import { ArchiveReportDocument, ReportsDocument } from '../../graphql/generated/graphql';
import { useGraphQLMutation, useGraphQLQuery } from '../../graphql/hooks';
import { queryKeys } from '../../graphql/queryKeys';
import { NewReportDialog } from './NewReportDialog';
import { ReportCard, type ReportListItem } from './ReportCard';
import { COMMUNITY_TYPE_LABEL } from './reportLabels';
import styles from './Workspace.module.scss';
import { WorkspacePage } from './WorkspacePage';
import { WorkspaceToolbar } from './WorkspaceToolbar';

const PAGE = { first: 50 };
const FINALIZED_ONLY = { status: 'FINALIZED' as const };
const ALL_STATUSES = {};

function matches(report: ReportListItem, term: string): boolean {
  return [
    report.title,
    report.area?.name,
    report.area?.admin.locality,
    report.planName,
    report.goal.description,
    report.siteProfile?.communityType && COMMUNITY_TYPE_LABEL[report.siteProfile.communityType],
  ]
    .filter(Boolean)
    .some((value) => value?.toLocaleLowerCase().includes(term));
}

/** The signed-in person's saved reports, as cards, with New report at the top right. */
export default function ReportsTab() {
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState('');
  const [archiving, setArchiving] = useState<ReportListItem | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [newReportOpen, setNewReportOpen] = useState(false);

  const filter = showArchived ? ALL_STATUSES : FINALIZED_ONLY;
  const query = useGraphQLQuery(queryKeys.reports.list(filter, PAGE), ReportsDocument, {
    filter,
    ...PAGE,
  });
  const archive = useGraphQLMutation('archiveReport', ArchiveReportDocument);

  const reports = useMemo(() => query.data?.reports.nodes ?? [], [query.data]);
  const term = search.trim().toLocaleLowerCase();
  const visible = useMemo(
    () => (term ? reports.filter((report) => matches(report, term)) : reports),
    [reports, term],
  );

  const confirmArchive = async () => {
    if (!archiving) return;
    setArchiveError(null);
    try {
      await archive.mutateAsync({ id: archiving.id, expectedVersion: archiving.version });
      setArchiving(null);
    } catch {
      setArchiveError('This report could not be archived. Refresh to check its current status.');
    }
  };

  let body;
  if (query.isPending) {
    body = (
      <LoadingRegion label="Loading reports">
        <Skeleton shape="block" />
        <Skeleton width="three-quarters" />
      </LoadingRegion>
    );
  } else if (query.isError) {
    body = (
      <ErrorState
        title="Reports could not load"
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      >
        Check your connection and retry.
      </ErrorState>
    );
  } else if (reports.length === 0) {
    body = (
      <EmptyState icon="file" title="No reports found">
        Finalize a plan and its report will appear here.
      </EmptyState>
    );
  } else if (visible.length === 0) {
    body = (
      <EmptyState icon="search" title="No reports found">
        No report matches this search. Try another title, location or plan name.
      </EmptyState>
    );
  } else {
    body = (
      <ul className={styles.grid} aria-label="Reports">
        {visible.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            onArchive={(item) => {
              setArchiveError(null);
              setArchiving(item);
            }}
          />
        ))}
      </ul>
    );
  }

  return (
    <WorkspacePage
      title="Your water planning workspace"
      subtitle="Manage your reports and community plans."
      action={
        <Button startIcon="plus" onClick={() => setNewReportOpen(true)}>
          New report
        </Button>
      }
    >
      <WorkspaceToolbar
        searchLabel="Search reports"
        search={search}
        onSearchChange={setSearch}
        showArchived={showArchived}
        onShowArchivedChange={setShowArchived}
      />
      {body}
      <Dialog
        open={archiving !== null}
        onClose={() => setArchiving(null)}
        title="Archive this report?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setArchiving(null)}>
              Keep report
            </Button>
            <Button
              variant="danger"
              loading={archive.isPending}
              onClick={() => void confirmArchive()}
            >
              Archive report
            </Button>
          </>
        }
      >
        <p>
          {archiving?.title} will remain available as a read-only snapshot under “Show archived”.
        </p>
        {archiveError && (
          <p role="alert" className={styles.error}>
            {archiveError}
          </p>
        )}
      </Dialog>
      <NewReportDialog open={newReportOpen} onClose={() => setNewReportOpen(false)} />
    </WorkspacePage>
  );
}
