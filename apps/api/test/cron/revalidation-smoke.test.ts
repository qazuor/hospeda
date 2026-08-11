/**
 * Integration Smoke Test: Manual Revalidation Flow
 *
 * Exercises the full manual invalidation path at the service level:
 *   initializeRevalidationService (NoOp adapter)
 *     → revalidateTags / revalidateByEntityType / purgeEverything / purgeWholeZone
 *       → NoOpRevalidationAdapter (spy)
 *
 * This is an API-level integration smoke test — no HTTP layer involved. It
 * verifies that the service wiring, tag resolution, and adapter invocation work
 * end to end.
 *
 * HOS-369 W1-1 rewrote this suite. It used to assert on URL paths and on the
 * locale fan-out that produced them; both are gone. A cache tag is
 * locale-agnostic by construction — `accom-x` purges the es, en and pt renders
 * at once — so there is no longer a locale dimension to expand, and
 * `revalidateByEntityType` resolves to the type's collection tags rather than
 * enumerating every published row.
 *
 * @module test/cron/revalidation-smoke
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoOpRevalidationAdapter } from '../../../../packages/service-core/src/revalidation/adapters/noop-revalidation.adapter';
import { RevalidationService } from '../../../../packages/service-core/src/revalidation/revalidation.service';
import {
    _resetRevalidationService,
    getRevalidationService,
    initializeRevalidationService
} from '../../../../packages/service-core/src/revalidation/revalidation-init';

// ---------------------------------------------------------------------------
// Mock @repo/db so the service can be instantiated without a real DB
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    RevalidationConfigModel: vi.fn().mockImplementation(function () {
        return {
            findByEntityType: vi.fn().mockResolvedValue(undefined)
        };
    }),
    RevalidationLogModel: vi.fn().mockImplementation(function () {
        return {
            create: vi.fn().mockResolvedValue(undefined)
        };
    })
}));

vi.mock('@repo/logger', () => ({
    createLogger: vi.fn().mockReturnValue({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a spy-wrapped NoOpRevalidationAdapter.
 * The spy records all calls while preserving the real implementation.
 */
function createSpyAdapter() {
    const adapter = new NoOpRevalidationAdapter();
    const revalidateSpy = vi.spyOn(adapter, 'revalidate');
    const revalidateManySpy = vi.spyOn(adapter, 'revalidateMany');
    const purgeEverythingSpy = vi.spyOn(adapter, 'purgeEverything');
    return { adapter, revalidateSpy, revalidateManySpy, purgeEverythingSpy };
}

/**
 * The deployment namespace this suite pins the service to.
 *
 * Every tag the service purges is qualified by it (HOS-369), so the assertions
 * below compare against {@link ns}-qualified tags rather than bare vocabulary.
 * Passing it explicitly is not optional: with the environment unresolved the
 * service drops the purge entirely and the adapter is never called — which is
 * the correct production behaviour, but as a test fixture it would only prove
 * that an unconfigured service does nothing.
 */
const TEST_CACHE_TAG_ENVIRONMENT = 'test';

/** Qualify a bare vocabulary tag the way the service does before purging. */
function ns(tag: string): string {
    return `${TEST_CACHE_TAG_ENVIRONMENT}:${tag}`;
}

/** A service wired to a spy adapter, with debounce disabled. */
function createService() {
    const spies = createSpyAdapter();
    const service = new RevalidationService({
        adapter: spies.adapter,
        debounceMs: 0,
        cacheTagEnvironment: TEST_CACHE_TAG_ENVIRONMENT
    });
    return { ...spies, service };
}

