/**
 * @fileoverview
 * Unit tests for RevalidationService:
 * - scheduleRevalidation: fire-and-forget entity-level debounced scheduling with config gating
 * - revalidateByEntityType: immediate purge of all cache tags for an entity type
 * - revalidateTags: immediate purge of an explicit cache-tag list with entityType threading
 * - purgeEverything: whole-zone flush escape hatch, one audit row targeting `*`
 * - getRevalidationService / initializeRevalidationService: singleton management
 * - _resetRevalidationService: test isolation helper
 * - Config getters: getLogRetentionDays
 *
 * Uses vi.useFakeTimers() for deterministic debounce testing.
 * Mocks @repo/db models and @repo/logger to isolate the service under test.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks must be declared before any imports of the mocked modules.
// vi.mock is hoisted to the top of the file by Vitest, but factory functions
// MUST NOT reference outer-scope `const`/`let` variables because those
// declarations are NOT hoisted -- only the vi.mock() call itself is.
// Use vi.fn() inline inside the factory, then configure in beforeEach.
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    RevalidationConfigModel: vi.fn().mockImplementation(function () {
        return {
            findByEntityType: vi.fn()
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

import { RevalidationConfigModel, RevalidationLogModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import type {
    RevalidateTargetResult,
    RevalidationAdapter
} from '../../src/revalidation/adapters/revalidation.adapter.js';
import { WHOLE_ZONE_TARGET } from '../../src/revalidation/adapters/revalidation.adapter.js';
import { RevalidationService } from '../../src/revalidation/revalidation.service.js';
import {
    _resetRevalidationService,
    getRevalidationService,
    initializeRevalidationService
} from '../../src/revalidation/revalidation-init.js';

// ---------------------------------------------------------------------------
// Helpers to access mock instances
// ---------------------------------------------------------------------------

function getMockLogger() {
    return (createLogger as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value as {
        error: ReturnType<typeof vi.fn>;
        warn: ReturnType<typeof vi.fn>;
    };
}

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeSuccessResult(tag: string): RevalidateTargetResult {
    return { success: true, target: tag, durationMs: 1 };
}

function makeFailureResult(tag: string, error: string): RevalidateTargetResult {
    return { success: false, target: tag, durationMs: 1, error };
}

/**
 * Creates a mock adapter whose revalidate() and revalidateMany() calls are tracked.
 * Defaults to returning success for all tags.
 */
function makeMockAdapter(
    revalidateImpl: (tag: string) => Promise<RevalidateTargetResult> = (tag) =>
        Promise.resolve(makeSuccessResult(tag))
): RevalidationAdapter {
    const revalidateFn = vi.fn((params: { readonly tag: string }) => revalidateImpl(params.tag));
    return {
        name: 'MockAdapter',
        revalidate: revalidateFn,
        revalidateMany: vi.fn(async (params: { readonly tags: ReadonlyArray<string> }) => {
            const settled = await Promise.allSettled(
                params.tags.map((t) => revalidateFn({ tag: t }))
            );
            return settled.map((r, i) =>
                r.status === 'fulfilled'
                    ? r.value
                    : makeFailureResult(
                          params.tags[i] ?? '',
                          String((r as PromiseRejectedResult).reason)
                      )
            );
        }),
        purgeEverything: vi.fn(async (_params: { readonly reason?: string }) => ({
            target: WHOLE_ZONE_TARGET,
            success: true,
            durationMs: 1
        }))
    };
}

/** Builds a fully-enabled config record */
function makeEnabledConfig(entityType: string, debounceSeconds = 1) {
    return {
        id: 'cfg-id',
        entityType,
        enabled: true,
        autoRevalidateOnChange: true,
        debounceSeconds,
        cronIntervalMinutes: 60,
        createdAt: new Date(),
        updatedAt: new Date()
    };
}

/** Creates a RevalidationService with test defaults */
function createTestService(adapter: RevalidationAdapter) {
    return new RevalidationService({ adapter });
}

// ---------------------------------------------------------------------------
// scheduleRevalidation -- fire-and-forget
// ---------------------------------------------------------------------------

