import type { AdminPaymentView, AdminPaymentViewStatus } from '@repo/schemas';

/**
 * A single admin payment row.
 *
 * Alias of {@link AdminPaymentView}, the single source of truth for this
 * shape (`packages/schemas/src/api/billing/admin-billing-view.schema.ts`).
 * Do NOT redeclare fields here — the admin UI previously invented its own
 * flat `Payment` interface (`status: 'completed' | ...`, a bare `amount` in
 * whole units, a `method` field the API never sent) that diverged from what
 * the backend actually serves. Money fields are integer centavos and carry
 * the `InCents` suffix on the real type; `user`/`plan` are nested and
 * nullable.
 */
export type Payment = AdminPaymentView;

/**
 * Normalised payment status. Alias of {@link AdminPaymentViewStatus}.
 *
 * `completed` is NOT a member — the API never emits it. See the JSDoc on
 * `AdminPaymentViewStatusSchema` for the full rationale.
 */
export type PaymentStatus = AdminPaymentViewStatus;
