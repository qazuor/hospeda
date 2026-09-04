/**
 * Resolving whose quota a chat spends, and what their plan grants (HOS-400).
 *
 * ---
 * ONE LOOKUP, FOUR ANSWERS
 *
 * A single chat request needs four things about the listing's OWNER:
 *
 *   1. do they exist / who are they      → the listing row's `ownerId`
 *   2. does their plan grant `AI_CHAT`   → the entitlement gate
 *   3. what is their monthly chat quota  → the cost cap
 *   4. what ELSE does their plan grant   → whether the carta / the directions
 *                                          may enter the prompt
 *
 * All four are answered from ONE resolution, deliberately. Asking separately
 * would multiply the billing round-trips, and — the reason that actually
 * matters — would let the answers come from DIFFERENT INSTANTS: a plan change
 * landing mid-request could gate the chat open on the old plan and build the
 * prompt from the new one, or the reverse. The same argument
 * `resolveOwnerGastronomyPlanEntitlementSet` makes for the public detail page,
 * where one render reads several gated features off one owner.
 * ---
 *
 * @module apps/api/services/ai-context/chat-owner-grants
 */

import {
    AI_CHAT_LIMIT_KEY_BY_COMMERCE_VERTICAL,
    type CommerceVertical,
    EntitlementKey,
    LimitKey
} from '@repo/billing';
import { experiences, gastronomies, getDb } from '@repo/db';
import { type AiChatEntityType, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { and, eq, isNull } from 'drizzle-orm';
import { getQZPayBilling } from '../../middlewares/billing.js';
import { resolveCommerceVerticalGrants } from '../../middlewares/commerce-entitlement.js';
import {
    resolveOwnerEntitlementsForOwnerId,
    resolveOwnerLimitsForOwnerId
} from '../../middlewares/owner-entitlement.js';
import { apiLogger } from '../../utils/logger.js';

/** What the chat route needs to know about a listing's owner. */
export interface ChatOwnerGrants {
    /** The `users.id` that bears the metered cost. */
    readonly ownerId: string;
    /** Whether the owner's plan grants `AI_CHAT` in THIS listing's domain. */
    readonly grantsAiChat: boolean;
    /**
     * The owner's monthly chat quota for this vertical. `-1` means unlimited
     * (staff bypass); `0` means the capability is disabled in their plan.
     */
    readonly monthlyQuota: number;
    /**
     * Everything the owner's plan grants, for the assembler's content gates.
     * Empty when unresolvable — the fail-closed direction.
     */
    readonly entitlements: ReadonlySet<string>;
}

/**
 * Narrows a chat entity type to a commerce vertical, or `null` for accommodation.
 *
 * @param entityType - The chat target's entity type.
 * @returns The commerce vertical, or `null` when the target is an accommodation.
 */
function commerceVerticalOf(entityType: AiChatEntityType): CommerceVertical | null {
    return entityType === 'accommodation' ? null : entityType;
}

/**
 * Reads a commerce listing's `ownerId`, or throws a pre-stream 404.
 *
 * Soft-deleted rows are treated as absent: a deleted listing has no live chat.
 *
 * @param entityType - Which commerce vertical's table to read.
 * @param entityId - The listing id.
 * @returns The owner's user id.
 * @throws {ServiceError} `NOT_FOUND` when the row does not exist or is deleted.
 */
async function loadCommerceOwnerId(
    entityType: 'gastronomy' | 'experience',
    entityId: string
): Promise<string> {
    const db = getDb();

    if (entityType === 'gastronomy') {
        const rows = await db
            .select({ ownerId: gastronomies.ownerId })
            .from(gastronomies)
            .where(and(eq(gastronomies.id, entityId), isNull(gastronomies.deletedAt)))
            .limit(1);
        const row = rows[0];
        if (!row) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Gastronomy not found.', {
                entityId
            });
        }
        return row.ownerId;
    }

    const rows = await db
        .select({ ownerId: experiences.ownerId })
        .from(experiences)
        .where(and(eq(experiences.id, entityId), isNull(experiences.deletedAt)))
        .limit(1);
    const row = rows[0];
    if (!row) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Experience not found.', { entityId });
    }
    return row.ownerId;
}

