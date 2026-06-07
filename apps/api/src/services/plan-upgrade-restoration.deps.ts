/**
 * Default production dependencies for the Plan Upgrade Restoration Service.
 *
 * Extracted from `plan-upgrade-restoration.service.ts` to keep that module
 * within the 500-line guideline (reviewed SPEC-167 T-023). This file contains
 * ONLY the concrete `defaultDeps` object that wires real DB/billing calls.
 * The interface and type definitions remain in the service module.
 *
 * **Do not import this file from tests.** Tests always inject their own
 * `deps` via {@link ApplyUpgradeRestorationsInput.deps}. This module is
 * production-only wiring.
 *
 * @module services/plan-upgrade-restoration.deps
 */

import { LimitKey, getPlanBySlug } from '@repo/billing';
import type { PlanDefinition } from '@repo/billing';
import type {
    AccommodationWithArchivedPhotos,
    PlanCaps,
    RestrictedItem,
    UpgradeRestorationDeps
} from './plan-upgrade-restoration.service';

// ---------------------------------------------------------------------------
// Default production dependencies
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Headroom helper
// ---------------------------------------------------------------------------

/**
 * Given the full list of restricted items (sorted most-recently-restricted
 * first by caller convention) and the headroom available, returns:
 * - `toRestore`: slice of ids to restore (up to headroom).
 * - `toLeave`: the remainder that stays restricted.
 *
 * When `cap === -1` (unlimited), ALL items are scheduled for restoration.
 */
export function splitByHeadroom(params: {
    readonly restricted: readonly RestrictedItem[];
    readonly cap: number;
    readonly activeCount: number;
}): { readonly toRestore: readonly string[]; readonly toLeave: readonly string[] } {
    const { restricted, cap, activeCount } = params;

    if (restricted.length === 0) {
        return { toRestore: [], toLeave: [] };
    }

    if (cap === -1) {
        // Unlimited — restore everything
        return { toRestore: restricted.map((r) => r.id), toLeave: [] };
    }

    const headroom = Math.max(0, cap - activeCount);
    if (headroom === 0) {
        return { toRestore: [], toLeave: restricted.map((r) => r.id) };
    }

    const toRestore = restricted.slice(0, headroom).map((r) => r.id);
    const toLeave = restricted.slice(headroom).map((r) => r.id);
    return { toRestore, toLeave };
}

// ---------------------------------------------------------------------------
// Default production dependencies
// ---------------------------------------------------------------------------

