import type { AdminSubscriptionView, AdminSubscriptionViewStatus } from '@repo/schemas';

/**
 * A single admin subscription row.
 *
 * Alias of {@link AdminSubscriptionView}, the single source of truth for this
 * shape (`packages/schemas/src/api/billing/admin-billing-view.schema.ts`).
 * Do NOT redeclare fields here — the admin UI previously invented its own
 * flat `Subscription` interface (`planSlug`, `monthlyAmount` in whole units,
 * `startDate`) that diverged from what the backend actually serves. `user`
 * and `plan` are nested and nullable; `recurringAmountInCents` is nullable
 * and must render as "—", never a fabricated `0,00`.
 */
export type Subscription = AdminSubscriptionView;

/**
 * Normalised subscription status. Alias of {@link AdminSubscriptionViewStatus}.
 *
 * Includes `abandoned`, `pending_provider`, and `comp`, which the previous
 * local union omitted and which previously rendered as an empty badge.
 */
export type SubscriptionStatus = AdminSubscriptionViewStatus;

/**
 * Payment history entry, as rendered inside the subscription details dialog.
 *
 * UI-derived from {@link AdminPaymentView} (mapped in
 * `SubscriptionDetailsDialog`), not a standalone API contract. `amount` here
 * is WHOLE-UNIT ARS (already divided by 100 at the mapping site) because this
 * block only ever displays it, never sends it back to an endpoint that
 * expects centavos.
 */
export interface PaymentHistory {
    readonly id: string;
    readonly date: string;
    readonly amount: number;
    readonly status: 'paid' | 'pending' | 'failed';
}
