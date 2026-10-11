import { EmptyState } from '../../components/StatePanel/StatePanel';
import { PageHeader } from '../../shell/PageHeader';

export default function ProposalsPage() {
  return (
    <>
      <PageHeader title="Proposals" subtitle="Funding proposals generated from a selected plan." />
      <EmptyState icon="file" title="Proposals are not built yet">
        <p>
          Proposal generation opens from Make It Happen (reference 2.png) and is implemented in
          Phase 14. Each proposal will be an immutable version that you review before downloading,
          with its numbers taken from the plan calculations and its sources cited.
        </p>
      </EmptyState>
    </>
  );
}
