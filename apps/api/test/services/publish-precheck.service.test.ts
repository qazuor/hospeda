/**
 * @file publish-precheck.service.test.ts
 * @description The six-cell decision matrix, across all three publish verticals
 * (HOS-1156 T-011, AC-11), plus AC-10's crossover and the AC-12 fail-open.
 *
 * These tests assert the composed DECISION, never the shape of a query.
 * `apps/api`'s setup mocks `@repo/db` wholesale, so an assertion about what SQL
 * ran here would be vacuous — it would only be re-reading the mock.
 *
 * `isCommercePublishVertical` is deliberately NOT mocked (it comes through
 * `importOriginal`): it is what routes a vertical to the commerce cap resolver,
 * so stubbing it would test the stub instead of the branch.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const countOwnListings = vi.fn();
const listOwnDraftListings = vi.fn();
const resolveCommerceVerticalCap = vi.fn();

vi.mock('../../src/services/publish-listing-reads', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../src/services/publish-listing-reads')>();
    return {
        ...actual,
        countOwnListings: (...args: unknown[]) => countOwnListings(...args),
        listOwnDraftListings: (...args: unknown[]) => listOwnDraftListings(...args)
    };
});

vi.mock('../../src/middlewares/commerce-entitlement', () => ({
    resolveCommerceVerticalCap: (...args: unknown[]) => resolveCommerceVerticalCap(...args)
}));

import { resolvePublishPrecheck } from '../../src/services/publish-precheck.service';

type Vertical = 'accommodation' | 'gastronomy' | 'experience';

const ACTOR = { id: 'owner-1', roles: [], permissions: [] } as never;

/**
 * A context stand-in carrying just the two keys the service reads and writes:
 * `userLimits` (what `checkLimit` consults) and `billingCustomerId`.
 */
function makeCtx(initialLimits: ReadonlyArray<readonly [string, number]> = []) {
    const store = new Map<string, unknown>([
        ['userLimits', new Map<string, number>(initialLimits)],
        ['billingCustomerId', 'cus-1']
    ]);
    return {
        get: (key: string) => store.get(key),
        set: (key: string, value: unknown) => store.set(key, value)
    } as never;
}

/** Builds N drafts with distinct ids. */
function drafts(n: number) {
    return Array.from({ length: n }, (_, i) => ({
        id: `draft-${i}`,
        slug: `draft-${i}`,
        name: `Draft ${i}`
    }));
}

/**
 * Arranges one matrix cell. `cap` and `currentCount` decide quota; `draftCount`
 * decides the other axis.
 */
function arrange(input: {
    vertical: Vertical;
    currentCount: number;
    cap: number;
    draftCount: number;
}) {
    countOwnListings.mockResolvedValue(input.currentCount);
    listOwnDraftListings.mockResolvedValue(drafts(input.draftCount));
    resolveCommerceVerticalCap.mockResolvedValue(input.cap);

    // Accommodation reads its cap from the limits the global entitlement
    // middleware already loaded, so it is seeded on the context instead.
    const ctx =
        input.vertical === 'accommodation'
            ? makeCtx([['max_accommodations', input.cap]])
            : makeCtx();

    return { ctx, vertical: input.vertical };
}

beforeEach(() => {
    vi.clearAllMocks();
});

const VERTICALS: readonly Vertical[] = ['accommodation', 'gastronomy', 'experience'];

describe.each(VERTICALS)('publish precheck decision matrix — %s', (vertical) => {
    // Cap of 3 with 1 listing = room left; cap of 3 with 3 listings = at cap.
    const WITH_ROOM = { currentCount: 1, cap: 3 };
    const AT_CAP = { currentCount: 3, cap: 3 };

    it('no drafts + room -> create_direct', async () => {
        const { ctx } = arrange({ vertical, ...WITH_ROOM, draftCount: 0 });
        const result = await resolvePublishPrecheck({ ctx, actor: ACTOR, vertical });
        expect(result.decision).toBe('create_direct');
        expect(result.hasQuota).toBe(true);
    });

    it('no drafts + at cap -> upgrade_only', async () => {
        const { ctx } = arrange({ vertical, ...AT_CAP, draftCount: 0 });
        const result = await resolvePublishPrecheck({ ctx, actor: ACTOR, vertical });
        expect(result.decision).toBe('upgrade_only');
        expect(result.hasQuota).toBe(false);
    });

    it('one draft + room -> resume_or_create', async () => {
        const { ctx } = arrange({ vertical, ...WITH_ROOM, draftCount: 1 });
        const result = await resolvePublishPrecheck({ ctx, actor: ACTOR, vertical });
        expect(result.decision).toBe('resume_or_create');
    });

    it('one draft + at cap -> resume_delete_or_upgrade', async () => {
        const { ctx } = arrange({ vertical, ...AT_CAP, draftCount: 1 });
        const result = await resolvePublishPrecheck({ ctx, actor: ACTOR, vertical });
        expect(result.decision).toBe('resume_delete_or_upgrade');
    });

    it('several drafts + room -> pick_draft_or_create', async () => {
        const { ctx } = arrange({ vertical, ...WITH_ROOM, draftCount: 2 });
        const result = await resolvePublishPrecheck({ ctx, actor: ACTOR, vertical });
        expect(result.decision).toBe('pick_draft_or_create');
    });

    it('several drafts + at cap -> pick_draft_delete_or_upgrade', async () => {
        const { ctx } = arrange({ vertical, ...AT_CAP, draftCount: 2 });
        const result = await resolvePublishPrecheck({ ctx, actor: ACTOR, vertical });
        expect(result.decision).toBe('pick_draft_delete_or_upgrade');
    });

    it('reports the counts it decided on', async () => {
        const { ctx } = arrange({ vertical, currentCount: 2, cap: 5, draftCount: 1 });
        const result = await resolvePublishPrecheck({ ctx, actor: ACTOR, vertical });
        expect(result.currentCount).toBe(2);
        expect(result.maxAllowed).toBe(5);
        expect(result.draftCount).toBe(1);
        expect(result.drafts).toHaveLength(1);
    });
});

