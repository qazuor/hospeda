/**
 * `GET /protected/{venues,experiences}/mine` carries each unpublished listing's
 * unmet publish requirements (HOS-2484, AC-7 «one list request»).
 *
 * Mounts the two routes directly with an actor injected, like
 * `listing-owner-listing-public-page.test.ts` (whose header explains why the
 * `initApp()` listMine suites never reach the handler). The batch evaluator is
 * mocked so this pins the ROUTE wiring: which listings are asked about, and how
 * the answer lands in the summaries. The evaluator's own rules are covered by
 * `test/services/listing-publication/*`.
 *
 * @module test/routes/listing-owner-listing-missing-requirements
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Must come before any import of the package. Restores the real service-core
// for this file only — `test/setup.ts` replaces it wholesale with fakes.
vi.mock(
    '@repo/service-core',
    async (importOriginal) => await importOriginal<Record<string, unknown>>()
);

const evaluateMock = vi.fn();
vi.mock('../../src/services/listing-publication/listing-publish-completeness-batch', () => ({
    evaluateListingsPublishCompleteness: (input: unknown) => evaluateMock(input)
}));

import { type PermissionEnum, PublicationStatusEnum, RoleEnum } from '@repo/schemas';
import { ExperienceService, VenueService } from '@repo/service-core';
import { Hono } from 'hono';
import type { AppBindings } from '../../src/types';

const ownerActor = {
    id: '11111111-1111-4111-8111-111111111111',
    roles: [RoleEnum.USER] as readonly RoleEnum[],
    permissions: [] as PermissionEnum[]
};

const PUBLISHED_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa0';
const DRAFT_INCOMPLETE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const DRAFT_COMPLETE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const PURGED_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';

const LISTINGS = [
    { id: PUBLISHED_ID, publicationStatus: PublicationStatusEnum.PUBLISHED },
    { id: DRAFT_INCOMPLETE_ID, publicationStatus: PublicationStatusEnum.DRAFT },
    { id: DRAFT_COMPLETE_ID, publicationStatus: PublicationStatusEnum.DRAFT },
    { id: PURGED_ID, publicationStatus: PublicationStatusEnum.PURGED }
].map((row, index) => ({
    ...row,
    name: `Listing ${index}`,
    slug: `listing-${index}`,
    type: 'PARRILLA'
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
        label: 'venue',
        service: VenueService,
        importRoute: async () =>
            (await import('../../src/routes/venue/protected/listMine.js')).protectedListMyVenueRoute
    },
    {
        label: 'experience',
        service: ExperienceService,
        importRoute: async () =>
            (await import('../../src/routes/experience/protected/listMine.js'))
                .protectedListMyExperienceRoute
    }
] as const;

describe.each(CASES)('GET /protected/$label/mine — missingRequirements', ({
    label,
    service,
    importRoute
}) => {
    beforeEach(() => {
        vi.restoreAllMocks();
        evaluateMock.mockReset();
        vi.spyOn(service.prototype, 'listOwn').mockResolvedValue({
            data: { listings: LISTINGS }
        } as never);
    });

    async function rows(): Promise<Array<Record<string, unknown>>> {
        const res = await buildApp(await importRoute()).request('/mine');
        expect(res.status).toBe(200);
        const body = (await res.json()) as { data: { listings: Array<Record<string, unknown>> } };
        return body.data.listings;
    }

    it('asks once, about the unpublished listings only, and maps the answer', async () => {
        // Arrange
        evaluateMock.mockResolvedValue(new Map([[DRAFT_INCOMPLETE_ID, ['photos', 'hours']]]));

        // Act
        const listings = await rows();

        // Assert: one batch call, for the two drafts and nothing else.
        expect(evaluateMock).toHaveBeenCalledTimes(1);
        const input = evaluateMock.mock.calls[0]?.[0] as {
            vertical: string;
            listings: Array<{ id: string }>;
        };
        expect(input.vertical).toBe(label);
        expect(input.listings.map((row) => row.id)).toStrictEqual([
            DRAFT_INCOMPLETE_ID,
            DRAFT_COMPLETE_ID
        ]);
        expect(listings.map((row) => row.missingRequirements)).toStrictEqual([
            undefined,
            ['photos', 'hours'],
            [],
            undefined
        ]);
    });

    it('omits the field (unknown, never «complete») when the read fails', async () => {
        // Arrange
        evaluateMock.mockRejectedValue(new Error('db down'));

        // Act
        const listings = await rows();

        // Assert
        expect(listings).toHaveLength(LISTINGS.length);
        for (const row of listings) expect(row).not.toHaveProperty('missingRequirements');
    });
});
