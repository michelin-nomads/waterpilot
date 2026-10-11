/** A fresh idempotency key for one user intent. Reuse it when retrying that intent. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