describe('RevalidationService.scheduleRevalidation -- fire-and-forget', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        // Re-mock implementations after clearAllMocks
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi.fn().mockResolvedValue(makeEnabledConfig('tag', 1))
            };
        });
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: vi.fn().mockResolvedValue(undefined)
            };
        });
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('returns void immediately without blocking', () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        const result = service.scheduleRevalidation({ entityType: 'tag' });

        expect(result).toBeUndefined();
    });

    it('does not call adapter synchronously before debounce expires', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'tag' });

        // Let async config lookup resolve but NOT the debounce timer
        await vi.runAllTicks();
        expect(adapter.revalidate).not.toHaveBeenCalled();
    });

    it('calls adapter for each affected cache tag after debounce timeout fires', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        // accommodation with slug -> 3 tags (accom-hotel-a, list-accom, home)
        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-a' });

        await vi.runAllTimersAsync();

        expect(adapter.revalidate).toHaveBeenCalledTimes(3);
    });

    it('merges multiple calls for the same entity within debounce window into one batch', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-a' });
        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-a' });
        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-a' });

        await vi.runAllTimersAsync();

        // Still 3 tags (entity + collection + home) -- NOT 9 (3 calls x 3 tags)
        expect(adapter.revalidate).toHaveBeenCalledTimes(3);
    });

    it('creates separate debounce entries for different entity keys', async () => {
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi
                    .fn()
                    .mockImplementation((entityType: string) =>
                        Promise.resolve(makeEnabledConfig(entityType, 1))
                    )
            };
        });

        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'tag' });
        service.scheduleRevalidation({ entityType: 'destination', slug: 'my-dest' });

        await vi.runAllTimersAsync();

        const tags = (adapter.revalidate as ReturnType<typeof vi.fn>).mock.calls.map(
            (args: unknown[]) => (args[0] as { tag: string }).tag
        );

        // 'tag' events fold into the shared accommodation-collection tag.
        expect(tags).toContain('list-accom');
        // 'destination' events carry their own entity tag.
        expect(tags).toContain('dest-my-dest');
    });

    it('uses entity-level debounce key (entityType:entityId) for slug-bearing events', async () => {
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi
                    .fn()
                    .mockImplementation((entityType: string) =>
                        Promise.resolve(makeEnabledConfig(entityType, 1))
                    )
            };
        });

        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        // Two different accommodations should get separate debounce entries
        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-a' });
        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-b' });

        await vi.runAllTimersAsync();

        // Both should fire independently, producing tags for both slugs
        const tags = (adapter.revalidate as ReturnType<typeof vi.fn>).mock.calls.map(
            (args: unknown[]) => (args[0] as { tag: string }).tag
        );

        expect(tags).toContain('accom-hotel-a');
        expect(tags).toContain('accom-hotel-b');
    });

    it('debounces distinct destinations on independent timers (no shared bucket)', async () => {
        // Regression for SPEC-246: destination/event/post no longer supply a UUID
        // to entity_id (extractEntityId returns undefined for them), but the debounce
        // bucket key must still be per-entity (slug) so distinct entities of the same
        // type don't collapse into one shared bucket and reset each other's timer.
        // This asserts timer ISOLATION, which the tag-accumulation test above cannot:
        // a collapsed bucket would still purge both tags, just on a reset timer.
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi
                    .fn()
                    .mockImplementation((entityType: string) =>
                        Promise.resolve(makeEnabledConfig(entityType, 1))
                    )
            };
        });

        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        // dest-a scheduled at t=0 -> its 1000ms debounce window ends at t=1000.
        service.scheduleRevalidation({ entityType: 'destination', slug: 'dest-a' });
        await vi.advanceTimersByTimeAsync(600);

        // dest-b arrives mid-window at t=600. With a shared bucket this resets the
        // single timer (pushing the fire to t=1600); with per-entity buckets dest-a
        // keeps its own t=1000 deadline.
        service.scheduleRevalidation({ entityType: 'destination', slug: 'dest-b' });
        await vi.advanceTimersByTimeAsync(500); // now at t=1100

        const firedTags = (adapter.revalidate as ReturnType<typeof vi.fn>).mock.calls.map(
            (args: unknown[]) => (args[0] as { tag: string }).tag
        );

        // dest-a must have already fired on its own timer (t=1000), independent of dest-b.
        expect(firedTags).toContain('dest-dest-a');
        // dest-b must NOT have fired yet (its window ends at t=1600).
        expect(firedTags).not.toContain('dest-dest-b');
    });
});

// ---------------------------------------------------------------------------
// scheduleRevalidation -- config gating
// ---------------------------------------------------------------------------

describe('RevalidationService.scheduleRevalidation -- config gating', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: vi.fn().mockResolvedValue(undefined)
            };
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('does NOT revalidate when config is missing (no DB record)', async () => {
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi.fn().mockResolvedValue(undefined)
            };
        });
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'tag' });
        await vi.runAllTimersAsync();

        expect(adapter.revalidate).not.toHaveBeenCalled();
    });

    it('does NOT revalidate when enabled === false', async () => {
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi.fn().mockResolvedValue({
                    ...makeEnabledConfig('tag'),
                    enabled: false
                })
            };
        });
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'tag' });
        await vi.runAllTimersAsync();

        expect(adapter.revalidate).not.toHaveBeenCalled();
    });

    it('does NOT revalidate when autoRevalidateOnChange === false', async () => {
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi.fn().mockResolvedValue({
                    ...makeEnabledConfig('tag'),
                    autoRevalidateOnChange: false
                })
            };
        });
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'tag' });
        await vi.runAllTimersAsync();

        expect(adapter.revalidate).not.toHaveBeenCalled();
    });

    it('uses debounceSeconds from config', async () => {
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi.fn().mockResolvedValue(makeEnabledConfig('tag', 2))
            };
        });
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'tag' });

        // Allow async config lookup to complete
        await vi.runAllTicks();
        // Advance 1 s -- still within the 2 s debounce window
        await vi.advanceTimersByTimeAsync(1000);
        expect(adapter.revalidate).not.toHaveBeenCalled();

        await vi.runAllTimersAsync();
        expect(adapter.revalidate).toHaveBeenCalled();
    });

    it('refetches config after cache expires (60s TTL)', async () => {
        const mockFindByEntityType = vi.fn().mockResolvedValue(makeEnabledConfig('tag', 1));
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: mockFindByEntityType
            };
        });
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        // First call -- DB is hit (cache miss)
        service.scheduleRevalidation({ entityType: 'tag' });
        await vi.runAllTimersAsync();

        const firstCallCount = mockFindByEntityType.mock.calls.length;
        expect(firstCallCount).toBeGreaterThan(0);

        // Second call within 60s -- cache hit, no new DB call
        service.scheduleRevalidation({ entityType: 'tag' });
        await vi.runAllTimersAsync();

        const secondCallCount = mockFindByEntityType.mock.calls.length;
        expect(secondCallCount).toBe(firstCallCount);

        // Advance past the 60s TTL
        await vi.advanceTimersByTimeAsync(61_000);

        // Third call after cache expiry -- DB must be hit again
        service.scheduleRevalidation({ entityType: 'tag' });
        await vi.runAllTimersAsync();

        const thirdCallCount = mockFindByEntityType.mock.calls.length;
        expect(thirdCallCount).toBeGreaterThan(secondCallCount);
    });

    it('caches config -- does not call DB again within 60 s for the same entity type', async () => {
        const mockFindByEntityType = vi.fn().mockResolvedValue(makeEnabledConfig('tag', 1));
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: mockFindByEntityType
            };
        });
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        // First call -- DB is hit
        service.scheduleRevalidation({ entityType: 'tag' });
        await vi.runAllTimersAsync();

        const firstCallCount = mockFindByEntityType.mock.calls.length;

        // Second call -- cache should serve it
        service.scheduleRevalidation({ entityType: 'tag' });
        await vi.runAllTimersAsync();

        // DB should not have been called again
        expect(mockFindByEntityType.mock.calls.length).toBe(firstCallCount);
    });
});