/** The tags the adapter was asked to purge on its first `revalidateMany` call. */
function firstCallTags(spy: ReturnType<typeof vi.spyOn>): readonly string[] {
    const [params] = spy.mock.calls[0] as [{ tags: readonly string[] }];
    return params.tags;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Manual Revalidation Flow — Integration Smoke Test', () => {
    beforeEach(() => {
        _resetRevalidationService();
        vi.clearAllMocks();
    });

    // -----------------------------------------------------------------------
    describe('Service Initialization', () => {
        it('should create a RevalidationService instance', () => {
            const { service } = createService();
            expect(service).toBeInstanceOf(RevalidationService);
        });

        it('should expose getRevalidationService returning undefined before init', () => {
            expect(getRevalidationService()).toBeUndefined();
        });

        it('should expose getRevalidationService returning the instance after init', () => {
            initializeRevalidationService({
                nodeEnv: 'test',
                revalidationSecret: 'test-secret',
                siteUrl: 'http://localhost:4321'
            });

            expect(getRevalidationService()).toBeInstanceOf(RevalidationService);
        });

        it('initializeRevalidationService should be idempotent -- second call returns same instance', () => {
            const first = initializeRevalidationService({
                nodeEnv: 'test',
                revalidationSecret: 'test-secret',
                siteUrl: 'http://localhost:4321'
            });

            const second = initializeRevalidationService({
                nodeEnv: 'test',
                revalidationSecret: 'different-secret',
                siteUrl: 'http://different.example.com'
            });

            expect(first).toBe(second);
        });
    });

    // -----------------------------------------------------------------------
    describe('revalidateTags — direct service call', () => {
        it('should call adapter.revalidateMany with the provided tags', async () => {
            const { service, revalidateManySpy } = createService();
            const tags = ['accom-cabana-del-rio', 'list-accom'];

            await service.revalidateTags({ tags });

            expect(revalidateManySpy).toHaveBeenCalledOnce();
            expect(firstCallTags(revalidateManySpy)).toEqual(expect.arrayContaining(tags.map(ns)));
        });

        it('should return without throwing when all adapter calls succeed', async () => {
            const { service } = createService();

            await expect(
                service.revalidateTags({ tags: ['list-accom', 'list-event'] })
            ).resolves.toBeDefined();
        });

        it('should handle an empty tag list gracefully', async () => {
            const { service, revalidateManySpy } = createService();

            await service.revalidateTags({ tags: [] });

            expect(revalidateManySpy).not.toHaveBeenCalled();
        });

        it('each adapter result should have success=true with a target and durationMs', async () => {
            const { service, revalidateSpy } = createService();

            await service.revalidateTags({ tags: ['list-accom', 'list-event'] });

            for (const call of revalidateSpy.mock.results) {
                const result = await call.value;
                expect(result).toMatchObject({
                    target: expect.any(String),
                    success: true,
                    durationMs: expect.any(Number)
                });
                expect(result.error).toBeUndefined();
            }
        });
    });

    // -----------------------------------------------------------------------
    describe('revalidateByEntityType — collection-tag resolution', () => {
        it('should resolve "accommodation" to its collection tag', async () => {
            const { service, revalidateManySpy } = createService();

            await service.revalidateByEntityType({ entityType: 'accommodation' });

            expect(revalidateManySpy).toHaveBeenCalledOnce();
            expect(firstCallTags(revalidateManySpy)).toContain(ns('list-accom'));
        });

        it('should NOT enumerate per-entity tags for a type', async () => {
            // The behaviour change HOS-369 W1-1 made deliberately: the collection
            // tag already covers every listing surface for the type, and walking
            // every published row would blow through Cloudflare's Free-plan
            // ceiling of 5 tag-purge requests per minute. Per-entity tags are
            // purged by that entity's own write hook.
            const { service, revalidateManySpy } = createService();

            await service.revalidateByEntityType({ entityType: 'accommodation' });

            const tags = firstCallTags(revalidateManySpy);
            // Match the QUALIFIED per-entity prefix. Checking for a bare
            // `accom-` here would be vacuously true now that every tag is
            // namespaced, so the assertion would pass without testing anything.
            expect(tags.every((tag) => !tag.startsWith(ns('accom-')))).toBe(true);
            expect(tags.length).toBeLessThan(5);
        });

        it('should produce no adapter call for an unknown entity type', async () => {
            const { service, revalidateManySpy } = createService();

            await service.revalidateByEntityType({ entityType: 'unknown_type' as never });

            expect(revalidateManySpy).not.toHaveBeenCalled();
        });

        it('should resolve without throwing on entity type expansion', async () => {
            const { service } = createService();

            await expect(
                service.revalidateByEntityType({ entityType: 'event' })
            ).resolves.toBeDefined();
        });
    });

    // -----------------------------------------------------------------------
    describe('purgeEverything — the environment flush', () => {
        it('should purge the environment catch-all tag, not the zone', async () => {
            // Staging and production share one Cloudflare zone, so the normal
            // "flush everything" path must address a namespaced tag.
            const { service, purgeEverythingSpy, revalidateManySpy } = createService();

            await service.purgeEverything({ reason: 'deploy' });

            expect(revalidateManySpy).toHaveBeenCalledWith({ tags: [ns('all')] });
            expect(purgeEverythingSpy).not.toHaveBeenCalled();
        });

        it('should NOT be reachable from a tag purge', async () => {
            // The whole point of the split: a content write can never flush
            // everything by accident. Only an explicit call gets there.
            const { service, revalidateManySpy } = createService();

            await service.revalidateTags({ tags: ['list-accom'] });
            await service.revalidateByEntityType({ entityType: 'post' });

            for (const call of revalidateManySpy.mock.calls) {
                expect(call[0].tags).not.toContain(ns('all'));
            }
        });
    });

    // -----------------------------------------------------------------------
    describe('purgeWholeZone — the emergency escape hatch', () => {
        it('should reach the adapter whole-zone flush', async () => {
            const { service, purgeEverythingSpy, revalidateManySpy } = createService();

            await service.purgeWholeZone({ reason: 'cache rule changed' });

            expect(purgeEverythingSpy).toHaveBeenCalledOnce();
            expect(revalidateManySpy).not.toHaveBeenCalled();
        });

        it('should NOT be reachable from a tag purge or an environment flush', async () => {
            const { service, purgeEverythingSpy } = createService();

            await service.revalidateTags({ tags: ['list-accom'] });
            await service.revalidateByEntityType({ entityType: 'post' });
            await service.purgeEverything({ reason: 'deploy' });

            expect(purgeEverythingSpy).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    describe('NoOpRevalidationAdapter — adapter contract', () => {
        it('should have correct adapter name', () => {
            const adapter = new NoOpRevalidationAdapter();
            expect(adapter.name).toBe('NoOpRevalidationAdapter');
        });

        it('should always return success=true from revalidate()', async () => {
            const adapter = new NoOpRevalidationAdapter();

            const result = await adapter.revalidate({ tag: 'list-accom' });

            expect(result.success).toBe(true);
            expect(result.target).toBe('list-accom');
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
            expect(result.error).toBeUndefined();
        });

        it('should never throw — adapter contract requires non-throwing', async () => {
            const adapter = new NoOpRevalidationAdapter();

            await expect(adapter.revalidate({ tag: '' })).resolves.toMatchObject({
                success: true
            });
        });

        it('should report the whole-zone target from purgeEverything()', async () => {
            const adapter = new NoOpRevalidationAdapter();

            const result = await adapter.purgeEverything({ reason: 'deploy' });

            expect(result).toMatchObject({ target: '*', success: true });
        });
    });

    // -----------------------------------------------------------------------
    describe('End-to-End: full manual revalidation flow', () => {
        it('should complete the full flow: init -> getService -> revalidateTags', async () => {
            const service = initializeRevalidationService({
                nodeEnv: 'test',
                revalidationSecret: 'e2e-bypass-token',
                siteUrl: 'http://localhost:4321',
                debounceMs: 0
            });

            expect(getRevalidationService()).toBe(service);

            await service.revalidateTags({ tags: ['list-accom', 'home'] });

            expect(service).toBeInstanceOf(RevalidationService);
        });

        it('should complete the full flow: init -> revalidateByEntityType', async () => {
            const service = initializeRevalidationService({
                nodeEnv: 'test',
                revalidationSecret: 'e2e-bypass-token',
                siteUrl: 'http://localhost:4321',
                debounceMs: 0
            });

            await expect(
                service.revalidateByEntityType({ entityType: 'destination' })
            ).resolves.toBeDefined();

            expect(getRevalidationService()).toBe(service);
        });
    });
});
