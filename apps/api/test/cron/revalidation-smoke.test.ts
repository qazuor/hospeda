/**
 * Integration Smoke Test: Manual Revalidation Flow
 *
 * Exercises the full manual revalidation path at the service level:
 *   initializeRevalidationService (NoOp adapter)
 *     → revalidatePaths / revalidateByEntityType
 *       → NoOpRevalidationAdapter.revalidate (spy)
 *
 * This is an API-level integration smoke test — no HTTP layer involved.
 * The test verifies that the service wiring, path generation, and adapter
 * invocation all work correctly end-to-end.
 *
 * Test Coverage:
 * - initializeRevalidationService initializes singleton with NoOp adapter
 * - revalidatePaths calls adapter.revalidateMany with the correct paths
 * - revalidateByEntityType expands entity type into correct path set
 * - Each adapter call returns success=true (NoOp always succeeds)
 * - getRevalidationService returns the initialized singleton
 * - _resetRevalidationService allows re-initialization between tests
 * - Adapter never throws (fire-and-forget contract)
 *
 * @module test/cron/revalidation-smoke
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoOpRevalidationAdapter } from '../../../../packages/service-core/src/revalidation/adapters/noop-revalidation.adapter';
import {
    _resetRevalidationService,
    getRevalidationService,
    initializeRevalidationService,
} from '../../../../packages/service-core/src/revalidation/revalidation-init';
import { RevalidationService } from '../../../../packages/service-core/src/revalidation/revalidation.service';

// ---------------------------------------------------------------------------
// Mock @repo/db so the service can be instantiated without a real DB
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    RevalidationConfigModel: vi.fn().mockImplementation(() => ({
        findByEntityType: vi.fn().mockResolvedValue(undefined),
    })),
    RevalidationLogModel: vi.fn().mockImplementation(() => ({
        create: vi.fn().mockResolvedValue(undefined),
    })),
}));

vi.mock('@repo/logger', () => ({
    createLogger: vi.fn().mockReturnValue({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a spy-wrapped NoOpRevalidationAdapter.
 * The spy records all calls while preserving the real implementation.
 */
