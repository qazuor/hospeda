/**
 * HOS-2329 — `create_listing`: the two-step create of a DRAFT listing.
 *
 * Covers AC-C16, AC-C19, AC-C20, AC-C22, AC-C23b, AC-C23c, AC-C23f and the side
 * effects of each portal create route. The token binding and the authorization
 * matrix are in `create-listing.binding.test.ts`.
 *
 * @module test/mcp/tools/listing/create-listing
 */

import { AnalyticsEvents } from '@repo/analytics';
import {
    DUPLICATE_LOCATION_REASON,
    ServiceErrorCode,
    sectionsTouchedByBody,
    VerticalEnum
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACCOMMODATION_CACHE_INVALIDATION_PREFIXES } from '../../../../src/middlewares/accommodation-cache-invalidation';
import { validateApiEnv } from '../../../../src/utils/env';
import {
    actorFor,
    CREATED_ID,
    DESTINATION_ID,
    FULL_MAPS_POINT,
    FULL_MAPS_URL,
    givenCreateServices,
    givenDestinations,
    givenPrecheck,
    makeFakeRedis,
    mocks,
    previewToken,
    run,
    SHORT_MAPS_URL,
    shortLinkFetcher,
    UNKNOWN_DESTINATION_ID,
    VALID_INPUT,
    VERTICALS,
    type Vertical
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

describe('create_listing', () => {
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

    describe('preview (no token)', () => {
        it.each(VERTICALS)('%s: answers a preview with a token and writes nothing', async (v) => {
            // Act
            const outcome = await run({ ...VALID_INPUT[v] });

            // Assert
            expect(outcome.ok).toBe(true);
            if (!outcome.ok) return;
            expect(outcome.data).toMatchObject({
                status: 'confirmation_required',
                vertical: v,
                listing: { name: VALID_INPUT[v].name, destinationName: 'Concepción del Uruguay' },
                location: null,
                confirmationToken: expect.any(String)
            });
            expect(writes()).toBe(0);
            expect(mocks.analytics).not.toHaveBeenCalled();
            expect(mocks.invalidateCache).not.toHaveBeenCalled();
        });

        it('shows the resolved point, the check link and the wrapped address hint (AC-C23b)', async () => {
            // Act
            const outcome = await run({
                ...VALID_INPUT.accommodation,
                mapsUrl: FULL_MAPS_URL,
                street: 'Calle Falsa',
                number: '123'
            });

            // Assert
            if (!outcome.ok) throw new Error(outcome.failure.message);
            expect(outcome.data).toMatchObject({
                location: {
                    coordinates: FULL_MAPS_POINT,
                    mapCheckUrl: `https://www.google.com/maps?q=${FULL_MAPS_POINT.lat},${FULL_MAPS_POINT.lng}`,
                    addressHint:
                        '<untrusted_data source="maps_link">\nCalle Falsa 123\n</untrusted_data>',
                    street: 'Calle Falsa',
                    number: '123'
                }
            });
            expect(writes()).toBe(0);
        });

        it.each([
            ['unparseable', 'https://www.google.com/maps/search/cabañas'],
            ['out of region', 'https://www.google.com/maps/@40.4168,-3.7038,15z'],
            ['not allowlisted', 'https://maps.app.goo.gl.evil.com/x']
        ])('refuses a %s link as a mapsUrl validation error, no token (AC-C23c)', async (_l, url) => {
            // Act
            const outcome = await run({ ...VALID_INPUT.venue, mapsUrl: url });

            // Assert
            expect(outcome.ok).toBe(false);
            if (outcome.ok) return;
            expect(outcome.failure.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(outcome.failure.message).toContain('mapsUrl');
            expect(fake.redis.set).not.toHaveBeenCalled();
        });

        it('refuses a resolver timeout as a mapsUrl validation error (AC-C23c)', async () => {
            // Arrange
            const fetchHop = vi.fn(async () => {
                throw Object.assign(new Error('timeout'), { name: 'MapsLinkTimeoutError' });
            });

            // Act
            const outcome = await run(
                { ...VALID_INPUT.experience, mapsUrl: SHORT_MAPS_URL },
                { fetchHop }
            );

            // Assert
            expect(outcome.ok).toBe(false);
            if (!outcome.ok) expect(outcome.failure.message).toContain('mapsUrl');
        });

        it('refuses an unknown destination by field, no token', async () => {
            // Act
            const outcome = await run({
                ...VALID_INPUT.venue,
                destinationId: UNKNOWN_DESTINATION_ID
            });

            // Assert
            if (outcome.ok) throw new Error('expected a failure');
            expect(outcome.failure.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
            expect(outcome.failure.message).toContain('destinationId');
            expect(fake.redis.set).not.toHaveBeenCalled();
        });

        it('warns about a duplicate address without blocking (AC-C23f)', async () => {
            // Arrange
            conflict.mockRejectedValue(
                new ServiceError(
                    ServiceErrorCode.ALREADY_EXISTS,
                    'dup',
                    undefined,
                    DUPLICATE_LOCATION_REASON
                )
            );

            // Act
            const outcome = await run({
                ...VALID_INPUT.accommodation,
                street: 'San Martín',
                number: '123'
            });

            // Assert
            if (!outcome.ok) throw new Error(outcome.failure.message);
            expect(outcome.data).toMatchObject({
                location: { duplicateAddressWarning: expect.stringContaining('misma dirección') }
            });
            expect(conflict).toHaveBeenCalledWith(
                expect.objectContaining({
                    vertical: VerticalEnum.ACCOMMODATION,
                    locationKey: `san martin|123|${DESTINATION_ID}`
                })
            );
        });

        it('reads no location key from coordinates alone (AC-C23f)', async () => {
            // Act
            await run({ ...VALID_INPUT.accommodation, mapsUrl: FULL_MAPS_URL });

            // Assert
            expect(conflict).toHaveBeenCalledWith(expect.objectContaining({ locationKey: null }));
        });

        it('says publishing will need a free slot, and still offers the draft (AC-C19)', async () => {
            // Arrange
            givenPrecheck({ atLimit: true });

            // Act
            const outcome = await run({ ...VALID_INPUT.accommodation });

            // Assert
            if (!outcome.ok) throw new Error(outcome.failure.message);
            expect(outcome.data).toMatchObject({
                status: 'confirmation_required',
                publishQuota: {
                    hasFreeSlot: false,
                    note: expect.stringContaining('liberar un lugar')
                }
            });
        });
    });

    describe('commit (same input + token)', () => {
        it.each(
            VERTICALS
        )('%s: creates one DRAFT through the portal service (AC-C16/C20)', async (v) => {
            // Arrange
            const token = await previewToken({ ...VALID_INPUT[v] });

            // Act
            const outcome = await run({ ...VALID_INPUT[v], confirmationToken: token });

            // Assert
            if (!outcome.ok) throw new Error(outcome.failure.message);
            expect(outcome.data).toMatchObject({
                status: 'created',
                id: CREATED_ID,
                vertical: v,
                publicationStatus: 'DRAFT',
                editorUrl: expect.stringContaining(CREATED_ID)
            });
            expect(services[v]).toHaveBeenCalledTimes(1);
            expect(writes()).toBe(1);
            const body = (services[v].mock.calls[0] as unknown[])[1] as Record<string, unknown>;
            expect(body).not.toHaveProperty('publicationStatus');
            if (v !== VerticalEnum.ACCOMMODATION) {
                expect(body).toMatchObject({ ownerId: actorFor().id });
            }
        });

        it('accommodation: fires the two host-onboarding analytics events with source assistant and evicts the cache (AC-C22)', async () => {
            // Arrange
            const token = await previewToken({ ...VALID_INPUT.accommodation });

            // Act
            await run({ ...VALID_INPUT.accommodation, confirmationToken: token });

            // Assert
            expect(mocks.analytics.mock.calls.map(([call]) => call.name)).toEqual([
                AnalyticsEvents.onboardingStarted,
                AnalyticsEvents.accommodationDraftSaved
            ]);
            expect(mocks.analytics).toHaveBeenCalledWith(
                expect.objectContaining({
                    distinctId: actorFor().id,
                    properties: { accommodation_id: CREATED_ID, creation_source: 'assistant' }
                })
            );
            expect(mocks.analytics).toHaveBeenCalledWith(
                expect.objectContaining({
                    properties: { onboarding_type: 'host_accommodation', draft_source: 'assistant' }
                })
            );
            expect(mocks.invalidateCache.mock.calls.map(([call]) => call.pathPrefix)).toEqual([
                ...ACCOMMODATION_CACHE_INVALIDATION_PREFIXES
            ]);
        });

        it.each([
            VerticalEnum.VENUE,
            VerticalEnum.EXPERIENCE
        ])('%s: fires no analytics and evicts nothing, as its route', async (v) => {
            const token = await previewToken({ ...VALID_INPUT[v as Vertical] });
            await run({ ...VALID_INPUT[v as Vertical], confirmationToken: token });
            expect(mocks.analytics).not.toHaveBeenCalled();
            expect(mocks.invalidateCache).not.toHaveBeenCalled();
        });

        it('venue: the access step receives the type preselection as business lines (AC-C22)', async () => {
            // Arrange: a parrilla preselects ['food'] (BUSINESS_LINE_RULES).
            const token = await previewToken({ ...VALID_INPUT.venue });

            // Act
            await run({ ...VALID_INPUT.venue, confirmationToken: token });

            // Assert: preview dry run + commit, both CREATE with the route's readers.
            expect(decideSpy).toHaveBeenCalledTimes(2);
            for (const [args] of decideSpy.mock.calls) {
                expect(args).toMatchObject({
                    listingId: '',
                    tier: 'protected',
                    ownerOnly: true,
                    config: { vertical: VerticalEnum.VENUE, operation: 'CREATE' }
                });
                expect(args.config.businessLinesFromBody({ body: args.body })).toEqual(['food']);
            }
            expect(mocks.coverage).toHaveBeenCalledWith(
                expect.objectContaining({ userId: actorFor().id, vertical: VerticalEnum.VENUE })
            );
        });

        it('venue: explicit business lines reach the access step as given', async () => {
            const input = { ...VALID_INPUT.venue, type: 'RESTAURANT', businessLines: ['food'] };
            await run(input);
            const [args] = decideSpy.mock.calls[0] ?? [];
            expect(args.config.businessLinesFromBody({ body: args.body })).toEqual(['food']);
            expect(args.body.businessLines).toEqual(['food']);
        });

        it('venue: the access step receives the sections the body writes, as the route', async () => {
            // Arrange: a body with a location writes the location section.
            const input = { ...VALID_INPUT.venue, street: 'Calle Falsa', number: '123' };

            // Act
            await run(input);

            // Assert
            const [args] = decideSpy.mock.calls[0] ?? [];
            const expected = sectionsTouchedByBody({ vertical: 'venue', body: args.body }).map(
                (id) => ({ id, intent: 'write' })
            );
            expect(expected.length).toBeGreaterThan(0);
            expect(args.config.listingSection({ body: args.body })).toEqual(expected);
        });

        it('writes exactly the previewed point, never re-resolving the link (AC-C23b)', async () => {
            // Arrange: the short link resolves on preview, then would point elsewhere.
            const fetchHop = shortLinkFetcher();
            const input = {
                ...VALID_INPUT.venue,
                mapsUrl: SHORT_MAPS_URL,
                street: 'Calle Falsa',
                number: '123'
            };
            const token = await previewToken(input, { fetchHop });
            fetchHop.mockResolvedValue({
                status: 302,
                location: 'https://www.google.com/maps/@-31.0,-59.0,15z'
            });

            // Act
            await run({ ...input, confirmationToken: token }, { fetchHop });

            // Assert
            expect(fetchHop).toHaveBeenCalledTimes(1);
            const body = (services.venue.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
            expect(body.location).toEqual({
                coordinates: {
                    lat: String(FULL_MAPS_POINT.lat),
                    long: String(FULL_MAPS_POINT.lng)
                },
                street: 'Calle Falsa',
                number: '123'
            });
        });

        it("maps the point and address into each vertical's create fields", async () => {
            const location = { mapsUrl: FULL_MAPS_URL, street: 'Calle Falsa', number: '123' };
            for (const v of [VerticalEnum.ACCOMMODATION, VerticalEnum.EXPERIENCE] as const) {
                const token = await previewToken({ ...VALID_INPUT[v], ...location });
                await run({ ...VALID_INPUT[v], ...location, confirmationToken: token });
            }
            const acc = (services.accommodation.mock.calls[0] as unknown[])[1];
            const exp = (services.experience.mock.calls[0] as unknown[])[1];
            expect(acc).toMatchObject({
                latitude: FULL_MAPS_POINT.lat,
                longitude: FULL_MAPS_POINT.lng,
                street: 'Calle Falsa',
                number: '123'
            });
            expect(exp).toMatchObject({
                meetingPoint: 'Calle Falsa 123',
                meetingPointLat: FULL_MAPS_POINT.lat,
                meetingPointLong: FULL_MAPS_POINT.lng
            });
        });

        it('experience on request: sends priceFrom null, as the web form does', async () => {
            const input = {
                ...VALID_INPUT.experience,
                priceFrom: undefined,
                priceUnit: undefined,
                isPriceOnRequest: true
            };
            const token = await previewToken(input);
            await run({ ...input, confirmationToken: token });
            const body = (services.experience.mock.calls[0] as unknown[])[1];
            expect(body).toMatchObject({ priceFrom: null, isPriceOnRequest: true });
        });

        it('links the location section when no location was set (AC-C23c)', async () => {
            const token = await previewToken({ ...VALID_INPUT.experience });
            const outcome = await run({ ...VALID_INPUT.experience, confirmationToken: token });
            if (!outcome.ok) throw new Error(outcome.failure.message);
            if (outcome.data.status !== 'created') throw new Error('expected a create');
            const steps = outcome.data.nextSteps;
            expect(steps.map((s) => s.step)).toEqual([
                'amenities',
                'photos',
                'location',
                'publish'
            ]);
            expect(steps.find((s) => s.step === 'location')?.url).toContain('punto-de-encuentro');
        });

        it('omits the location step when the draft has one', async () => {
            const input = { ...VALID_INPUT.accommodation, mapsUrl: FULL_MAPS_URL };
            const token = await previewToken(input);
            const outcome = await run({ ...input, confirmationToken: token });
            if (!outcome.ok) throw new Error(outcome.failure.message);
            if (outcome.data.status !== 'created') throw new Error('expected a create');
            const steps = outcome.data.nextSteps;
            expect(steps.map((s) => s.step)).toEqual(['amenities', 'photos', 'publish']);
        });
    });
});
