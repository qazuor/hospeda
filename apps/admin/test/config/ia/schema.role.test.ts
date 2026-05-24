/**
 * Tests for RoleConfigSchema (T-006, updated T-040)
 *
 * Covers:
 * - enabled=false role with no mainMenu is valid (deferred role)
 * - enabled=true missing dashboard caught by superRefine
 * - enabled=true missing topbar caught by superRefine
 * - enabled=true with all required fields is valid
 *
 * T-040 note: defaultPermissions was removed from RoleConfigSchema (SPEC-154 §11.4
 * decision D). The role-to-permission bundle lives in ROLE_PERMISSIONS seed data, not here.
 */

import { RoleConfigSchema } from '@/config/ia/schema';
import { describe, expect, it } from 'vitest';

// ============================================================================
// Shared fixtures
// ============================================================================

const validLabel = { es: 'Anfitrión', en: 'Host', pt: 'Anfitrião' } as const;

const validTopbar = {
    showSearch: false,
    showQuickCreate: ['newAccommodation'] as const,
    accountInMenu: true
} as const;

const validMobile = {
    bottomNav: ['inicio', 'catalogo'] as const,
    fab: 'newAccommodation' as const
} as const;

const fullEnabledRole = {
    enabled: true,
    label: validLabel,
    mainMenu: ['inicio', 'misAlojamientos', 'consultas', 'miCuenta'],
    dashboard: 'hostDashboard',
    topbar: validTopbar,
    mobile: validMobile,
    labelOverrides: {}
} as const;

// ============================================================================
// RoleConfigSchema — enabled=false (deferred roles)
// ============================================================================

describe('RoleConfigSchema — disabled role', () => {
    describe('when given valid input', () => {
        it('should accept enabled=false with only label (all nav fields omitted)', () => {
            // Arrange
            const input = { enabled: false, label: validLabel };
            // Act + Assert
            expect(RoleConfigSchema.safeParse(input).success).toBe(true);
        });

        it('should default labelOverrides to {} when omitted', () => {
            // Arrange
            const input = { enabled: false, label: validLabel };
            // Act
            const result = RoleConfigSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.labelOverrides).toEqual({});
            }
        });

        it('should not have a defaultPermissions field (T-040: removed from schema)', () => {
            // Arrange
            const input = { enabled: false, label: validLabel };
            // Act
            const result = RoleConfigSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).not.toHaveProperty('defaultPermissions');
            }
        });
    });
});

// ============================================================================
// RoleConfigSchema — enabled=true (superRefine)
// ============================================================================

describe('RoleConfigSchema — enabled role', () => {
    describe('when given valid input', () => {
        it('should accept an enabled role with all required fields', () => {
            // Arrange + Act + Assert
            expect(RoleConfigSchema.safeParse(fullEnabledRole).success).toBe(true);
        });

        it('should accept labelOverrides with valid label paths', () => {
            // Arrange
            const input = {
                ...fullEnabledRole,
                labelOverrides: {
                    'inicioSidebar.dashboard': {
                        es: 'Mi negocio',
                        en: 'My business',
                        pt: 'Meu negócio'
                    }
                }
            };
            // Act + Assert
            expect(RoleConfigSchema.safeParse(input).success).toBe(true);
        });
    });

    describe('when required navigation fields are missing (superRefine)', () => {
        it('should catch missing dashboard and report the correct path', () => {
            // Arrange
            const { dashboard: _d, ...input } = fullEnabledRole;
            // Act
            const result = RoleConfigSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const paths = result.error.issues.map((i) => i.path.join('.'));
                expect(paths).toContain('dashboard');
            }
        });

        it('should catch missing topbar and report the correct path', () => {
            // Arrange
            const { topbar: _t, ...input } = fullEnabledRole;
            // Act
            const result = RoleConfigSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const paths = result.error.issues.map((i) => i.path.join('.'));
                expect(paths).toContain('topbar');
            }
        });

        it('should catch missing mobile and report the correct path', () => {
            // Arrange
            const { mobile: _m, ...input } = fullEnabledRole;
            // Act
            const result = RoleConfigSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const paths = result.error.issues.map((i) => i.path.join('.'));
                expect(paths).toContain('mobile');
            }
        });

        it('should catch missing mainMenu and report the correct path', () => {
            // Arrange
            const { mainMenu: _mm, ...input } = fullEnabledRole;
            // Act
            const result = RoleConfigSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const paths = result.error.issues.map((i) => i.path.join('.'));
                expect(paths).toContain('mainMenu');
            }
        });

        it('should catch an empty mainMenu array', () => {
            // Arrange
            const input = { ...fullEnabledRole, mainMenu: [] };
            // Act
            const result = RoleConfigSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const paths = result.error.issues.map((i) => i.path.join('.'));
                expect(paths).toContain('mainMenu');
            }
        });

        it('should report ALL four missing fields in a single parse call', () => {
            // Arrange — strip all four nav fields at once
            const input = {
                enabled: true,
                label: validLabel
            };
            // Act
            const result = RoleConfigSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                const paths = result.error.issues.map((i) => i.path.join('.'));
                expect(paths).toContain('mainMenu');
                expect(paths).toContain('dashboard');
                expect(paths).toContain('topbar');
                expect(paths).toContain('mobile');
            }
        });
    });
});
