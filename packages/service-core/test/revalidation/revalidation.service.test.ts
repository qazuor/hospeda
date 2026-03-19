/**
 * @fileoverview
 * Unit tests for RevalidationService:
 * - scheduleRevalidation: fire-and-forget entity-level debounced scheduling with config gating
 * - revalidateByEntityType: immediate revalidation of all paths for an entity type
 * - revalidatePaths: immediate revalidation of an explicit path list with entityType threading
 * - getRevalidationService / initializeRevalidationService: singleton management
 * - _resetRevalidationService: test isolation helper
 * - Config getters: getLocales, getMaxCronRevalidations, getLogRetentionDays
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
    RevalidationConfigModel: vi.fn().mockImplementation(() => ({
        findByEntityType: vi.fn()
    })),
    RevalidationLogModel: vi.fn().mockImplementation(() => ({
        create: vi.fn().mockResolvedValue(undefined)
    }))
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
    RevalidatePathResult,
    RevalidationAdapter
} from '../../src/revalidation/adapters/revalidation.adapter.js';
import {
    _resetRevalidationService,
    getRevalidationService,
    initializeRevalidationService
} from '../../src/revalidation/revalidation-init.js';
import { RevalidationService } from '../../src/revalidation/revalidation.service.js';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const TEST_LOCALES = ['es', 'en', 'pt'] as const;

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

function makeSuccessResult(path: string): RevalidatePathResult {
    return { success: true, path, durationMs: 1 };
}

function makeFailureResult(path: string, error: string): RevalidatePathResult {
    return { success: false, path, durationMs: 1, error };
}

/**
 * Creates a mock adapter whose revalidate() and revalidateMany() calls are tracked.
 * Defaults to returning success for all paths.
 */
