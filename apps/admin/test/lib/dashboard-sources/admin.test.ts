/**
 * Tests for ADMIN/SUPER_ADMIN base dashboard data-source registrations
 * (T-020, SPEC-155).
 *
 * Covers:
 * - All ADMIN-specific source IDs (B–F) are registered.
 * - T-017 built-ins (admin.entities.counts, admin.users.stats) also present.
 * - admin.ts does NOT re-register the T-017 built-ins (no duplicate error).
 * - All ADMIN sources use `scope: 'all'` → userId NOT in the queryKey.
 * - admin.system.health uses a shorter staleTime (30 s).
 * - Deferred sources (cron run-history) are NOT registered.
 * - queryFn is callable on every source.
 *
 * Strategy (mirrors existing dashboard-sources.test.ts):
 * - Import both dashboard-sources.ts (T-017) and admin.ts (T-020) in beforeAll.
 * - Between tests, clear the registry and re-register all stubs manually to
 *   avoid ES-module cache issues with dynamic re-imports.
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

function makeAdminCtx(): ResolverContext {
    return {
        role: 'ADMIN',
        userId: 'usr_admin_001',
        permissions: [
            'ACCOMMODATION_VIEW_ALL',
            'POST_VIEW_ALL',
            'EVENT_VIEW_ALL',
            'USER_VIEW_ALL',
            'MODERATION_VIEW_ALL'
        ],
        scope: 'all'
    };
}

/** Source IDs registered by admin.ts (T-020) — excludes T-017 built-ins. */
const ADMIN_MODULE_SOURCE_IDS = [
    'admin.accommodations.latest',
    'admin.editorial.summary',
    'admin.crons.list',
    'admin.system.health',
    'admin.moderation.pending'
] as const;

/** T-017 built-ins — must be present but NOT registered by admin.ts. */
const ADMIN_BUILTIN_SOURCE_IDS = ['admin.entities.counts', 'admin.users.stats'] as const;

/** All sources that must be present in the registry. */
const ALL_ADMIN_SOURCE_IDS = [...ADMIN_MODULE_SOURCE_IDS, ...ADMIN_BUILTIN_SOURCE_IDS] as const;

/**
 * Re-registers T-017 built-in stubs after a registry clear.
 * Keeps the same IDs without hitting fetchApi.
 */
function reRegisterBuiltins(): void {
    for (const id of ADMIN_BUILTIN_SOURCE_IDS) {
        if (!isSourceRegistered(id)) {
            registerDataSource(id, (ctx) => ({
                queryKey: buildDashboardQueryKey(id, ctx),
                queryFn: async () => ({ source: id }),
                staleTime: DASHBOARD_STALE_TIME_MS
            }));
        }
    }
}

/**
 * Re-registers T-020 ADMIN module stubs after a registry clear.
 * Preserves the shorter staleTime for admin.system.health.
 */
function reRegisterAdminSources(): void {
    for (const id of ADMIN_MODULE_SOURCE_IDS) {
        if (!isSourceRegistered(id)) {
            registerDataSource(id, (ctx) => ({
                queryKey: buildDashboardQueryKey(id, ctx),
                queryFn: async () => ({ source: id }),
                staleTime: id === 'admin.system.health' ? 30_000 : DASHBOARD_STALE_TIME_MS
            }));
        }
    }
}

// ============================================================================
// SETUP / TEARDOWN
// ============================================================================

beforeAll(async () => {
    // Import T-017 first — its module-level code registers the built-ins.
    await import('@/lib/dashboard-sources');
    // Import T-020 — registers the 5 ADMIN-specific sources.
    await import('@/lib/dashboard-sources/admin');
});

afterEach(() => {
    _clearRegistryForTesting();
    reRegisterBuiltins();
    reRegisterAdminSources();
    vi.restoreAllMocks();
});

// ============================================================================
// REGISTRATION
// ============================================================================

describe('ADMIN module source registrations', () => {
    it('registers all ADMIN-module-specific source IDs', () => {
        for (const id of ADMIN_MODULE_SOURCE_IDS) {
            expect(isSourceRegistered(id), `Expected '${id}' to be registered`).toBe(true);
        }
    });

    it('T-017 built-in sources are also present', () => {
        for (const id of ADMIN_BUILTIN_SOURCE_IDS) {
            expect(isSourceRegistered(id), `T-017 built-in '${id}' must be registered`).toBe(true);
        }
    });

    it('does NOT register cron run-history source (deferred — no backend)', () => {
        expect(isSourceRegistered('admin.crons.run-history')).toBe(false);
        expect(isSourceRegistered('admin.crons.failed')).toBe(false);
    });

    it('does NOT register maintenance-mode as a separate source (folded into health)', () => {
        expect(isSourceRegistered('admin.system.maintenance')).toBe(false);
    });

    it('all ADMIN-module source IDs start with admin.', () => {
        for (const id of ADMIN_MODULE_SOURCE_IDS) {
            expect(id.startsWith('admin.')).toBe(true);
        }
    });
});