/**
 * Resolves the owner's billing customer id from their user id.
 *
 * Returns `null` when billing is disabled or the customer row does not exist
 * yet — a normal transient state, since customer rows are created by a
 * non-blocking signup hook. A `null` customer resolves downstream to the code
 * floor, which does NOT include `AI_CHAT`, so the chat is refused rather than
 * opened. That is the correct direction: no customer means no paid plan.
 *
 * @param ownerId - The owner's `users.id`.
 * @returns The QZPay customer id, or `null`.
 */
async function loadOwnerBillingCustomerId(ownerId: string): Promise<string | null> {
    const billing = getQZPayBilling();
    if (!billing) {
        return null;
    }
    try {
        const customer = await billing.customers.getByExternalId(ownerId);
        return customer?.id ?? null;
    } catch (error) {
        apiLogger.warn(
            { ownerId, error: error instanceof Error ? error.message : String(error) },
            'chat-owner-grants: failed to resolve the owner billing customer; treating as none'
        );
        return null;
    }
}

/**
 * Resolves everything the chat route needs about a listing's owner, in one pass.
 *
 * Dispatches on the entity type:
 *
 * - **accommodation** — keeps the SPEC-211 path exactly as it was
 *   (`resolveOwnerEntitlementsForOwnerId` + `resolveOwnerLimitsForOwnerId`, in
 *   parallel, both cached per customer). Not rerouted through the commerce
 *   resolver: that file carries the staff bypass, the owner-básico fallback and
 *   the caches this domain depends on, and HOS-1084 is rewriting it concurrently.
 * - **gastronomy / experience** — one `resolveCommerceVerticalGrants` call,
 *   which reads the entitlements, the listing cap and the chat quota off the SAME
 *   plan row of the SAME subscription.
 *
 * @param input.entityType - The listing's vertical.
 * @param input.entityId - The listing id.
 * @param input.accommodationOwnerId - For the accommodation path only, the owner
 *   id the route already read from the accommodation row (it needs that row
 *   anyway for its own 404 guard, so re-reading it here would be a second query
 *   for a value already in hand).
 * @returns The owner id, the gate answer, the quota and the full grant set.
 * @throws {ServiceError} `NOT_FOUND` when a commerce listing does not exist.
 */
export async function resolveChatOwnerGrants(input: {
    entityType: AiChatEntityType;
    entityId: string;
    accommodationOwnerId?: string;
}): Promise<ChatOwnerGrants> {
    const vertical = commerceVerticalOf(input.entityType);

    if (vertical === null) {
        const ownerId = input.accommodationOwnerId;
        if (!ownerId) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'resolveChatOwnerGrants: accommodationOwnerId is required for the accommodation path.'
            );
        }
        const [entitlements, limits] = await Promise.all([
            resolveOwnerEntitlementsForOwnerId(ownerId),
            resolveOwnerLimitsForOwnerId(ownerId)
        ]);
        return {
            ownerId,
            grantsAiChat: entitlements.includes(EntitlementKey.AI_CHAT),
            monthlyQuota: limits.get(LimitKey.MAX_AI_CHAT_PER_MONTH) ?? 0,
            entitlements: new Set<string>(entitlements)
        };
    }

    const ownerId = await loadCommerceOwnerId(vertical, input.entityId);
    const customerId = await loadOwnerBillingCustomerId(ownerId);
    const grants = await resolveCommerceVerticalGrants({ customerId, vertical });

    // Sanity: the quota key this vertical is metered under must be the one the
    // resolver read. Kept as an assertion in the type system rather than a
    // runtime check — `AI_CHAT_LIMIT_KEY_BY_COMMERCE_VERTICAL` is exhaustive over
    // the vertical union, so this cannot resolve to undefined.
    void AI_CHAT_LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical];

    return {
        ownerId,
        grantsAiChat: grants.entitlements.has(EntitlementKey.AI_CHAT),
        monthlyQuota: grants.aiChatCap,
        entitlements: new Set<string>(grants.entitlements)
    };
}
