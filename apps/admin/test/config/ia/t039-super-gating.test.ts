/**
 * T-039 — SUPER_ADMIN role gating (SPEC-155)
 *
 * Asserts that the ADMIN role resolves to `adminBaseDashboard` (7 cards A–G)
 * and the SUPER_ADMIN role resolves to `superAdminDashboard` (9 cards = base
 * + super-only section). Also asserts that cards H and I (widget IDs
 * 'super-card-h', 'super-card-i') are present ONLY in the SUPER_ADMIN
 * dashboard and absent from the ADMIN dashboard.
 *
 * This is a config-placement gate: ADMIN literally never receives cards H/I
 * because `adminBaseDashboard` does not include those widgets. No runtime
 * permission check is needed — the absence from the config IS the gate.
 *
 * Covers:
 * - ADMIN role maps to adminBaseDashboard: exactly 7 widgets, none with id
 *   'super-card-h' or 'super-card-i'.
 * - SUPER_ADMIN role maps to superAdminDashboard: exactly 9 widgets,
 *   including both 'super-card-h' and 'super-card-i'.
 * - Cards H and I both carry `onMissing: 'hide'` (belt-and-suspenders guard).
 * - Cards A–G are present in both dashboards (spread construction is correct).
 * - The superAdminOnlySection named export is identical to the registry entry.
 * - The base section widgets in superAdminDashboard do NOT carry
 *   `onMissing: 'hide'` (only super-only cards should be hidden for others).
 *
 * Strategy: pure config assertions — no mocks, no rendering.
 * Import directly from dashboards.ts so the test is fast and deterministic.
 *
 * @see apps/admin/src/config/ia/dashboards.ts — dashboards config under test
 * @see SPEC-155 T-039, AC-7, AC-8, AC-31
 */

import { dashboards, superAdminOnlySection } from '@/config/ia/dashboards';
import { describe, expect, it } from 'vitest';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Widget IDs that belong exclusively to the SUPER_ADMIN section (cards H + I). */
const SUPER_ONLY_IDS = new Set(['super-card-h', 'super-card-i'] as const);

/** IDs of all 7 base cards shared by ADMIN and SUPER_ADMIN (cards A–G). */
const ADMIN_BASE_IDS = new Set([
    'admin-card-a',
    'admin-card-b',
    'admin-card-c',
    'admin-card-d',
    'admin-card-e',
    'admin-card-f',
    'admin-card-g'
] as const);

// ============================================================================
// T-039 — ADMIN resolves to adminBaseDashboard (7 cards)
// ============================================================================

describe('T-039 ADMIN role — adminBaseDashboard (7 cards, no H/I)', () => {
    it('adminBaseDashboard has exactly 9 widgets (cards A–G + admin-card-views + whats-new, SPEC-197)', () => {
        expect(dashboards.adminBaseDashboard?.widgets).toHaveLength(9);
    });

    it('adminBaseDashboard contains all 7 base widget IDs (A–G)', () => {
        const ids = new Set(dashboards.adminBaseDashboard?.widgets.map((w) => w.id));
        for (const expectedId of ADMIN_BASE_IDS) {
            expect(ids.has(expectedId), `missing base widget '${expectedId}'`).toBe(true);
        }
    });

    it('adminBaseDashboard does NOT contain super-card-h (AC-31)', () => {
        const ids = dashboards.adminBaseDashboard?.widgets.map((w) => w.id) ?? [];
        expect(ids).not.toContain('super-card-h');
    });

    it('adminBaseDashboard does NOT contain super-card-i (AC-31)', () => {
        const ids = dashboards.adminBaseDashboard?.widgets.map((w) => w.id) ?? [];
        expect(ids).not.toContain('super-card-i');
    });

    it('adminBaseDashboard contains no widget IDs from SUPER_ONLY_IDS (AC-31)', () => {
        const ids = dashboards.adminBaseDashboard?.widgets.map((w) => w.id) ?? [];
        for (const superOnlyId of SUPER_ONLY_IDS) {
            expect(ids, `adminBaseDashboard must not contain '${superOnlyId}'`).not.toContain(
                superOnlyId
            );
        }
    });
});

// ============================================================================
// T-039 — SUPER_ADMIN resolves to superAdminDashboard (9 cards = base + H + I)
// ============================================================================

describe('T-039 SUPER_ADMIN role — superAdminDashboard (9 cards = base + super-only)', () => {
    it('superAdminDashboard has exactly 11 widgets (9 base incl. views + whats-new + 2 super-only)', () => {
        expect(dashboards.superAdminDashboard?.widgets).toHaveLength(11);
    });

    it('superAdminDashboard contains all 7 base widget IDs (A–G)', () => {
        const ids = new Set(dashboards.superAdminDashboard?.widgets.map((w) => w.id));
        for (const baseId of ADMIN_BASE_IDS) {
            expect(ids.has(baseId), `superAdminDashboard missing base widget '${baseId}'`).toBe(
                true
            );
        }
    });

    it('superAdminDashboard contains super-card-h', () => {
        const ids = dashboards.superAdminDashboard?.widgets.map((w) => w.id) ?? [];
        expect(ids).toContain('super-card-h');
    });

    it('superAdminDashboard contains super-card-i', () => {
        const ids = dashboards.superAdminDashboard?.widgets.map((w) => w.id) ?? [];
        expect(ids).toContain('super-card-i');
    });

    it('superAdminDashboard contains all SUPER_ONLY_IDS (H + I)', () => {
        const ids = new Set(dashboards.superAdminDashboard?.widgets.map((w) => w.id));
        for (const superOnlyId of SUPER_ONLY_IDS) {
            expect(
                ids.has(superOnlyId),
                `superAdminDashboard missing super-only widget '${superOnlyId}'`
            ).toBe(true);
        }
    });
});

