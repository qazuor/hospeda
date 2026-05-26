/**
 * Tests for WidgetSchema, DashboardSchema, TopbarConfigSchema, MobileConfigSchema (T-005)
 *
 * Covers:
 * - bottomNav min(2) enforced
 * - bottomNav max(5) enforced
 * - bottomNav null is valid
 * - showQuickCreate as 'all' / as array / as null all valid
 */

import {
    DashboardSchema,
    MobileConfigSchema,
    TopbarConfigSchema,
    WidgetSchema
} from '@/config/ia/schema';
import { describe, expect, it } from 'vitest';

// ============================================================================
// Shared fixtures
// ============================================================================

const validLabel = { es: 'Widget', en: 'Widget', pt: 'Widget' } as const;

const validWidget = {
    id: 'my-count',
    type: 'kpi' as const,
    label: validLabel
};

// ============================================================================
// WidgetSchema
// ============================================================================

describe('WidgetSchema', () => {
    describe('when given valid input', () => {
        it('should accept a minimal widget (no permissions, no config)', () => {
            // Arrange + Act + Assert
            expect(WidgetSchema.safeParse(validWidget).success).toBe(true);
        });

        it('should default scope to "all" when not provided', () => {
            // Arrange + Act
            const result = WidgetSchema.safeParse(validWidget);
            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.scope).toBe('all');
            }
        });

        it('should accept all valid widget types', () => {
            // Arrange
            const types = [
                'kpi',
                'list',
                'chart',
                'feed',
                'callout',
                'shortcut',
                'map',
                'calendar'
            ] as const;
            // Act + Assert
            for (const type of types) {
                const result = WidgetSchema.safeParse({ ...validWidget, id: `w-${type}`, type });
                expect(result.success).toBe(true);
            }
        });

        it('should accept a widget with config object', () => {
            // Arrange
            const input = {
                ...validWidget,
                config: { source: 'accommodation.list.count.own', limit: 5 }
            };
            // Act + Assert
            expect(WidgetSchema.safeParse(input).success).toBe(true);
        });

        it('should accept scope "own"', () => {
            // Arrange
            const input = { ...validWidget, scope: 'own' as const };
            // Act + Assert
            expect(WidgetSchema.safeParse(input).success).toBe(true);
        });

        it('should accept scope "toggle"', () => {
            // Arrange
            const input = { ...validWidget, scope: 'toggle' as const };
            // Act + Assert
            expect(WidgetSchema.safeParse(input).success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject an unknown widget type', () => {
            // Arrange
            const input = { ...validWidget, type: 'table' };
            // Act + Assert
            expect(WidgetSchema.safeParse(input).success).toBe(false);
        });

        it('should reject an empty id', () => {
            // Arrange
            const input = { ...validWidget, id: '' };
            // Act + Assert
            expect(WidgetSchema.safeParse(input).success).toBe(false);
        });
    });
});

// ============================================================================
// DashboardSchema
// ============================================================================

describe('DashboardSchema', () => {
    describe('when given valid input', () => {
        it('should accept a dashboard with one widget', () => {
            // Arrange
            const input = { widgets: [validWidget] };
            // Act + Assert
            expect(DashboardSchema.safeParse(input).success).toBe(true);
        });

        it('should accept a dashboard with multiple widgets', () => {
            // Arrange
            const input = {
                widgets: [
                    validWidget,
                    {
                        id: 'list-widget',
                        type: 'list' as const,
                        label: validLabel,
                        scope: 'own' as const
                    }
                ]
            };
            // Act + Assert
            expect(DashboardSchema.safeParse(input).success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject a dashboard with zero widgets', () => {
            // Arrange
            const input = { widgets: [] };
            // Act + Assert
            expect(DashboardSchema.safeParse(input).success).toBe(false);
        });
    });
});

// ============================================================================
// TopbarConfigSchema
// ============================================================================

describe('TopbarConfigSchema', () => {
    describe('when given valid input', () => {
        it('should accept showQuickCreate as "all"', () => {
            // Arrange
            const input = { showSearch: true, showQuickCreate: 'all', accountInMenu: false };
            // Act + Assert
            expect(TopbarConfigSchema.safeParse(input).success).toBe(true);
        });

        it('should accept showQuickCreate as an explicit array', () => {
            // Arrange
            const input = {
                showSearch: true,
                showQuickCreate: ['newAccommodation', 'newPost'],
                accountInMenu: true
            };
            // Act + Assert
            expect(TopbarConfigSchema.safeParse(input).success).toBe(true);
        });

        it('should accept showQuickCreate as null (no button)', () => {
            // Arrange
            const input = { showSearch: false, showQuickCreate: null, accountInMenu: true };
            // Act + Assert
            expect(TopbarConfigSchema.safeParse(input).success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject an empty showQuickCreate array', () => {
            // Arrange — union requires 'all' | array min(1) | null; empty array matches neither
            const input = { showSearch: true, showQuickCreate: [], accountInMenu: false };
            // Act + Assert
            expect(TopbarConfigSchema.safeParse(input).success).toBe(false);
        });

        it('should reject missing showSearch', () => {
            // Arrange
            const input = { showQuickCreate: null, accountInMenu: false };
            // Act + Assert
            expect(TopbarConfigSchema.safeParse(input).success).toBe(false);
        });
    });
});

// ============================================================================
// MobileConfigSchema
// ============================================================================

describe('MobileConfigSchema', () => {
    describe('when given valid input', () => {
        it('should accept bottomNav with exactly 2 items (min boundary)', () => {
            // Arrange
            const input = { bottomNav: ['inicio', 'consultas'], fab: null };
            // Act + Assert
            expect(MobileConfigSchema.safeParse(input).success).toBe(true);
        });

        it('should accept bottomNav with exactly 5 items (max boundary)', () => {
            // Arrange
            const input = {
                bottomNav: ['s1', 's2', 's3', 's4', 's5'],
                fab: 'newAccommodation'
            };
            // Act + Assert
            expect(MobileConfigSchema.safeParse(input).success).toBe(true);
        });

        it('should accept bottomNav as null (hamburger-only mode)', () => {
            // Arrange
            const input = { bottomNav: null, fab: null };
            // Act + Assert
            expect(MobileConfigSchema.safeParse(input).success).toBe(true);
        });

        it('should accept fab as a string reference', () => {
            // Arrange
            const input = { bottomNav: ['inicio', 'catalogo'], fab: 'newAccommodation' };
            // Act + Assert
            expect(MobileConfigSchema.safeParse(input).success).toBe(true);
        });

        it('should accept bottomNav with 7 items (admin/super-admin compact nav)', () => {
            // Arrange
            const input = {
                bottomNav: ['s1', 's2', 's3', 's4', 's5', 's6', 's7'],
                fab: null
            };
            // Act + Assert
            expect(MobileConfigSchema.safeParse(input).success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject bottomNav with only 1 item (violates min 2)', () => {
            // Arrange
            const input = { bottomNav: ['inicio'], fab: null };
            // Act + Assert
            expect(MobileConfigSchema.safeParse(input).success).toBe(false);
        });

        it('should reject bottomNav with 8 items (exceeds max 7)', () => {
            // Arrange
            const input = {
                bottomNav: ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'],
                fab: null
            };
            // Act + Assert
            expect(MobileConfigSchema.safeParse(input).success).toBe(false);
        });

        it('should reject an empty bottomNav array (min 2 not met)', () => {
            // Arrange
            const input = { bottomNav: [], fab: null };
            // Act + Assert
            expect(MobileConfigSchema.safeParse(input).success).toBe(false);
        });
    });
});