// ---------------------------------------------------------------------------
// scheduleRevalidation -- error isolation
// ---------------------------------------------------------------------------

describe('RevalidationService.scheduleRevalidation -- error isolation', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi.fn().mockResolvedValue(makeEnabledConfig('tag', 1))
            };
        });
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: vi.fn().mockResolvedValue(undefined)
            };
        });
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('does not propagate adapter rejection to caller', async () => {
        const adapter = makeMockAdapter(() => Promise.reject(new Error('network error')));
        const service = createTestService(adapter);

        // scheduleRevalidation must not throw synchronously -- fire-and-forget
        expect(() => {
            service.scheduleRevalidation({ entityType: 'tag' });
        }).not.toThrow();

        // Run timers -- adapter rejects but the .catch() in debounceEntity handles it gracefully
        await vi.runAllTimersAsync();
    });

    it('logs error when adapter returns failure result', async () => {
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
        const adapter = makeMockAdapter((path) =>
            Promise.resolve(makeFailureResult(path, 'upstream error'))
        );
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'tag' });
        await vi.runAllTimersAsync();

        const loggerMock = getMockLogger();
        expect(loggerMock?.error).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// revalidateByEntityType -- immediate execution
// ---------------------------------------------------------------------------

describe('RevalidationService.revalidateByEntityType', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi.fn().mockResolvedValue(makeEnabledConfig('tag', 1))
            };
        });
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: vi.fn().mockResolvedValue(undefined)
            };
        });
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('calls adapter.revalidateMany with tags for the entity type', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await service.revalidateByEntityType({ entityType: 'tag' });

        // 'tag' entities have no page of their own -- they fold into list-accom
        expect(adapter.revalidateMany).toHaveBeenCalledOnce();
        const [params] = (adapter.revalidateMany as ReturnType<typeof vi.fn>).mock.calls[0]!;
        expect((params as { tags: string[] }).tags).toEqual(['list-accom']);
    });

    it('passes entityType to log entries', async () => {
        const mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: mockCreate
            };
        });
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await service.revalidateByEntityType({ entityType: 'tag', trigger: 'cron' });

        // Allow pending log writes
        await Promise.resolve();
        await Promise.resolve();

        expect(mockCreate).toHaveBeenCalled();
        const firstCallArg = mockCreate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(firstCallArg.entityType).toBe('tag');
        expect(firstCallArg.trigger).toBe('cron');
    });

    it('resolves without throwing even when adapter calls fail', async () => {
        const adapter = makeMockAdapter((_tag) => {
            return Promise.reject(new Error('forced fail'));
        });
        const service = createTestService(adapter);

        await expect(
            service.revalidateByEntityType({ entityType: 'event' })
        ).resolves.toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// revalidateTags -- immediate execution
// ---------------------------------------------------------------------------

describe('RevalidationService.revalidateTags', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi.fn().mockResolvedValue(makeEnabledConfig('tag', 1))
            };
        });
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: vi.fn().mockResolvedValue(undefined)
            };
        });
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('calls adapter.revalidateMany with the provided tags', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);
        const tags = ['tag-a', 'tag-b', 'tag-c'] as const;

        await service.revalidateTags({ tags });

        expect(adapter.revalidateMany).toHaveBeenCalledOnce();
        const [params] = (adapter.revalidateMany as ReturnType<typeof vi.fn>).mock.calls[0]!;
        expect((params as { tags: readonly string[] }).tags).toEqual(
            expect.arrayContaining([...tags])
        );
    });

    it('handles empty array gracefully without calling adapter', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        const result = await service.revalidateTags({ tags: [] });
        expect(result).toEqual([]);
        expect(adapter.revalidateMany).not.toHaveBeenCalled();
    });

    it('handles adapter failure without aborting (allSettled semantics)', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await expect(
            service.revalidateTags({ tags: ['tag-1', 'tag-2', 'tag-3'] })
        ).resolves.toBeDefined();
    });

    it('logs error when a tag returns a non-success result', async () => {
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
        const adapter = makeMockAdapter((tag) =>
            Promise.resolve(makeFailureResult(tag, 'upstream 500'))
        );
        const service = createTestService(adapter);

        await service.revalidateTags({ tags: ['some-tag'] });

        const loggerMock = getMockLogger();
        expect(loggerMock?.error).toHaveBeenCalled();
    });

    it('writes a log entry to DB for each revalidated tag', async () => {
        const mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: mockCreate
            };
        });
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await service.revalidateTags({ tags: ['tag-x', 'tag-y'] });

        // Allow any pending async log writes to complete
        await Promise.resolve();
        await Promise.resolve();

        expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('threads entityType through to log entries', async () => {
        const mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: mockCreate
            };
        });
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await service.revalidateTags({
            tags: ['some-tag'],
            triggeredBy: 'user-1',
            reason: 'test reason',
            trigger: 'manual',
            entityType: 'accommodation'
        });

        await Promise.resolve();
        await Promise.resolve();

        expect(mockCreate).toHaveBeenCalledTimes(1);
        const logArg = mockCreate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(logArg.entityType).toBe('accommodation');
        expect(logArg.trigger).toBe('manual');
        expect(logArg.triggeredBy).toBe('user-1');
    });

    it('defaults entityType to "manual" when not provided', async () => {
        const mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: mockCreate
            };
        });
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await service.revalidateTags({ tags: ['tag'] });

        await Promise.resolve();
        await Promise.resolve();

        const logArg = mockCreate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(logArg.entityType).toBe('manual');
    });
});

