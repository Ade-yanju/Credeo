/** Pure account-retention policy so the 90-day rule can be tested without DB access. */

export const ACCOUNT_RETENTION_DAYS = 90;
const DAY_MS = 86_400_000;

export function retentionDeadline(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + ACCOUNT_RETENTION_DAYS * DAY_MS);
}
