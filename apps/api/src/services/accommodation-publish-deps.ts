/**
 * @file accommodation-publish-deps.ts
 * @description Factory that adapts the existing API-level billing infrastructure
 * (`BillingCustomerSyncService` + `TrialService` + `QZPayBilling` client) into
 * the slimmer `AccommodationPublishDeps` interface that
 * `AccommodationService.publish()` consumes from `@repo/service-core`.
 *
 * Why the factory lives in `apps/api`:
 *
 * - `service-core` cannot import from `apps/api` (one-way dependency rule).
 * - QZPay/MercadoPago HTTP calls must stay outside the local DB transaction
 *   (see `service-core/CLAUDE.md` "External API calls outside the callback").
 *   The factory orchestrates the external trial creation and customer sync;
 *   `service-core` then runs the local writes (lifecycleState flip + role
 *   promotion) inside its own short transaction.
 *
 * The trial-creation call is wrapped in an 8s timeout so the API surfaces a
 * `service_unavailable` error promptly when QZPay is slow, instead of holding
 * the request open for the duration of the platform default timeout.
 */
import type { QZPayBilling } from '@qazuor/qzpay-core';
import { applyTestControl, isSubscriptionLive } from '@repo/billing';
import { UserModel, billingCustomers, billingSubscriptions, desc, eq, getDb } from '@repo/db';
import type { AccommodationPublishDeps, PublishEligibility } from '@repo/service-core';
import { addPublishLinkageContext } from '../lib/sentry';
import { clearEntitlementCache } from '../middlewares/entitlement';
import { apiLogger } from '../utils/logger';
import { BillingCustomerSyncService } from './billing-customer-sync';
import { TrialService } from './trial.service';

/** Maximum time, in ms, we wait for the QZPay trial creation to complete. */
const QZPAY_TRIAL_TIMEOUT_MS = 8_000;

/**
 * Wraps a promise with a hard timeout. If the promise has not settled before
 * `timeoutMs`, the returned promise rejects with a `TimeoutError` and the
 * original computation is abandoned (the underlying HTTP call may still
 * resolve in the background; we just stop waiting on it).
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/**
 * Builds the publish dependencies that `AccommodationService.publish()` needs.
 * Pass the result to the `AccommodationService` constructor as the fifth
 * argument.
 *
 * Accepts a *getter* for the QZPay billing client (rather than the client
 * itself) so that route modules instantiated at boot time resolve the billing
 * instance lazily on the first request. This avoids capturing a `null` from
 * `getQZPayBilling()` if module load races with billing initialisation.
 *
 * When billing is disabled (the getter returns `null`), `checkEligibility`
 * answers `first_publish` and both `startTrial` and `cancelTrial` throw, which
 * surfaces as `SERVICE_UNAVAILABLE` to the API caller.
 */
export function buildAccommodationPublishDeps(
    getBilling: () => QZPayBilling | null
): AccommodationPublishDeps {
    const userModel = new UserModel();
    return {
        checkEligibility: async (ownerId: string): Promise<PublishEligibility> => {
            const db = getDb();
            const [customer] = await db
                .select()
                .from(billingCustomers)
                .where(eq(billingCustomers.externalId, ownerId))
                .limit(1);
            if (!customer) {
                return 'first_publish';
            }
            const subscriptions = await db
                .select()
                .from(billingSubscriptions)
                .where(eq(billingSubscriptions.customerId, customer.id))
                .orderBy(desc(billingSubscriptions.createdAt))
                .limit(10);
            if (subscriptions.length === 0) {
                return 'first_publish';
            }
            const hasActive = subscriptions.some((s) =>
                isSubscriptionLive({
                    status: s.status,
                    trialEnd: s.trialEnd,
                    currentPeriodEnd: s.currentPeriodEnd
                })
            );
            return hasActive ? 'has_active_sub' : 'subscription_required';
        },

        startTrial: async ({
            ownerId,
            accommodationId
        }: { ownerId: string; accommodationId: string }) =>
            applyTestControl('startTrial', { ownerId, accommodationId }, async () => {
                const billing = getBilling();
                const customerSync = new BillingCustomerSyncService(billing);
                const trialService = new TrialService(billing);
                const user = await userModel.findById(ownerId);
                if (!user) {
                    throw new Error(`Cannot start trial: user ${ownerId} not found`);
                }
                const customerId = await withTimeout(
                    customerSync.ensureCustomerExists({
                        userId: user.id,
                        email: user.email ?? '',
                        name: user.displayName ?? user.firstName ?? user.email ?? undefined
                    }),
                    QZPAY_TRIAL_TIMEOUT_MS,
                    'billing.ensureCustomer'
                );
                if (!customerId) {
                    throw new Error('Billing customer sync returned no customer id');
                }
                // SPEC-222 Part 2: forward the triggering accommodation so the
                // MercadoPago creation metadata carries the referential marker
                // (no extra MP call — it rides the existing create payload).
                const subscriptionId = await withTimeout(
                    trialService.startTrial({ customerId, accommodationId }),
                    QZPAY_TRIAL_TIMEOUT_MS,
                    'billing.startTrial'
                );
                if (!subscriptionId) {
                    throw new Error('Trial creation returned no subscription id');
                }
                clearEntitlementCache(customerId);
                // SPEC-222 Part 1: attach the trial↔accommodation↔owner linkage to
                // the Sentry scope so any error captured on this request carries it
                // and the issue is searchable by any of the ids. Scope enrichment
                // only — no event emitted, no-op when Sentry is disabled.
                addPublishLinkageContext({
                    subscriptionId,
                    accommodationId,
                    ownerId,
                    customerId,
                    planSlug: 'owner-basico'
                });
                apiLogger.info(
                    { ownerId, customerId, subscriptionId, accommodationId },
                    '[publish] trial subscription created'
                );
                return { subscriptionId };
            }) as Promise<{ subscriptionId: string }>,

        cancelTrial: async (subscriptionId: string) =>
            applyTestControl('cancelTrial', subscriptionId, async () => {
                const billing = getBilling();
                if (!billing) {
                    throw new Error('Billing client unavailable; cannot cancel trial');
                }
                await withTimeout(
                    billing.subscriptions.cancel(subscriptionId),
                    QZPAY_TRIAL_TIMEOUT_MS,
                    'billing.cancel'
                );
                apiLogger.warn(
                    { subscriptionId },
                    '[publish] trial subscription cancelled (compensation)'
                );
            }) as Promise<void>
    };
}
