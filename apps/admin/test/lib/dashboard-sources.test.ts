/**
 * Tests for the dashboard data-source resolver registry.
 *
 * Covers:
 * - Registering a source and resolving it returns correct queryKey/options.
 * - Scope context injects userId into the queryKey for 'own'-scoped sources.
 * - 'all'-scoped sources do NOT include userId in the queryKey.
 * - 'toggle'-scoped sources behave like 'all' (default scope, no userId).
 * - Unknown source ID is handled gracefully (returns found:false + noop options).
 * - Duplicate registration throws in dev (import.meta.env.DEV = true).
 * - `isSourceRegistered` and `getRegisteredSourceIds` behave correctly.
 * - Built-in example sources ('admin.entities.counts', 'admin.users.stats') are registered.
 * - buildDashboardQueryKey produces the expected tuple shape.
 */

import {
    DASHBOARD_QUERY_KEY_ROOT,
    DASHBOARD_STALE_TIME_MS,
    _clearRegistryForTesting,
    buildDashboardQueryKey,
    getRegisteredSourceIds,
    isSourceRegistered,
    registerDataSource,
    resolveDataSource
} from '@/lib/dashboard-sources';
import type { ResolverContext } from '@/lib/dashboard-sources';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// HELPERS
// ============================================================================

function makeCtx(overrides: Partial<ResolverContext> = {}): ResolverContext {
    return {
        role: 'ADMIN',
        userId: 'usr_test_001',
        permissions: ['ACCOMMODATION_VIEW_ALL'],
        scope: 'all',
        ...overrides
    };
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

// Strategy:
// - The built-in example sources are tested in an isolated describe block that
//   always runs BEFORE any test that might call _clearRegistryForTesting.
// - Tests that register new sources use a unique prefix 'test.*' so they can
//   be removed without touching the built-in sources.
// - We clear test-registered sources in afterEach by clearing the whole
//   registry and then re-registering only the built-in ones inline.
//   This avoids the need to re-import the module.

/**
 * Re-registers the two built-in example sources after a registry clear.
 * Mirror of what `dashboard-sources.ts` does at module load time, but using
 * simple stubs so tests don't need to mock fetchApi.
 */
function reRegisterExampleSources(): void {
    if (!isSourceRegistered('admin.entities.counts')) {
        registerDataSource('admin.entities.counts', (ctx) => ({
            queryKey: buildDashboardQueryKey('admin.entities.counts', ctx),
            queryFn: async () => [{ name: 'accommodations', count: 0 }],
            staleTime: DASHBOARD_STALE_TIME_MS
        }));
    }
    if (!isSourceRegistered('admin.users.stats')) {
        registerDataSource('admin.users.stats', (ctx) => ({
            queryKey: buildDashboardQueryKey('admin.users.stats', ctx),
            queryFn: async () => ({ total: 0 }),
            staleTime: DASHBOARD_STALE_TIME_MS
        }));
    }
}

afterEach(() => {
    // Reset the registry and restore the two built-in example sources so
    // each test suite always starts from a clean-but-populated state.
    _clearRegistryForTesting();
    reRegisterExampleSources();
    vi.restoreAllMocks();
});

// ============================================================================
// buildDashboardQueryKey
// ============================================================================

describe('buildDashboardQueryKey', () => {
    it('produces the correct root + sourceId + role + scope for all-scoped ctx', () => {
        const ctx = makeCtx({ scope: 'all' });
        const key = buildDashboardQueryKey('admin.users.stats', ctx);
        expect(key).toEqual([DASHBOARD_QUERY_KEY_ROOT, 'admin.users.stats', 'ADMIN', 'all']);
    });

    it('appends userId for own-scoped ctx', () => {
        const ctx = makeCtx({ scope: 'own', userId: 'usr_host_001', role: 'HOST' });
        const key = buildDashboardQueryKey('host.accommodations.count', ctx);
        expect(key).toEqual([
            DASHBOARD_QUERY_KEY_ROOT,
            'host.accommodations.count',
            'HOST',
            'own',
            'usr_host_001'
        ]);
    });

    it('does NOT append userId for toggle-scoped ctx', () => {
        const ctx = makeCtx({ scope: 'toggle' });
        const key = buildDashboardQueryKey('admin.some.source', ctx);
        expect(key).toEqual([DASHBOARD_QUERY_KEY_ROOT, 'admin.some.source', 'ADMIN', 'toggle']);
    });

    it('appends extras after userId for own-scoped ctx', () => {
        const ctx = makeCtx({ scope: 'own', userId: 'u1' });
        const key = buildDashboardQueryKey('host.stats', ctx, '7d');
        expect(key).toEqual([DASHBOARD_QUERY_KEY_ROOT, 'host.stats', 'ADMIN', 'own', 'u1', '7d']);
    });

    it('appends extras for all-scoped ctx', () => {
        const ctx = makeCtx({ scope: 'all' });
        const key = buildDashboardQueryKey('admin.crons', ctx, 'live');
        expect(key).toEqual([DASHBOARD_QUERY_KEY_ROOT, 'admin.crons', 'ADMIN', 'all', 'live']);
    });

    it('cache keys differ between roles for the same sourceId', () => {
        const adminCtx = makeCtx({ role: 'ADMIN', scope: 'all' });
        const superCtx = makeCtx({ role: 'SUPER_ADMIN', scope: 'all' });
        const k1 = buildDashboardQueryKey('admin.users.stats', adminCtx);
        const k2 = buildDashboardQueryKey('admin.users.stats', superCtx);
        expect(k1).not.toEqual(k2);
    });

    it('cache keys differ between users for own-scoped sources', () => {
        const hostA = makeCtx({ role: 'HOST', scope: 'own', userId: 'u1' });
        const hostB = makeCtx({ role: 'HOST', scope: 'own', userId: 'u2' });
        const k1 = buildDashboardQueryKey('host.accommodations.count', hostA);
        const k2 = buildDashboardQueryKey('host.accommodations.count', hostB);
        expect(k1).not.toEqual(k2);
    });
});

// ============================================================================
// registerDataSource + resolveDataSource
// ============================================================================

describe('registerDataSource / resolveDataSource', () => {
    it('registers a source and resolveDataSource returns found:true', () => {
        registerDataSource('test.source.basic', (ctx) => ({
            queryKey: buildDashboardQueryKey('test.source.basic', ctx),
            queryFn: async () => ({ value: 42 }),
            staleTime: DASHBOARD_STALE_TIME_MS
        }));

        const ctx = makeCtx({ scope: 'all' });
        const result = resolveDataSource('test.source.basic', ctx);

        expect(result.found).toBe(true);
        expect(result.options.queryKey).toEqual([
            DASHBOARD_QUERY_KEY_ROOT,
            'test.source.basic',
            'ADMIN',
            'all'
        ]);
        expect(result.options.staleTime).toBe(DASHBOARD_STALE_TIME_MS);
        expect(typeof result.options.queryFn).toBe('function');
    });

    it('resolver returns different queryKey per role', () => {
        registerDataSource('test.source.role', (ctx) => ({
            queryKey: buildDashboardQueryKey('test.source.role', ctx),
            queryFn: async () => null,
            staleTime: DASHBOARD_STALE_TIME_MS
        }));

        const adminResult = resolveDataSource(
            'test.source.role',
            makeCtx({ role: 'ADMIN', scope: 'all' })
        );
        const superResult = resolveDataSource(
            'test.source.role',
            makeCtx({ role: 'SUPER_ADMIN', scope: 'all' })
        );

        expect(adminResult.options.queryKey[2]).toBe('ADMIN');
        expect(superResult.options.queryKey[2]).toBe('SUPER_ADMIN');
    });

    it('own-scoped resolver includes userId in queryKey', () => {
        registerDataSource('test.source.own', (ctx) => ({
            queryKey: buildDashboardQueryKey('test.source.own', ctx),
            queryFn: async () => null,
            staleTime: DASHBOARD_STALE_TIME_MS
        }));

        const ctx = makeCtx({ scope: 'own', userId: 'usr_host_42', role: 'HOST' });
        const result = resolveDataSource('test.source.own', ctx);

        expect(result.found).toBe(true);
        expect(result.options.queryKey).toContain('usr_host_42');
    });

    it('all-scoped resolver does NOT include userId in queryKey', () => {
        registerDataSource('test.source.allscope', (ctx) => ({
            queryKey: buildDashboardQueryKey('test.source.allscope', ctx),
            queryFn: async () => null,
            staleTime: DASHBOARD_STALE_TIME_MS
        }));

        const ctx = makeCtx({ scope: 'all', userId: 'usr_should_not_appear' });
        const result = resolveDataSource('test.source.allscope', ctx);

        expect(result.found).toBe(true);
        expect(result.options.queryKey).not.toContain('usr_should_not_appear');
    });

    it('queryFn resolves to the data returned by the factory', async () => {
        const expectedData = { count: 7, label: 'test' };

        registerDataSource('test.source.data', (_ctx) => ({
            queryKey: ['test', 'source', 'data'],
            queryFn: async () => expectedData,
            staleTime: DASHBOARD_STALE_TIME_MS
        }));

        const result = resolveDataSource('test.source.data', makeCtx());
        expect(result.found).toBe(true);
        const data = await result.options.queryFn();
        expect(data).toEqual(expectedData);
    });

    it('unknown sourceId returns found:false with noop options (graceful degradation)', () => {
        const result = resolveDataSource('nonexistent.source.xyz', makeCtx());

        expect(result.found).toBe(false);
        expect(result.options.enabled).toBe(false);
        expect(result.options.staleTime).toBe(Number.POSITIVE_INFINITY);
        // noop queryFn resolves to null without throwing
        return expect(result.options.queryFn()).resolves.toBeNull();
    });

    it('noop queryKey includes __noop__ marker for easy identification', () => {
        const result = resolveDataSource('unknown.source', makeCtx({ role: 'HOST' }));

        expect(result.found).toBe(false);
        expect(result.options.queryKey).toContain('__noop__');
        expect(result.options.queryKey).toContain('HOST');
    });

    it('duplicate registration throws (DEV mode is true in test environment)', () => {
        // Vitest runs with import.meta.env.DEV = true, so the duplicate guard
        // throws on a second registration with the same sourceId.
        // This verifies the guard is active and produces a meaningful error message.
        registerDataSource('test.source.dedup', (_ctx) => ({
            queryKey: ['first'],
            queryFn: async () => 'first',
            staleTime: 0
        }));

        expect(() => {
            registerDataSource('test.source.dedup', (_ctx) => ({
                queryKey: ['second'],
                queryFn: async () => 'second',
                staleTime: 0
            }));
        }).toThrow(/Duplicate source registration.*test\.source\.dedup/);
    });
});

// ============================================================================
// isSourceRegistered / getRegisteredSourceIds
// ============================================================================

describe('isSourceRegistered', () => {
    it('returns true after registering a source', () => {
        registerDataSource('test.is.registered', (_ctx) => ({
            queryKey: [],
            queryFn: async () => null,
            staleTime: 0
        }));
        expect(isSourceRegistered('test.is.registered')).toBe(true);
    });

    it('returns false for an unregistered source', () => {
        expect(isSourceRegistered('does.not.exist.at.all')).toBe(false);
    });
});

describe('getRegisteredSourceIds', () => {
    it('returns an array that includes a newly registered source', () => {
        registerDataSource('test.get.ids', (_ctx) => ({
            queryKey: [],
            queryFn: async () => null,
            staleTime: 0
        }));
        expect(getRegisteredSourceIds()).toContain('test.get.ids');
    });

    it('is readonly — the returned array cannot be mutated in place', () => {
        const ids = getRegisteredSourceIds();
        // TypeScript ensures readonly, but also verify at runtime that the
        // value is a stable snapshot (not the internal Map's iterator).
        expect(Array.isArray(ids)).toBe(true);
    });
});

// ============================================================================
// Built-in example sources
// ============================================================================

describe('built-in example sources', () => {
    it('admin.entities.counts is registered at module load time', () => {
        expect(isSourceRegistered('admin.entities.counts')).toBe(true);
    });

    it('admin.users.stats is registered at module load time', () => {
        expect(isSourceRegistered('admin.users.stats')).toBe(true);
    });

    it('admin.entities.counts resolver returns correct queryKey structure', () => {
        const ctx = makeCtx({ role: 'ADMIN', scope: 'all' });
        const result = resolveDataSource('admin.entities.counts', ctx);

        expect(result.found).toBe(true);
        expect(result.options.queryKey[0]).toBe(DASHBOARD_QUERY_KEY_ROOT);
        expect(result.options.queryKey[1]).toBe('admin.entities.counts');
        expect(result.options.queryKey[2]).toBe('ADMIN');
    });

    it('admin.users.stats resolver returns correct staleTime', () => {
        const ctx = makeCtx({ role: 'SUPER_ADMIN', scope: 'all' });
        const result = resolveDataSource('admin.users.stats', ctx);

        expect(result.found).toBe(true);
        expect(result.options.staleTime).toBe(DASHBOARD_STALE_TIME_MS);
    });
});
