/**
 * Subscription pause service (SPEC-143 #29).
 *
 * Shared helpers for the SERVICE-SUSPENSION dimension of a subscription pause.
 * The BILLING dimension (MP preapproval + local subscription status) is owned
 * by qzpay (`billing.subscriptions.pause/resume`). This service only handles
 * the Hospeda-specific side effect: hiding the owner's accommodations from
 * public reads and locking them from edits while the pause is "full".
 *
 * Used by both surfaces so the logic lives in exactly one place:
 *  - the admin qzpay-hono hooks (`qzpay-admin-hooks.ts`)
 *  - the host self-serve protected route
 *
 * Source of truth: `users.service_suspended`. Denormalized to
 * `accommodations.owner_suspended` for the public hot path + the edit-lock.
 *
 * @module services/subscription-pause
 */

import { type DrizzleClient, accommodations, billingCustomers, eq, getDb, users } from '@repo/db';
import { type EntityChangeData, getRevalidationService } from '@repo/service-core';
import { apiLogger } from '../utils/logger';

/**
 * Resolves the Hospeda owner `users.id` from a billing customer id.
 *
 * `billing_customers.external_id` stores the Hospeda user id (see the
 * local-test-users seed and the checkout flow). Returns null when the customer
 * has no linked external id (should not happen for owner subscriptions).
 *
 * @param input - The billing customer id and an optional db/tx client.
 * @returns The owner user id, or null when it cannot be resolved.
 */
export async function resolveOwnerUserId(input: {
    customerId: string;
    db?: DrizzleClient;
}): Promise<string | null> {
    const db = input.db ?? getDb();
    const rows = await db
        .select({ externalId: billingCustomers.externalId })
        .from(billingCustomers)
        .where(eq(billingCustomers.id, input.customerId))
        .limit(1);

    return rows[0]?.externalId ?? null;
}

/**
 * Applies (or clears) the service-suspension flags for an owner.
 *
 * Flips `users.service_suspended` (canonical) and bulk-updates
 * `accommodations.owner_suspended` (denormalized) for every accommodation owned
 * by the user. Idempotent: setting the same value again is a harmless no-op, so
 * resume can always clear without first checking whether the pause was "full".
 *
 * After both DB writes succeed, schedules ISR revalidation (fire-and-forget) for
 * every affected accommodation so Cloudflare-cached public pages reflect the new
 * suspended/active state without waiting for the TTL to expire. Revalidation
 * failure is non-blocking: the DB writes are already committed at that point.
 *
 * @param input - The owner user id, the target suspended state, and an
 *   optional db/tx client.
 * @returns The number of accommodations whose flag was updated.
 */
export async function setOwnerServiceSuspension(input: {
    userId: string;
    suspended: boolean;
    db?: DrizzleClient;
}): Promise<{ accommodationsUpdated: number }> {
    const db = input.db ?? getDb();

    await db
        .update(users)
        .set({ serviceSuspended: input.suspended, updatedAt: new Date() })
        .where(eq(users.id, input.userId));

    const updated = await db
        .update(accommodations)
        .set({ ownerSuspended: input.suspended, updatedAt: new Date() })
        .where(eq(accommodations.ownerId, input.userId))
        .returning({ id: accommodations.id, slug: accommodations.slug });

    apiLogger.info(
        {
            userId: input.userId,
            suspended: input.suspended,
            accommodationsUpdated: updated.length
        },
        'Applied owner service-suspension flags'
    );

    // Schedule ISR revalidation AFTER DB writes succeed so cached public pages
    // (Cloudflare) reflect the new visibility state without waiting for TTL.
    // Fire-and-forget: revalidation never blocks the DB operation.
    if (updated.length > 0) {
        const revalidationService = getRevalidationService();
        if (revalidationService) {
            const direction = input.suspended ? 'suspend' : 'resume';
            const events: EntityChangeData[] = updated.map((row) => ({
                entityType: 'accommodation' as const,
                slug: row.slug
            }));
            revalidationService.scheduleRevalidationBatch({
                events,
                reason: `owner-service-suspension: ${direction} userId=${input.userId}`
            });
        }
    }

    return { accommodationsUpdated: updated.length };
}
