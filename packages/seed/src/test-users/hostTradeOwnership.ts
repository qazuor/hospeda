/**
 * @fileoverview
 * HOS-376 T-013 — makes one test user a provider as well as a host.
 *
 * The SPEC-143 matrix has hosts and it has tourists, but nobody who owns a
 * `host_trades` listing. AC-16 ("a host who is also a provider CAN rate other
 * providers") and AC-17 ("...but NOT their own listing") both need a single
 * account on both sides of the relationship, so neither is testable end-to-end
 * without this.
 *
 * Rather than seed a new listing, this links an existing curated fixture. The
 * fixtures under `src/data/hostTrade/` are guarded baseline data — editing one
 * to add an `ownerUserId` would drag a dev-only concern into the dual-write
 * rule and ship a test account's id to staging. Assigning ownership at
 * test-user seed time keeps the whole thing inside the dev-only carril.
 *
 * @module test-users/hostTradeOwnership
 */
import { type DrizzleClient, hostTrades } from '@repo/db';
import { and, eq, isNull } from 'drizzle-orm';

/** The dual-role account: owns accommodations AND a provider listing. */
export const HOST_TRADE_OWNER_EMAIL = 'host-provider@local.test';

/**
 * Slug of the fixture listing this user takes ownership of
 * (`src/data/hostTrade/002-hostTrade-uruguay-plomeria.json`).
 *
 * Concepción del Uruguay, which is where the matrix's other hosts have their
 * accommodations — so the linked-selector and directory-scoping paths have
 * coherent data to exercise instead of an orphan listing in a destination
 * nobody hosts in.
 */
export const HOST_TRADE_OWNER_SLUG = 'plomeria-litoral';

/** What {@link resolveHostTradeOwnershipAction} decided to do. */
export type HostTradeOwnershipAction = 'link' | 'skip-already-linked' | 'skip-owned-by-other';

/**
 * Decides whether the seed may claim a listing for the dual-role test user.
 *
 * Pure so the decision is unit-testable without a database — the interesting
 * case is not the happy path but the refusal.
 *
 * @param params.currentOwnerUserId - `ownerUserId` currently on the row, if any.
 *   Empty string is treated as unowned: it is not a user id, and comparing
 *   against it would make the "owned by someone else" guard compare garbage.
 * @param params.targetUserId - the dual-role test user's id.
 *
 * @remarks
 * The `skip-owned-by-other` branch is the load-bearing one. This seed can run
 * against a database where a REAL provider already claimed the listing through
 * the HOS-278 alliance flow. Overwriting `ownerUserId` there would silently
 * transfer a real person's listing to a test account and lock them out of their
 * own ficha — so the seed yields instead, and the dual-role user simply does
 * not get a listing on that environment.
 */
export function resolveHostTradeOwnershipAction(params: {
    readonly currentOwnerUserId: string | null | undefined;
    readonly targetUserId: string;
}): HostTradeOwnershipAction {
    const { currentOwnerUserId, targetUserId } = params;

    if (!currentOwnerUserId) {
        return 'link';
    }

    return currentOwnerUserId === targetUserId ? 'skip-already-linked' : 'skip-owned-by-other';
}

/**
 * Attaches {@link HOST_TRADE_OWNER_SLUG} to the dual-role test user, if and
 * only if {@link resolveHostTradeOwnershipAction} allows it.
 *
 * Idempotent: re-running `db:seed:test-users` against an already-linked row
 * writes nothing.
 *
 * @returns the action taken, or `'not-found'` when the fixture listing is not
 *   present — which is the normal case on a database seeded without
 *   `--example`, not an error.
 */
export async function ensureHostTradeOwnership(params: {
    readonly userId: string;
    readonly db: DrizzleClient;
}): Promise<HostTradeOwnershipAction | 'not-found'> {
    const { userId, db } = params;

    const [listing] = await db
        .select({ id: hostTrades.id, ownerUserId: hostTrades.ownerUserId })
        .from(hostTrades)
        .where(and(eq(hostTrades.slug, HOST_TRADE_OWNER_SLUG), isNull(hostTrades.deletedAt)))
        .limit(1);

    if (!listing) {
        return 'not-found';
    }

    const action = resolveHostTradeOwnershipAction({
        currentOwnerUserId: listing.ownerUserId,
        targetUserId: userId
    });

    if (action === 'link') {
        await db
            .update(hostTrades)
            .set({ ownerUserId: userId, updatedById: userId })
            .where(eq(hostTrades.id, listing.id));
    }

    return action;
}
