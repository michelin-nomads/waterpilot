import { useCallback, useRef } from 'react';

import { useAuth } from '../../auth/authContext';
import { newIdempotencyKey, unwrapPayload } from '../../graphql/client';
import {
  FinalizeReportDocument,
  type FinalizeReportMutation,
} from '../../graphql/generated/graphql';
import { useGraphQLMutation } from '../../graphql/hooks';

export const FINALIZE_SIGN_IN_REASON =
  'Finalizing creates a permanent report. Sign in to keep it; your current session stays as it is.';

type FinalizedReport = NonNullable<FinalizeReportMutation['finalizeReport']['report']>;

export type FinalizeOutcome =
  { status: 'finalized'; report: FinalizedReport } | { status: 'cancelled' } | { status: 'busy' };

/**
 * Finalize the session's report. Strictly sequential: the user must hold a permanent
 * account (signing in or linking first if needed) before the mutation is sent, so
 * sign-up and submission never race. One idempotency key covers the whole intent,
 * including retries after a failure, so a retry can never create a second report.
 */
export function useFinalizeReport() {
  const { ensurePermanent } = useAuth();
  const mutation = useGraphQLMutation('finalizeReport', FinalizeReportDocument);
  const { mutateAsync } = mutation;
  const intent = useRef<{ sessionId: string; key: string } | null>(null);
  const running = useRef(false);

  const finalize = useCallback(
    async (input: { sessionId: string; title: string }): Promise<FinalizeOutcome> => {
      if (running.current) return { status: 'busy' };
      running.current = true;
      try {
        if (intent.current?.sessionId !== input.sessionId) {
          intent.current = { sessionId: input.sessionId, key: newIdempotencyKey() };
        }
        const { key } = intent.current;
        if (!(await ensurePermanent(FINALIZE_SIGN_IN_REASON))) return { status: 'cancelled' };
        const data = await mutateAsync({ ...input, idempotencyKey: key });
        const { report } = unwrapPayload(data.finalizeReport);
        if (!report) throw new Error('The server did not return the finalized report.');
        intent.current = null;
        return { status: 'finalized', report };
      } finally {
        running.current = false;
      }
    },
    [ensurePermanent, mutateAsync],
  );

  return { finalize, isPending: mutation.isPending, error: mutation.error };
}
