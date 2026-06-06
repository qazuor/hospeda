/**
 * Tests for apps/admin/src/config/ia/dashboards.ts (T-004/SPEC-155)
 *
 * Verifies:
 * - All dashboard stubs parse against DashboardSchema.
 * - The 4 named source objects (AC-4) exist in the registry.
 * - The assembled superAdminDashboard (base + super-only section) has 9 widgets.
 * - ADMIN role resolves to adminBaseDashboard (7 cards).
 * - SUPER_ADMIN role resolves to superAdminDashboard (9 cards).
 * - superAdminOnlySection widgets all carry onMissing: 'hide' (AC-7).
 * - adminBaseDashboard contains NO cards H or I (AC-31).
 * - Stub widget IDs are unique within each dashboard.
 * - Every stub widget has non-empty es/en/pt labels.
 * - Real PermissionEnum keys where permission gates are used.
 */

import { dashboards, superAdminOnlySection } from '@/config/ia/dashboards';
import { DashboardSchema } from '@/config/ia/schema';
import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Source object IDs — AC-4
// ---------------------------------------------------------------------------

const SOURCE_DASHBOARD_IDS = [
    'hostDashboard',
    'editorDashboard',
    'adminBaseDashboard',
    'superAdminOnlySection'
] as const;

// Widget IDs that belong exclusively to the SUPER_ADMIN-only section (cards H+I)
const SUPER_ONLY_WIDGET_IDS = new Set(['super-card-h', 'super-card-i']);

// ---------------------------------------------------------------------------
// Registry shape
// ---------------------------------------------------------------------------

describe('dashboards registry', () => {
    it('should contain the 4 named source objects (AC-4)', () => {
        const keys = Object.keys(dashboards);
        for (const id of SOURCE_DASHBOARD_IDS) {
            expect(keys, `missing source object: '${id}'`).toContain(id);
        }
    });

    it('should contain superAdminDashboard as the assembled role-facing entry', () => {
        expect(Object.keys(dashboards)).toContain('superAdminDashboard');
    });

    it('should contain exactly 5 entries (4 source + 1 assembled)', () => {
        expect(Object.keys(dashboards)).toHaveLength(5);
    });
});

// ---------------------------------------------------------------------------
// Schema validation — all entries parse cleanly
// ---------------------------------------------------------------------------

