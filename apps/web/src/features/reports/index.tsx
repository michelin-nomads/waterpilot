import { EmptyState } from '../../components/StatePanel/StatePanel';
import { PageHeader } from '../../shell/PageHeader';

export default function ReportsPage() {
  return (
    <>
      <PageHeader title="Reports" subtitle="Finalized snapshots of a planning session." />
      <EmptyState icon="file" title="Reports are not built yet">
        <p>
          A finalized report is an immutable snapshot of the location, evidence, goal, plan and
          results at the time it was finalized. Finalizing your first report will require a
          permanent sign-in; guest sessions can explore but not finalize.
        </p>
        <p>Reports depend on sign-in (Phase 05) and the planning session (Phase 04 onward).</p>
      </EmptyState>
    </>
  );
}
