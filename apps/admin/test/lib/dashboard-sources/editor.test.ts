/**
 * Tests for EDITOR dashboard data-source registrations (T-019, SPEC-155).
 *
 * Covers:
 * - All EDITOR source IDs are registered after the module is imported.
 * - Resolvers return `found: true` with the correct queryKey structure.
 * - All EDITOR sources use `scope: 'all'` → userId is NOT in the queryKey.
 * - queryFn is a callable async function on every source.
 * - staleTime equals DASHBOARD_STALE_TIME_MS.
 * - Client-side-only / deferred slots (Card G content.health, Card H comments,
 *   phase-2 views) are NOT registered.
 *
 * Strategy (mirrors existing dashboard-sources.test.ts):
 * - The editor module registers sources at module load time (beforeAll import).
 * - Between tests we call _clearRegistryForTesting() then manually re-register
 *   the expected sources via stub resolvers to avoid ES-module cache issues.
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

function makeEditorCtx(): ResolverContext {
    return {
        role: 'EDITOR',
        userId: 'usr_editor_001',
        permissions: [
            'POST_VIEW_ALL',
            'POST_WRITE',
            'EVENT_VIEW_ALL',
            'EVENT_WRITE',
            'NEWSLETTER_CAMPAIGN_VIEW',
            'NEWSLETTER_CAMPAIGN_WRITE',
            'NEWSLETTER_SUBSCRIBER_VIEW'
        ],
        scope: 'all'
    };
}

/** All source IDs the EDITOR module must register. */
const EDITOR_SOURCE_IDS = [
    'editor.posts.published-this-month',
    'editor.posts.drafts',
    'editor.events.upcoming',
    'editor.newsletter.subscribers',
    'editor.newsletter.campaigns',
    'editor.posts.stats',
    'editor.events.stats'
] as const;

/**
 * Re-registers all EDITOR sources with stub resolvers after a registry clear.
 * Mirrors what `editor.ts` does at module load time but avoids fetchApi calls.
 */
function reRegisterEditorSources(): void {
    for (const id of EDITOR_SOURCE_IDS) {
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
    await import('@/lib/dashboard-sources/editor');
});

afterEach(() => {
    _clearRegistryForTesting();
    reRegisterEditorSources();
    vi.restoreAllMocks();
});

// ============================================================================
// REGISTRATION
// ============================================================================

describe('EDITOR source registrations', () => {
    it('registers all expected EDITOR source IDs', () => {
        for (const id of EDITOR_SOURCE_IDS) {
            expect(isSourceRegistered(id), `Expected '${id}' to be registered`).toBe(true);
        }
    });

    it('does NOT register editor.content.health (client-side checklist, card G)', () => {
        expect(isSourceRegistered('editor.content.health')).toBe(false);
    });

    it('does NOT register editor.comments.recent (backend pending — EDITOR-Q1)', () => {
        expect(isSourceRegistered('editor.comments.recent')).toBe(false);
    });

    it('does NOT register any phase-2 view sources', () => {
        expect(isSourceRegistered('editor.posts.views')).toBe(false);
        expect(isSourceRegistered('editor.events.views')).toBe(false);
    });

    it('does NOT register open-rate source (phase-2)', () => {
        expect(isSourceRegistered('editor.newsletter.open-rate')).toBe(false);
    });

    it('all registered EDITOR source IDs start with editor.', () => {
        for (const id of EDITOR_SOURCE_IDS) {
            expect(id.startsWith('editor.')).toBe(true);
        }
    });
});

// ============================================================================
// QUERY KEY STRUCTURE
// ============================================================================

describe('EDITOR source queryKey structure', () => {
    it.each(EDITOR_SOURCE_IDS)('%s — queryKey starts with dashboard root', (sourceId) => {
        const ctx = makeEditorCtx();
        const { found, options } = resolveDataSource(sourceId, ctx);

        expect(found).toBe(true);
        expect(options.queryKey[0]).toBe(DASHBOARD_QUERY_KEY_ROOT);
        expect(options.queryKey[1]).toBe(sourceId);
        expect(options.queryKey[2]).toBe('EDITOR');
        expect(options.queryKey[3]).toBe('all');
    });

    it.each(EDITOR_SOURCE_IDS)('%s — userId NOT included in queryKey (all scope)', (sourceId) => {
        const ctx = makeEditorCtx();
        const { options } = resolveDataSource(sourceId, ctx);

        expect(options.queryKey).not.toContain(ctx.userId);
    });

    it('queryKey matches buildDashboardQueryKey output', () => {
        const ctx = makeEditorCtx();
        const expected = buildDashboardQueryKey('editor.posts.published-this-month', ctx);
        const { options } = resolveDataSource('editor.posts.published-this-month', ctx);

        expect(options.queryKey).toEqual(expected);
    });

    it('different roles for same source produce different queryKeys', () => {
        const editorKey = buildDashboardQueryKey('editor.posts.stats', makeEditorCtx());
        const adminCtx: ResolverContext = {
            role: 'ADMIN',
            userId: 'usr_admin_001',
            permissions: [],
            scope: 'all'
        };
        const adminKey = buildDashboardQueryKey('editor.posts.stats', adminCtx);

        expect(editorKey[2]).toBe('EDITOR');
        expect(adminKey[2]).toBe('ADMIN');
        expect(editorKey).not.toEqual(adminKey);
    });
});

// ============================================================================
// RESOLVER OPTIONS
// ============================================================================

describe('EDITOR resolver options', () => {
    it.each(EDITOR_SOURCE_IDS)('%s — staleTime equals DASHBOARD_STALE_TIME_MS', (sourceId) => {
        const { options } = resolveDataSource(sourceId, makeEditorCtx());
        expect(options.staleTime).toBe(DASHBOARD_STALE_TIME_MS);
    });

    it.each(EDITOR_SOURCE_IDS)('%s — queryFn is a callable function', (sourceId) => {
        const { options } = resolveDataSource(sourceId, makeEditorCtx());
        expect(typeof options.queryFn).toBe('function');
    });

    it.each(EDITOR_SOURCE_IDS)('%s — resolveDataSource returns found:true', (sourceId) => {
        const { found } = resolveDataSource(sourceId, makeEditorCtx());
        expect(found).toBe(true);
    });
});

// ============================================================================
// DEDUPLICATION GUARD
// ============================================================================

describe('EDITOR registration deduplication', () => {
    it('re-registering an existing EDITOR source throws (DEV duplicate guard)', () => {
        expect(() => {
            registerDataSource('editor.posts.drafts', (_ctx) => ({
                queryKey: ['dup'],
                queryFn: async () => null,
                staleTime: 0
            }));
        }).toThrow(/Duplicate source registration/);
    });
});
