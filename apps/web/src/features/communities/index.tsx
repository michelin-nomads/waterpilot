import { EmptyState } from '../../components/StatePanel/StatePanel';
import { PageHeader } from '../../shell/PageHeader';

export default function CommunitiesPage() {
  return (
    <>
      <PageHeader title="Communities" subtitle="Plan and track together with your neighbours." />
      <EmptyState icon="users" title="Communities are not built yet">
        <p>
          You will be able to join a community immediately, without waiting for approval. Membership
          gives the permissions of your community role only, and the server checks them on every
          action.
        </p>
        <p>Communities depend on sign-in and server-side roles (Phase 05).</p>
      </EmptyState>
    </>
  );
}
