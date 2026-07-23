/**
 * Tests for the commerce visibility reconcile wiring (SPEC-239 T-050,
 * predicate widened + completeness injection HOS-166 §6.5).
 *
 * Verifies that `reconcileCommerceListingForSubscription` (the bridge invoked by
 * the MP webhook + dunning/finalize crons) flips a linked commerce listing:
 *   - active + complete    → PUBLIC  + ACTIVE
 *   - active + incomplete  → stays PRIVATE + INACTIVE (HOS-166 AC-6)
 *   - REJECTED moderation  → stays PRIVATE regardless of completeness (AC-9)
 *   - cancelled            → PRIVATE + INACTIVE
 * and is a no-op when the subscription has no commerce link row.
 *
 * `@repo/db` is stubbed for the link lookup/update; the gastronomy/experience
 * models are stubbed via `resolveCommerceEntityModel`-compatible behaviour.
 * The real reconciler (`reconcileCommerceListingVisibility` from
 * @repo/service-core) AND the real completeness wiring
 * (`resolveCommerceListingCompleteness` from `commerce-reconcile.service.ts`,
 * which reads the SAME mocked `gastronomyModel`/`experienceModel`) both run.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// ── @repo/db stub: link lookup + denormalized status update ────────────────
const linkRows: Array<{ entityType: string; entityId: string }> = [];
const selectWhere = vi.fn(() => Promise.resolve(linkRows));
const selectFrom = vi.fn(() => ({ where: selectWhere }));
const dbSelect = vi.fn(() => ({ from: selectFrom }));
const updateWhere = vi.fn(() => Promise.resolve(undefined));
const updateSet = vi.fn(() => ({ where: updateWhere }));
const dbUpdate = vi.fn(() => ({ set: updateSet }));

/**
 * Shape of a fake entity row. Beyond `id`/`visibility`/`lifecycleState`
 * (required by the reconciler's own read), every field
 * `resolveListingCompleteness` reads is optional — a row missing them is
 * genuinely incomplete, exactly like a real DRAFT listing (HOS-166 §6.6).
 */
interface FakeEntityRow {
    id: string;
    visibility: string;
    lifecycleState: string;
    moderationState?: string;
    name?: string;
    summary?: string;
    description?: string;
    destinationId?: string;
    ownerId?: string;
    type?: string;
    media?: { featuredImage?: { url: string } };
    contactInfo?: { personalEmail?: string };
    openingHours?: {
        timezone: string;
        days: Record<string, { closed: boolean; shifts: { open: string; close: string }[] }>;
    };
    priceRange?: string;
    priceFrom?: number;
    isPriceOnRequest?: boolean;
}

/** A fully-complete gastronomy row — satisfies every shared + gastronomy-specific requirement. */
function makeCompleteGastronomyRow(base: {
    id: string;
    visibility: string;
    lifecycleState: string;
    moderationState?: string;
}): FakeEntityRow {
    return {
        ...base,
        name: 'La Parrilla del Puerto',
        summary: 'A riverside parrilla with fresh grilled fish and steak.',
        description:
            'La Parrilla del Puerto has served the waterfront for over a decade, specializing in grilled fish and classic asado.',
        destinationId: '00000000-0000-4000-a000-000000000002',
        ownerId: '00000000-0000-4000-a000-000000000001',
        type: 'RESTAURANT',
        media: { featuredImage: { url: 'https://example.com/img.jpg' } },
        contactInfo: { personalEmail: 'owner@example.com' },
        openingHours: {
            timezone: 'America/Argentina/Buenos_Aires',
            days: {
                mon: { closed: false, shifts: [{ open: '09:00', close: '22:00' }] },
                tue: { closed: true, shifts: [] },
                wed: { closed: true, shifts: [] },
                thu: { closed: true, shifts: [] },
                fri: { closed: true, shifts: [] },
                sat: { closed: true, shifts: [] },
                sun: { closed: true, shifts: [] }
            }
        },
        priceRange: 'MODERATE'
    };
}

/** A fully-complete experience row — satisfies shared + experience-specific requirements. */
function makeCompleteExperienceRow(base: {
    id: string;
    visibility: string;
    lifecycleState: string;
    moderationState?: string;
}): FakeEntityRow {
    return {
        ...base,
        name: 'Kayak tour on the Uruguay river',
        summary: 'A guided two-hour kayak tour along the riverside.',
        description:
            'Explore the Uruguay river coastline by kayak with a certified local guide, including all safety equipment.',
        destinationId: '00000000-0000-4000-a000-000000000002',
        ownerId: '00000000-0000-4000-a000-000000000001',
        type: 'TOUR_GUIDE',
        media: { featuredImage: { url: 'https://example.com/kayak.jpg' } },
        contactInfo: { personalEmail: 'guide@example.com' },
        priceFrom: 1500000,
        isPriceOnRequest: false
    };
}

