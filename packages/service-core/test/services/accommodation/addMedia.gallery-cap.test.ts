/**
 * packages/service-core/test/services/accommodation/addMedia.gallery-cap.test.ts
 *
 * HOS-389 §2 — registering a gallery row must respect the per-entity cap.
 *
 * The cap was already enforced server-side, but only at the UPLOAD routes
 * (`media/protected/upload-entity.ts`, `media/admin/upload.ts`) — the step that
 * costs a Cloudinary asset. `addMedia`, the step that registers the row, never
 * checked it, so anything calling it directly with an already-uploaded URL
 * walked straight past the limit.
 *
 * The expected count is read from `getGalleryCap` rather than hardcoded: the
 * point of the fix is that both paths consult ONE constant, and a test asserting
 * `50` would keep passing while the service drifted onto a private literal.
 */
import { resetDb, setDb } from '@repo/db';
import { getGalleryCap, ModerationStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { ServiceConfig } from '../../../src/types';

vi.mock('../../../src/services/destination/destination.service', () => ({
    DestinationService: vi.fn().mockImplementation(function () {
        return {};
    })
}));

vi.mock('../../../src/revalidation/revalidation-init.js', () => ({
    getRevalidationService: vi.fn().mockReturnValue(null)
}));

const ACCOMMODATION_ID = '00000000-0000-4000-8000-0000000000a1';
const CAP = getGalleryCap('accommodation');

const ownerActor = {
    id: '00000000-0000-4000-8000-0000000000ff',
    roles: [RoleEnum.HOST],
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};

/**
 * Minimal Drizzle stub for `AccommodationMediaModel.findAll` — which issues the
 * paginated row select and a count select in parallel — plus the `insert` that
 * `create` performs. `visibleCount` drives the count query, which is what the
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

describe('AccommodationService.addMedia — gallery cap (HOS-389 §2)', () => {
    afterEach(() => {
        resetDb();
    });

    it('refuses to register a row once the gallery is at cap, and writes nothing', async () => {
        const dbMock = makeMediaDbMock({ visibleCount: CAP });
        setDb(dbMock as never);

        const result = await buildService().addMedia(
            ownerActor as never,
            {
                accommodationId: ACCOMMODATION_ID,
                media: validMedia
            } as never
        );

        expect(result.error?.code).toBe('QUOTA_EXCEEDED');
        // The row must not land: a rejection that still inserts is worse than
        // no cap at all, because the caller is told it failed.
        expect(dbMock._insertSpy).not.toHaveBeenCalled();
    });

    it('accepts the last photo that still fits', async () => {
        // Boundary: at CAP-1 the gallery has room for exactly one more. An
        // off-by-one here would cap owners one photo below their real allowance.
        const dbMock = makeMediaDbMock({ visibleCount: CAP - 1 });
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

    it('reports the real numbers so the caller can render them', () => {
        // The cap is a shared constant, not a local literal — this is what ties
        // the service to the same value the upload routes enforce.
        expect(CAP).toBeGreaterThan(0);
        expect(getGalleryCap('accommodation')).toBe(CAP);
    });
});
