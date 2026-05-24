/**
 * Tests for role config files (T-012, T-013, T-014)
 *
 * Each role const is validated against RoleConfigSchema.parse() to ensure the
 * static config data never drifts from the schema contract. Assertions cover:
 *
 * - All 6 roles parse without throwing
 * - Enabled roles have the required navigation fields matching the spec values
 * - Disabled roles parse cleanly without navigation fields
 * - HOST / EDITOR bottomNav entries are a subset of their respective mainMenu
 * - HOST mobile.fab and EDITOR topbar.showQuickCreate match spec exactly
 * - superRefine catches a synthetically invalid enabled role missing `dashboard`
 *
 * @see apps/admin/src/config/ia/roles/super-admin.ts
 * @see apps/admin/src/config/ia/roles/admin.ts
 * @see apps/admin/src/config/ia/roles/host.ts
 * @see apps/admin/src/config/ia/roles/editor.ts
 * @see apps/admin/src/config/ia/roles/sponsor.ts
 * @see apps/admin/src/config/ia/roles/client-manager.ts
 */

import { describe, expect, it } from 'vitest';
import { adminRole } from '../roles/admin';
import { clientManagerRole } from '../roles/client-manager';
import { editorRole } from '../roles/editor';
import { hostRole } from '../roles/host';
import { sponsorRole } from '../roles/sponsor';
import { superAdminRole } from '../roles/super-admin';
import { RoleConfigSchema } from '../schema';

// ============================================================================
// Helpers
// ============================================================================

/**
 * Returns true when every element of `subset` is present in `superset`.
 */
function isSubsetOf(subset: readonly string[], superset: readonly string[]): boolean {
    return subset.every((item) => superset.includes(item));
}

// ============================================================================
// superAdminRole
// ============================================================================

describe('superAdminRole', () => {
    it('should parse without throwing', () => {
        // Arrange + Act + Assert
        expect(() => RoleConfigSchema.parse(superAdminRole)).not.toThrow();
    });

    it('should be enabled', () => {
        // Arrange
        const result = RoleConfigSchema.parse(superAdminRole);
        // Act + Assert
        expect(result.enabled).toBe(true);
    });

    it('should have all 7 sections in mainMenu', () => {
        // Arrange
        const result = RoleConfigSchema.parse(superAdminRole);
        // Assert
        expect(result.mainMenu).toEqual([
            'inicio',
            'catalogo',
            'editorial',
            'comunidad',
            'comercial',
            'plataforma',
            'analisis'
        ]);
    });

    it('should reference superAdminDashboard', () => {
        // Arrange
        const result = RoleConfigSchema.parse(superAdminRole);
        // Assert
        expect(result.dashboard).toBe('superAdminDashboard');
    });

    it('should have topbar with showSearch=true, showQuickCreate="all", accountInMenu=false', () => {
        // Arrange
        const result = RoleConfigSchema.parse(superAdminRole);
        // Assert
        expect(result.topbar?.showSearch).toBe(true);
        expect(result.topbar?.showQuickCreate).toBe('all');
        expect(result.topbar?.accountInMenu).toBe(false);
    });

    it('should have mobile with bottomNav=null and fab=null', () => {
        // Arrange
        const result = RoleConfigSchema.parse(superAdminRole);
        // Assert
        expect(result.mobile?.bottomNav).toBeNull();
        expect(result.mobile?.fab).toBeNull();
    });

    it('should have empty labelOverrides by default', () => {
        // Arrange
        const result = RoleConfigSchema.parse(superAdminRole);
        // Assert
        expect(result.labelOverrides).toEqual({});
    });
});

// ============================================================================
// adminRole
// ============================================================================

describe('adminRole', () => {
    it('should parse without throwing', () => {
        // Arrange + Act + Assert
        expect(() => RoleConfigSchema.parse(adminRole)).not.toThrow();
    });

    it('should be enabled', () => {
        // Arrange
        const result = RoleConfigSchema.parse(adminRole);
        // Assert
        expect(result.enabled).toBe(true);
    });

    it('should have all 7 sections in mainMenu', () => {
        // Arrange
        const result = RoleConfigSchema.parse(adminRole);
        // Assert
        expect(result.mainMenu).toEqual([
            'inicio',
            'catalogo',
            'editorial',
            'comunidad',
            'comercial',
            'plataforma',
            'analisis'
        ]);
    });

    it('should reference adminDashboard', () => {
        // Arrange
        const result = RoleConfigSchema.parse(adminRole);
        // Assert
        expect(result.dashboard).toBe('adminDashboard');
    });

    it('should have topbar with showSearch=true, showQuickCreate="all", accountInMenu=false', () => {
        // Arrange
        const result = RoleConfigSchema.parse(adminRole);
        // Assert
        expect(result.topbar?.showSearch).toBe(true);
        expect(result.topbar?.showQuickCreate).toBe('all');
        expect(result.topbar?.accountInMenu).toBe(false);
    });

    it('should have mobile with bottomNav=null and fab=null', () => {
        // Arrange
        const result = RoleConfigSchema.parse(adminRole);
        // Assert
        expect(result.mobile?.bottomNav).toBeNull();
        expect(result.mobile?.fab).toBeNull();
    });
});

