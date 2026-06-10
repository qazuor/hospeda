/**
 * Tests for SUPER_ADMIN-only dashboard data-source registrations
 * (T-021, SPEC-155).
 *
 * Covers:
 * - super.billing.stats is registered after the module is imported.
 * - super.billing.stats uses scope: 'all' → userId NOT in the queryKey.
 * - Card H deferred sources (audit log, security log, Sentry) are NOT registered.
 * - queryFn is callable.
 * - staleTime equals DASHBOARD_STALE_TIME_MS.
 * - SUPER_ADMIN and ADMIN produce different queryKeys for the same sourceId.
 *
 * Strategy (mirrors existing dashboard-sources.test.ts):
 * - Import super.ts in beforeAll to trigger the one-time registration.
 * - Between tests, clear and re-register via stub after each test.
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

function makeSuperCtx(): ResolverContext {
    return {
        role: 'SUPER_ADMIN',
        userId: 'usr_super_001',
        permissions: ['*'],
        scope: 'all'
    };
}

/** All source IDs the super.ts module must register. */
const SUPER_SOURCE_IDS = ['super.billing.stats'] as const;

/**
 * Re-registers SUPER_ADMIN sources with stub resolvers after a registry clear.
 */
function reRegisterSuperSources(): void {
    for (const id of SUPER_SOURCE_IDS) {
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
    await import('@/lib/dashboard-sources/super');
});

afterEach(() => {
    _clearRegistryForTesting();
    reRegisterSuperSources();
    vi.restoreAllMocks();
});

// ============================================================================
// REGISTRATION
// ============================================================================

describe('SUPER_ADMIN source registrations', () => {
    it('registers super.billing.stats', () => {
        expect(isSourceRegistered('super.billing.stats')).toBe(true);
    });

    it('Card H audit log sub-slots are NOT registered (deferred — no backend)', () => {
        expect(isSourceRegistered('super.audit.log')).toBe(false);
        expect(isSourceRegistered('super.audit.log.actions')).toBe(false);
        expect(isSourceRegistered('super.audit.log.security')).toBe(false);
        expect(isSourceRegistered('super.audit.log.sentry')).toBe(false);
    });

    it('does NOT register admin.* sources (those belong to admin.ts)', () => {
        expect(isSourceRegistered('admin.entities.counts')).toBe(false);
        expect(isSourceRegistered('admin.users.stats')).toBe(false);
    });

    it('all registered SUPER source IDs start with super.', () => {
        for (const id of SUPER_SOURCE_IDS) {
            expect(id.startsWith('super.')).toBe(true);
        }
    });
});

// ============================================================================
// QUERY KEY STRUCTURE
// ============================================================================

describe('SUPER_ADMIN source queryKey structure', () => {
    it('super.billing.stats — queryKey has correct structure', () => {
        const ctx = makeSuperCtx();
        const { found, options } = resolveDataSource('super.billing.stats', ctx);

        expect(found).toBe(true);
        expect(options.queryKey[0]).toBe(DASHBOARD_QUERY_KEY_ROOT);
        expect(options.queryKey[1]).toBe('super.billing.stats');
        expect(options.queryKey[2]).toBe('SUPER_ADMIN');
        expect(options.queryKey[3]).toBe('all');
    });

    it('super.billing.stats — userId NOT included in queryKey (all scope)', () => {
        const ctx = makeSuperCtx();
        const { options } = resolveDataSource('super.billing.stats', ctx);

        expect(options.queryKey).not.toContain(ctx.userId);
    });

    it('queryKey matches buildDashboardQueryKey output for SUPER_ADMIN', () => {
        const ctx = makeSuperCtx();
        const expected = buildDashboardQueryKey('super.billing.stats', ctx);
        const { options } = resolveDataSource('super.billing.stats', ctx);

        expect(options.queryKey).toEqual(expected);
    });

    it('SUPER_ADMIN and ADMIN produce different queryKeys for super.billing.stats', () => {
        const superKey = buildDashboardQueryKey('super.billing.stats', makeSuperCtx());
        const adminKey = buildDashboardQueryKey('super.billing.stats', {
            role: 'ADMIN',
            userId: 'usr_admin_001',
            permissions: [],
            scope: 'all'
        });

        expect(superKey[2]).toBe('SUPER_ADMIN');
        expect(adminKey[2]).toBe('ADMIN');
        expect(superKey).not.toEqual(adminKey);
    });
});

// ============================================================================
// RESOLVER OPTIONS
// ============================================================================

describe('SUPER_ADMIN resolver options', () => {
    it('super.billing.stats — staleTime equals DASHBOARD_STALE_TIME_MS', () => {
        const { options } = resolveDataSource('super.billing.stats', makeSuperCtx());
        expect(options.staleTime).toBe(DASHBOARD_STALE_TIME_MS);
    });

    it('super.billing.stats — queryFn is a callable function', () => {
        const { options } = resolveDataSource('super.billing.stats', makeSuperCtx());
        expect(typeof options.queryFn).toBe('function');
    });

    it('super.billing.stats — resolveDataSource returns found:true', () => {
        const { found } = resolveDataSource('super.billing.stats', makeSuperCtx());
        expect(found).toBe(true);
    });
});

// ============================================================================
// DEDUPLICATION GUARD
// ============================================================================

describe('SUPER_ADMIN registration deduplication', () => {
    it('re-registering super.billing.stats throws (DEV duplicate guard)', () => {
        expect(() => {
            registerDataSource('super.billing.stats', (_ctx) => ({
                queryKey: ['dup'],
                queryFn: async () => null,
                staleTime: 0
            }));
        }).toThrow(/Duplicate source registration/);
    });
});
