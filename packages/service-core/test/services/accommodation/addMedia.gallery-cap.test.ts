/**
 * packages/service-core/test/services/accommodation/addMedia.gallery-cap.test.ts
 *
 * HOS-2495 (AC-17) — registering a gallery row is NOT capped by a literal.
 *
 * HOS-389 §2 added a literal `getGalleryCap('accommodation')` (50) here. With
 * the owner's effective photo limit enforced by step 7 on every route that
 * reaches `addMedia`, that literal only refused what the owner paid for: a
 * Premium plan (50) with one `extra-photos-20` pack (70) was cut at 51.
 */
import { resetDb, setDb } from '@repo/db';
import { ModerationStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { ServiceConfig } from '../../../src/types';

// HOS-1642: the FAQ/media writes now run inside a transaction and write an
// owner-act event to `domain_event`. Unit tests have no database, so both
// need stand-ins: the DB-level transaction fake and the domain-event double
// (same pattern as the listing owner-act tests).
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    const doubles = await import('../../helpers/owner-act-doubles');
    return {
        ...actual,
        domainEventModel: doubles.domainEventModelDouble,
        // The real models run against the setDb(...) stub, so the fake
        // transaction handle must BE that stubbed client (HOS-1642).
        withTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
            fn((actual as typeof import('@repo/db')).getDb())
        )
    };
});

vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(function () {
        return {};
    })
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

const ACCOMMODATION_ID = '00000000-0000-4000-8000-0000000000a1';
/** The literal cap this service used to enforce. */
const OLD_LITERAL_CAP = 50;

const ownerActor = {
    id: '00000000-0000-4000-8000-0000000000ff',
    roles: [RoleEnum.HOST],
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};

/**
 * Minimal Drizzle stub for `AccommodationMediaModel.findAll` — which issues the
 * paginated row select and a count select in parallel — plus `count()` (a third
 * query since HOS-791, which measures the cap on the gallery alone) and the
 * `insert` that `create` performs.
 *
 * NOTE this stub answers every projected select with the same `visibleCount`
 * regardless of the `where` it was given, so it is structurally BLIND to the
 * `isFeatured: false` filter — it can assert that the cap fires, never that the
 * cap counted the right rows. That filter is pinned instead by
 * `apps/api/test/services/photo-limit-gallery-only.guard.test.ts`; the
 * venue and experience twins, which mock at the model level, assert it
 * behaviourally. `visibleCount` drives the count query, which is what the
 * cap reads.
 */
function makeMediaDbMock({ visibleCount }: { readonly visibleCount: number }) {
    const topRow = {
        id: '00000000-0000-4000-8000-0000000000b9',
        accommodationId: ACCOMMODATION_ID,
        sortOrder: Math.max(visibleCount - 1, 0),
        state: 'visible'
    };
    /**
     * A self-returning, awaitable Drizzle-builder stub. `findAll` composes its
     * query dynamically (`.$dynamic()`) and terminates in an `await`, so every
     * builder method has to return the chain and the chain itself has to be
     * thenable — a fixed `from().where().orderBy()...` nest breaks the moment
     * the model reorders or adds a call.
     */
    const makeChain = (rows: readonly unknown[]): Record<string, unknown> => {
        const chain: Record<string, unknown> = {};
        const self = () => chain;
        for (const method of [
            'from',
            'where',
            '$dynamic',
            'orderBy',
            'limit',
            'offset',
            'groupBy',
            'having',
            'innerJoin',
            'leftJoin'
        ]) {
            chain[method] = self;
        }
        chain.execute = () => Promise.resolve([...rows]);
        // biome-ignore lint/suspicious/noThenProperty: intentional awaitable mock builder
        chain.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
            Promise.resolve([...rows]).then(resolve, reject);
        return chain;
    };

    const rowQuery = makeChain(visibleCount > 0 ? [topRow] : []);
    const countQuery = makeChain([{ count: visibleCount }]);
    const insertSpy = vi.fn(() => ({
        values: () => ({
            returning: () =>
                Promise.resolve([
                    {
                        ...topRow,
                        id: '00000000-0000-4000-8000-0000000000bb',
                        sortOrder: visibleCount
                    }
                ])
        })
    }));
    return {
        select: vi.fn((projection?: unknown) => (projection ? countQuery : rowQuery)),
        insert: insertSpy,
        _insertSpy: insertSpy
    };
}

function buildService() {
    const accommodationModel = {
        findById: vi.fn().mockResolvedValue({
            id: ACCOMMODATION_ID,
            ownerId: ownerActor.id,
            slug: 'cabana-del-rio'
        })
    };
    return new AccommodationService({} as ServiceConfig, accommodationModel as never);
}

const validMedia = {
    url: 'https://res.cloudinary.com/demo/image/upload/nueva.jpg',
    publicId: 'hospeda/dev/nueva',
    moderationState: ModerationStatusEnum.APPROVED
};

describe('AccommodationService.addMedia — no literal gallery cap (HOS-2495)', () => {
    afterEach(() => {
        resetDb();
    });

    it.each([
        OLD_LITERAL_CAP,
        69
    ])('registers a row with %s gallery photos already visible (past the old literal)', async (visibleCount) => {
        const dbMock = makeMediaDbMock({ visibleCount });
        setDb(dbMock as never);

        const result = await buildService().addMedia(
            ownerActor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                media: validMedia
            } as never
        );

        expect(result.error).toBeUndefined();
        expect(dbMock._insertSpy).toHaveBeenCalledTimes(1);
    });

    it('accepts a photo into an empty gallery', async () => {
        const dbMock = makeMediaDbMock({ visibleCount: 0 });
        setDb(dbMock as never);

        const result = await buildService().addMedia(
            ownerActor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                media: validMedia
            } as never
        );

        expect(result.error).toBeUndefined();
        expect(dbMock._insertSpy).toHaveBeenCalledTimes(1);
    });
});
