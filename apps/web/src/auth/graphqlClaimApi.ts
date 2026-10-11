import { graphqlRequest, unwrapPayload } from '../graphql/client';
import {
  BeginAccountClaimDocument,
  CancelAccountClaimDocument,
  CompleteAccountClaimDocument,
} from '../graphql/generated/graphql';
import type { ClaimApi } from './accountUpgrade';
import { AuthFailure } from './authErrors';

export const graphqlClaimApi: ClaimApi = {
  async begin() {
    const data = await graphqlRequest(BeginAccountClaimDocument, {});
    const { claim, claimSecret } = unwrapPayload(data.beginAccountClaim);
    if (!claim || !claimSecret) throw new AuthFailure('claim-failed');
    return { claimId: claim.id, version: claim.version, secret: claimSecret };
  },
  async complete(claimId, secret, idempotencyKey) {
    const data = await graphqlRequest(CompleteAccountClaimDocument, {
      input: { claimId, claimSecret: secret, idempotencyKey },
    });
    unwrapPayload(data.completeAccountClaim);
  },
  async cancel(claimId, version) {
    const data = await graphqlRequest(CancelAccountClaimDocument, {
      input: { claimId, expectedVersion: version },
    });
    unwrapPayload(data.cancelAccountClaim);
  },
};