// ── entity store the fake model reads/writes ────────────────────────────────
// Backed directly into the mocked @repo/db `gastronomyModel`/`experienceModel`,
// so the REAL `resolveCommerceEntityModel` → REAL reconciler → REAL
// `resolveCommerceListingCompleteness` all run end-to-end against it.
const entityStore = new Map<string, FakeEntityRow>();

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({ select: dbSelect, update: dbUpdate })),
    eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
    commerceListingSubscriptions: {
        subscriptionId: 'subscription_id',
        entityType: 'entity_type',
        entityId: 'entity_id',
        status: 'status'
    },
    // Real-shaped fake model: resolveCommerceEntityModel returns this for
    // entityType='gastronomy', and the real reconciler drives findById/update.
    gastronomyModel: {
        findById: (id: string) => Promise.resolve(entityStore.get(id) ?? null),
        // BaseModel.update signature: update(where, data, tx?). The reconciler
        // passes `{ id: entityId }` as the where clause.
        update: (where: { id: string }, data: { visibility?: string; lifecycleState?: string }) => {
            const cur = entityStore.get(where.id);
            if (cur) entityStore.set(where.id, { ...cur, ...data });
            return Promise.resolve(undefined);
        }
    },
    // Real-shaped fake model for experience — mirrors the gastronomy stub above.
    experienceModel: {
        findById: (id: string) => Promise.resolve(entityStore.get(id) ?? null),
        update: (where: { id: string }, data: { visibility?: string; lifecycleState?: string }) => {
            const cur = entityStore.get(where.id);
            if (cur) entityStore.set(where.id, { ...cur, ...data });
            return Promise.resolve(undefined);
        }
    }
}));

import { reconcileCommerceListingForSubscription } from '../../src/services/commerce-reconcile.service';

const SUB_ID = '22222222-2222-4222-8222-222222222222';
const ENTITY_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('reconcileCommerceListingForSubscription (SPEC-239 T-050)', () => {
    beforeEach(() => {
        linkRows.length = 0;
        entityStore.clear();
        dbSelect.mockClear();
        dbUpdate.mockClear();
        updateSet.mockClear();
    });

    it('flips a linked listing PUBLIC + ACTIVE on an active subscription (complete listing)', async () => {
        linkRows.push({ entityType: 'gastronomy', entityId: ENTITY_ID });
        entityStore.set(
            ENTITY_ID,
            makeCompleteGastronomyRow({
                id: ENTITY_ID,
                visibility: 'PRIVATE',
                lifecycleState: 'INACTIVE'
            })
        );

        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_ID,
            subscriptionStatus: 'active',
            source: 'mp-webhook'
        });

        const updated = entityStore.get(ENTITY_ID);
        expect(updated?.visibility).toBe('PUBLIC');
        expect(updated?.lifecycleState).toBe('ACTIVE');
        // Denormalized link status kept in sync.
        expect(updateSet).toHaveBeenCalled();
    });

    it('hides a linked listing PRIVATE + INACTIVE on a cancelled subscription', async () => {
        linkRows.push({ entityType: 'gastronomy', entityId: ENTITY_ID });
        entityStore.set(
            ENTITY_ID,
            makeCompleteGastronomyRow({
                id: ENTITY_ID,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE'
            })
        );

        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_ID,
            subscriptionStatus: 'cancelled',
            source: 'dunning-cron'
        });

        expect(entityStore.get(ENTITY_ID)).toMatchObject({
            visibility: 'PRIVATE',
            lifecycleState: 'INACTIVE'
        });
    });

    it('is a no-op when the subscription has no commerce link row', async () => {
        // linkRows empty → accommodation subscription path.
        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_ID,
            subscriptionStatus: 'cancelled',
            source: 'finalize-cancelled-cron'
        });

        // No status update issued, no entity touched.
        expect(updateSet).not.toHaveBeenCalled();
        expect(entityStore.size).toBe(0);
    });

    it('does not throw when the reconcile lookup fails (non-blocking)', async () => {
        selectWhere.mockRejectedValueOnce(new Error('db down'));

        await expect(
            reconcileCommerceListingForSubscription({
                subscriptionId: SUB_ID,
                subscriptionStatus: 'active',
                source: 'mp-webhook'
            })
        ).resolves.toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// HOS-166 AC-6: active subscription + incomplete listing → stays PRIVATE
// ---------------------------------------------------------------------------

describe('reconcileCommerceListingForSubscription — incomplete listing (HOS-166 AC-6)', () => {
    beforeEach(() => {
        linkRows.length = 0;
        entityStore.clear();
        dbSelect.mockClear();
        dbUpdate.mockClear();
        updateSet.mockClear();
    });

    it('keeps a genuinely incomplete listing PRIVATE despite an active subscription', async () => {
        linkRows.push({ entityType: 'gastronomy', entityId: ENTITY_ID });
        // Minimal row — no media, contactInfo, openingHours, priceRange: a
        // real DRAFT listing that was never completed.
        entityStore.set(ENTITY_ID, {
            id: ENTITY_ID,
            visibility: 'PRIVATE',
            lifecycleState: 'INACTIVE',
            name: 'Draft Listing',
            ownerId: '00000000-0000-4000-a000-000000000001'
        });

        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_ID,
            subscriptionStatus: 'active',
            source: 'mp-webhook'
        });

        const row = entityStore.get(ENTITY_ID);
        expect(row?.visibility).toBe('PRIVATE');
        expect(row?.lifecycleState).toBe('INACTIVE');
    });

    it('flips an already-PUBLIC listing back to PRIVATE if it becomes incomplete (R-2 race)', async () => {
        linkRows.push({ entityType: 'experience', entityId: ENTITY_ID });
        // Was complete+published; owner un-completed a required field
        // (priceFrom un-set here to simulate the edit).
        const row = makeCompleteExperienceRow({
            id: ENTITY_ID,
            visibility: 'PUBLIC',
            lifecycleState: 'ACTIVE'
        });
        row.priceFrom = undefined;
        row.isPriceOnRequest = false;
        entityStore.set(ENTITY_ID, row);

        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_ID,
            subscriptionStatus: 'active',
            source: 'dunning-cron'
        });

        const updated = entityStore.get(ENTITY_ID);
        expect(updated?.visibility).toBe('PRIVATE');
        expect(updated?.lifecycleState).toBe('INACTIVE');
    });
});

