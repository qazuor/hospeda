/**
 * `hasPublicPage` is BOTH clauses, on both commerce verticals (HOS-982 PR 2).
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
 * `isPublic` is visibility ALONE. Every protected route that prints something
 * for a listing also requires `lifecycleState === ACTIVE`, and the admin schemas
 * accept `lifecycleState` on its own — so a staff PATCH to INACTIVE that leaves
 * `visibility` standing produces a row where the two disagree. On that row the
 * owner's card called the listing published, mounted the QR panel, and collected
 * three contradictory sentences from three different 404s. `hasPublicPage` is
 * the field that answers the API's own question, and the INACTIVE+PUBLIC listing
 * below is the only fixture that can tell it apart from `isPublic`.
 *
 * @module test/routes/commerce-owner-listing-public-page
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Must come before any import of the package. Restores the real service-core
// for this file only — `test/setup.ts` replaces it wholesale with fakes.
vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);

import { LifecycleStatusEnum, type PermissionEnum, RoleEnum, VisibilityEnum } from '@repo/schemas';
import * as serviceCore from '@repo/service-core';
import { ExperienceService, GastronomyService } from '@repo/service-core';
import { Hono } from 'hono';
import type { AppBindings } from '../../src/types';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';

const ownerActor = {
    id: OWNER_ID,
    roles: [RoleEnum.USER] as readonly RoleEnum[],
    permissions: [] as PermissionEnum[]
};

/**
 * Three rows, and the third is the whole point.
 *
 * - `published` — ACTIVE + PUBLIC. Both fields true.
 * - `hidden` — ACTIVE + PRIVATE. Both fields false.
 * - `deactivated` — INACTIVE + PUBLIC. `isPublic` true, `hasPublicPage` false.
 *   Without this one every mapping that reads either clause alone passes.
 */
const LISTINGS = [
    {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'La Parrilla',
        slug: 'la-parrilla',
        type: 'PARRILLA',
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        visibility: VisibilityEnum.PUBLIC
    },
    {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Cafe Oculto',
        slug: 'cafe-oculto',
        type: 'CAFE',
        lifecycleState: LifecycleStatusEnum.ACTIVE,
        visibility: VisibilityEnum.PRIVATE
    },
    {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        name: 'Bodegon Pausado',
        slug: 'bodegon-pausado',
        type: 'BODEGON',
        lifecycleState: LifecycleStatusEnum.INACTIVE,
        visibility: VisibilityEnum.PUBLIC
    }
];

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
        service: GastronomyService,
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
    // Reads `@repo/db` directly, which `test/setup.ts`'s generic mock cannot
    // resolve — overridden rather than exercised, as every route-level test of
    // this family does.
    vi.spyOn(serviceCore, 'getCommerceListingSubscriptionStatuses').mockResolvedValue(new Map());
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
        expect(await listings()).toHaveLength(3);
    });

    it('answers true only when the listing is ACTIVE and PUBLIC', async () => {
        const rows = await listings();

        expect(rows[0]?.hasPublicPage).toBe(true);
        expect(rows[1]?.hasPublicPage).toBe(false);
        expect(rows[2]?.hasPublicPage).toBe(false);
    });

    it('is NOT `isPublic`, and the deactivated row is where they part', async () => {
        const rows = await listings();

        // Visibility alone still says published for the third row — that field
        // is unchanged and other consumers depend on it. The two answers
        // differing on exactly one row is the invariant: a mapping that read
        // either clause alone would make them agree everywhere.
        expect(rows[2]?.isPublic).toBe(true);
        expect(rows[2]?.hasPublicPage).toBe(false);

        expect(rows.map((row) => row.isPublic)).toStrictEqual([true, false, true]);
        expect(rows.map((row) => row.hasPublicPage)).toStrictEqual([true, false, false]);
    });
});