export const defaultDeps: UpgradeRestorationDeps = {
    async getPlanSlug(planId: string): Promise<string | null> {
        const { getQZPayBilling } = await import('../middlewares/billing');
        const billing = getQZPayBilling();
        if (!billing) return null;
        try {
            const plan = await billing.plans.get(planId);
            // qzpay stores slug as plan.name (mirrors resolvePlanBySlug in checkout service)
            return plan?.name ?? null;
        } catch {
            return null;
        }
    },

    getPlanCaps(planSlug: string): PlanCaps {
        const plan: PlanDefinition | undefined = getPlanBySlug(planSlug);
        if (!plan) {
            // Unknown slug → treat as unlimited (safe fallback: restores everything)
            return { accommodationsCap: -1, promotionsCap: -1, photosPerAccommodationCap: -1 };
        }

        const getLimit = (key: LimitKey): number => {
            const def = plan.limits.find((l) => l.key === key);
            return def?.value ?? -1;
        };

        return {
            accommodationsCap: getLimit(LimitKey.MAX_ACCOMMODATIONS),
            promotionsCap: getLimit(LimitKey.MAX_ACTIVE_PROMOTIONS),
            photosPerAccommodationCap: getLimit(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION)
        };
    },

    async getRestrictedAccommodations(userId: string): Promise<RestrictedItem[]> {
        const {
            accommodations: accsTable,
            getDb,
            and,
            eq,
            isNull,
            desc
        } = await import('@repo/db');
        const db = getDb();
        const rows = await db
            .select({ id: accsTable.id, updatedAt: accsTable.updatedAt })
            .from(accsTable)
            .where(
                and(
                    eq(accsTable.ownerId, userId),
                    eq(accsTable.planRestricted, true),
                    isNull(accsTable.deletedAt)
                )
            )
            .orderBy(desc(accsTable.updatedAt));
        return rows.map((r) => ({ id: r.id, updatedAt: r.updatedAt }));
    },

    async getActiveAccommodationCount(userId: string): Promise<number> {
        const {
            accommodations: accsTable,
            getDb,
            and,
            eq,
            isNull,
            count
        } = await import('@repo/db');
        const db = getDb();
        const [row] = await db
            .select({ n: count(accsTable.id) })
            .from(accsTable)
            .where(
                and(
                    eq(accsTable.ownerId, userId),
                    eq(accsTable.planRestricted, false),
                    isNull(accsTable.deletedAt)
                )
            );
        return Number(row?.n ?? 0);
    },

    async getRestrictedPromotions(userId: string): Promise<RestrictedItem[]> {
        const {
            ownerPromotions: promosTable,
            getDb,
            and,
            eq,
            isNull,
            desc
        } = await import('@repo/db');
        const db = getDb();
        const rows = await db
            .select({ id: promosTable.id, updatedAt: promosTable.updatedAt })
            .from(promosTable)
            .where(
                and(
                    eq(promosTable.ownerId, userId),
                    eq(promosTable.planRestricted, true),
                    isNull(promosTable.deletedAt)
                )
            )
            .orderBy(desc(promosTable.updatedAt));
        return rows.map((r) => ({ id: r.id, updatedAt: r.updatedAt }));
    },

    async getActivePromotionCount(userId: string): Promise<number> {
        const {
            ownerPromotions: promosTable,
            getDb,
            and,
            eq,
            isNull,
            count
        } = await import('@repo/db');
        const db = getDb();
        const [row] = await db
            .select({ n: count(promosTable.id) })
            .from(promosTable)
            .where(
                and(
                    eq(promosTable.ownerId, userId),
                    eq(promosTable.planRestricted, false),
                    isNull(promosTable.deletedAt)
                )
            );
        return Number(row?.n ?? 0);
    },

    async getAccommodationsWithArchivedPhotos(
        userId: string
    ): Promise<AccommodationWithArchivedPhotos[]> {
        const {
            accommodations: accsTable,
            getDb,
            and,
            eq,
            isNull,
            sql: drizzleSql
        } = await import('@repo/db');
        const db = getDb();

        // Select accommodations owned by this user that have non-empty archivedGallery
        const rows = await db
            .select({ id: accsTable.id, media: accsTable.media })
            .from(accsTable)
            .where(
                and(
                    eq(accsTable.ownerId, userId),
                    isNull(accsTable.deletedAt),
                    // JSONB: archivedGallery exists and is non-empty
                    drizzleSql`${accsTable.media}->'archivedGallery' IS NOT NULL AND jsonb_array_length(${accsTable.media}->'archivedGallery') > 0`
                )
            );

        return rows.map((r) => {
            const media = r.media as {
                gallery?: Array<unknown>;
                archivedGallery?: Array<unknown>;
            } | null;
            return {
                accommodationId: r.id,
                galleryCount: media?.gallery?.length ?? 0,
                archivedCount: media?.archivedGallery?.length ?? 0
            };
        });
    },

    async fetchAccommodationSlugs(ids: readonly string[]): Promise<Record<string, string>> {
        if (ids.length === 0) return {};
        const { accommodationModel } = await import('@repo/db');
        const rows = await accommodationModel.findAll(
            { id: { in: ids as string[] } },
            { pageSize: ids.length + 10 }
        );
        const map: Record<string, string> = {};
        for (const row of rows.items ?? []) {
            if (row.id && row.slug) map[row.id] = row.slug;
        }
        return map;
    }
};