// ---------------------------------------------------------------------------
// HOS-166 AC-9: moderationState=REJECTED → stays PRIVATE regardless of
// completeness or subscription status.
// ---------------------------------------------------------------------------

describe('reconcileCommerceListingForSubscription — moderationState=REJECTED (HOS-166 AC-9)', () => {
    beforeEach(() => {
        linkRows.length = 0;
        entityStore.clear();
        dbSelect.mockClear();
        dbUpdate.mockClear();
        updateSet.mockClear();
    });

    it('keeps a REJECTED-moderation listing PRIVATE even when otherwise complete and paid', async () => {
        linkRows.push({ entityType: 'gastronomy', entityId: ENTITY_ID });
        entityStore.set(
            ENTITY_ID,
            makeCompleteGastronomyRow({
                id: ENTITY_ID,
                visibility: 'PRIVATE',
                lifecycleState: 'INACTIVE',
                moderationState: 'REJECTED'
            })
        );

        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_ID,
            subscriptionStatus: 'active',
            source: 'mp-webhook'
        });

        const row = entityStore.get(ENTITY_ID);
        expect(row?.visibility).toBe('PRIVATE');
        expect(row?.lifecycleState).toBe('INACTIVE');
    });

    it('treats a PENDING moderationState as publishable (no moderation queue exists — §6.5 default)', async () => {
        linkRows.push({ entityType: 'gastronomy', entityId: ENTITY_ID });
        entityStore.set(
            ENTITY_ID,
            makeCompleteGastronomyRow({
                id: ENTITY_ID,
                visibility: 'PRIVATE',
                lifecycleState: 'INACTIVE',
                moderationState: 'PENDING'
            })
        );

        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_ID,
            subscriptionStatus: 'active',
            source: 'mp-webhook'
        });

        expect(entityStore.get(ENTITY_ID)?.visibility).toBe('PUBLIC');
    });
});

// ---------------------------------------------------------------------------
// H-1 regression: experience entity arm is wired in resolveCommerceEntityModel
// ---------------------------------------------------------------------------

describe('reconcileCommerceListingForSubscription — experience entity (H-1 regression)', () => {
    beforeEach(() => {
        linkRows.length = 0;
        entityStore.clear();
        dbSelect.mockClear();
        dbUpdate.mockClear();
        updateSet.mockClear();
    });

    it('flips a linked experience listing PUBLIC + ACTIVE on an active subscription (complete listing)', async () => {
        linkRows.push({ entityType: 'experience', entityId: ENTITY_ID });
        entityStore.set(
            ENTITY_ID,
            makeCompleteExperienceRow({
                id: ENTITY_ID,
                visibility: 'PRIVATE',
                lifecycleState: 'INACTIVE'
            })
        );

        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_ID,
            subscriptionStatus: 'active',
            source: 'mp-webhook'
        });

        const updated = entityStore.get(ENTITY_ID);
        expect(updated?.visibility).toBe('PUBLIC');
        expect(updated?.lifecycleState).toBe('ACTIVE');
    });

    it('hides a linked experience listing PRIVATE + INACTIVE on a cancelled subscription', async () => {
        linkRows.push({ entityType: 'experience', entityId: ENTITY_ID });
        entityStore.set(
            ENTITY_ID,
            makeCompleteExperienceRow({
                id: ENTITY_ID,
                visibility: 'PUBLIC',
                lifecycleState: 'ACTIVE'
            })
        );

        await reconcileCommerceListingForSubscription({
            subscriptionId: SUB_ID,
            subscriptionStatus: 'cancelled',
            source: 'dunning-cron'
        });

        expect(entityStore.get(ENTITY_ID)).toMatchObject({
            visibility: 'PRIVATE',
            lifecycleState: 'INACTIVE'
        });
    });
});
