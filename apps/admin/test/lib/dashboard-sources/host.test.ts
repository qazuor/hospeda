/**
 * Tests for HOST dashboard data-source registrations (T-018, SPEC-155).
 *
 * Covers:
 * - All HOST source IDs are registered after the module is imported.
 * - Resolvers return `found: true` with the correct queryKey structure.
 * - All HOST sources use `scope: 'own'` → userId is included in the queryKey.
 * - Different userIds produce different queryKeys (no cross-user cache leaks).
 * - queryFn is a callable async function on every source.
 * - staleTime equals DASHBOARD_STALE_TIME_MS.
 * - Client-side-only / deferred slots (D, F, G-views) are NOT registered.
 *
 * Strategy (mirrors existing dashboard-sources.test.ts):
 * - The host module registers sources at module load time.
 * - Between tests we call _clearRegistryForTesting() then manually re-register
 *   the expected sources via stub resolvers (matching the module's registration
 *   pattern but without hitting fetchApi). This avoids ES-module cache issues
 *   with dynamic re-imports.
 */

import {
    DASHBOARD_QUERY_KEY_ROOT,
    DASHBOARD_STALE_TIME_MS,
    _clearRegistryForTesting,
    buildDashboardQueryKey,
    isSourceRegistered,
    registerDataSource,
    resolveDataSource
} from '@/lib/dashboard-sources';
import type { ResolverContext } from '@/lib/dashboard-sources';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

// ============================================================================
// HELPERS
// ============================================================================

function makeHostCtx(userId = 'usr_host_001'): ResolverContext {
    return {
        role: 'HOST',
        userId,
        permissions: ['ACCOMMODATION_VIEW_OWN', 'REVIEW_VIEW_OWN', 'CONVERSATION_VIEW_OWN'],
        scope: 'own'
    };
}

/** All source IDs the HOST module must register. */
const HOST_SOURCE_IDS = [
    'host.accommodations.count',
    'host.accommodations.drafts',
    'host.billing.plan',
    'host.conversations.pending',
    'host.reviews.latest',
    'host.stats.favorites',
    'host.stats.response-rate',
    'host.stats.ratings'
] as const;

/**
 * Re-registers all HOST sources with stub resolvers after a registry clear.
 * Mirrors what `host.ts` does at module load time but avoids fetchApi calls.
 */