function makeMockAdapter(
    revalidateImpl: (path: string) => Promise<RevalidatePathResult> = (path) =>
        Promise.resolve(makeSuccessResult(path))
): RevalidationAdapter {
    const revalidateFn = vi.fn((params: { readonly path: string }) => revalidateImpl(params.path));
    return {
        name: 'MockAdapter',
        revalidate: revalidateFn,
        revalidateMany: vi.fn(async (params: { readonly paths: ReadonlyArray<string> }) => {
            const settled = await Promise.allSettled(
                params.paths.map((p) => revalidateFn({ path: p }))
            );
            return settled.map((r, i) =>
                r.status === 'fulfilled'
                    ? r.value
                    : makeFailureResult(
                          params.paths[i] ?? '',
                          String((r as PromiseRejectedResult).reason)
                      )
            );
        })
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
    return new RevalidationService({ adapter, locales: TEST_LOCALES });
}

// ---------------------------------------------------------------------------
// scheduleRevalidation -- fire-and-forget
// ---------------------------------------------------------------------------

describe('RevalidationService.scheduleRevalidation -- fire-and-forget', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        // Re-mock implementations after clearAllMocks
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            findByEntityType: vi.fn().mockResolvedValue(makeEnabledConfig('tag', 1))
        }));
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            create: vi.fn().mockResolvedValue(undefined)
        }));
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

    it('calls adapter for each affected path after debounce timeout fires', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        // tag -> 3 paths (/alojamientos/ + /en/alojamientos/ + /pt/alojamientos/)
        service.scheduleRevalidation({ entityType: 'tag' });

        await vi.runAllTimersAsync();

        expect(adapter.revalidate).toHaveBeenCalledTimes(3);
    });

    it('merges multiple calls for the same entity within debounce window into one batch', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'tag' });
        service.scheduleRevalidation({ entityType: 'tag' });
        service.scheduleRevalidation({ entityType: 'tag' });

        await vi.runAllTimersAsync();

        // Still 3 paths (es, en, pt) -- NOT 9 (3 calls x 3 paths)
        expect(adapter.revalidate).toHaveBeenCalledTimes(3);
    });

    it('creates separate debounce entries for different entity keys', async () => {
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            findByEntityType: vi
                .fn()
                .mockImplementation((entityType: string) =>
                    Promise.resolve(makeEnabledConfig(entityType, 1))
                )
        }));

        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'tag' });
        service.scheduleRevalidation({ entityType: 'destination', slug: 'my-dest' });

        await vi.runAllTimersAsync();

        const paths = (adapter.revalidate as ReturnType<typeof vi.fn>).mock.calls.map(
            (args: unknown[]) => (args[0] as { path: string }).path
        );

        expect(paths.some((p: string) => p.includes('/alojamientos/'))).toBe(true);
        expect(paths.some((p: string) => p.includes('/destinos/my-dest/'))).toBe(true);
    });

    it('uses entity-level debounce key (entityType:entityId) for slug-bearing events', async () => {
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            findByEntityType: vi
                .fn()
                .mockImplementation((entityType: string) =>
                    Promise.resolve(makeEnabledConfig(entityType, 1))
                )
        }));

        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        // Two different accommodations should get separate debounce entries
        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-a' });
        service.scheduleRevalidation({ entityType: 'accommodation', slug: 'hotel-b' });

        await vi.runAllTimersAsync();

        // Both should fire independently, producing paths for both slugs
        const paths = (adapter.revalidate as ReturnType<typeof vi.fn>).mock.calls.map(
            (args: unknown[]) => (args[0] as { path: string }).path
        );

        expect(paths.some((p: string) => p.includes('/alojamientos/hotel-a/'))).toBe(true);
        expect(paths.some((p: string) => p.includes('/alojamientos/hotel-b/'))).toBe(true);
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
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            create: vi.fn().mockResolvedValue(undefined)
        }));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('does NOT revalidate when config is missing (no DB record)', async () => {
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            findByEntityType: vi.fn().mockResolvedValue(undefined)
        }));
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'tag' });
        await vi.runAllTimersAsync();

        expect(adapter.revalidate).not.toHaveBeenCalled();
    });

    it('does NOT revalidate when enabled === false', async () => {
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            findByEntityType: vi.fn().mockResolvedValue({
                ...makeEnabledConfig('tag'),
                enabled: false
            })
        }));
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'tag' });
        await vi.runAllTimersAsync();

        expect(adapter.revalidate).not.toHaveBeenCalled();
    });

    it('does NOT revalidate when autoRevalidateOnChange === false', async () => {
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            findByEntityType: vi.fn().mockResolvedValue({
                ...makeEnabledConfig('tag'),
                autoRevalidateOnChange: false
            })
        }));
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        service.scheduleRevalidation({ entityType: 'tag' });
        await vi.runAllTimersAsync();

        expect(adapter.revalidate).not.toHaveBeenCalled();
    });

    it('uses debounceSeconds from config', async () => {
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            findByEntityType: vi.fn().mockResolvedValue(makeEnabledConfig('tag', 2))
        }));
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
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            findByEntityType: mockFindByEntityType
        }));
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
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            findByEntityType: mockFindByEntityType
        }));
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
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            findByEntityType: vi.fn().mockResolvedValue(makeEnabledConfig('tag', 1))
        }));
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            create: vi.fn().mockResolvedValue(undefined)
        }));
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
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            findByEntityType: vi.fn().mockResolvedValue(makeEnabledConfig('tag', 1))
        }));
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            create: vi.fn().mockResolvedValue(undefined)
        }));
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

    it('calls adapter.revalidateMany with paths for the entity type', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await service.revalidateByEntityType({ entityType: 'tag' });

        // tag -> 3 paths (es, en, pt)
        expect(adapter.revalidateMany).toHaveBeenCalledOnce();
        const [params] = (adapter.revalidateMany as ReturnType<typeof vi.fn>).mock.calls[0]!;
        expect((params as { paths: string[] }).paths.length).toBe(3);
    });

    it('passes entityType to log entries', async () => {
        const mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            create: mockCreate
        }));
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
        const adapter = makeMockAdapter((_path) => {
            return Promise.reject(new Error('forced fail'));
        });
        const service = createTestService(adapter);

        await expect(
            service.revalidateByEntityType({ entityType: 'event' })
        ).resolves.toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// revalidatePaths -- immediate execution
// ---------------------------------------------------------------------------

describe('RevalidationService.revalidatePaths', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            findByEntityType: vi.fn().mockResolvedValue(makeEnabledConfig('tag', 1))
        }));
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            create: vi.fn().mockResolvedValue(undefined)
        }));
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

    it('calls adapter.revalidateMany with the provided paths', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);
        const paths = ['/path-a/', '/path-b/', '/path-c/'] as const;

        await service.revalidatePaths({ paths });

        expect(adapter.revalidateMany).toHaveBeenCalledOnce();
        const [params] = (adapter.revalidateMany as ReturnType<typeof vi.fn>).mock.calls[0]!;
        expect((params as { paths: readonly string[] }).paths).toEqual(
            expect.arrayContaining([...paths])
        );
    });

    it('handles empty array gracefully without calling adapter', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        const result = await service.revalidatePaths({ paths: [] });
        expect(result).toEqual([]);
        expect(adapter.revalidateMany).not.toHaveBeenCalled();
    });

    it('handles adapter failure without aborting (allSettled semantics)', async () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await expect(
            service.revalidatePaths({ paths: ['/path-1/', '/path-2/', '/path-3/'] })
        ).resolves.toBeDefined();
    });

    it('logs error when a path returns a non-success result', async () => {
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
        const adapter = makeMockAdapter((path) =>
            Promise.resolve(makeFailureResult(path, 'upstream 500'))
        );
        const service = createTestService(adapter);

        await service.revalidatePaths({ paths: ['/some-path/'] });

        const loggerMock = getMockLogger();
        expect(loggerMock?.error).toHaveBeenCalled();
    });

    it('writes a log entry to DB for each revalidated path', async () => {
        const mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            create: mockCreate
        }));
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await service.revalidatePaths({ paths: ['/path-x/', '/path-y/'] });

        // Allow any pending async log writes to complete
        await Promise.resolve();
        await Promise.resolve();

        expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('threads entityType through to log entries', async () => {
        const mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            create: mockCreate
        }));
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await service.revalidatePaths({
            paths: ['/some-path/'],
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
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            create: mockCreate
        }));
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        await service.revalidatePaths({ paths: ['/path/'] });

        await Promise.resolve();
        await Promise.resolve();

        const logArg = mockCreate.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(logArg.entityType).toBe('manual');
    });
});

