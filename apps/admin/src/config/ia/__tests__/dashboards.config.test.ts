/**
 * CI validation test for dashboard configs — T-033 (SPEC-155)
 *
 * Asserts:
 *   1. All 4 dashboard objects (hostDashboard, editorDashboard, adminBaseDashboard,
 *      superAdminOnlySection) pass the SPEC-154 DashboardSchema Zod validation.
 *   2. Card counts match the agreed per-role definitions in 03c:
 *      HOST=7, EDITOR=8, adminBase=7, superSection=2.
 *   3. Every data widget whose `config.source` is set uses a source ID that
 *      exists in the registered resolver contract — catching typos before runtime.
 *   4. superAdminDashboard is correctly assembled as base (7) + super-only (2) = 9.
 *   5. Every widget in superAdminOnlySection carries `onMissing: 'hide'`.
 *
 * Strategy:
 *   - Import dashboards.ts directly (pure config, no side effects).
 *   - Import the DashboardSchema from schema.ts for Zod validation.
 *   - Define the KNOWN_SOURCE_IDS set inline from the resolver contract files
 *     (host.ts T-018, editor.ts T-019, admin.ts T-020, super.ts T-021,
 *     dashboard-sources.ts T-017 built-ins). This avoids importing the resolver
 *     files themselves (they call fetchApi at module scope, which requires mocks).
 *
 * @see apps/admin/src/config/ia/dashboards.ts         — subject under test
 * @see apps/admin/src/lib/dashboard-sources/host.ts   — HOST source IDs
 * @see apps/admin/src/lib/dashboard-sources/editor.ts — EDITOR source IDs
 * @see apps/admin/src/lib/dashboard-sources/admin.ts  — ADMIN source IDs
 * @see apps/admin/src/lib/dashboard-sources/super.ts  — SUPER source IDs
 * @see apps/admin/src/lib/dashboard-sources.ts        — T-017 built-in IDs
 * @see SPEC-155 T-033
 */

import { describe, expect, it } from 'vitest';
import { dashboards, superAdminOnlySection } from '../dashboards';
import { DashboardSchema, WidgetSchema } from '../schema';

// ============================================================================
// SOURCE ID CONTRACT
// All registered resolver source IDs from T-017..T-021. Maintained here as a
// compile-time constant so the test catches any typo in dashboards.ts without
// needing to load the actual resolver files (which call fetchApi at module scope).
// ============================================================================

/**
 * Complete set of source IDs registered by the resolver contract
 * (T-017 built-ins + T-018 HOST + T-019 EDITOR + T-020 ADMIN + T-021 SUPER).
 *
 * Update this set whenever a new source is added to any resolver file.
 */
const KNOWN_SOURCE_IDS = new Set<string>([
    // T-017 built-ins (dashboard-sources.ts)
    'admin.entities.counts',
    'admin.users.stats',

    // T-018 HOST (host.ts)
    'host.accommodations.count',
    'host.accommodations.drafts',
    'host.accommodations.entities',
    'host.billing.plan',
    'host.conversations.pending',
    'host.profile.current',
    'host.reviews.latest',
    'host.stats.favorites',
    'host.stats.response-rate',
    'host.stats.ratings',
    'host.stats.conversations-monthly',
    'host.stats.market-comparison',
    'host.suggestions.list',

    // T-019 EDITOR (editor.ts)
    'editor.posts.published-this-month',
    'editor.posts.drafts',
    'editor.events.upcoming',
    'editor.newsletter.subscribers',
    'editor.newsletter.campaigns',
    'editor.posts.stats',
    'editor.events.stats',
    'editor.posts.latest',
    'editor.shortcuts',
    'editor.content.health.posts',
    'editor.content.health.events',
    // SPEC-165 T-016: recent-comments feed card (editor-card-h, type='feed')
    'editor.comments.recent',

    // T-020 ADMIN (admin.ts)
    'admin.accommodations.latest',
    'admin.editorial.summary',
    'admin.crons.list',
    'admin.system.health',
    'admin.moderation.pending',

    // T-021 SUPER (super.ts)
    'super.billing.stats',

    // SPEC-175 T-016: shared What's New recent source (dashboard-sources/whats-new.ts)
    'whats-new.recent'
]);