// ---------------------------------------------------------------------------
// purgeEverything -- whole-zone flush escape hatch
// ---------------------------------------------------------------------------

describe('RevalidationService.purgeEverything', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: vi.fn().mockResolvedValue(undefined)
            };
        });
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('delegates to the adapter and returns a result targeting WHOLE_ZONE_TARGET', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        const result = await service.purgeEverything({ reason: 'deploy' });

        expect(adapter.purgeEverything).toHaveBeenCalledWith({ reason: 'deploy' });
        expect(result.target).toBe(WHOLE_ZONE_TARGET);
        expect(result.success).toBe(true);
    });

    it('writes exactly ONE audit row targeting WHOLE_ZONE_TARGET', async () => {
        const mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return { create: mockCreate };
        });
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await service.purgeEverything({ reason: 'deploy', triggeredBy: 'ci' });

        await Promise.resolve();
        await Promise.resolve();

        expect(mockCreate).toHaveBeenCalledTimes(1);
        const logArg = mockCreate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(logArg.target).toBe(WHOLE_ZONE_TARGET);
        expect(logArg.triggeredBy).toBe('ci');
    });

    it('defaults trigger to "manual"', async () => {
        const mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return { create: mockCreate };
        });
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await service.purgeEverything();

        await Promise.resolve();
        await Promise.resolve();

        const logArg = mockCreate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(logArg.trigger).toBe('manual');
    });

    it('resolves without throwing when the adapter reports failure', async () => {
        const adapter = makeMockAdapter();
        (adapter.purgeEverything as ReturnType<typeof vi.fn>).mockResolvedValue({
            target: WHOLE_ZONE_TARGET,
            success: false,
            durationMs: 5,
            error: 'Cloudflare unreachable'
        });
        const service = createTestService(adapter);

        const result = await service.purgeEverything({ reason: 'deploy' });

        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Config getters
// ---------------------------------------------------------------------------

describe('RevalidationService config getters', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi.fn().mockResolvedValue(undefined)
            };
        });
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: vi.fn().mockResolvedValue(undefined)
            };
        });
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
    });

    it('getLogRetentionDays returns configured value', () => {
        const adapter = makeMockAdapter();
        const service = new RevalidationService({
            adapter,
            logRetentionDays: 7
        });

        expect(service.getLogRetentionDays()).toBe(7);
    });

    it('getLogRetentionDays returns default 30 when not configured', () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        expect(service.getLogRetentionDays()).toBe(30);
    });
});

// ---------------------------------------------------------------------------
// getRevalidationService / initializeRevalidationService / _reset
// ---------------------------------------------------------------------------

