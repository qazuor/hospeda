/**
 * @file publish-precheck.service.test.ts
 * @description The decision-matrix cells that survive the legacy billing
 * demolition (HOS-1416), across all three publish verticals (HOS-1156 T-011),
 * plus the AC-12 fail-open.
 *
 * Quota uses PB1's published count and effective publication limit. These tests assert the composed
 * DECISION, never the shape of a query — `apps/api`'s setup mocks `@repo/db`
 * wholesale, so an assertion about what SQL ran here would be vacuous.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const listOwnDraftListings = vi.fn();
const countAllListings = vi.fn();
const countPublished = vi.fn();
const readPublishLimit = vi.fn();

vi.mock('../../src/services/publish-listing-reads', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../src/services/publish-listing-reads')>();
    return {
        ...actual,
        countOwnListings: (...args: unknown[]) => countAllListings(...args),
        listOwnDraftListings: (...args: unknown[]) => listOwnDraftListings(...args)
    };
});

vi.mock('../../src/utils/listing-publication/ports', () => ({
    getListingPublicationPorts: () => ({
        unitOfWork: {
            runLocked: (_args: unknown, work: (tx: unknown) => Promise<unknown>) =>
                work({ countPublished, readPublishLimit })
        }
    })
}));

import { resolvePublishPrecheck } from '../../src/services/publish-precheck.service';

type Vertical = 'accommodation' | 'gastronomy' | 'experience';

const ACTOR = { id: 'owner-1', roles: [], permissions: [] } as never;

/** The precheck no longer reads or writes limit context (HOS-1416). */
function makeCtx() {
    const store = new Map<string, unknown>();
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

function arrange(input: {
    vertical: Vertical;
    currentCount: number;
    draftCount: number;
    maxAllowed?: number;
}) {
    countPublished.mockResolvedValue(input.currentCount);
    countAllListings.mockResolvedValue(input.currentCount + input.draftCount);
    readPublishLimit.mockResolvedValue(input.maxAllowed ?? 2);
    listOwnDraftListings.mockResolvedValue(drafts(input.draftCount));
    return { ctx: makeCtx(), vertical: input.vertical };
}

beforeEach(() => {
    vi.clearAllMocks();
});

const VERTICALS: readonly Vertical[] = ['accommodation', 'gastronomy', 'experience'];

describe.each(VERTICALS)('publish precheck decision matrix — %s', (vertical) => {
    it('no drafts -> create_direct', async () => {
        const { ctx } = arrange({ vertical, currentCount: 1, draftCount: 0 });
        const result = await resolvePublishPrecheck({ ctx, actor: ACTOR, vertical });
        expect(result.decision).toBe('create_direct');
        expect(result.hasQuota).toBe(true);
    });

    it('one draft -> resume_or_create', async () => {
        const { ctx } = arrange({ vertical, currentCount: 1, draftCount: 1 });
        const result = await resolvePublishPrecheck({ ctx, actor: ACTOR, vertical });
        expect(result.decision).toBe('resume_or_create');
    });

    it('several drafts -> pick_draft_or_create', async () => {
        const { ctx } = arrange({ vertical, currentCount: 1, draftCount: 2 });
        const result = await resolvePublishPrecheck({ ctx, actor: ACTOR, vertical });
        expect(result.decision).toBe('pick_draft_or_create');
    });

    it('one draft with no published listings retains quota at trial limit 1', async () => {
        const { ctx } = arrange({ vertical, currentCount: 0, draftCount: 1, maxAllowed: 1 });
        const result = await resolvePublishPrecheck({ ctx, actor: ACTOR, vertical });
        expect(result.currentCount).toBe(0);
        expect(result.maxAllowed).toBe(1);
        expect(result.hasQuota).toBe(true);
        expect(result.draftCount).toBe(1);
        expect(result.drafts).toHaveLength(1);
    });

    it('a published listing fills trial limit 1', async () => {
        const { ctx } = arrange({ vertical, currentCount: 1, draftCount: 0, maxAllowed: 1 });
        const result = await resolvePublishPrecheck({ ctx, actor: ACTOR, vertical });
        expect(result.currentCount).toBe(1);
        expect(result.hasQuota).toBe(false);
    });
});

describe('fail-open (AC-12, D-5)', () => {
    it('falls back to create_direct when the count cannot be resolved', async () => {
        countPublished.mockResolvedValue(null);
        listOwnDraftListings.mockResolvedValue([]);

        const result = await resolvePublishPrecheck({
            ctx: makeCtx(),
            actor: ACTOR,
            vertical: 'gastronomy'
        });

        expect(result.decision).toBe('create_direct');
    });

    it('falls back to create_direct when the drafts cannot be resolved', async () => {
        countPublished.mockResolvedValue(0);
        listOwnDraftListings.mockResolvedValue(null);

        const result = await resolvePublishPrecheck({
            ctx: makeCtx(),
            actor: ACTOR,
            vertical: 'gastronomy'
        });

        expect(result.decision).toBe('create_direct');
    });

    it('never throws out of the precheck', async () => {
        countPublished.mockRejectedValue(new Error('db down'));
        listOwnDraftListings.mockResolvedValue([]);

        await expect(
            resolvePublishPrecheck({ ctx: makeCtx(), actor: ACTOR, vertical: 'accommodation' })
        ).resolves.toMatchObject({ decision: 'create_direct' });
    });
});

describe('PRE_TRIAL without effective max_accommodations', () => {
    it('keeps the precheck fail-open when readPublishLimit resolves to no limit', async () => {
        countPublished.mockResolvedValue(0);
        readPublishLimit.mockResolvedValue(0);
        listOwnDraftListings.mockResolvedValue(drafts(1));
        const result = await resolvePublishPrecheck({
            ctx: makeCtx(),
            actor: ACTOR,
            vertical: 'accommodation'
        });
        expect(result).toMatchObject({
            hasQuota: true,
            decision: 'resume_or_create',
            maxAllowed: -1
        });
    });
});
