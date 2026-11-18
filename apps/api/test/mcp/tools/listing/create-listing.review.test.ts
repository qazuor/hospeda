/**
 * HOS-2329 — `create_listing` review fixes: the city-only destination (L-4) and the commit-side revalidation run as a
 * dry run before any token exists (L-6). Same mocks as `create-listing.test.ts`.
 *
 * @module test/mcp/tools/listing/create-listing.review
 */

import {
    AccommodationCreateDraftHttpSchema,
    ExperienceAdminCreateInputCheckedSchema,
    ServiceErrorCode,
    VenueAdminCreateInputSchema,
    VerticalEnum
} from '@repo/schemas';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateCreateBody } from '../../../../src/mcp/tools/listing/create-listing-steps';
import { validateApiEnv } from '../../../../src/utils/env';
import {
    actorFor,
    givenCreateServices,
    givenDestinations,
    givenPrecheck,
    makeFakeRedis,
    mocks,
    PROVINCE_DESTINATION_ID,
    previewToken,
    run,
    VALID_INPUT,
    VERTICALS
} from './create-listing.harness';

vi.mock('../../../../src/utils/listing-access/ports', async () => {
    const { mocks } = await import('./create-listing.harness');
    return {
        getListingAccessPorts: () => ({
            loadFacts: mocks.loadFacts,
            billing: { coverage: mocks.coverage },
            effectiveSet: mocks.effectiveSet,
            preTrialDraftLimits: mocks.preTrialDraftLimits
        })
    };
});
vi.mock('../../../../src/middlewares/cache', async (importOriginal) => {
    const { mocks } = await import('./create-listing.harness');
    const actual = await importOriginal<typeof import('../../../../src/middlewares/cache')>();
    return { ...actual, invalidateCacheByPathPrefix: mocks.invalidateCache };
});
vi.mock('../../../../src/lib/analytics-client', async (importOriginal) => {
    const { mocks } = await import('./create-listing.harness');
    const actual = await importOriginal<typeof import('../../../../src/lib/analytics-client')>();
    return { ...actual, captureServerAnalyticsEvent: mocks.analytics };
});
vi.mock('../../../../src/services/publish-precheck.service', async () => {
    const { mocks } = await import('./create-listing.harness');
    return { resolvePublishPrecheck: mocks.precheck };
});
vi.mock('../../../../src/utils/redis', async () => {
    const { mocks } = await import('./create-listing.harness');
    return { getRedisClient: vi.fn(async () => mocks.redis) };
});
// Hoisted, not read from the harness: the harness imports @repo/service-core itself.
const { conflict, decideSpy } = vi.hoisted(() => ({ conflict: vi.fn(), decideSpy: vi.fn() }));
vi.mock('../../../../src/middlewares/listing-access', async (importOriginal) => {
    const actual =
        await importOriginal<typeof import('../../../../src/middlewares/listing-access')>();
    decideSpy.mockImplementation(actual.decideListingAccess);
    return { ...actual, decideListingAccess: decideSpy };
});
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual, assertNoOwnLocationConflict: conflict };
});

type Services = ReturnType<typeof givenCreateServices>;

/** A schema failure as zod reports it, for the spied commit-side schemas. */
const rejectWith = (path: readonly PropertyKey[]) =>
    ({
        success: false,
        error: { issues: [{ code: 'custom', path, message: 'rechazado al confirmar' }] }
    }) as never;

const COMMIT_SCHEMAS = {
    [VerticalEnum.ACCOMMODATION]: AccommodationCreateDraftHttpSchema,
    [VerticalEnum.VENUE]: VenueAdminCreateInputSchema,
    [VerticalEnum.EXPERIENCE]: ExperienceAdminCreateInputCheckedSchema
} as const;