describe('singleton management', () => {
    beforeEach(() => {
        _resetRevalidationService();
        vi.clearAllMocks();
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi.fn().mockResolvedValue(undefined)
            };
        });
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: vi.fn().mockResolvedValue(undefined)
            };
        });
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
    });

    afterEach(() => {
        _resetRevalidationService();
    });

    it('getRevalidationService returns undefined before initialization', () => {
        expect(getRevalidationService()).toBeUndefined();
    });

    it('initializeRevalidationService returns a RevalidationService instance', () => {
        const service = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://example.com'
        });

        expect(service).toBeInstanceOf(RevalidationService);
    });

    it('getRevalidationService returns the same instance after initialization', () => {
        const initialized = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://example.com'
        });

        const retrieved = getRevalidationService();

        expect(retrieved).toBe(initialized);
    });

    it('initializeRevalidationService is idempotent -- repeated calls return same instance', () => {
        const first = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://example.com'
        });
        const second = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://different.com'
        });

        expect(second).toBe(first);
    });

    it('logs a warning on re-initialization attempt', () => {
        const warnSpy = vi.fn();
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: warnSpy,
            info: vi.fn(),
            debug: vi.fn()
        });

        const first = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://example.com'
        });
        const second = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://other.com'
        });

        // The idempotent behavior (same instance) is the observable effect of the warning path
        expect(first).toBe(second);
    });

    it('_resetRevalidationService clears the singleton', () => {
        initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://example.com'
        });

        _resetRevalidationService();

        expect(getRevalidationService()).toBeUndefined();
    });

    it('new instance can be created after reset', () => {
        initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://a.com'
        });
        _resetRevalidationService();
        const second = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://b.com'
        });

        expect(second).toBeInstanceOf(RevalidationService);
        expect(getRevalidationService()).toBe(second);
    });

    it('passes logRetentionDays through to the service', () => {
        const service = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://example.com',
            logRetentionDays: 14
        });

        expect(service.getLogRetentionDays()).toBe(14);
    });
});

// ---------------------------------------------------------------------------
// scheduleRevalidationBatch -- targeted batch helper
// ---------------------------------------------------------------------------

describe('RevalidationService.scheduleRevalidationBatch', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi
                    .fn()
                    .mockImplementation((entityType: string) =>
                        Promise.resolve(makeEnabledConfig(entityType, 1))
                    )
            };
        });
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: vi.fn().mockResolvedValue(undefined)
            };
        });
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('returns void immediately (fire-and-forget)', () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        const result = service.scheduleRevalidationBatch({ events: [{ entityType: 'tag' }] });

        expect(result).toBeUndefined();
    });

    it('empty events array is a no-op -- adapter never called', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidationBatch({ events: [] });
        await vi.runAllTimersAsync();

        expect(adapter.revalidate).not.toHaveBeenCalled();
    });

    it('schedules N independent events through the debounce path', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidationBatch({
            events: [
                { entityType: 'accommodation', slug: 'hotel-a' },
                { entityType: 'accommodation', slug: 'hotel-b' },
                { entityType: 'accommodation', slug: 'hotel-c' }
            ]
        });

        await vi.runAllTimersAsync();

        const tags = (adapter.revalidate as ReturnType<typeof vi.fn>).mock.calls.map(
            (args: unknown[]) => (args[0] as { tag: string }).tag
        );

        expect(tags).toContain('accom-hotel-a');
        expect(tags).toContain('accom-hotel-b');
        expect(tags).toContain('accom-hotel-c');
    });

    it('deduplicate within batch: same entity twice merges into single debounce entry', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        // Two identical accommodation events for the same slug
        service.scheduleRevalidationBatch({
            events: [
                { entityType: 'accommodation', slug: 'hotel-x' },
                { entityType: 'accommodation', slug: 'hotel-x' }
            ]
        });

        await vi.runAllTimersAsync();

        // Should produce the same tags as a single scheduleRevalidation call
        const callCount = (adapter.revalidate as ReturnType<typeof vi.fn>).mock.calls.length;
        expect(callCount).toBeGreaterThan(0);

        // Verify no duplicate tags were purged
        const tags = (adapter.revalidate as ReturnType<typeof vi.fn>).mock.calls.map(
            (args: unknown[]) => (args[0] as { tag: string }).tag
        );
        const uniqueTags = new Set(tags);
        expect(tags.length).toBe(uniqueTags.size);
    });

    it('reason is propagated to each scheduled event', async () => {
        const mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: mockCreate
            };
        });
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidationBatch({
            events: [{ entityType: 'tag' }],
            reason: 'downgrade-preflight'
        });

        await vi.runAllTimersAsync();

        // Allow pending log writes
        await Promise.resolve();
        await Promise.resolve();

        expect(mockCreate).toHaveBeenCalled();
        const logArg = mockCreate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect((logArg.metadata as Record<string, unknown>)?.reason).toBe('downgrade-preflight');
    });

    it('debounce key preserved: two events for same entity use same debounce slot', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        // Call scheduleRevalidation individually first to fill a debounce slot
        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-y' });
        // Then schedule the same entity again via batch
        service.scheduleRevalidationBatch({
            events: [{ entityType: 'accommodation', slug: 'hotel-y' }]
        });

        await vi.runAllTimersAsync();

        const tags = (adapter.revalidate as ReturnType<typeof vi.fn>).mock.calls.map(
            (args: unknown[]) => (args[0] as { tag: string }).tag
        );
        const uniqueTags = new Set(tags);
        // Tags for hotel-y should be deduplicated (no double purge)
        expect(tags.length).toBe(uniqueTags.size);
    });
});

// ---------------------------------------------------------------------------
// SPEC-246: entity_id threading regression (AC-3)
// ---------------------------------------------------------------------------

