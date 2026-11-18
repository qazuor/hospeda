/**
 * HOS-2329 — `create_listing`: the token binding and the authorization matrix.
 *
 * Covers AC-C17, AC-C18, AC-C23b (a changed mapsUrl, street or number burns the
 * token) and the authorization matrix (owner, unverified email, no coverage,
 * coverage lost before the commit, no OAuth client). Same mocks as
 * `create-listing.test.ts`.
 *
 * @module test/mcp/tools/listing/create-listing.binding
 */

import { ServiceErrorCode, VerticalEnum } from '@repo/schemas';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateApiEnv } from '../../../../src/utils/env';
import {
    actorFor,
    DESTINATION_ID,
    FULL_MAPS_URL,
    givenCreateServices,
    givenDestinations,
    givenPrecheck,
    makeFakeRedis,
    mocks,
    OTHER_CLIENT,
    OTHER_ID,
    previewToken,
    run,
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

describe('create_listing binding and authorization', () => {
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

    describe('token binding (AC-C17, AC-C18, AC-C23b)', () => {
        it.each([
            ['name', { name: 'Otro nombre' }],
            ['mapsUrl', { mapsUrl: 'https://www.google.com/maps/@-32.49,-58.24,17z' }],
            ['street', { street: 'Otra calle' }],
            ['number', { number: '999' }]
        ])('a commit that changes %s writes nothing and burns the token', async (_f, change) => {
            // Arrange
            const input = {
                ...VALID_INPUT.accommodation,
                mapsUrl: FULL_MAPS_URL,
                street: 'Calle Falsa',
                number: '123'
            };
            const token = await previewToken(input);

            // Act
            const changed = await run({ ...input, ...change, confirmationToken: token });
            const original = await run({ ...input, confirmationToken: token });

            // Assert
            expect(changed.ok).toBe(false);
            if (!changed.ok) expect(changed.failure.message).toContain('No se creó nada');
            expect(original.ok).toBe(false); // burnt by the mismatching attempt
            expect(writes()).toBe(0);
        });

        it('a token is bound to the vertical', async () => {
            const token = await previewToken({ ...VALID_INPUT.venue });
            const outcome = await run({
                ...VALID_INPUT.venue,
                vertical: VerticalEnum.EXPERIENCE,
                priceFrom: 100,
                priceUnit: 'per_person',
                confirmationToken: token
            });
            expect(outcome.ok).toBe(false);
            expect(writes()).toBe(0);
        });

        it('a token is bound to the user', async () => {
            const token = await previewToken({ ...VALID_INPUT.venue });
            const outcome = await run(
                { ...VALID_INPUT.venue, confirmationToken: token },
                { actor: actorFor(OTHER_ID) }
            );
            expect(outcome.ok).toBe(false);
            expect(writes()).toBe(0);
        });

        it('a token is bound to the OAuth client', async () => {
            const token = await previewToken({ ...VALID_INPUT.venue });
            const outcome = await run(
                { ...VALID_INPUT.venue, confirmationToken: token },
                { context: { channel: 'mcp', clientId: OTHER_CLIENT } }
            );
            expect(outcome.ok).toBe(false);
            expect(writes()).toBe(0);
        });

        it('a reused token creates nothing the second time', async () => {
            const token = await previewToken({ ...VALID_INPUT.venue });
            const first = await run({ ...VALID_INPUT.venue, confirmationToken: token });
            const second = await run({ ...VALID_INPUT.venue, confirmationToken: token });
            expect(first.ok).toBe(true);
            expect(second.ok).toBe(false);
            expect(writes()).toBe(1);
        });

        it('an expired token creates nothing', async () => {
            const token = await previewToken({ ...VALID_INPUT.venue });
            fake.advance(601_000);
            const outcome = await run({ ...VALID_INPUT.venue, confirmationToken: token });
            expect(outcome.ok).toBe(false);
            expect(writes()).toBe(0);
        });

        it('two racing commits create exactly one listing (AC-C18)', async () => {
            const token = await previewToken({ ...VALID_INPUT.accommodation });
            const outcomes = await Promise.all([
                run({ ...VALID_INPUT.accommodation, confirmationToken: token }),
                run({ ...VALID_INPUT.accommodation, confirmationToken: token })
            ]);
            expect(outcomes.filter((o) => o.ok)).toHaveLength(1);
            expect(writes()).toBe(1);
        });

        it('a forged token creates nothing', async () => {
            const outcome = await run({ ...VALID_INPUT.venue, confirmationToken: 'forged' });
            expect(outcome.ok).toBe(false);
            expect(writes()).toBe(0);
        });

        it('fails closed, writing nothing, when the token store is down', async () => {
            mocks.redis = undefined;
            const outcome = await run({ ...VALID_INPUT.venue });
            if (outcome.ok) throw new Error('expected a failure');
            expect(outcome.failure.code).toBe(ServiceErrorCode.SERVICE_UNAVAILABLE);
            expect(writes()).toBe(0);
        });
    });

    describe('authorization matrix', () => {
        it.each([
            VerticalEnum.VENUE,
            VerticalEnum.EXPERIENCE
        ])('%s: no coverage refuses the preview with a plans link, no token', async (v) => {
            mocks.coverage.mockResolvedValue({ sources: [] });
            const outcome = await run({ ...VALID_INPUT[v as Vertical] });
            if (outcome.ok) throw new Error('expected a failure');
            expect(outcome.failure.code).toBe(ServiceErrorCode.ENTITLEMENT_REQUIRED);
            expect(outcome.failure.action?.url).toContain('planes');
            expect(fake.redis.set).not.toHaveBeenCalled();
        });

        it('venue: coverage lost between preview and commit refuses the commit, nothing written', async () => {
            const token = await previewToken({ ...VALID_INPUT.venue });
            mocks.coverage.mockResolvedValue({ sources: [] });
            const outcome = await run({ ...VALID_INPUT.venue, confirmationToken: token });
            expect(outcome.ok).toBe(false);
            expect(writes()).toBe(0);
        });

        it('accommodation runs no access step, as /host-onboarding/start declares none', async () => {
            mocks.coverage.mockResolvedValue({ sources: [] });
            const token = await previewToken({ ...VALID_INPUT.accommodation });
            const outcome = await run({ ...VALID_INPUT.accommodation, confirmationToken: token });
            expect(outcome.ok).toBe(true);
            expect(mocks.coverage).not.toHaveBeenCalled();
        });

        it.each(VERTICALS)('%s: an unverified email is refused before anything runs', async (v) => {
            const outcome = await run(
                { ...VALID_INPUT[v] },
                { actor: actorFor(undefined, { emailVerified: false }) }
            );
            expect(outcome.ok).toBe(false);
            expect(fake.redis.set).not.toHaveBeenCalled();
            expect(writes()).toBe(0);
        });

        it('refuses a call with no OAuth client (nothing to bind the token to)', async () => {
            const outcome = await run({ ...VALID_INPUT.venue }, { context: { channel: 'mcp' } });
            if (outcome.ok) throw new Error('expected a failure');
            expect(outcome.failure.code).toBe(ServiceErrorCode.UNAUTHORIZED);
            expect(fake.redis.set).not.toHaveBeenCalled();
        });
    });

    it('the destination id is checked against the catalog with the guest actor', async () => {
        const destinations = givenDestinations();
        await run({ ...VALID_INPUT.venue });
        expect(destinations.getById).toHaveBeenCalledWith(expect.anything(), DESTINATION_ID);
    });
});
