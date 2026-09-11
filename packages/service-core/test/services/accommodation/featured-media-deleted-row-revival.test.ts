/**
 * packages/service-core/test/services/accommodation/featured-media-deleted-row-revival.test.ts
 *
 * HOS-803 C-1 — the cover swap must not leave a row that can be re-featured.
 *
 * ## The attack this file exists to reject
 *
 * `addFeaturedMedia` is quota-neutral WITHIN its transaction: one row into the
 * featured slot, one out of the table. Every other test in this suite proves
 * that, and all of them are honest. None of them could see this, because the
 * evasion is not inside the transaction — it is in the residue the transaction
 * leaves for the NEXT request:
 *
 *   1. `softDelete` patches `deletedAt`/`updatedAt`/`deletedById` and NOTHING
 *      else, so the released cover keeps `is_featured = true` and
 *      `state = 'visible'`.
 *   2. `findById` does not filter soft-deletes (documented on `findByIds`).
 *   3. `setFeaturedMedia` resolved its target with `findById` and checked only
 *      existence and ownership — never `deletedAt`, unlike `updateMedia`, which
 *      has always checked it.
 *   4. The partial unique index is `WHERE is_featured = true AND deleted_at IS
 *      NULL`, so featuring a deleted row does not violate it.
 *
 * Chained: upload a new cover (the old one is deleted but still flagged), then
 * re-feature that deleted id. The live cover is demoted into the gallery to
 * make room for a row that no longer exists — gallery +1, and the listing is
 * left with no live cover at all. Repeat for +1 per cycle, uncapped.
 *
 * ## Why this was NEW rather than pre-existing
 *
 * The zombie flag and the missing guard both predate this work. What did not
 * exist was a way to hold a zombie AND a live cover at the same time without
 * paying for one: reaching that state used to require `addMedia`, which charges
 * a gallery slot and refuses at the cap. Creating a live featured row for free
 * is exactly what this feature added, and it is what turns two dormant flaws
 * into a working quota evasion — the property the ticket's rejected option (a)
 * was rejected for.
 *
 * ## Why the fake is written the way it is
 *
 * The model fake mirrors `BaseModelImpl` semantics rather than convenient ones:
 * `softDelete` stamps timestamps ONLY, and `findById` returns soft-deleted rows.
 * The earlier fake cleared `isFeatured` inside its own delete helper — a world
 * where the zombie cannot exist, which is precisely why no test could imagine
 * it. A fake that is kinder than production hides the bugs production has.
 */

// ---- vi.mock MUST be first — hoisted by vitest ---------------------------

const fakeTable = {
    rows: [] as Record<string, unknown>[]
};

const mediaModelFake = {
    /** Mirrors BaseModelImpl.findById: does NOT filter soft-deletes. */
    findById: async (id: string) => fakeTable.rows.find((r) => r.id === id) ?? null,

    /** Mirrors the model: live featured row only (`deleted_at IS NULL`). */
    findFeatured: async ({ accommodationId }: { accommodationId: string }) =>
        fakeTable.rows.find(
            (r) =>
                r.accommodationId === accommodationId &&
                r.isFeatured === true &&
                r.deletedAt === null
        ) ?? null,

    count: async (where: Record<string, unknown>) =>
        fakeTable.rows.filter((r) =>
            Object.entries(where).every(([k, v]) => (v === null ? r[k] === null : r[k] === v))
        ).length,

    findAll: async (where: Record<string, unknown>) => {
        const items = fakeTable.rows
            .filter((r) =>
                Object.entries(where).every(([k, v]) => (v === null ? r[k] === null : r[k] === v))
            )
            .sort((a, b) => (b.sortOrder as number) - (a.sortOrder as number));
        return { items, total: items.length };
    },

    create: async (data: Record<string, unknown>) => {
        const row = {
            id: `00000000-0000-4000-8000-0000000002${String(fakeTable.rows.length).padStart(2, '0')}`,
            deletedAt: null,
            ...data
        };
        fakeTable.rows.push(row);
        return row;
    },

    update: async (where: Record<string, unknown>, patch: Record<string, unknown>) => {
        const row = fakeTable.rows.find((r) => r.id === where.id);
        if (row) Object.assign(row, patch);
        return row ?? null;
    },

    /**
     * Mirrors BaseModelImpl.softDelete EXACTLY: stamps the timestamps and the
     * actor, and touches nothing else. It does NOT clear `isFeatured` or move
     * `state` — that is the whole reason C-1 was reachable.
     */
    softDelete: async (where: Record<string, unknown>, deletedById: string | null) => {
        const row = fakeTable.rows.find((r) => r.id === where.id);
        if (!row) return 0;
        row.deletedAt = new Date();
        row.updatedAt = new Date();
        row.deletedById = deletedById;
        return 1;
    }
};

vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/db')>();
    return {
        ...actual,
        AccommodationMediaModel: vi.fn(function () {
            return mediaModelFake;
        }),
        withTransaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({ __tx: true }))
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

// ---------------------------------------------------------------------------

import { ModerationStatusEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccommodationService } from '../../../src/services/accommodation/accommodation.service';
import type { ServiceConfig } from '../../../src/types';

const ACCOMMODATION_ID = '00000000-0000-4000-8000-0000000000a1';
const OWNER_ID = '00000000-0000-4000-8000-0000000000ff';
const ORIGINAL_COVER_ID = '00000000-0000-4000-8000-0000000000c0';
/** Fixture ids must be real UUIDs — `mediaId` is UUID-validated on the way in. */
const galleryId = (i: number) => `00000000-0000-4000-8000-0000000001${String(i).padStart(2, '0')}`;

/** The plan the reported bug was filed against. */
const PLAN_CAP = 15;

const PAYLOAD = {
    url: 'https://res.cloudinary.com/demo/image/upload/new-cover.jpg',
    publicId: 'hospeda/dev/new-cover',
    moderationState: ModerationStatusEnum.APPROVED
};

const ownerActor = {
    id: OWNER_ID,
    roles: [RoleEnum.HOST],
    permissions: [PermissionEnum.ACCOMMODATION_UPDATE_OWN]
};

function buildService() {
    const accommodationModel = {
        findById: vi.fn().mockResolvedValue({
            id: ACCOMMODATION_ID,
            ownerId: OWNER_ID,
            visibility: 'PRIVATE',
            lifecycleState: 'DRAFT'
        })
    };
    return new AccommodationService({} as ServiceConfig, accommodationModel as never);
}

/** Visible, non-featured, not soft-deleted — what every gallery cap measures. */
function liveGalleryCount(): number {
    return fakeTable.rows.filter(
        (r) => r.state === 'visible' && r.isFeatured === false && r.deletedAt === null
    ).length;
}

/** Featured AND not soft-deleted — what the partial unique index constrains. */
function liveFeaturedCount(): number {
    return fakeTable.rows.filter((r) => r.isFeatured === true && r.deletedAt === null).length;
}

beforeEach(() => {
    vi.clearAllMocks();

    // A gallery sitting exactly at the plan cap, plus a cover.
    fakeTable.rows = [];
    for (let i = 0; i < PLAN_CAP; i++) {
        fakeTable.rows.push({
            id: galleryId(i),
            accommodationId: ACCOMMODATION_ID,
            url: `https://cdn.example.com/${i}.jpg`,
            moderationState: ModerationStatusEnum.APPROVED,
            state: 'visible',
            isFeatured: false,
            sortOrder: i,
            deletedAt: null
        });
    }
    fakeTable.rows.push({
        id: ORIGINAL_COVER_ID,
        accommodationId: ACCOMMODATION_ID,
        url: 'https://cdn.example.com/cover.jpg',
        moderationState: ModerationStatusEnum.APPROVED,
        state: 'visible',
        isFeatured: true,
        sortOrder: PLAN_CAP,
        deletedAt: null
    });
});