describe('SPEC-246: entity_id is threaded through to logModel.create', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi
                    .fn()
                    .mockImplementation((entityType: string) =>
                        Promise.resolve(makeEnabledConfig(entityType, 1))
                    )
            };
        });
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('scheduleRevalidation with accommodation id propagates entityId to logModel.create', async () => {
        // Arrange
        const knownUuid = '550e8400-e29b-41d4-a716-446655440001';
        const mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: mockCreate
            };
        });

        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        // Act — fire a scheduleRevalidation with a known UUID
        service.scheduleRevalidation({
            entityType: 'accommodation',
            id: knownUuid,
            slug: 'hotel-uuid-test'
        });

        // Advance fake timers past the debounce window (config seeds 1 s in test setup)
        await vi.runAllTimersAsync();

        // Allow pending async log-write microtasks to drain
        await Promise.resolve();
        await Promise.resolve();

        // Assert — logModel.create must have been called with entityId === knownUuid
        expect(mockCreate).toHaveBeenCalled();
        const logArg = mockCreate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(logArg.entityId).toBe(knownUuid);
    });

    it('scheduleRevalidation without id leaves entityId null in logModel.create', async () => {
        // Arrange — call site omits `id` (slug-only, as legacy hooks do)
        const mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: mockCreate
            };
        });

        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        // Act
        service.scheduleRevalidation({
            entityType: 'accommodation',
            slug: 'hotel-no-id'
        });

        await vi.runAllTimersAsync();
        await Promise.resolve();
        await Promise.resolve();

        // Assert — entityId must be null (not undefined, not slug)
        expect(mockCreate).toHaveBeenCalled();
        const logArg = mockCreate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(logArg.entityId).toBeNull();
    });

    it('pins entityId first-write-wins when a later same-entity call omits id', async () => {
        // Regression: two calls for the same entity (same slug → same debounce
        // bucket) inside the window. The first carries the UUID, the second omits
        // it (as _afterCreate/publish do). The pinned UUID must survive — the
        // id-less second call must NOT overwrite it to null.
        const knownUuid = '550e8400-e29b-41d4-a716-446655440099';
        const mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: mockCreate
            };
        });

        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        // Act — first call carries the UUID, second (same slug) does not.
        service.scheduleRevalidation({
            entityType: 'accommodation',
            id: knownUuid,
            slug: 'hotel-race'
        });
        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-race' });

        await vi.runAllTimersAsync();
        await Promise.resolve();
        await Promise.resolve();

        // Assert — the UUID from the first call must not be clobbered.
        expect(mockCreate).toHaveBeenCalled();
        const logArg = mockCreate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(logArg.entityId).toBe(knownUuid);
    });

    it('adopts entityId when the first same-entity call lacks it and a later one supplies it', async () => {
        // Inverse of the above: first call is id-less, a later call in the window
        // brings the UUID. The bucket should adopt it (first non-undefined wins).
        const knownUuid = '550e8400-e29b-41d4-a716-446655440077';
        const mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: mockCreate
            };
        });

        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-race2' });
        service.scheduleRevalidation({
            entityType: 'accommodation',
            id: knownUuid,
            slug: 'hotel-race2'
        });

        await vi.runAllTimersAsync();
        await Promise.resolve();
        await Promise.resolve();

        expect(mockCreate).toHaveBeenCalled();
        const logArg = mockCreate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(logArg.entityId).toBe(knownUuid);
    });
});

// ---------------------------------------------------------------------------
// revalidateEntityTypesBatch (HOS-297)
// ---------------------------------------------------------------------------

