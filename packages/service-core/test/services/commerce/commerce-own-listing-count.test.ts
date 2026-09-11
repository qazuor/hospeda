/**
 * `countOwn` — the owner-tier listing count a commerce quota is allowed to read
 * (HOS-1247).
 *
 * ---
 * WHAT THIS FILE IS DEFENDING, AND WHY IT NEEDS BOTH HALVES
 *
 * A commerce quota was measured on staging counting THREE listings as zero: an
 * account holding one gastronomy listing on a plan of one created two more, each
 * answering 201, with no `X-Usage-Warning` header and no `commerce listing limit
 * reached` line anywhere in the log. Nothing was mis-wired — the gate ran, read
 * a count of `0`, compared `0 < 1`, and correctly allowed the request.
 *
 * The count was zero because it went through `count()`, whose `_executeCount`
 * mirrors the PUBLIC search and therefore forces `visibility: PUBLIC` +
 * `lifecycleState: ACTIVE`. Every listing an owner creates through the
 * self-service route starts `PRIVATE`/`DRAFT` (`commerce/protected/create.ts`
 * D-3). So the one query a quota depends on excluded, by construction, exactly
 * the rows the quota exists to count.
 *
 * Hence two assertions per vertical, and neither is redundant:
 *
 *  1. **`countOwn` does not narrow by visibility or lifecycle.** This is the fix.
 *  2. **`_executeCount` still DOES.** This is the trap. It is asserted here on
 *     purpose rather than left to the public-search suite: without it, someone
 *     "simplifying" `countOwn` back into `count()` sees every test in this file
 *     pass, and the quota silently stops counting drafts again.
 *
 * The model is a spy throughout: the decision under test is WHICH PREDICATE
 * reaches the database, and the counting primitive itself is covered by
 * `@repo/db`'s own suite.
 */

import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExperienceService } from '../../../src/services/experience/experience.service';
import { GastronomyService } from '../../../src/services/gastronomy/gastronomy.service';
import type { Actor } from '../../../src/types';

const OWNER_ID = '00000000-0000-4000-a000-000000000002';

/** The account the cap exists for: a commerce owner, no staff permission. */
const ownerActor: Actor = {
    id: OWNER_ID,
    roles: [RoleEnum.COMMERCE_OWNER],
    permissions: []
};

/**
 * The `any` seam the sibling service suites use to inject a model spy: `model`
 * is a protected readonly field on both services.
 */
type AnyService = any;

/** A model spy whose `count` answers a fixed number. */
function makeModel(count: number) {
    return {
        count: vi.fn().mockResolvedValue(count),
        findAll: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        findAllWithRelations: vi.fn().mockResolvedValue({ items: [], total: 0 })
    };
}

function makeGastronomyService(count = 0) {
    const service: AnyService = new GastronomyService({});
    const model = makeModel(count);
    service.model = model;
    return { service: service as GastronomyService, model };
}

function makeExperienceService(count = 0) {
    const service: AnyService = new ExperienceService({});
    const model = makeModel(count);
    service.model = model;
    return { service: service as ExperienceService, model };
}

beforeEach(() => {
    vi.restoreAllMocks();
});

describe("countOwn — counts the owner's listings in EVERY state (HOS-1247)", () => {
    it('gastronomy: scopes to the owner and narrows by nothing else', async () => {
        const { service, model } = makeGastronomyService(3);

        const result = await service.countOwn(ownerActor);

        expect(result.data?.count).toBe(3);

        const where = model.count.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(where).toMatchObject({ ownerId: OWNER_ID, deletedAt: null });
        // The whole point. A DRAFT/PRIVATE listing occupies a quota slot, so a
        // predicate that names either column here would reproduce the bug.
        expect(where).not.toHaveProperty('visibility');
        expect(where).not.toHaveProperty('lifecycleState');
    });

    it('experience: scopes to the owner and narrows by nothing else', async () => {
        const { service, model } = makeExperienceService(2);

        const result = await service.countOwn(ownerActor);

        expect(result.data?.count).toBe(2);

        const where = model.count.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(where).toMatchObject({ ownerId: OWNER_ID, deletedAt: null });
        expect(where).not.toHaveProperty('visibility');
        expect(where).not.toHaveProperty('lifecycleState');
    });

    it('refuses an actor with no id rather than counting the whole platform', async () => {
        const { service, model } = makeGastronomyService(99);

        const result = await service.countOwn({ id: '', roles: [], permissions: [] } as Actor);

        expect(result.error?.code).toBe(ServiceErrorCode.FORBIDDEN);
        // An unscoped `ownerId: undefined` would count every listing there is.
        expect(model.count).not.toHaveBeenCalled();
    });
});

describe('the trap countOwn exists to avoid: _executeCount forces PUBLIC + ACTIVE', () => {
    it('gastronomy: the public count narrows by visibility AND lifecycle', async () => {
        const { service, model } = makeGastronomyService(0);

        await (
            service as unknown as { _executeCount: (...args: unknown[]) => unknown }
        )._executeCount({ ownerId: OWNER_ID }, ownerActor, {});

        const where = model.count.mock.calls[0]?.[0] as Record<string, unknown>;
        // Correct for a public search total — and fatal for a quota, which is
        // why the quota no longer reads through here.
        expect(where).toMatchObject({
            ownerId: OWNER_ID,
            visibility: 'PUBLIC',
            lifecycleState: 'ACTIVE'
        });
    });

    it('experience: the public count narrows by visibility AND lifecycle', async () => {
        const { service, model } = makeExperienceService(0);

        await (
            service as unknown as { _executeCount: (...args: unknown[]) => unknown }
        )._executeCount({ ownerId: OWNER_ID }, ownerActor, {});

        const where = model.count.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(where).toMatchObject({
            ownerId: OWNER_ID,
            visibility: 'PUBLIC',
            lifecycleState: 'ACTIVE'
        });
    });
});