describe('HOS-803 C-1 — a released cover cannot be re-featured', () => {
    it('leaves no featured flag on the row it releases', async () => {
        const service = buildService();

        await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: PAYLOAD,
            planGalleryCap: PLAN_CAP
        });

        const released = fakeTable.rows.find((r) => r.id === ORIGINAL_COVER_ID);
        expect(released?.deletedAt).toBeInstanceOf(Date);
        // A deleted row that still claims to be the cover is a live target for
        // `setFeaturedMedia`, and the partial unique index cannot see it
        // because the index ignores deleted rows.
        expect(released?.isFeatured).toBe(false);
    });

    it('refuses to re-feature the released row — NOT_FOUND, like updateMedia', async () => {
        const service = buildService();

        await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: PAYLOAD,
            planGalleryCap: PLAN_CAP
        });

        const result = await service.setFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            mediaId: ORIGINAL_COVER_ID
        });

        // A deleted row is not a row. `updateMedia` has always answered this
        // way; `setFeatured` did not, and that gap is half the evasion.
        expect(result.error?.code).toBe('NOT_FOUND');
    });

    it('does not grow the gallery through the upload → re-feature chain', async () => {
        const service = buildService();

        expect(liveGalleryCount()).toBe(PLAN_CAP);

        // Step 2 of the attack: a new cover, quota-free by design.
        await service.addFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            media: PAYLOAD,
            planGalleryCap: PLAN_CAP
        });
        expect(liveGalleryCount()).toBe(PLAN_CAP);

        // Step 3: re-feature the row step 2 released. If this is allowed, the
        // live cover is demoted into the gallery to make room for a row that
        // does not exist — +1, and no live cover left at all.
        await service.setFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            mediaId: ORIGINAL_COVER_ID
        });

        expect(liveGalleryCount()).toBe(PLAN_CAP);
        expect(liveFeaturedCount()).toBe(1);
    });

    it('holds the cap across ten upload → re-feature cycles', async () => {
        const service = buildService();

        for (let cycle = 0; cycle < 10; cycle++) {
            const before = await service.addFeaturedMedia(ownerActor, {
                accommodationId: ACCOMMODATION_ID,
                media: PAYLOAD,
                planGalleryCap: PLAN_CAP
            });
            expect(before.error).toBeUndefined();

            // Try to revive EVERY row the chain has released so far, not just
            // the last: each cycle leaves another deleted candidate behind.
            for (const dead of fakeTable.rows.filter((r) => r.deletedAt !== null)) {
                await service.setFeaturedMedia(ownerActor, {
                    accommodationId: ACCOMMODATION_ID,
                    mediaId: dead.id as string
                });
            }

            // Asserted inside the loop: a breach on cycle 2 must not be masked
            // by the state on cycle 10.
            expect(liveGalleryCount()).toBe(PLAN_CAP);
            expect(liveFeaturedCount()).toBe(1);
        }
    });

    it('still allows promoting a LIVE gallery photo — the fix is not a blanket refusal', async () => {
        const service = buildService();

        const result = await service.setFeaturedMedia(ownerActor, {
            accommodationId: ACCOMMODATION_ID,
            mediaId: galleryId(3)
        });

        // The deletedAt guard must reject deleted rows only. Promotion of a
        // live gallery photo is untouched by this work and stays quota-neutral:
        // the old cover comes down as the promoted one goes up.
        expect(result.error).toBeUndefined();
        expect(liveFeaturedCount()).toBe(1);
        expect(fakeTable.rows.find((r) => r.id === galleryId(3))?.isFeatured).toBe(true);
        expect(fakeTable.rows.find((r) => r.id === ORIGINAL_COVER_ID)?.isFeatured).toBe(false);
        expect(liveGalleryCount()).toBe(PLAN_CAP);
    });
});