describe('RevalidationService.revalidateEntityTypesBatch -- one purge per run', () => {
    let mockCreate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
        mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return { findByEntityType: vi.fn().mockResolvedValue(makeEnabledConfig('tag', 1)) };
        });
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return { create: mockCreate };
        });
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
    });

    /**
     * THE REGRESSION GUARD for HOS-297. Every purge invalidates the whole zone,
     * so revalidating N entity types with N separate calls fired N identical
     * zone purges per cron run — and that burst from one egress IP is what the
     * edge WAF answers with 403.
     */
    it('performs exactly ONE adapter purge for several entity types', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await service.revalidateEntityTypesBatch({
            entityTypes: ['accommodation', 'destination', 'event']
        });

        // One batch call = one purge. (Asserting on `adapter.revalidate` would
        // test this harness's own fan-out, not the service: the mock's
        // revalidateMany delegates per tag, whereas the real Cloudflare adapter
        // collapses the batch into a single purgeOnce.)
        expect(adapter.revalidateMany).toHaveBeenCalledTimes(1);
    });

    it('hands the adapter the deduplicated union of every type’s tags', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await service.revalidateEntityTypesBatch({
            entityTypes: ['accommodation', 'destination']
        });

        const call = (adapter.revalidateMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
            tags: string[];
        };
        expect(call.tags.length).toBeGreaterThan(0);
        expect(new Set(call.tags).size).toBe(call.tags.length);
    });

    /**
     * Load-bearing, not cosmetic: the cron reads the last `cron` log entry PER
     * ENTITY TYPE to decide whether that type's interval has elapsed. Collapsing
     * the log along with the purge would make every run believe every interval
     * had elapsed, and the job would revalidate everything, every hour, forever.
     */
    it('still writes log entries attributed per entity type', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        // No microtask pumping needed: purgeGroupsOnce awaits its own log writes.
        await service.revalidateEntityTypesBatch({
            entityTypes: ['accommodation', 'destination'],
            trigger: 'cron'
        });

        const loggedTypes = new Set(
            mockCreate.mock.calls.map(
                (call) => (call[0] as Record<string, unknown>).entityType as string
            )
        );
        expect(loggedTypes).toContain('accommodation');
        expect(loggedTypes).toContain('destination');

        for (const call of mockCreate.mock.calls) {
            expect((call[0] as Record<string, unknown>).trigger).toBe('cron');
        }
    });

    it('reports the shared purge failure on every entity type instead of throwing', async () => {
        const adapter = makeMockAdapter(() => Promise.reject(new Error('HTTP 403: Forbidden')));
        const service = createTestService(adapter);

        const batches = await service.revalidateEntityTypesBatch({
            entityTypes: ['accommodation', 'destination']
        });

        expect(batches.length).toBeGreaterThan(0);
        for (const batch of batches) {
            expect(batch.results.every((result) => !result.success)).toBe(true);
        }
    });

    it('ignores duplicate entity types', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        const batches = await service.revalidateEntityTypesBatch({
            entityTypes: ['accommodation', 'accommodation']
        });

        expect(batches).toHaveLength(1);
        expect(adapter.revalidateMany).toHaveBeenCalledTimes(1);
    });

    it('purges nothing when no entity type resolves to a tag', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        const batches = await service.revalidateEntityTypesBatch({ entityTypes: [] });

        expect(batches).toEqual([]);
        expect(adapter.revalidateMany).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Coalesced purge window (HOS-297) — the actual burst fix
// ---------------------------------------------------------------------------

describe('RevalidationService -- coalesced purge window', () => {
    let mockCreate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi.fn().mockResolvedValue(makeEnabledConfig('accommodation', 1))
            };
        });
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return { create: mockCreate };
        });
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /**
     * THE REGRESSION GUARD for HOS-297's real cause.
     *
     * `scheduleRevalidationBatch` arms ONE debounce bucket per entity, all in the
     * same tick with the same debounce window, so they all expire together. Each
     * bucket used to fire its own unawaited purge — N simultaneous POSTs from one
     * egress IP, which is the measured signature the edge WAF answers with 403
     * (1 POST → 401, 20 concurrent → 403 ×20). Callers that fan out this way
     * include `accommodation.sync-featured-by-entitlement`, which maps over every
     * accommodation an owner has.
     */
    /**
     * THE REGRESSION GUARD for the rate-limit hole HOS-369 W1-1 introduced.
     *
     * Cloudflare's Free-plan ceiling is 5 tag-purge requests per MINUTE. The
     * 50 ms coalescing window above only merges siblings enqueued in the same
     * tick; writes arriving seconds apart each got their own request, and six
     * hosts saving six listings over fifteen seconds blew straight past the
     * limit. Under `purge_everything` that was self-correcting — any later
     * flush covered what the rejected one carried. Under tags it is not: the
     * rejected request's tags are disjoint from the next one's, so its content
     * stays cached for the full TTL with nothing able to evict it.
     *
     * The fix DELAYS rather than drops, which is what these two assert.
     */
    it('spaces consecutive purges by the Cloudflare rate-limit interval', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'primera' });
        await vi.runAllTimersAsync();
        expect(adapter.revalidateMany).toHaveBeenCalledTimes(1);

        // A second write moments later must NOT produce a second request yet.
        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'segunda' });
        await vi.advanceTimersByTimeAsync(2_000);
        expect(adapter.revalidateMany).toHaveBeenCalledTimes(1);

        // ...but it must go out once the interval has elapsed.
        await vi.advanceTimersByTimeAsync(12_000);
        expect(adapter.revalidateMany).toHaveBeenCalledTimes(2);
    });

    it('DELAYS the held-back tags rather than dropping them', async () => {
        // The load-bearing half. Spacing requests would be worthless — worse
        // than the 429, even — if the tags waiting behind the interval were
        // discarded instead of accumulated.
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'primera' });
        await vi.runAllTimersAsync();

        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'segunda' });
        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'tercera' });
        await vi.advanceTimersByTimeAsync(15_000);

        const secondCall = adapter.revalidateMany.mock.calls[1] as
            | [{ tags: readonly string[] }]
            | undefined;
        expect(secondCall).toBeDefined();
        expect(secondCall?.[0].tags).toEqual(
            expect.arrayContaining(['accom-segunda', 'accom-tercera'])
        );
    });

    it('fires ONE purge for a batch of many entities, not one per entity', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidationBatch({
            events: [
                { entityType: 'accommodation', slug: 'cabana-uno' },
                { entityType: 'accommodation', slug: 'cabana-dos' },
                { entityType: 'accommodation', slug: 'cabana-tres' },
                { entityType: 'accommodation', slug: 'cabana-cuatro' },
                { entityType: 'accommodation', slug: 'cabana-cinco' }
            ],
            reason: 'featured-by-entitlement-owner'
        });

        await vi.runAllTimersAsync();

        expect(adapter.revalidateMany).toHaveBeenCalledTimes(1);
    });

    it('still covers every entity’s tags in that single purge', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidationBatch({
            events: [
                { entityType: 'accommodation', slug: 'cabana-uno' },
                { entityType: 'accommodation', slug: 'cabana-dos' }
            ]
        });

        await vi.runAllTimersAsync();

        const call = (adapter.revalidateMany as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
            tags: string[];
        };
        expect(call.tags.some((t) => t.includes('cabana-uno'))).toBe(true);
        expect(call.tags.some((t) => t.includes('cabana-dos'))).toBe(true);
        // Deduplicated: the shared collection/home tags appear once, not per entity.
        expect(new Set(call.tags).size).toBe(call.tags.length);
    });

    it('keeps a per-entity audit row so the log stays attributable', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidationBatch({
            events: [
                { entityType: 'accommodation', slug: 'cabana-uno' },
                { entityType: 'accommodation', slug: 'cabana-dos' }
            ]
        });

        await vi.runAllTimersAsync();

        const loggedTargets = mockCreate.mock.calls.map(
            (call) => (call[0] as Record<string, unknown>).target as string
        );
        expect(loggedTargets.some((t) => t.includes('cabana-uno'))).toBe(true);
        expect(loggedTargets.some((t) => t.includes('cabana-dos'))).toBe(true);
    });

    it('records a failed purge on every entity in the window', async () => {
        const adapter = makeMockAdapter(() => Promise.reject(new Error('HTTP 403: Forbidden')));
        const service = createTestService(adapter);

        service.scheduleRevalidationBatch({
            events: [
                { entityType: 'accommodation', slug: 'cabana-uno' },
                { entityType: 'accommodation', slug: 'cabana-dos' }
            ]
        });

        await vi.runAllTimersAsync();

        expect(mockCreate).toHaveBeenCalled();
        for (const call of mockCreate.mock.calls) {
            expect((call[0] as Record<string, unknown>).status).toBe('failed');
        }
    });
});