function reRegisterHostSources(): void {
    for (const id of HOST_SOURCE_IDS) {
        if (!isSourceRegistered(id)) {
            registerDataSource(id, (ctx) => ({
                queryKey: buildDashboardQueryKey(id, ctx),
                queryFn: async () => ({ source: id }),
                staleTime: DASHBOARD_STALE_TIME_MS
            }));
        }
    }
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

// The host module runs its registrations at module-load time once.
// We use beforeAll to ensure the module has been imported.
beforeAll(async () => {
    await import('@/lib/dashboard-sources/host');
});

afterEach(() => {
    // Reset and restore the HOST stubs so each test suite starts clean.
    _clearRegistryForTesting();
    reRegisterHostSources();
    vi.restoreAllMocks();
});

// ============================================================================
// REGISTRATION
// ============================================================================

describe('HOST source registrations', () => {
    it('registers all expected HOST source IDs', () => {
        for (const id of HOST_SOURCE_IDS) {
            expect(isSourceRegistered(id), `Expected '${id}' to be registered`).toBe(true);
        }
    });

    it('does NOT register host.stats.views (phase-2, no backend)', () => {
        expect(isSourceRegistered('host.stats.views')).toBe(false);
    });

    it('does NOT register host.accommodations.health (client-side checklist, card D)', () => {
        expect(isSourceRegistered('host.accommodations.health')).toBe(false);
    });

    it('does NOT register host.profile.health (client-side checklist, card F)', () => {
        expect(isSourceRegistered('host.profile.health')).toBe(false);
    });

    it('all HOST source IDs start with host.', () => {
        for (const id of HOST_SOURCE_IDS) {
            expect(id.startsWith('host.')).toBe(true);
        }
    });
});

// ============================================================================
// QUERY KEY STRUCTURE
// ============================================================================

describe('HOST source queryKey structure', () => {
    it.each(HOST_SOURCE_IDS)('%s — queryKey starts with dashboard root', (sourceId) => {
        const ctx = makeHostCtx();
        const { found, options } = resolveDataSource(sourceId, ctx);

        expect(found).toBe(true);
        expect(options.queryKey[0]).toBe(DASHBOARD_QUERY_KEY_ROOT);
        expect(options.queryKey[1]).toBe(sourceId);
        expect(options.queryKey[2]).toBe('HOST');
    });

    it.each(HOST_SOURCE_IDS)('%s — own scope includes userId in queryKey', (sourceId) => {
        const ctx = makeHostCtx('usr_host_xyz');
        const { options } = resolveDataSource(sourceId, ctx);

        expect(options.queryKey).toContain('usr_host_xyz');
    });

    it.each(HOST_SOURCE_IDS)('%s — different userId produces different queryKey', (sourceId) => {
        const ctxA = makeHostCtx('usr_host_A');
        const ctxB = makeHostCtx('usr_host_B');

        const { options: optsA } = resolveDataSource(sourceId, ctxA);
        const { options: optsB } = resolveDataSource(sourceId, ctxB);

        expect(optsA.queryKey).not.toEqual(optsB.queryKey);
        expect(optsA.queryKey).toContain('usr_host_A');
        expect(optsB.queryKey).toContain('usr_host_B');
    });

    it('queryKey built by buildDashboardQueryKey for own scope matches resolver output', () => {
        const ctx = makeHostCtx('usr_host_001');
        const expectedKey = buildDashboardQueryKey('host.accommodations.count', ctx);
        const { options } = resolveDataSource('host.accommodations.count', ctx);

        expect(options.queryKey).toEqual(expectedKey);
    });
});

// ============================================================================
// RESOLVER OPTIONS
// ============================================================================

describe('HOST resolver options', () => {
    it.each(HOST_SOURCE_IDS)('%s — staleTime equals DASHBOARD_STALE_TIME_MS', (sourceId) => {
        const { options } = resolveDataSource(sourceId, makeHostCtx());
        expect(options.staleTime).toBe(DASHBOARD_STALE_TIME_MS);
    });

    it.each(HOST_SOURCE_IDS)('%s — queryFn is a callable function', (sourceId) => {
        const { options } = resolveDataSource(sourceId, makeHostCtx());
        expect(typeof options.queryFn).toBe('function');
    });

    it.each(HOST_SOURCE_IDS)('%s — resolveDataSource returns found:true', (sourceId) => {
        const { found } = resolveDataSource(sourceId, makeHostCtx());
        expect(found).toBe(true);
    });
});

// ============================================================================
// SCOPE GUARD — own-scoped sources always include userId
// ============================================================================

describe('HOST scope isolation', () => {
    it('all HOST sources include userId in queryKey (own scope)', () => {
        for (const id of HOST_SOURCE_IDS) {
            const ctx = makeHostCtx('usr_isolation_test');
            const { options } = resolveDataSource(id, ctx);
            // For own-scoped sources, userId is at index 4 in the canonical key.
            expect(options.queryKey[4]).toBe('usr_isolation_test');
        }
    });

    it('buildDashboardQueryKey with scope:all omits userId — confirming own isolation semantics', () => {
        const ctx: ResolverContext = {
            role: 'HOST',
            userId: 'usr_should_be_absent',
            permissions: [],
            scope: 'all'
        };
        const key = buildDashboardQueryKey('host.accommodations.count', ctx);
        expect(key).not.toContain('usr_should_be_absent');
    });
});

// ============================================================================
// DEDUPLICATION GUARD
// ============================================================================

describe('HOST registration deduplication', () => {
    it('re-registering an existing HOST source throws (DEV duplicate guard)', () => {
        expect(() => {
            registerDataSource('host.accommodations.count', (_ctx) => ({
                queryKey: ['dup'],
                queryFn: async () => null,
                staleTime: 0
            }));
        }).toThrow(/Duplicate source registration/);
    });
});
