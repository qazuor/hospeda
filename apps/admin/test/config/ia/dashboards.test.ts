/**
 * Tests for apps/admin/src/config/ia/dashboards.ts (T-016)
 *
 * Verifies that all 4 canonical stub dashboards parse against DashboardSchema
 * and satisfy the minimum 1-widget requirement.
 */

import { dashboards } from '@/config/ia/dashboards';
import { DashboardSchema } from '@/config/ia/schema';
import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

// The 4 canonical dashboard IDs referenced by role configs
const CANONICAL_DASHBOARD_IDS = [
    'hostDashboard',
    'superAdminDashboard',
    'adminDashboard',
    'editorDashboard'
] as const;

describe('dashboards', () => {
    describe('registry shape', () => {
        it('should contain exactly 4 canonical dashboard IDs', () => {
            const keys = Object.keys(dashboards);
            expect(keys).toHaveLength(4);
            for (const id of CANONICAL_DASHBOARD_IDS) {
                expect(keys, `missing canonical dashboard: '${id}'`).toContain(id);
            }
        });
    });

    describe('schema validation', () => {
        it('should parse all dashboards against DashboardSchema without errors', () => {
            for (const [key, dashboard] of Object.entries(dashboards)) {
                const result = DashboardSchema.safeParse(dashboard);
                expect(
                    result.success,
                    `dashboards['${key}'] failed schema validation: ${JSON.stringify(result.error?.issues)}`
                ).toBe(true);
            }
        });
    });

    describe('widget minimum', () => {
        it('should have at least 1 widget in every dashboard (schema constraint)', () => {
            for (const [key, dashboard] of Object.entries(dashboards)) {
                expect(
                    dashboard.widgets.length,
                    `dashboards['${key}'] has no widgets`
                ).toBeGreaterThanOrEqual(1);
            }
        });
    });

    describe('widget validity', () => {
        it('should have unique widget IDs within each dashboard', () => {
            for (const [key, dashboard] of Object.entries(dashboards)) {
                const ids = dashboard.widgets.map((w) => w.id);
                const unique = new Set(ids);
                expect(unique.size, `dashboards['${key}'] has duplicate widget IDs`).toBe(
                    ids.length
                );
            }
        });

        it('should only use real PermissionEnum keys in widget permission gates', () => {
            // Arrange
            // The IA config uses PermissionEnum key names (e.g. ACCOMMODATION_VIEW_ALL),
            // not the dotted enum values (e.g. 'accommodation.viewAll').
            // PermissionExpressionSchema accepts uppercase identifiers that match PermissionEnum keys.
            const validPermKeys = new Set<string>(Object.keys(PermissionEnum));

            for (const [key, dashboard] of Object.entries(dashboards)) {
                for (const widget of dashboard.widgets) {
                    if (widget.permissions) {
                        for (const perm of widget.permissions) {
                            expect(
                                validPermKeys.has(perm),
                                `dashboards['${key}'] widget '${widget.id}' uses unknown permission key '${perm}'`
                            ).toBe(true);
                        }
                    }
                }
            }
        });

        it('should have non-empty es/en/pt labels on every widget', () => {
            for (const [key, dashboard] of Object.entries(dashboards)) {
                for (const widget of dashboard.widgets) {
                    expect(
                        widget.label.es,
                        `dashboards['${key}'].${widget.id} missing es`
                    ).toBeTruthy();
                    expect(
                        widget.label.en,
                        `dashboards['${key}'].${widget.id} missing en`
                    ).toBeTruthy();
                    expect(
                        widget.label.pt,
                        `dashboards['${key}'].${widget.id} missing pt`
                    ).toBeTruthy();
                }
            }
        });
    });

    describe('specific dashboard expectations', () => {
        it('hostDashboard stub widget should have scope: "own"', () => {
            // Arrange
            const widget = dashboards.hostDashboard.widgets[0];

            // Assert
            expect(widget?.scope).toBe('own');
        });

        it('superAdminDashboard stub widget should have scope: "all"', () => {
            // Arrange
            const widget = dashboards.superAdminDashboard.widgets[0];

            // Assert
            expect(widget?.scope).toBe('all');
        });

        it('adminDashboard stub widget should have scope: "all"', () => {
            // Arrange
            const widget = dashboards.adminDashboard.widgets[0];

            // Assert
            expect(widget?.scope).toBe('all');
        });

        it('editorDashboard stub widget should have scope: "all"', () => {
            // Arrange
            const widget = dashboards.editorDashboard.widgets[0];

            // Assert
            expect(widget?.scope).toBe('all');
        });
    });
});