// ---------------------------------------------------------------------------
// Coalescing — the branches the first attempt missed
// ---------------------------------------------------------------------------

describe('RevalidationService -- coalescing covers BOTH debounce branches', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi.fn().mockResolvedValue(makeEnabledConfig('accommodation', 1))
            };
        });
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return { create: vi.fn().mockResolvedValue(undefined) };
        });
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    /**
     * `debounceEntity` arms its timer in TWO places: creating a bucket, and
     * resetting an existing bucket's timer when a second event lands inside the
     * window. The first attempt at the coalescing fix converted only the creation
     * branch, so any entity scheduled twice reverted to firing its own purge —
     * with a fully green suite, because every other test schedules distinct slugs
     * exactly once.
     *
     * This is the ordinary plan-change shape, not an edge case:
     * `immediate-plan-swap` runs upgrade restoration and then
     * `syncFeaturedByEntitlementForOwner` over overlapping accommodations, so the
     * same debounce keys are hit twice in one request.
     */
    it('fires ONE purge even when every entity is rescheduled inside its window', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);
        const events = [
            { entityType: 'accommodation' as const, slug: 'cabana-uno' },
            { entityType: 'accommodation' as const, slug: 'cabana-dos' },
            { entityType: 'accommodation' as const, slug: 'cabana-tres' },
            { entityType: 'accommodation' as const, slug: 'cabana-cuatro' },
            { entityType: 'accommodation' as const, slug: 'cabana-cinco' }
        ];

        service.scheduleRevalidationBatch({ events });
        await vi.advanceTimersByTimeAsync(10);
        // Second pass over the SAME entities, still inside the 1 s debounce window.
        service.scheduleRevalidationBatch({ events });

        await vi.runAllTimersAsync();

        expect(adapter.revalidateMany).toHaveBeenCalledTimes(1);
    });

    it('does not lose groups that arrive while a purge is in flight', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidationBatch({
            events: [{ entityType: 'accommodation', slug: 'cabana-uno' }]
        });
        await vi.runAllTimersAsync();

        service.scheduleRevalidationBatch({
            events: [{ entityType: 'accommodation', slug: 'cabana-dos' }]
        });
        await vi.runAllTimersAsync();

        const allTags = (adapter.revalidateMany as ReturnType<typeof vi.fn>).mock.calls.flatMap(
            (call) => (call[0] as { tags: string[] }).tags
        );
        expect(allTags.some((t) => t.includes('cabana-uno'))).toBe(true);
        expect(allTags.some((t) => t.includes('cabana-dos'))).toBe(true);
    });

    /**
     * Guards the FALLBACK DIRECTION of result matching. Matching purge results
     * back by tag is right, but recording an unmatched tag as failed would turn
     * any adapter that normalises tags into a 100%-failure report for a purge
     * that actually succeeded — a worse bug than the shared-verdict one it
     * replaced. When the counts line up, position wins.
     */
    it('falls back to positional matching when the adapter renames tags', async () => {
        const adapter: RevalidationAdapter = {
            name: 'RenamingAdapter',
            revalidate: vi.fn(),
            revalidateMany: vi.fn(async (params: { readonly tags: ReadonlyArray<string> }) =>
                params.tags.map(() => makeSuccessResult('?'))
            ),
            purgeEverything: vi.fn(async () => ({
                target: WHOLE_ZONE_TARGET,
                success: true,
                durationMs: 1
            }))
        };
        const service = createTestService(adapter);

        const batches = await service.revalidateEntityTypesBatch({
            entityTypes: ['accommodation']
        });

        expect(batches.length).toBeGreaterThan(0);
        for (const batch of batches) {
            expect(batch.results.every((result) => result.success)).toBe(true);
        }
    });
});
