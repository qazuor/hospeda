/**
 * `hasPublicPage` is the publication state, on both gastronomy and experience verticals
 * (HOS-982 PR 2; V6.9b).
 *
 * ---
 * WHY THIS FILE EXISTS RATHER THAN AN ASSERTION IN THE listMine SUITES
 *
 * The mapping assertions belong in `routes/{gastronomy,experience}/protected/
 * listMine.test.ts`, and they were written there first. They do not run. Those
 * suites drive the whole app through `initApp()` with mock-actor headers, never
 * reach `listOwn`, and guard every assertion behind an `if (!capturedActor)
 * return;` — so the test passes without executing any of it. Measured rather
 * than assumed: replacing `toHaveLength(3)` with `toHaveLength(99)` in that file
 * leaves all three of its tests green.
 *
 * That escape hatch predates this change and is not this PR's to remove. What is
 * this PR's is not shipping a fix whose only test cannot fail. So the mapping is
 * exercised here, mounting the two routes directly with an actor injected —
 * the shape `listing-qr-code.test.ts` uses, which demonstrably reaches handlers.
 *
 * ## What is being pinned
 *
 * Since V6.9b (HOS-1641) both `isPublic` and `hasPublicPage` read the single
 * publication state: they are true for a `PUBLISHED` listing and false for each
 * of the other five. Every protected route that prints something for a listing
 * answers 404 for any state but `PUBLISHED`, so a card that called one of those
 * listings public would mount the QR panel and collect 404s. The summary also
 * echoes `publicationStatus` so the card can tell the five apart (H3).
 *
 * @module test/routes/listing-owner-listing-public-page
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Must come before any import of the package. Restores the real service-core
// for this file only — `test/setup.ts` replaces it wholesale with fakes.
vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);

import { type PermissionEnum, PublicationStatusEnum, RoleEnum } from '@repo/schemas';
import { ExperienceService, VenueService } from '@repo/service-core';
import { Hono } from 'hono';
import type { AppBindings } from '../../src/types';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';

const ownerActor = {
    id: OWNER_ID,
    roles: [RoleEnum.USER] as readonly RoleEnum[],
    permissions: [] as PermissionEnum[]
};

/** One row per publication state; only the first is public. */
const STATES = [
    PublicationStatusEnum.PUBLISHED,
    PublicationStatusEnum.DRAFT,
    PublicationStatusEnum.UNPUBLISHED_BY_BILLING,
    PublicationStatusEnum.ARCHIVED,
    PublicationStatusEnum.MODERATED,
    PublicationStatusEnum.PURGED
] as const;

const LISTINGS = STATES.map((publicationStatus, index) => ({
    id: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa${index}`,
    name: `Listing ${publicationStatus}`,
    slug: `listing-${publicationStatus.toLowerCase()}`,
    type: 'PARRILLA',
    publicationStatus
}));

/** Mounts one route with `ownerActor` injected. */
function buildApp(
    route: ReturnType<typeof import('../../src/utils/create-app.js').createRouter>
): Hono<AppBindings> {
    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('actor', ownerActor as never);
        return next();
    });
    app.route('/', route);
    return app;
}

const CASES = [
    {
        label: 'gastronomy',
        service: VenueService,
        importRoute: async () => {
            const mod = await import('../../src/routes/gastronomy/protected/listMine.js');
            return mod.protectedListMyGastronomyRoute;
        }
    },
    {
        label: 'experience',
        service: ExperienceService,
        importRoute: async () => {
            const mod = await import('../../src/routes/experience/protected/listMine.js');
            return mod.protectedListMyExperienceRoute;
        }
    }
] as const;

beforeEach(() => {
    vi.restoreAllMocks();
});

describe.each(CASES)('GET /protected/$label/mine — hasPublicPage', ({ service, importRoute }) => {
    beforeEach(() => {
        vi.spyOn(service.prototype, 'listOwn').mockResolvedValue({
            data: { listings: LISTINGS }
        } as never);
    });

    async function listings(): Promise<Array<Record<string, unknown>>> {
        const res = await buildApp(await importRoute()).request('/mine');
        expect(res.status).toBe(200);
        const body = (await res.json()) as {
            data: { listings: Array<Record<string, unknown>> };
        };
        return body.data.listings;
    }

    it('reaches the mapping at all', async () => {
        // The assertion the sibling suites cannot make. Everything below is
        // meaningless without it, and it is what tells a future reader that a
        // green run here means the code ran.
        expect(await listings()).toHaveLength(STATES.length);
    });

    it('answers hasPublicPage true only for a PUBLISHED listing', async () => {
        const rows = await listings();

        expect(rows.map((row) => row.hasPublicPage)).toStrictEqual([
            true,
            false,
            false,
            false,
            false,
            false
        ]);
    });

    it('answers isPublic true only for a PUBLISHED listing, like hasPublicPage', async () => {
        const rows = await listings();

        expect(rows.map((row) => row.isPublic)).toStrictEqual([
            true,
            false,
            false,
            false,
            false,
            false
        ]);
    });

    it('echoes the publication state of every listing', async () => {
        const rows = await listings();

        expect(rows.map((row) => row.publicationStatus)).toStrictEqual([...STATES]);
    });
});
