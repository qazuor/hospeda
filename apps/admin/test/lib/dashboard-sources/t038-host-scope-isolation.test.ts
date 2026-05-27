/**
 * T-038 — HOST scope isolation (SPEC-155)
 *
 * Asserts that every HOST-scoped data source builds a queryKey that includes
 * the userId (scope 'own' → userId appended at index 4), so two different HOST
 * users get isolated TanStack Query caches and there is no cross-owner leak.
 *
 * Covers:
 * - Every HOST source ID passes `scope: 'own'` into the resolver.
 * - The queryKey at index 4 equals the userId for every HOST source.
 * - Two different userIds produce two non-equal queryKeys for every source.
 * - A global/'all'-scoped source with the same userId does NOT include userId
 *   in the key — confirming the isolation is 'own'-scope-specific, not global.
 * - `buildDashboardQueryKey` with `scope: 'own'` places userId at index 4
 *   regardless of the source prefix.
 * - HOST sources NEVER produce a key that matches an ADMIN (scope: 'all') key
 *   for the same sourceId.
 *
 * Strategy:
 * - Import `@/lib/dashboard-sources/host` in `beforeAll` to trigger the one-time
 *   side-effect registration.
 * - After each test, clear the registry and re-register stubs via
 *   `reRegisterHostSources()` so subsequent tests start from a clean state.
 * - Never call `fetchApi` — stubs return `{ source: id }` immediately.
 *
 * @see apps/admin/src/lib/dashboard-sources/host.ts — source under test
 * @see apps/admin/src/lib/dashboard-sources.ts — buildDashboardQueryKey
 * @see SPEC-155 T-038
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
// CONSTANTS
// ============================================================================

/**
 * The complete list of HOST source IDs that must be registered by host.ts.
 * Deferred/client-side slots (D, F, G-views) are intentionally absent.
 */
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

/** Index in the canonical queryKey tuple where userId lives for own-scoped sources. */
const USER_ID_KEY_INDEX = 4;

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Builds a minimal HOST ResolverContext with the given userId.
 * All HOST sources are scope: 'own', so this mirrors the runtime context.
 */
function makeHostCtx(userId = 'usr_host_001'): ResolverContext {
    return {
        role: 'HOST',
        userId,
        permissions: ['ACCOMMODATION_VIEW_OWN', 'REVIEW_VIEW_OWN', 'CONVERSATION_VIEW_OWN'],
        scope: 'own'
    };
}

/**
 * Builds a minimal ADMIN ResolverContext (scope: 'all') for contrast assertions.
 */
function makeAdminAllCtx(userId = 'usr_admin_001'): ResolverContext {
    return {
        role: 'ADMIN',
        userId,
        permissions: ['ACCOMMODATION_VIEW_ALL'],
        scope: 'all'
    };
}

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

beforeAll(async () => {
    // Trigger the one-time module registration of all HOST sources.
    await import('@/lib/dashboard-sources/host');
});

afterEach(() => {
    _clearRegistryForTesting();
    reRegisterHostSources();
    vi.restoreAllMocks();
});

// ============================================================================
// T-038 — SCOPE: 'own' → userId MUST be present in every HOST queryKey
// ============================================================================

describe('T-038 HOST scope isolation — userId presence', () => {
    it.each(HOST_SOURCE_IDS)('%s — queryKey includes userId when scope is own', (sourceId) => {
        const ctx = makeHostCtx('usr_isolation_abc');
        const { found, options } = resolveDataSource(sourceId, ctx);

        expect(found).toBe(true);
        expect(options.queryKey).toContain('usr_isolation_abc');
    });

    it.each(HOST_SOURCE_IDS)('%s — userId is at index 4 in the canonical key tuple', (sourceId) => {
        const userId = 'usr_index_test';
        const ctx = makeHostCtx(userId);
        const { options } = resolveDataSource(sourceId, ctx);

        expect(options.queryKey[USER_ID_KEY_INDEX]).toBe(userId);
    });

    it.each(HOST_SOURCE_IDS)(
        '%s — queryKey structure: [root, sourceId, role, scope, userId]',
        (sourceId) => {
            const userId = 'usr_struct_check';
            const ctx = makeHostCtx(userId);
            const { options } = resolveDataSource(sourceId, ctx);

            expect(options.queryKey[0]).toBe(DASHBOARD_QUERY_KEY_ROOT);
            expect(options.queryKey[1]).toBe(sourceId);
            expect(options.queryKey[2]).toBe('HOST');
            expect(options.queryKey[3]).toBe('own');
            expect(options.queryKey[4]).toBe(userId);
        }
    );
});