function createSpyAdapter(): {
    adapter: NoOpRevalidationAdapter;
    revalidateSpy: ReturnType<typeof vi.spyOn>;
    revalidateManySpy: ReturnType<typeof vi.spyOn>;
} {
    const adapter = new NoOpRevalidationAdapter();
    const revalidateSpy = vi.spyOn(adapter, 'revalidate');
    const revalidateManySpy = vi.spyOn(adapter, 'revalidateMany');
    return { adapter, revalidateSpy, revalidateManySpy };
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
            const { adapter } = createSpyAdapter();
            const service = new RevalidationService({ adapter, debounceMs: 0 });
            expect(service).toBeInstanceOf(RevalidationService);
        });

        it('should expose getRevalidationService returning undefined before init', () => {
            expect(getRevalidationService()).toBeUndefined();
        });

        it('should expose getRevalidationService returning the instance after init', () => {
            initializeRevalidationService({
                nodeEnv: 'test',
                revalidationSecret: 'test-secret',
                siteUrl: 'http://localhost:4321',
            });

            const instance = getRevalidationService();
            expect(instance).toBeInstanceOf(RevalidationService);
        });

        it('initializeRevalidationService should be idempotent — second call returns same instance', () => {
            const first = initializeRevalidationService({
                nodeEnv: 'test',
                revalidationSecret: 'test-secret',
                siteUrl: 'http://localhost:4321',
            });

            const second = initializeRevalidationService({
                nodeEnv: 'test',
                revalidationSecret: 'different-secret',
                siteUrl: 'http://different.example.com',
            });

            expect(first).toBe(second);
        });
    });

    // -----------------------------------------------------------------------
    describe('revalidatePaths — direct service call', () => {
        it('should call adapter.revalidateMany with the provided paths', async () => {
            const { adapter, revalidateManySpy } = createSpyAdapter();
            const service = new RevalidationService({ adapter, debounceMs: 0 });
            const paths = ['/alojamientos/', '/en/alojamientos/'];

            await service.revalidatePaths(paths);

            expect(revalidateManySpy).toHaveBeenCalledOnce();
            const [calledPaths] = revalidateManySpy.mock.calls[0]!;
            expect(calledPaths).toEqual(expect.arrayContaining(paths));
        });

        it('should return without throwing when all adapter calls succeed', async () => {
            const { adapter } = createSpyAdapter();
            const service = new RevalidationService({ adapter, debounceMs: 0 });

            await expect(
                service.revalidatePaths(['/alojamientos/', '/eventos/'])
            ).resolves.toBeUndefined();
        });

        it('should handle an empty path list gracefully', async () => {
            const { adapter, revalidateManySpy } = createSpyAdapter();
            const service = new RevalidationService({ adapter, debounceMs: 0 });

            await service.revalidatePaths([]);

            expect(revalidateManySpy).not.toHaveBeenCalled();
        });

        it('each adapter result should have success=true with a path and durationMs', async () => {
            const { adapter, revalidateSpy } = createSpyAdapter();
            const service = new RevalidationService({ adapter, debounceMs: 0 });
            const paths = ['/alojamientos/', '/eventos/'];

            await service.revalidatePaths(paths);

            for (const call of revalidateSpy.mock.results) {
                const result = await call.value;
                expect(result).toMatchObject({
                    path: expect.any(String),
                    success: true,
                    durationMs: expect.any(Number),
                });
                expect(result.error).toBeUndefined();
            }
        });
    });

    // -----------------------------------------------------------------------
    describe('revalidateByEntityType — entity-type expansion', () => {
        it('should expand "accommodation" entity type into multiple paths', async () => {
            const { adapter, revalidateManySpy } = createSpyAdapter();
            const service = new RevalidationService({ adapter, debounceMs: 0 });

            await service.revalidateByEntityType('accommodation');

            expect(revalidateManySpy).toHaveBeenCalledOnce();
            const [calledPaths] = revalidateManySpy.mock.calls[0]!;
            expect((calledPaths as string[]).length).toBeGreaterThan(0);
            expect(calledPaths).toContain('/alojamientos/');
        });

        it('should generate locale-prefixed paths for accommodation entity type', async () => {
            const { adapter, revalidateManySpy } = createSpyAdapter();
            const service = new RevalidationService({ adapter, debounceMs: 0 });

            await service.revalidateByEntityType('accommodation');

            const [calledPaths] = revalidateManySpy.mock.calls[0]!;
            expect((calledPaths as string[]).some((p) => p.startsWith('/en/'))).toBe(true);
            expect((calledPaths as string[]).some((p) => p.startsWith('/pt/'))).toBe(true);
        });

        it('should not generate paths for unknown entity type (no adapter calls)', async () => {
            const { adapter, revalidateManySpy } = createSpyAdapter();
            const service = new RevalidationService({ adapter, debounceMs: 0 });

            await service.revalidateByEntityType('unknown_type' as never);

            // revalidateMany is called with an empty array, so adapter.revalidate is never invoked
            expect(revalidateManySpy).not.toHaveBeenCalled();
        });

        it('should resolve without throwing on entity type expansion', async () => {
            const { adapter } = createSpyAdapter();
            const service = new RevalidationService({ adapter, debounceMs: 0 });

            await expect(service.revalidateByEntityType('event')).resolves.toBeUndefined();
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
            const result = await adapter.revalidate('/alojamientos/');
            expect(result.success).toBe(true);
            expect(result.path).toBe('/alojamientos/');
            expect(result.durationMs).toBeGreaterThanOrEqual(0);
            expect(result.error).toBeUndefined();
        });

        it('should never throw — adapter contract requires non-throwing', async () => {
            const adapter = new NoOpRevalidationAdapter();
            await expect(adapter.revalidate('')).resolves.toMatchObject({ success: true });
        });
    });

    // -----------------------------------------------------------------------
    describe('End-to-End: full manual revalidation flow', () => {
        it('should complete the full flow: init → getService → revalidatePaths', async () => {
            const service = initializeRevalidationService({
                nodeEnv: 'test',
                revalidationSecret: 'e2e-bypass-token',
                siteUrl: 'http://localhost:4321',
                debounceMs: 0,
            });

            expect(getRevalidationService()).toBe(service);

            await service.revalidatePaths(['/alojamientos/', '/en/alojamientos/']);

            expect(service).toBeInstanceOf(RevalidationService);
        });

        it('should complete the full flow: init → revalidateByEntityType', async () => {
            const service = initializeRevalidationService({
                nodeEnv: 'test',
                revalidationSecret: 'e2e-bypass-token',
                siteUrl: 'http://localhost:4321',
                debounceMs: 0,
            });

            await expect(service.revalidateByEntityType('destination')).resolves.toBeUndefined();

            expect(getRevalidationService()).toBe(service);
        });
    });
});