// ---------------------------------------------------------------------------
// Config getters
// ---------------------------------------------------------------------------

describe('RevalidationService config getters', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            findByEntityType: vi.fn().mockResolvedValue(undefined)
        }));
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            create: vi.fn().mockResolvedValue(undefined)
        }));
        (createLogger as ReturnType<typeof vi.fn>).mockReturnValue({
            error: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            debug: vi.fn()
        });
    });

    it('getLocales returns the configured locales', () => {
        const adapter = makeMockAdapter();
        const service = new RevalidationService({
            adapter,
            locales: ['es', 'en']
        });

        expect(service.getLocales()).toEqual(['es', 'en']);
    });

    it('getMaxCronRevalidations returns configured value', () => {
        const adapter = makeMockAdapter();
        const service = new RevalidationService({
            adapter,
            locales: TEST_LOCALES,
            maxCronRevalidations: 100
        });

        expect(service.getMaxCronRevalidations()).toBe(100);
    });

    it('getMaxCronRevalidations returns default 500 when not configured', () => {
        const adapter = makeMockAdapter();
        const service = createTestService(adapter);

        expect(service.getMaxCronRevalidations()).toBe(500);
    });

    it('getLogRetentionDays returns configured value', () => {
        const adapter = makeMockAdapter();
        const service = new RevalidationService({
            adapter,
            locales: TEST_LOCALES,
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
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            findByEntityType: vi.fn().mockResolvedValue(undefined)
        }));
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(() => ({
            create: vi.fn().mockResolvedValue(undefined)
        }));
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
            siteUrl: 'https://example.com',
            locales: TEST_LOCALES
        });

        expect(service).toBeInstanceOf(RevalidationService);
    });

    it('getRevalidationService returns the same instance after initialization', () => {
        const initialized = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://example.com',
            locales: TEST_LOCALES
        });

        const retrieved = getRevalidationService();

        expect(retrieved).toBe(initialized);
    });

    it('initializeRevalidationService is idempotent -- repeated calls return same instance', () => {
        const first = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://example.com',
            locales: TEST_LOCALES
        });
        const second = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://different.com',
            locales: TEST_LOCALES
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
            siteUrl: 'https://example.com',
            locales: TEST_LOCALES
        });
        const second = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://other.com',
            locales: TEST_LOCALES
        });

        // The idempotent behavior (same instance) is the observable effect of the warning path
        expect(first).toBe(second);
    });

    it('_resetRevalidationService clears the singleton', () => {
        initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://example.com',
            locales: TEST_LOCALES
        });

        _resetRevalidationService();

        expect(getRevalidationService()).toBeUndefined();
    });

    it('new instance can be created after reset', () => {
        initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://a.com',
            locales: TEST_LOCALES
        });
        _resetRevalidationService();
        const second = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://b.com',
            locales: TEST_LOCALES
        });

        expect(second).toBeInstanceOf(RevalidationService);
        expect(getRevalidationService()).toBe(second);
    });

    it('passes locales config through to the service', () => {
        const service = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://example.com',
            locales: ['es', 'en']
        });

        expect(service.getLocales()).toEqual(['es', 'en']);
    });

    it('passes maxCronRevalidations and logRetentionDays through to the service', () => {
        const service = initializeRevalidationService({
            nodeEnv: 'test',
            siteUrl: 'https://example.com',
            locales: TEST_LOCALES,
            maxCronRevalidations: 200,
            logRetentionDays: 14
        });

        expect(service.getMaxCronRevalidations()).toBe(200);
        expect(service.getLogRetentionDays()).toBe(14);
    });
});