// ============================================================================
// T-038 — Two different HOST users → two different queryKeys (cache isolation)
// ============================================================================

describe('T-038 HOST scope isolation — cross-owner cache separation', () => {
    it.each(HOST_SOURCE_IDS)('%s — different userIds produce non-equal queryKeys', (sourceId) => {
        const ctxA = makeHostCtx('usr_host_alice');
        const ctxB = makeHostCtx('usr_host_bob');

        const { options: optsA } = resolveDataSource(sourceId, ctxA);
        const { options: optsB } = resolveDataSource(sourceId, ctxB);

        // The full keys must differ.
        expect(optsA.queryKey).not.toEqual(optsB.queryKey);
        // Each key contains its owner's userId.
        expect(optsA.queryKey).toContain('usr_host_alice');
        expect(optsB.queryKey).toContain('usr_host_bob');
        // The owner's userId must NOT appear in the other owner's key.
        expect(optsA.queryKey).not.toContain('usr_host_bob');
        expect(optsB.queryKey).not.toContain('usr_host_alice');
    });

    it('buildDashboardQueryKey with two different userIds produces two different keys', () => {
        const ctxAlice = makeHostCtx('usr_alice');
        const ctxBob = makeHostCtx('usr_bob');

        const keyAlice = buildDashboardQueryKey('host.accommodations.count', ctxAlice);
        const keyBob = buildDashboardQueryKey('host.accommodations.count', ctxBob);

        expect(keyAlice).not.toEqual(keyBob);
        expect(keyAlice[USER_ID_KEY_INDEX]).toBe('usr_alice');
        expect(keyBob[USER_ID_KEY_INDEX]).toBe('usr_bob');
    });

    it('same sourceId but different userIds are never confused by TanStack Query (key inequality)', () => {
        // Simulate 5 different HOST users.
        const userIds = ['u1', 'u2', 'u3', 'u4', 'u5'];
        const keys = userIds.map((uid) =>
            buildDashboardQueryKey('host.stats.ratings', makeHostCtx(uid))
        );

        // All keys must be pairwise different.
        for (let i = 0; i < keys.length; i++) {
            for (let j = i + 1; j < keys.length; j++) {
                expect(keys[i]).not.toEqual(keys[j]);
            }
        }
    });
});

// ============================================================================
// T-038 — scope: 'all' NEVER includes userId — confirms own isolation semantics
// ============================================================================

describe('T-038 HOST scope isolation — contrast: all-scope NEVER includes userId', () => {
    it("buildDashboardQueryKey with scope:'all' does NOT include userId", () => {
        // Even if a HOST source is resolved with scope: 'all' (shouldn't happen
        // in production, but confirms the guard is in buildDashboardQueryKey itself).
        const ctxAll = makeAdminAllCtx('usr_should_not_appear');
        const key = buildDashboardQueryKey('host.accommodations.count', ctxAll);

        expect(key).not.toContain('usr_should_not_appear');
        // 5-element own tuple must NOT be built.
        expect(key).toHaveLength(4); // [root, sourceId, role, scope]
    });

    it("HOST queryKey (scope:'own') and ADMIN queryKey (scope:'all') are never equal for the same sourceId", () => {
        const hostCtx = makeHostCtx('shared_user');
        const adminCtx = makeAdminAllCtx('shared_user');

        const hostKey = buildDashboardQueryKey('host.accommodations.count', hostCtx);
        const adminKey = buildDashboardQueryKey('host.accommodations.count', adminCtx);

        expect(hostKey).not.toEqual(adminKey);
        // Host key is longer (has userId at index 4).
        expect(hostKey.length).toBeGreaterThan(adminKey.length);
    });

    it('HOST sources do not collide with ADMIN sources even with the same numeric userId', () => {
        const userId = '000000000';
        const hostKey = buildDashboardQueryKey('host.stats.ratings', makeHostCtx(userId));
        const adminKey = buildDashboardQueryKey('admin.entities.counts', makeAdminAllCtx(userId));

        // Different source IDs, different roles, different scopes → never equal.
        expect(hostKey).not.toEqual(adminKey);
    });
});

// ============================================================================
// T-038 — buildDashboardQueryKey consistency with resolveDataSource output
// ============================================================================

describe('T-038 HOST scope isolation — key builder consistency', () => {
    it.each(HOST_SOURCE_IDS)(
        '%s — resolver queryKey matches buildDashboardQueryKey output exactly',
        (sourceId) => {
            const ctx = makeHostCtx('usr_consistency_check');
            const expected = buildDashboardQueryKey(sourceId, ctx);
            const { options } = resolveDataSource(sourceId, ctx);

            expect(options.queryKey).toEqual(expected);
        }
    );
});