// ============================================================================
// hostRole
// ============================================================================

describe('hostRole', () => {
    it('should parse without throwing', () => {
        // Arrange + Act + Assert
        expect(() => RoleConfigSchema.parse(hostRole)).not.toThrow();
    });

    it('should be enabled', () => {
        // Arrange
        const result = RoleConfigSchema.parse(hostRole);
        // Assert
        expect(result.enabled).toBe(true);
    });

    it('should have the host-scoped mainMenu', () => {
        // Arrange
        const result = RoleConfigSchema.parse(hostRole);
        // Assert
        expect(result.mainMenu).toEqual([
            'inicio',
            'misAlojamientos',
            'consultas',
            'miFacturacion',
            'miCuenta'
        ]);
    });

    it('should reference hostDashboard', () => {
        // Arrange
        const result = RoleConfigSchema.parse(hostRole);
        // Assert
        expect(result.dashboard).toBe('hostDashboard');
    });

    it('should have topbar with showSearch=false, showQuickCreate=["newAccommodation"], accountInMenu=true', () => {
        // Arrange
        const result = RoleConfigSchema.parse(hostRole);
        // Assert
        expect(result.topbar?.showSearch).toBe(false);
        expect(result.topbar?.showQuickCreate).toEqual(['newAccommodation']);
        expect(result.topbar?.accountInMenu).toBe(true);
    });

    it('should have mobile.fab === "newAccommodation"', () => {
        // Arrange
        const result = RoleConfigSchema.parse(hostRole);
        // Assert
        expect(result.mobile?.fab).toBe('newAccommodation');
    });

    it('should have bottomNav as a subset of mainMenu', () => {
        // Arrange
        const result = RoleConfigSchema.parse(hostRole);
        const mainMenu = result.mainMenu ?? [];
        const bottomNav = result.mobile?.bottomNav ?? [];
        // Assert
        expect(isSubsetOf(bottomNav, mainMenu)).toBe(true);
    });

    it('should have bottomNav matching spec exactly', () => {
        // Arrange
        const result = RoleConfigSchema.parse(hostRole);
        // Assert
        expect(result.mobile?.bottomNav).toEqual([
            'inicio',
            'misAlojamientos',
            'consultas',
            'miCuenta'
        ]);
    });

    it('should override inicioSidebar.dashboard label to "Mi negocio"', () => {
        // Arrange
        const result = RoleConfigSchema.parse(hostRole);
        const override = result.labelOverrides['inicioSidebar.dashboard'];
        // Assert
        expect(override).toEqual({
            es: 'Mi negocio',
            en: 'My business',
            pt: 'Meu negócio'
        });
    });
});

// ============================================================================
// editorRole
// ============================================================================

