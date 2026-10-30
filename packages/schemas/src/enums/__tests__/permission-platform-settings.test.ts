import { describe, expect, it } from 'vitest';
import { PermissionEnum } from '../permission.enum.js';

// ============================================================================
// SPEC-156 — Platform Settings V1 finer-grained permissions
// Covers AC-27 (perm enum populated) + the gating refs of AC-22..AC-26.
// Tech-analysis D1: owner chose to ADD literal new perms vs map to existing.
// ============================================================================

describe('PermissionEnum — Platform Settings V1 (SPEC-156)', () => {
    describe('Plataforma → Configuración general', () => {
        it('exposes SETTINGS_GENERAL_VIEW', () => {
            expect(PermissionEnum.SETTINGS_GENERAL_VIEW).toBe('settings.general.view');
        });

        it('exposes SETTINGS_GENERAL_WRITE', () => {
            expect(PermissionEnum.SETTINGS_GENERAL_WRITE).toBe('settings.general.write');
        });
    });

    describe('Plataforma → Configuración crítica (SUPER_ADMIN only)', () => {
        it('exposes MAINTENANCE_MODE_WRITE', () => {
            expect(PermissionEnum.MAINTENANCE_MODE_WRITE).toBe('system.maintenanceMode.write');
        });

        it('does NOT replace the legacy SYSTEM_MAINTENANCE_MODE perm (both coexist)', () => {
            expect(PermissionEnum.SYSTEM_MAINTENANCE_MODE).toBe('system.maintenanceMode');
            expect(PermissionEnum.MAINTENANCE_MODE_WRITE).not.toBe(
                PermissionEnum.SYSTEM_MAINTENANCE_MODE
            );
        });
    });

    describe('Comercial → Configuración billing', () => {
        it('exposes BILLING_SETTINGS_VIEW', () => {
            expect(PermissionEnum.BILLING_SETTINGS_VIEW).toBe('billing.settings.view');
        });

        it('exposes BILLING_SETTINGS_WRITE', () => {
            expect(PermissionEnum.BILLING_SETTINGS_WRITE).toBe('billing.settings.write');
        });
    });

    describe('Mi facturación HOST landing (retired with the old billing, HOS-1419)', () => {
        it('no longer exposes the old own-billing and own-subscription values', () => {
            const values: readonly string[] = Object.values(PermissionEnum);
            expect(values).not.toContain('billing.view.own');
            expect(values).not.toContain('subscription.view.own');
            expect(values).not.toContain('billing.readAll');
        });
    });

    describe('Mi cuenta umbrella gate', () => {
        it('exposes USER_UPDATE_SELF', () => {
            expect(PermissionEnum.USER_UPDATE_SELF).toBe('user.update.self');
        });

        it('does NOT replace USER_UPDATE_PROFILE (legacy own-profile gate kept)', () => {
            expect(PermissionEnum.USER_UPDATE_PROFILE).toBe('user.update.profile');
            expect(PermissionEnum.USER_UPDATE_SELF).not.toBe(PermissionEnum.USER_UPDATE_PROFILE);
        });
    });

    // -------------------------------------------------------------------------
    // Cross-cutting integrity
    // -------------------------------------------------------------------------

    describe('Integrity across the 6 surviving SPEC-156 permissions', () => {
        const newPerms = [
            PermissionEnum.SETTINGS_GENERAL_VIEW,
            PermissionEnum.SETTINGS_GENERAL_WRITE,
            PermissionEnum.MAINTENANCE_MODE_WRITE,
            PermissionEnum.BILLING_SETTINGS_VIEW,
            PermissionEnum.BILLING_SETTINGS_WRITE,
            PermissionEnum.USER_UPDATE_SELF
        ];

        it('contains exactly 6 entries (no accidental duplicates)', () => {
            const uniques = new Set(newPerms);
            expect(uniques.size).toBe(6);
        });

        it('every entry uses dot-notation, lowercase string values', () => {
            for (const value of newPerms) {
                expect(value).toMatch(/^[a-z]+(\.[a-zA-Z]+)+$/);
            }
        });

        it('no new value collides with any other PermissionEnum value', () => {
            const allValues = Object.values(PermissionEnum);
            // total values must equal unique values (no duplicates anywhere)
            expect(new Set(allValues).size).toBe(allValues.length);
        });
    });
});