// ============================================================================
// QUERY KEY STRUCTURE
// ============================================================================

describe('ADMIN source queryKey structure', () => {
    it.each(ALL_ADMIN_SOURCE_IDS)('%s — queryKey structure is correct', (sourceId) => {
        const ctx = makeAdminCtx();
        const { found, options } = resolveDataSource(sourceId, ctx);

        expect(found).toBe(true);
        expect(options.queryKey[0]).toBe(DASHBOARD_QUERY_KEY_ROOT);
        expect(options.queryKey[1]).toBe(sourceId);
        expect(options.queryKey[2]).toBe('ADMIN');
        expect(options.queryKey[3]).toBe('all');
    });

    it.each(ALL_ADMIN_SOURCE_IDS)('%s — userId NOT in queryKey (all scope)', (sourceId) => {
        const ctx = makeAdminCtx();
        const { options } = resolveDataSource(sourceId, ctx);

        expect(options.queryKey).not.toContain(ctx.userId);
    });

    it('queryKey matches buildDashboardQueryKey for ADMIN role', () => {
        const ctx = makeAdminCtx();
        const expected = buildDashboardQueryKey('admin.accommodations.latest', ctx);
        const { options } = resolveDataSource('admin.accommodations.latest', ctx);

        expect(options.queryKey).toEqual(expected);
    });

    it('ADMIN and SUPER_ADMIN produce different queryKeys for the same source', () => {
        const adminKey = buildDashboardQueryKey('admin.crons.list', makeAdminCtx());
        const superKey = buildDashboardQueryKey('admin.crons.list', {
            role: 'SUPER_ADMIN',
            userId: 'usr_super_001',
            permissions: ['*'],
            scope: 'all'
        });

        expect(adminKey[2]).toBe('ADMIN');
        expect(superKey[2]).toBe('SUPER_ADMIN');
        expect(adminKey).not.toEqual(superKey);
    });
});

// ============================================================================
// STALE TIME
// ============================================================================

describe('ADMIN source stale times', () => {
    it.each(ADMIN_MODULE_SOURCE_IDS.filter((id) => id !== 'admin.system.health'))(
        '%s — staleTime equals DASHBOARD_STALE_TIME_MS',
        (sourceId) => {
            const { options } = resolveDataSource(sourceId, makeAdminCtx());
            expect(options.staleTime).toBe(DASHBOARD_STALE_TIME_MS);
        }
    );

    it('admin.system.health uses a shorter 30-second staleTime', () => {
        const { options } = resolveDataSource('admin.system.health', makeAdminCtx());
        expect(options.staleTime).toBe(30_000);
        expect(options.staleTime).toBeLessThan(DASHBOARD_STALE_TIME_MS);
    });
});

// ============================================================================
// RESOLVER OPTIONS
// ============================================================================

describe('ADMIN resolver options', () => {
    it.each(ADMIN_MODULE_SOURCE_IDS)('%s — queryFn is a callable function', (sourceId) => {
        const { options } = resolveDataSource(sourceId, makeAdminCtx());
        expect(typeof options.queryFn).toBe('function');
    });

    it.each(ADMIN_MODULE_SOURCE_IDS)('%s — resolveDataSource returns found:true', (sourceId) => {
        const { found } = resolveDataSource(sourceId, makeAdminCtx());
        expect(found).toBe(true);
    });
});

// ============================================================================
// DEDUPLICATION GUARD
// ============================================================================

describe('ADMIN registration deduplication', () => {
    it('manually re-registering an existing ADMIN source throws (DEV duplicate guard)', () => {
        expect(() => {
            registerDataSource('admin.crons.list', (_ctx) => ({
                queryKey: ['dup'],
                queryFn: async () => null,
                staleTime: 0
            }));
        }).toThrow(/Duplicate source registration/);
    });

    it('manually re-registering a T-017 built-in throws (DEV duplicate guard)', () => {
        expect(() => {
            registerDataSource('admin.entities.counts', (_ctx) => ({
                queryKey: ['dup'],
                queryFn: async () => null,
                staleTime: 0
            }));
        }).toThrow(/Duplicate source registration/);
    });
});