// ============================================================================
// T-039 — Cards H and I are present ONLY in SUPER_ADMIN, absent from ADMIN
// ============================================================================

describe('T-039 config-placement gating — H and I absent from ADMIN, present in SUPER', () => {
    it('super-card-h: present in superAdminDashboard, absent in adminBaseDashboard', () => {
        const superIds = dashboards.superAdminDashboard?.widgets.map((w) => w.id) ?? [];
        const adminIds = dashboards.adminBaseDashboard?.widgets.map((w) => w.id) ?? [];

        expect(superIds).toContain('super-card-h');
        expect(adminIds).not.toContain('super-card-h');
    });

    it('super-card-i: present in superAdminDashboard, absent in adminBaseDashboard', () => {
        const superIds = dashboards.superAdminDashboard?.widgets.map((w) => w.id) ?? [];
        const adminIds = dashboards.adminBaseDashboard?.widgets.map((w) => w.id) ?? [];

        expect(superIds).toContain('super-card-i');
        expect(adminIds).not.toContain('super-card-i');
    });

    it('superAdminDashboard has 2 more widgets than adminBaseDashboard', () => {
        const superCount = dashboards.superAdminDashboard?.widgets.length ?? 0;
        const adminCount = dashboards.adminBaseDashboard?.widgets.length ?? 0;

        expect(superCount - adminCount).toBe(2);
    });
});

// ============================================================================
// T-039 — onMissing: 'hide' gating on super-only cards (AC-7)
// ============================================================================

describe('T-039 onMissing gating (AC-7)', () => {
    it('super-card-h has onMissing: "hide" in superAdminDashboard', () => {
        const widget = dashboards.superAdminDashboard?.widgets.find((w) => w.id === 'super-card-h');
        expect(widget).toBeDefined();
        expect(widget?.onMissing).toBe('hide');
    });

    it('super-card-i has onMissing: "hide" in superAdminDashboard', () => {
        const widget = dashboards.superAdminDashboard?.widgets.find((w) => w.id === 'super-card-i');
        expect(widget).toBeDefined();
        expect(widget?.onMissing).toBe('hide');
    });

    it('every widget in superAdminOnlySection has onMissing: "hide" (AC-7)', () => {
        for (const widget of superAdminOnlySection.widgets) {
            expect(
                widget.onMissing,
                `superAdminOnlySection widget '${widget.id}' missing onMissing:'hide'`
            ).toBe('hide');
        }
    });

    it('base widgets in superAdminDashboard (A–G) do NOT have onMissing: "hide"', () => {
        for (const widget of dashboards.superAdminDashboard?.widgets ?? []) {
            if (
                ADMIN_BASE_IDS.has(
                    widget.id as typeof ADMIN_BASE_IDS extends Set<infer T> ? T : never
                )
            ) {
                expect(
                    widget.onMissing,
                    `base widget '${widget.id}' should not be hidden`
                ).not.toBe('hide');
            }
        }
    });
});

// ============================================================================
// T-039 — Spread construction integrity
// ============================================================================

describe('T-039 spread construction integrity', () => {
    it('superAdminDashboard widgets is the concatenation of base + superOnlySection', () => {
        const baseIds = dashboards.adminBaseDashboard?.widgets.map((w) => w.id) ?? [];
        const superOnlyIds = dashboards.superAdminOnlySection?.widgets.map((w) => w.id) ?? [];
        const expectedIds = [...baseIds, ...superOnlyIds];

        const actualIds = dashboards.superAdminDashboard?.widgets.map((w) => w.id) ?? [];
        expect(actualIds).toEqual(expectedIds);
    });

    it('superAdminOnlySection named export is identical to dashboards.superAdminOnlySection', () => {
        // Reference equality: the named export and registry entry must be the same object.
        expect(superAdminOnlySection).toBe(dashboards.superAdminOnlySection);
    });

    it('adding a widget to superAdminOnlySection would raise superAdminDashboard count to 10 (structural proof)', () => {
        // This test verifies the spread construction is dynamic, not a manual copy.
        // We can verify this indirectly: the total is always superOnlySection.length + baseSection.length.
        const baseCount = dashboards.adminBaseDashboard?.widgets.length ?? 0;
        const sectionCount = dashboards.superAdminOnlySection?.widgets.length ?? 0;
        const totalCount = dashboards.superAdminDashboard?.widgets.length ?? 0;

        expect(totalCount).toBe(baseCount + sectionCount);
    });
});