describe('editorRole', () => {
    it('should parse without throwing', () => {
        // Arrange + Act + Assert
        expect(() => RoleConfigSchema.parse(editorRole)).not.toThrow();
    });

    it('should be enabled', () => {
        // Arrange
        const result = RoleConfigSchema.parse(editorRole);
        // Assert
        expect(result.enabled).toBe(true);
    });

    it('should have the editor-scoped mainMenu', () => {
        // Arrange
        const result = RoleConfigSchema.parse(editorRole);
        // Assert
        expect(result.mainMenu).toEqual(['inicio', 'editorial', 'analisis', 'miCuenta']);
    });

    it('should reference editorDashboard', () => {
        // Arrange
        const result = RoleConfigSchema.parse(editorRole);
        // Assert
        expect(result.dashboard).toBe('editorDashboard');
    });

    it('should have topbar.showQuickCreate deep-equal ["newPost","newEvent","newCampaign"]', () => {
        // Arrange
        const result = RoleConfigSchema.parse(editorRole);
        // Assert
        expect(result.topbar?.showQuickCreate).toEqual(['newPost', 'newEvent', 'newCampaign']);
    });

    it('should have topbar with showSearch=true and accountInMenu=true', () => {
        // Arrange
        const result = RoleConfigSchema.parse(editorRole);
        // Assert
        expect(result.topbar?.showSearch).toBe(true);
        expect(result.topbar?.accountInMenu).toBe(true);
    });

    it('should have mobile.fab === "newPost"', () => {
        // Arrange
        const result = RoleConfigSchema.parse(editorRole);
        // Assert
        expect(result.mobile?.fab).toBe('newPost');
    });

    it('should have bottomNav as a subset of mainMenu', () => {
        // Arrange
        const result = RoleConfigSchema.parse(editorRole);
        const mainMenu = result.mainMenu ?? [];
        const bottomNav = result.mobile?.bottomNav ?? [];
        // Assert
        expect(isSubsetOf(bottomNav, mainMenu)).toBe(true);
    });

    it('should have bottomNav matching spec exactly', () => {
        // Arrange
        const result = RoleConfigSchema.parse(editorRole);
        // Assert
        expect(result.mobile?.bottomNav).toEqual(['inicio', 'editorial', 'analisis', 'miCuenta']);
    });

    it('should override inicioSidebar.dashboard label to "Dashboard editorial"', () => {
        // Arrange
        const result = RoleConfigSchema.parse(editorRole);
        const override = result.labelOverrides['inicioSidebar.dashboard'];
        // Assert
        expect(override).toEqual({
            es: 'Dashboard editorial',
            en: 'Editorial dashboard',
            pt: 'Painel editorial'
        });
    });
});

// ============================================================================
// sponsorRole — disabled (deferred)
// ============================================================================

describe('sponsorRole', () => {
    it('should parse without throwing', () => {
        // Arrange + Act + Assert
        expect(() => RoleConfigSchema.parse(sponsorRole)).not.toThrow();
    });

    it('should be disabled', () => {
        // Arrange
        const result = RoleConfigSchema.parse(sponsorRole);
        // Assert
        expect(result.enabled).toBe(false);
    });

    it('should have tri-locale label', () => {
        // Arrange
        const result = RoleConfigSchema.parse(sponsorRole);
        // Assert
        expect(result.label).toEqual({ es: 'Sponsor', en: 'Sponsor', pt: 'Patrocinador' });
    });

    it('should have no mainMenu field', () => {
        // Arrange
        const result = RoleConfigSchema.parse(sponsorRole);
        // Assert
        expect(result.mainMenu).toBeUndefined();
    });

    it('should have no dashboard field', () => {
        // Arrange
        const result = RoleConfigSchema.parse(sponsorRole);
        // Assert
        expect(result.dashboard).toBeUndefined();
    });
});

// ============================================================================
// clientManagerRole — disabled (deferred)
// ============================================================================

describe('clientManagerRole', () => {
    it('should parse without throwing', () => {
        // Arrange + Act + Assert
        expect(() => RoleConfigSchema.parse(clientManagerRole)).not.toThrow();
    });

    it('should be disabled', () => {
        // Arrange
        const result = RoleConfigSchema.parse(clientManagerRole);
        // Assert
        expect(result.enabled).toBe(false);
    });

    it('should have tri-locale label', () => {
        // Arrange
        const result = RoleConfigSchema.parse(clientManagerRole);
        // Assert
        expect(result.label).toEqual({
            es: 'Client manager',
            en: 'Client manager',
            pt: 'Gestor de clientes'
        });
    });

    it('should have no mainMenu field', () => {
        // Arrange
        const result = RoleConfigSchema.parse(clientManagerRole);
        // Assert
        expect(result.mainMenu).toBeUndefined();
    });
});

// ============================================================================
// superRefine — synthetic invalid enabled role missing dashboard
// ============================================================================

describe('RoleConfigSchema superRefine — enabled role missing dashboard', () => {
    it('should fail when enabled=true and dashboard is absent', () => {
        // Arrange — construct an inline invalid object
        const invalidRole = {
            enabled: true,
            label: { es: 'Test', en: 'Test', pt: 'Test' },
            mainMenu: ['inicio'],
            // dashboard intentionally omitted
            topbar: { showSearch: false, showQuickCreate: null, accountInMenu: false },
            mobile: { bottomNav: null, fab: null }
        };

        // Act
        const result = RoleConfigSchema.safeParse(invalidRole);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            const paths = result.error.issues.map((issue) => issue.path.join('.'));
            expect(paths).toContain('dashboard');
        }
    });
});
