import { useRef } from 'react';

import { newIdempotencyKey, unwrapPayload } from '../../graphql/client';
import {
  ConfirmLocationDocument,
  type AreaLocationFieldsFragment,
  type ConfirmLocationInput,
} from '../../graphql/generated/graphql';
import { useGraphQLMutation } from '../../graphql/hooks';
import { usePlanningSession } from '../../session/sessionContext';

export type LocationDraftInput = Omit<ConfirmLocationInput, 'idempotencyKey'>;

/**
 * Create (or reuse) the confirmed area, then point the session at it through the session
 * coordinator, which stays the only writer of the session (ADR 0006). One idempotency
 * key covers one unchanged intent, so a retry after a lost response is safe.
 */
export function useConfirmLocation() {
  const { coordinator } = usePlanningSession();
  const mutation = useGraphQLMutation('confirmLocation', ConfirmLocationDocument);
  const intent = useRef<{ key: string; signature: string } | null>(null);

  async function confirm(input: LocationDraftInput): Promise<AreaLocationFieldsFragment> {
    const signature = JSON.stringify(input);
    if (intent.current?.signature !== signature) {
      intent.current = { key: newIdempotencyKey(), signature };
    }
    const data = await mutation.mutateAsync({ ...input, idempotencyKey: intent.current.key });
    const { area } = unwrapPayload(data.confirmLocation);
    if (!area) throw new Error('The server did not return the location.');
    if (coordinator) {
      coordinator.setArea(area.id);
      await coordinator.flush();
      if (coordinator.getState().server?.areaId !== area.id)
        throw new Error('The location is waiting to be saved. Try again.');
    }
    intent.current = null;
    return area;
  }

  return { confirm, pending: mutation.isPending, canSave: Boolean(coordinator) };
}