describe('create_listing review fixes', () => {
    let fake: ReturnType<typeof makeFakeRedis>;
    let services: Services;

    beforeAll(() => {
        validateApiEnv();
    });

    beforeEach(() => {
        for (const mock of [
            mocks.loadFacts,
            mocks.coverage,
            mocks.effectiveSet,
            mocks.preTrialDraftLimits,
            mocks.record,
            mocks.invalidateCache,
            mocks.analytics,
            mocks.precheck
        ]) {
            mock.mockReset();
        }
        conflict.mockReset();
        decideSpy.mockClear();
        fake = makeFakeRedis();
        mocks.redis = fake.redis;
        mocks.coverage.mockResolvedValue({ sources: ['TRIAL'] });
        conflict.mockResolvedValue(undefined);
        givenPrecheck();
        givenDestinations();
        services = givenCreateServices();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    const writes = () =>
        VERTICALS.reduce((total, vertical) => total + services[vertical].mock.calls.length, 0);

    describe('destination must be a city (L-4)', () => {
        it.each(
            VERTICALS
        )('%s: a province id is a destinationId field error with no token', async (vertical) => {
            // Act
            const outcome = await run({
                ...VALID_INPUT[vertical],
                destinationId: PROVINCE_DESTINATION_ID
            });

            // Assert
            if (outcome.ok) throw new Error('expected a failure');
            expect(outcome.failure.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(outcome.failure.message).toContain('destinationId');
            expect(outcome.failure.message).toContain('no es una ciudad de Hospeda');
            expect(fake.redis.set).not.toHaveBeenCalled();
            expect(writes()).toBe(0);
        });
    });

    describe('commit-side revalidation dry run (L-6)', () => {
        it.each(
            VERTICALS
        )('%s: a body the commit schema rejects fails at preview, without a token', async (vertical) => {
            // Arrange
            vi.spyOn(COMMIT_SCHEMAS[vertical], 'safeParse').mockReturnValue(rejectWith(['name']));

            // Act
            const outcome = await run({ ...VALID_INPUT[vertical] });

            // Assert
            if (outcome.ok) throw new Error('expected a failure');
            expect(outcome.failure.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(outcome.failure.message).toContain('name');
            expect(outcome.failure.message).toContain('rechazado al confirmar');
            expect(fake.redis.set).not.toHaveBeenCalled();
            expect(decideSpy).not.toHaveBeenCalled();
            expect(writes()).toBe(0);
        });

        it.each(
            VERTICALS
        )('%s: the commit re-runs the same schema and writes nothing on failure', async (vertical) => {
            // Arrange
            const token = await previewToken({ ...VALID_INPUT[vertical] });
            vi.spyOn(COMMIT_SCHEMAS[vertical], 'safeParse').mockReturnValue(rejectWith(['name']));

            // Act
            const outcome = await run({ ...VALID_INPUT[vertical], confirmationToken: token });

            // Assert
            if (outcome.ok) throw new Error('expected a failure');
            expect(outcome.failure.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(writes()).toBe(0);
        });

        it('maps commit-side paths back to the input fields the user can fix', () => {
            // Act
            const venue = validateCreateBody({
                actor: actorFor(),
                vertical: VerticalEnum.VENUE,
                body: {
                    ...VALID_INPUT.venue,
                    location: {
                        coordinates: { lat: 'x', long: 'y' },
                        street: 'Calle Falsa',
                        number: '1'
                    }
                }
            });
            const experience = validateCreateBody({
                actor: actorFor(),
                vertical: VerticalEnum.EXPERIENCE,
                body: { ...VALID_INPUT.experience, meetingPointLat: 200, meetingPointLong: 0 }
            });
            const accommodation = validateCreateBody({
                actor: actorFor(),
                vertical: VerticalEnum.ACCOMMODATION,
                body: { ...VALID_INPUT.accommodation, name: '' }
            });

            // Assert
            const fields = (result: ReturnType<typeof validateCreateBody>) =>
                result.ok
                    ? []
                    : (result.error.error?.details as { path: string[] }[]).map((d) => d.path[0]);
            expect(venue.ok).toBe(false);
            expect(new Set(fields(venue))).toEqual(new Set(['mapsUrl']));
            expect(experience.ok).toBe(false);
            expect(fields(experience)).toEqual(['mapsUrl']);
            expect(accommodation.ok).toBe(false);
            expect(fields(accommodation)).toEqual(['name']);
        });

        it('accepts the valid body of every vertical', () => {
            for (const vertical of VERTICALS) {
                const result = validateCreateBody({
                    actor: actorFor(),
                    vertical,
                    body: { ...VALID_INPUT[vertical] }
                });
                expect(result.ok, vertical).toBe(true);
            }
        });
    });
});