/**
 * Collects all `source` and `companionSource` string IDs from a widget config.
 * Does NOT recurse into arrays — the config schema keeps things flat in V1.
 *
 * @param config - Widget config object (may be undefined).
 * @returns Array of source ID strings found in the config.
 */
function collectSourceIds(config: Record<string, unknown> | undefined): readonly string[] {
    if (!config) return [];

    const ids: string[] = [];

    if (typeof config.source === 'string') {
        ids.push(config.source);
    }
    if (typeof config.companionSource === 'string') {
        ids.push(config.companionSource);
    }
    if (Array.isArray(config.companionSources)) {
        for (const s of config.companionSources) {
            if (typeof s === 'string') ids.push(s);
        }
    }

    return ids;
}

// ============================================================================
// TESTS
// ============================================================================

describe('Dashboard configs (SPEC-155 T-033)', () => {
    // ── 1. Zod schema validation ──────────────────────────────────────────────

    describe('DashboardSchema validation', () => {
        it('hostDashboard passes DashboardSchema', () => {
            const result = DashboardSchema.safeParse(dashboards.hostDashboard);
            expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(
                true
            );
        });

        it('editorDashboard passes DashboardSchema', () => {
            const result = DashboardSchema.safeParse(dashboards.editorDashboard);
            expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(
                true
            );
        });

        it('adminBaseDashboard passes DashboardSchema', () => {
            const result = DashboardSchema.safeParse(dashboards.adminBaseDashboard);
            expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(
                true
            );
        });

        it('superAdminOnlySection passes DashboardSchema', () => {
            const result = DashboardSchema.safeParse(superAdminOnlySection);
            expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(
                true
            );
        });

        it('superAdminDashboard passes DashboardSchema', () => {
            const result = DashboardSchema.safeParse(dashboards.superAdminDashboard);
            expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(
                true
            );
        });
    });

    // ── 2. Card counts ────────────────────────────────────────────────────────

    describe('Card counts', () => {
        // SPEC-175 T-017: +1 'whats-new' widget on all four role dashboards.
        it('hostDashboard has exactly 11 widgets (10 original + 1 whats-new)', () => {
            expect(dashboards.hostDashboard.widgets).toHaveLength(11);
        });

        it('editorDashboard has exactly 12 widgets (11 original + 1 whats-new)', () => {
            expect(dashboards.editorDashboard.widgets).toHaveLength(12);
        });

        it('adminBaseDashboard has exactly 8 widgets (7 original + 1 whats-new)', () => {
            expect(dashboards.adminBaseDashboard.widgets).toHaveLength(8);
        });

        it('superAdminOnlySection has exactly 2 widgets', () => {
            expect(superAdminOnlySection.widgets).toHaveLength(2);
        });

        it('superAdminDashboard has exactly 10 widgets (7 base + 2 super-only + 1 whats-new)', () => {
            expect(dashboards.superAdminDashboard.widgets).toHaveLength(10);
        });
    });

    // ── 3. Source ID contract ─────────────────────────────────────────────────

    describe('Source ID contract (no typos)', () => {
        it('all hostDashboard widget sources are in the contract', () => {
            const unknownSources: string[] = [];
            for (const widget of dashboards.hostDashboard.widgets) {
                for (const id of collectSourceIds(
                    widget.config as Record<string, unknown> | undefined
                )) {
                    if (!KNOWN_SOURCE_IDS.has(id)) {
                        unknownSources.push(`widget '${widget.id}': source '${id}'`);
                    }
                }
            }
            expect(unknownSources, `Unknown sources: ${unknownSources.join(', ')}`).toHaveLength(0);
        });

        it('all editorDashboard widget sources are in the contract', () => {
            const unknownSources: string[] = [];
            for (const widget of dashboards.editorDashboard.widgets) {
                for (const id of collectSourceIds(
                    widget.config as Record<string, unknown> | undefined
                )) {
                    if (!KNOWN_SOURCE_IDS.has(id)) {
                        unknownSources.push(`widget '${widget.id}': source '${id}'`);
                    }
                }
            }
            expect(unknownSources, `Unknown sources: ${unknownSources.join(', ')}`).toHaveLength(0);
        });

        it('all adminBaseDashboard widget sources are in the contract', () => {
            const unknownSources: string[] = [];
            for (const widget of dashboards.adminBaseDashboard.widgets) {
                for (const id of collectSourceIds(
                    widget.config as Record<string, unknown> | undefined
                )) {
                    if (!KNOWN_SOURCE_IDS.has(id)) {
                        unknownSources.push(`widget '${widget.id}': source '${id}'`);
                    }
                }
            }
            expect(unknownSources, `Unknown sources: ${unknownSources.join(', ')}`).toHaveLength(0);
        });

        it('all superAdminOnlySection widget sources are in the contract', () => {
            const unknownSources: string[] = [];
            for (const widget of superAdminOnlySection.widgets) {
                for (const id of collectSourceIds(
                    widget.config as Record<string, unknown> | undefined
                )) {
                    if (!KNOWN_SOURCE_IDS.has(id)) {
                        unknownSources.push(`widget '${widget.id}': source '${id}'`);
                    }
                }
            }
            expect(unknownSources, `Unknown sources: ${unknownSources.join(', ')}`).toHaveLength(0);
        });
    });

    // ── 4. superAdminOnlySection gating ──────────────────────────────────────

    describe('superAdminOnlySection gating', () => {
        it('every widget in superAdminOnlySection carries onMissing: hide', () => {
            for (const widget of superAdminOnlySection.widgets) {
                expect(widget.onMissing, `Widget '${widget.id}' missing onMissing: 'hide'`).toBe(
                    'hide'
                );
            }
        });

        it('superAdminDashboard widgets A–G come from adminBaseDashboard (excluding whats-new)', () => {
            // adminBaseDashboard now includes the whats-new widget at the end.
            // Slice to 7 to get the original base widgets (A–G).
            const baseIds = dashboards.adminBaseDashboard.widgets.slice(0, 7).map((w) => w.id);
            const superIds = dashboards.superAdminDashboard.widgets.slice(0, 7).map((w) => w.id);
            expect(superIds).toEqual(baseIds);
        });

        it('superAdminDashboard widgets H–I come from superAdminOnlySection (ids match)', () => {
            const sectionIds = superAdminOnlySection.widgets.map((w) => w.id);
            // superAdminDashboard = adminBaseDashboard (A–G + whats-new) ++ superAdminOnlySection,
            // so the super-only section occupies the LAST two positions (t039 spread invariant).
            const superIds = dashboards.superAdminDashboard.widgets.slice(-2).map((w) => w.id);
            expect(superIds).toEqual(sectionIds);
        });

        it('superAdminDashboard includes whats-new right after the A–G base (position 7)', () => {
            // Concatenation invariant: [A–G, whats-new] ++ [H, I].
            const widget = dashboards.superAdminDashboard.widgets.at(7);
            expect(widget?.id).toBe('whats-new');
        });
    });

    // ── 5. Widget ID uniqueness within each dashboard ─────────────────────────

    describe('Widget ID uniqueness', () => {
        const dashboardsToCheck = [
            ['hostDashboard', dashboards.hostDashboard],
            ['editorDashboard', dashboards.editorDashboard],
            ['adminBaseDashboard', dashboards.adminBaseDashboard],
            ['superAdminOnlySection', superAdminOnlySection],
            ['superAdminDashboard', dashboards.superAdminDashboard]
        ] as const;

        for (const [name, dashboard] of dashboardsToCheck) {
            it(`${name} has no duplicate widget IDs`, () => {
                const ids = dashboard.widgets.map((w) => w.id);
                const unique = new Set(ids);
                expect(unique.size, `Duplicate IDs found: ${ids.join(', ')}`).toBe(ids.length);
            });
        }
    });

    // ── 6. Scope correctness ──────────────────────────────────────────────────

    describe('Scope correctness', () => {
        it('all hostDashboard widgets (except shared cross-role ones) use scope: own', () => {
            // The 'whats-new' widget uses scope: 'all' because the backend filters
            // by the authenticated session, not by owner — this is the correct scope
            // for a shared content widget (SPEC-175 T-017 decision).
            const CROSS_ROLE_WIDGET_IDS = new Set(['whats-new']);
            for (const widget of dashboards.hostDashboard.widgets) {
                if (CROSS_ROLE_WIDGET_IDS.has(widget.id)) continue;
                expect(widget.scope, `Widget '${widget.id}' has wrong scope`).toBe('own');
            }
        });

        it('all editorDashboard widgets use scope: all', () => {
            for (const widget of dashboards.editorDashboard.widgets) {
                expect(widget.scope, `Widget '${widget.id}' has wrong scope`).toBe('all');
            }
        });

        it('all adminBaseDashboard widgets use scope: all', () => {
            for (const widget of dashboards.adminBaseDashboard.widgets) {
                expect(widget.scope, `Widget '${widget.id}' has wrong scope`).toBe('all');
            }
        });

        it('all superAdminOnlySection widgets use scope: all', () => {
            for (const widget of superAdminOnlySection.widgets) {
                expect(widget.scope, `Widget '${widget.id}' has wrong scope`).toBe('all');
            }
        });
    });

    // ── 7. Registry completeness ──────────────────────────────────────────────

    describe('Registry export completeness', () => {
        it('dashboards registry contains hostDashboard', () => {
            expect(dashboards).toHaveProperty('hostDashboard');
        });

        it('dashboards registry contains editorDashboard', () => {
            expect(dashboards).toHaveProperty('editorDashboard');
        });

        it('dashboards registry contains adminBaseDashboard', () => {
            expect(dashboards).toHaveProperty('adminBaseDashboard');
        });

        it('dashboards registry contains superAdminOnlySection', () => {
            expect(dashboards).toHaveProperty('superAdminOnlySection');
        });

        it('dashboards registry contains superAdminDashboard', () => {
            expect(dashboards).toHaveProperty('superAdminDashboard');
        });
    });

    // ── 8. status type integration ────────────────────────────────────────────

    describe('status widget type integration', () => {
        it('WidgetSchema accepts type="status"', () => {
            const result = WidgetSchema.safeParse({
                id: 'test-status',
                type: 'status',
                label: { es: 'Estado', en: 'Status', pt: 'Estado' },
                scope: 'all'
            });
            expect(result.success, result.success ? '' : JSON.stringify(result.error?.issues)).toBe(
                true
            );
        });

        it('admin-card-e uses type="status" and source="admin.system.health"', () => {
            const cardE = dashboards.adminBaseDashboard.widgets.find(
                (w) => w.id === 'admin-card-e'
            );
            expect(cardE).toBeDefined();
            expect(cardE?.type).toBe('status');
            expect(cardE?.config?.source).toBe('admin.system.health');
        });

        it('admin-card-e variantMap covers up/degraded/down', () => {
            const cardE = dashboards.adminBaseDashboard.widgets.find(
                (w) => w.id === 'admin-card-e'
            );
            const variantMap = cardE?.config?.variantMap as Record<string, string> | undefined;
            expect(variantMap).toBeDefined();
            expect(variantMap?.up).toBe('success');
            expect(variantMap?.degraded).toBe('warning');
            expect(variantMap?.down).toBe('destructive');
        });

        it('host-card-b uses type="status" and source="host.billing.plan"', () => {
            const cardB = dashboards.hostDashboard.widgets.find((w) => w.id === 'host-card-b');
            expect(cardB).toBeDefined();
            expect(cardB?.type).toBe('status');
            expect(cardB?.config?.source).toBe('host.billing.plan');
        });

        it('host-card-b variantMap covers active/expiring/expired', () => {
            const cardB = dashboards.hostDashboard.widgets.find((w) => w.id === 'host-card-b');
            const variantMap = cardB?.config?.variantMap as Record<string, string> | undefined;
            expect(variantMap).toBeDefined();
            expect(variantMap?.active).toBe('success');
            expect(variantMap?.expiring).toBe('warning');
            expect(variantMap?.expired).toBe('destructive');
        });

        it('no live-source card in any dashboard uses a deferred type', () => {
            // A "live-source card" is one with config.source set and no config.deferred=true.
            // Deferred types are those NOT in the live set: callout, shortcut, map, calendar.
            // Note: 'feed' is a LIVE type since SPEC-165 T-016 (dispatches to CommentsFeedCard).
            const deferredTypes = new Set(['callout', 'shortcut', 'map', 'calendar']);
            const allDashboards = [
                dashboards.hostDashboard,
                dashboards.editorDashboard,
                dashboards.adminBaseDashboard,
                superAdminOnlySection
            ];
            const violations: string[] = [];
            for (const dashboard of allDashboards) {
                for (const widget of dashboard.widgets) {
                    const config = widget.config as Record<string, unknown> | undefined;
                    const hasLiveSource = typeof config?.source === 'string';
                    const isDeferred = config?.deferred === true;
                    if (hasLiveSource && !isDeferred && deferredTypes.has(widget.type)) {
                        violations.push(
                            `widget '${widget.id}' (type='${widget.type}') has live source '${config?.source}' but routes to DeferredWidget`
                        );
                    }
                }
            }
            expect(violations, violations.join(', ')).toHaveLength(0);
        });
    });

    // ── 9. What's New widget (SPEC-175 T-017) ─────────────────────────────────

    describe("What's New widget (SPEC-175 T-017)", () => {
        /**
         * Returns the 'whats-new' widget from a dashboard, or undefined.
         */
        function findWnWidget(widgets: ReadonlyArray<{ id: string; [k: string]: unknown }>) {
            return widgets.find((w) => w.id === 'whats-new');
        }

        it("'whats-new' widget is present in hostDashboard", () => {
            expect(findWnWidget(dashboards.hostDashboard.widgets)).toBeDefined();
        });

        it("'whats-new' widget is present in editorDashboard", () => {
            expect(findWnWidget(dashboards.editorDashboard.widgets)).toBeDefined();
        });

        it("'whats-new' widget is present in adminBaseDashboard", () => {
            expect(findWnWidget(dashboards.adminBaseDashboard.widgets)).toBeDefined();
        });

        it("'whats-new' widget is present in superAdminDashboard", () => {
            expect(findWnWidget(dashboards.superAdminDashboard.widgets)).toBeDefined();
        });

        it("'whats-new' widget has type 'list'", () => {
            const widget = findWnWidget(dashboards.hostDashboard.widgets);
            expect(widget?.type).toBe('list');
        });

        it("'whats-new' widget has source 'whats-new.recent'", () => {
            const widget = findWnWidget(dashboards.hostDashboard.widgets);
            const config = widget?.config as Record<string, unknown> | undefined;
            expect(config?.source).toBe('whats-new.recent');
        });

        it("'whats-new' widget has maxItems: 4", () => {
            const widget = findWnWidget(dashboards.hostDashboard.widgets);
            const config = widget?.config as Record<string, unknown> | undefined;
            expect(config?.maxItems).toBe(4);
        });

        it("'whats-new' widget has accent: 'sky'", () => {
            const widget = findWnWidget(dashboards.hostDashboard.widgets);
            const config = widget?.config as Record<string, unknown> | undefined;
            expect(config?.accent).toBe('sky');
        });

        it("'whats-new' widget has gridSpan: { cols: 2 }", () => {
            const widget = findWnWidget(dashboards.hostDashboard.widgets);
            expect(widget?.gridSpan).toEqual({ cols: 2 });
        });

        it("'whats-new' widget labels include all three locales", () => {
            const widget = findWnWidget(dashboards.hostDashboard.widgets);
            const label = widget?.label as { es: string; en: string; pt: string } | undefined;
            expect(label?.es).toBe('Últimas novedades');
            expect(label?.en).toBe("What's New");
            expect(label?.pt).toBe('Novidades');
        });

        it("'whats-new' widget footerLink carries 'whats-new-panel' action", () => {
            const widget = findWnWidget(dashboards.hostDashboard.widgets);
            const config = widget?.config as Record<string, unknown> | undefined;
            const footerLink = config?.footerLink as { action: string } | undefined;
            expect(footerLink?.action).toBe('whats-new-panel');
        });

        it("'whats-new' widget is the same object across all four dashboards (shared ref)", () => {
            // The widget is defined once as `whatsNewWidget` and spread into all
            // four dashboards — this test confirms the id is consistent.
            const roleIds = [
                'hostDashboard',
                'editorDashboard',
                'adminBaseDashboard',
                'superAdminDashboard'
            ] as const;
            const wnWidgets = roleIds.map((key) =>
                dashboards[key]?.widgets.find((w) => w.id === 'whats-new')
            );
            for (const w of wnWidgets) {
                expect(w?.id).toBe('whats-new');
                expect((w?.config as Record<string, unknown> | undefined)?.source).toBe(
                    'whats-new.recent'
                );
            }
        });
    });
});