describe('schema validation', () => {
    it('should parse all dashboard registry entries against DashboardSchema', () => {
        for (const [key, dashboard] of Object.entries(dashboards)) {
            const result = DashboardSchema.safeParse(dashboard);
            expect(
                result.success,
                `dashboards['${key}'] failed schema: ${JSON.stringify(result.error?.issues)}`
            ).toBe(true);
        }
    });

    it('superAdminOnlySection named export should also parse cleanly', () => {
        const result = DashboardSchema.safeParse(superAdminOnlySection);
        expect(
            result.success,
            `superAdminOnlySection export failed schema: ${JSON.stringify(result.error?.issues)}`
        ).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Card counts — AC-4
// ---------------------------------------------------------------------------

describe('card counts (AC-4)', () => {
    /**
     * hostDashboard grew from 7 to 10 widgets through SPEC-155 additions
     * (commits c94502f99 → 06b73c15c), then to 11 with the shared 'whats-new'
     * widget added by SPEC-175 T-017, then to 12 with host-card-g-views added
     * by SPEC-197 T-013.
     */
    it('hostDashboard should have exactly 12 stub widgets', () => {
        expect(dashboards.hostDashboard?.widgets).toHaveLength(12);
    });

    /**
     * editorDashboard grew from 8 to 11 widgets through SPEC-155 additions
     * and the live recent-comments card (commit 06b73c15c), then to 12 with
     * the shared 'whats-new' widget added by SPEC-175 T-017, then to 14 with
     * editor-card-e-views + editor-card-f-views added by SPEC-197 T-014.
     */
    it('editorDashboard should have exactly 14 stub widgets', () => {
        expect(dashboards.editorDashboard?.widgets).toHaveLength(14);
    });

    it('adminBaseDashboard should have exactly 9 stub widgets (cards A–G + admin-card-views + whats-new)', () => {
        expect(dashboards.adminBaseDashboard?.widgets).toHaveLength(9);
    });

    it('superAdminOnlySection should have exactly 2 stub widgets (cards H–I)', () => {
        expect(dashboards.superAdminOnlySection?.widgets).toHaveLength(2);
    });

    it('superAdminDashboard should have exactly 11 stub widgets (base 9 + super-only 2)', () => {
        expect(dashboards.superAdminDashboard?.widgets).toHaveLength(11);
    });
});

// ---------------------------------------------------------------------------
// ADMIN / SUPER_ADMIN role wiring — AC-8
// ---------------------------------------------------------------------------

describe('role wiring (AC-8)', () => {
    it('adminBaseDashboard has 9 widgets — ADMIN resolves to 9 cards (7 original + admin-card-views + whats-new)', () => {
        // AC-8: ADMIN role → adminBaseDashboard (7 cards + 1 admin-card-views + 1 whats-new = 9, SPEC-197 T-015)
        const base = dashboards.adminBaseDashboard;
        expect(base?.widgets).toHaveLength(9);
    });

    it('superAdminDashboard has 11 widgets — SUPER_ADMIN resolves to base + section (11 cards)', () => {
        // AC-8: SUPER_ADMIN role → superAdminDashboard (adminBaseDashboard 9 + superAdminOnlySection 2 = 11, SPEC-197 T-015)
        const assembled = dashboards.superAdminDashboard;
        expect(assembled?.widgets).toHaveLength(11);
    });

    it('superAdminDashboard widgets include all adminBaseDashboard widget IDs', () => {
        // Spread construction: assembled dashboard inherits every base widget.
        const baseIds = new Set((dashboards.adminBaseDashboard?.widgets ?? []).map((w) => w.id));
        const assembledIds = new Set(
            (dashboards.superAdminDashboard?.widgets ?? []).map((w) => w.id)
        );
        for (const id of baseIds) {
            expect(
                assembledIds.has(id),
                `base widget '${id}' missing from superAdminDashboard`
            ).toBe(true);
        }
    });

    it('superAdminDashboard widgets include all superAdminOnlySection widget IDs', () => {
        const sectionIds = new Set(
            (dashboards.superAdminOnlySection?.widgets ?? []).map((w) => w.id)
        );
        const assembledIds = new Set(
            (dashboards.superAdminDashboard?.widgets ?? []).map((w) => w.id)
        );
        for (const id of sectionIds) {
            expect(
                assembledIds.has(id),
                `super-only widget '${id}' missing from superAdminDashboard`
            ).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// SUPER_ADMIN-only gating — AC-7, AC-31
// ---------------------------------------------------------------------------

describe('SUPER_ADMIN-only gating (AC-7, AC-31)', () => {
    it('[AC-7] every widget in superAdminOnlySection should have onMissing: "hide"', () => {
        for (const widget of dashboards.superAdminOnlySection?.widgets ?? []) {
            expect(
                widget.onMissing,
                `superAdminOnlySection widget '${widget.id}' missing onMissing:'hide'`
            ).toBe('hide');
        }
    });

    it('[AC-31] adminBaseDashboard should NOT contain cards H or I widget IDs', () => {
        // ADMIN never receives H/I because they are absent from adminBaseDashboard.
        const baseIds = (dashboards.adminBaseDashboard?.widgets ?? []).map((w) => w.id);
        for (const superOnlyId of SUPER_ONLY_WIDGET_IDS) {
            expect(
                baseIds,
                `adminBaseDashboard must not contain SUPER-only widget '${superOnlyId}'`
            ).not.toContain(superOnlyId);
        }
    });

    it('superAdminDashboard base widgets (A-G) should NOT have onMissing: "hide"', () => {
        // Base widgets should be visible to SUPER_ADMIN unconditionally.
        const baseIds = new Set((dashboards.adminBaseDashboard?.widgets ?? []).map((w) => w.id));
        for (const widget of dashboards.superAdminDashboard?.widgets ?? []) {
            if (baseIds.has(widget.id)) {
                expect(
                    widget.onMissing,
                    `base widget '${widget.id}' should not be hidden`
                ).not.toBe('hide');
            }
        }
    });

    it('[AC-7] superAdminDashboard super-only widgets (H-I) should have onMissing: "hide"', () => {
        for (const widget of dashboards.superAdminDashboard?.widgets ?? []) {
            if (SUPER_ONLY_WIDGET_IDS.has(widget.id)) {
                expect(
                    widget.onMissing,
                    `super-only widget '${widget.id}' in superAdminDashboard should have onMissing:'hide'`
                ).toBe('hide');
            }
        }
    });

    it('superAdminOnlySection named export should be identical to dashboards.superAdminOnlySection', () => {
        // Belt-and-suspenders: named export and registry entry must be the same object.
        expect(superAdminOnlySection).toBe(dashboards.superAdminOnlySection);
    });
});

// ---------------------------------------------------------------------------
// Widget integrity — all dashboards
// ---------------------------------------------------------------------------

describe('widget integrity', () => {
    it('should have unique widget IDs within each dashboard', () => {
        for (const [key, dashboard] of Object.entries(dashboards)) {
            const ids = (dashboard.widgets ?? []).map((w) => w.id);
            const unique = new Set(ids);
            expect(
                unique.size,
                `dashboards['${key}'] has duplicate widget IDs: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`
            ).toBe(ids.length);
        }
    });

    it('should have non-empty es/en/pt labels on every widget', () => {
        for (const [key, dashboard] of Object.entries(dashboards)) {
            for (const widget of dashboard.widgets ?? []) {
                expect(
                    widget.label.es,
                    `dashboards['${key}'].${widget.id} missing es label`
                ).toBeTruthy();
                expect(
                    widget.label.en,
                    `dashboards['${key}'].${widget.id} missing en label`
                ).toBeTruthy();
                expect(
                    widget.label.pt,
                    `dashboards['${key}'].${widget.id} missing pt label`
                ).toBeTruthy();
            }
        }
    });

    it('should only use real PermissionEnum keys in widget permission gates', () => {
        const validPermKeys = new Set<string>(Object.keys(PermissionEnum));
        for (const [key, dashboard] of Object.entries(dashboards)) {
            for (const widget of dashboard.widgets ?? []) {
                if (widget.permissions) {
                    for (const perm of widget.permissions) {
                        expect(
                            validPermKeys.has(perm),
                            `dashboards['${key}'] widget '${widget.id}' uses unknown permission '${perm}'`
                        ).toBe(true);
                    }
                }
            }
        }
    });

    it('should have at least 1 widget in every dashboard (schema constraint)', () => {
        for (const [key, dashboard] of Object.entries(dashboards)) {
            expect(
                (dashboard.widgets ?? []).length,
                `dashboards['${key}'] has no widgets`
            ).toBeGreaterThanOrEqual(1);
        }
    });
});

// ---------------------------------------------------------------------------
// Scope expectations per dashboard
// ---------------------------------------------------------------------------

describe('widget scope expectations', () => {
    it('hostDashboard widgets should all have scope "own" (HOST-scoped, except whats-new)', () => {
        // SPEC-175 T-017: the 'whats-new' widget uses scope 'all' because the
        // GET endpoint is session-scoped (server filters by authenticated user),
        // not owner-scoped. Excluding it here is the correct behaviour.
        for (const widget of dashboards.hostDashboard?.widgets ?? []) {
            if (widget.id === 'whats-new') continue;
            expect(
                widget.scope,
                `hostDashboard widget '${widget.id}' should have scope 'own'`
            ).toBe('own');
        }
    });

    it('editorDashboard widgets should all have scope "all"', () => {
        for (const widget of dashboards.editorDashboard?.widgets ?? []) {
            expect(
                widget.scope,
                `editorDashboard widget '${widget.id}' should have scope 'all'`
            ).toBe('all');
        }
    });

    it('adminBaseDashboard widgets should all have scope "all"', () => {
        for (const widget of dashboards.adminBaseDashboard?.widgets ?? []) {
            expect(
                widget.scope,
                `adminBaseDashboard widget '${widget.id}' should have scope 'all'`
            ).toBe('all');
        }
    });

    it('superAdminOnlySection widgets should all have scope "all"', () => {
        for (const widget of dashboards.superAdminOnlySection?.widgets ?? []) {
            expect(
                widget.scope,
                `superAdminOnlySection widget '${widget.id}' should have scope 'all'`
            ).toBe('all');
        }
    });
});