describe('per-vertical isolation (AC-10)', () => {
    it('reads the commerce cap per vertical, never per account', async () => {
        // The same owner, at their gastronomy cap and with experience room free.
        // A pooled reading would answer the same decision for both.
        countOwnListings.mockResolvedValue(1);
        listOwnDraftListings.mockResolvedValue([]);
        resolveCommerceVerticalCap.mockImplementation(({ vertical }: { vertical: string }) =>
            vertical === 'gastronomy' ? 1 : 10
        );

        const gastronomy = await resolvePublishPrecheck({
            ctx: makeCtx(),
            actor: ACTOR,
            vertical: 'gastronomy'
        });
        const experience = await resolvePublishPrecheck({
            ctx: makeCtx(),
            actor: ACTOR,
            vertical: 'experience'
        });

        expect(gastronomy.decision).toBe('upgrade_only');
        expect(experience.decision).toBe('create_direct');
    });

    it('does not consult the commerce cap resolver for accommodation', async () => {
        const { ctx } = arrange({
            vertical: 'accommodation',
            currentCount: 0,
            cap: 3,
            draftCount: 0
        });
        await resolvePublishPrecheck({ ctx, actor: ACTOR, vertical: 'accommodation' });
        expect(resolveCommerceVerticalCap).not.toHaveBeenCalled();
    });

    it('asks the commerce resolver for the vertical it was given', async () => {
        const { ctx } = arrange({
            vertical: 'experience',
            currentCount: 0,
            cap: 3,
            draftCount: 0
        });
        await resolvePublishPrecheck({ ctx, actor: ACTOR, vertical: 'experience' });
        expect(resolveCommerceVerticalCap).toHaveBeenCalledWith(
            expect.objectContaining({ vertical: 'experience' })
        );
    });
});

describe('fail-open (AC-12, D-5)', () => {
    it('falls back to create_direct when the count cannot be resolved', async () => {
        countOwnListings.mockResolvedValue(null);
        listOwnDraftListings.mockResolvedValue([]);
        resolveCommerceVerticalCap.mockResolvedValue(1);

        const result = await resolvePublishPrecheck({
            ctx: makeCtx(),
            actor: ACTOR,
            vertical: 'gastronomy'
        });

        expect(result.decision).toBe('create_direct');
    });

    it('falls back to create_direct when the drafts cannot be resolved', async () => {
        countOwnListings.mockResolvedValue(0);
        listOwnDraftListings.mockResolvedValue(null);
        resolveCommerceVerticalCap.mockResolvedValue(1);

        const result = await resolvePublishPrecheck({
            ctx: makeCtx(),
            actor: ACTOR,
            vertical: 'gastronomy'
        });

        expect(result.decision).toBe('create_direct');
    });

    it('falls back to create_direct when the cap resolver throws', async () => {
        countOwnListings.mockResolvedValue(0);
        listOwnDraftListings.mockResolvedValue([]);
        resolveCommerceVerticalCap.mockRejectedValue(new Error('billing down'));

        const result = await resolvePublishPrecheck({
            ctx: makeCtx(),
            actor: ACTOR,
            vertical: 'gastronomy'
        });

        expect(result.decision).toBe('create_direct');
    });

    it('never throws out of the precheck', async () => {
        countOwnListings.mockRejectedValue(new Error('db down'));
        listOwnDraftListings.mockResolvedValue([]);
        resolveCommerceVerticalCap.mockResolvedValue(1);

        await expect(
            resolvePublishPrecheck({ ctx: makeCtx(), actor: ACTOR, vertical: 'accommodation' })
        ).resolves.toMatchObject({ decision: 'create_direct' });
    });
});
