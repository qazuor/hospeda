/**
 * HOS-2329 — `create_listing` review fixes: the city-only destination (L-4).
 * Same mocks as `create-listing.test.ts`.
 *
 * @module test/mcp/tools/listing/create-listing.review
 */

import { ServiceErrorCode } from '@repo/schemas';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { validateApiEnv } from '../../../../src/utils/env';
import {
    givenCreateServices,
    givenDestinations,
    givenPrecheck,
    makeFakeRedis,
    mocks,
    PROVINCE_DESTINATION_ID,
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
});
