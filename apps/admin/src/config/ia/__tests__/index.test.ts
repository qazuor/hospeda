/**
 * Tests for apps/admin/src/config/ia/index.ts (T-017)
 *
 * Verifies that rawConfig is assembled correctly from all data modules and
 * has the expected structure. Does NOT validate cross-references (that is
 * tested in cross-reference-validations.test.ts).
 */

import { RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { rawConfig } from '../index';

describe('rawConfig (T-017 composer)', () => {
    describe('top-level keys', () => {
        it('should have all 6 required top-level keys', () => {
            const keys = Object.keys(rawConfig);
            expect(keys).toContain('sections');
            expect(keys).toContain('sidebars');
            expect(keys).toContain('dashboards');
            expect(keys).toContain('tabs');
            expect(keys).toContain('createActions');
            expect(keys).toContain('roles');
        });
    });

    describe('sections', () => {
        it('should be a non-empty record', () => {
            expect(typeof rawConfig.sections).toBe('object');
            expect(Object.keys(rawConfig.sections).length).toBeGreaterThan(0);
        });

        it('should contain the canonical top-level sections', () => {
            const sectionIds = Object.keys(rawConfig.sections);
            for (const id of [
                'inicio',
                'catalogo',
                'editorial',
                'comunidad',
                'comercial',
                'plataforma',
                'analisis'
            ]) {
                expect(sectionIds).toContain(id);
            }
        });
    });

    describe('sidebars', () => {
        it('should be a non-empty record', () => {
            expect(typeof rawConfig.sidebars).toBe('object');
            expect(Object.keys(rawConfig.sidebars).length).toBeGreaterThan(0);
        });

        it('should contain at least 7 sidebar definitions', () => {
            expect(Object.keys(rawConfig.sidebars).length).toBeGreaterThanOrEqual(7);
        });

        it('should contain inicioSidebar and catalogoSidebar', () => {
            expect(rawConfig.sidebars).toHaveProperty('inicioSidebar');
            expect(rawConfig.sidebars).toHaveProperty('catalogoSidebar');
        });
    });

    describe('dashboards', () => {
        it('should be a non-empty record', () => {
            expect(typeof rawConfig.dashboards).toBe('object');
            expect(Object.keys(rawConfig.dashboards).length).toBeGreaterThan(0);
        });

        it('should contain the 4 canonical dashboards', () => {
            const ids = Object.keys(rawConfig.dashboards);
            for (const id of [
                'hostDashboard',
                'superAdminDashboard',
                'adminDashboard',
                'editorDashboard'
            ]) {
                expect(ids).toContain(id);
            }
        });
    });

    describe('tabs', () => {
        it('should be a non-empty record', () => {
            expect(typeof rawConfig.tabs).toBe('object');
            expect(Object.keys(rawConfig.tabs).length).toBeGreaterThan(0);
        });

        it('should contain the accommodation and post entity tabs', () => {
            expect(rawConfig.tabs).toHaveProperty('accommodation');
            expect(rawConfig.tabs).toHaveProperty('post');
        });
    });

    describe('createActions', () => {
        it('should be a non-empty record', () => {
            expect(typeof rawConfig.createActions).toBe('object');
            expect(Object.keys(rawConfig.createActions).length).toBeGreaterThan(0);
        });

        it('should contain the core create actions', () => {
            const ids = Object.keys(rawConfig.createActions);
            for (const id of ['newAccommodation', 'newPost', 'newEvent', 'newCampaign']) {
                expect(ids).toContain(id);
            }
        });
    });

    describe('roles', () => {
        it('should have exactly the 6 admin-panel RoleEnum keys', () => {
            const roleKeys = Object.keys(rawConfig.roles);
            expect(roleKeys).toContain(RoleEnum.SUPER_ADMIN);
            expect(roleKeys).toContain(RoleEnum.ADMIN);
            expect(roleKeys).toContain(RoleEnum.HOST);
            expect(roleKeys).toContain(RoleEnum.EDITOR);
            expect(roleKeys).toContain(RoleEnum.SPONSOR);
            expect(roleKeys).toContain(RoleEnum.CLIENT_MANAGER);
        });

        it('should have 6 roles total', () => {
            expect(Object.keys(rawConfig.roles)).toHaveLength(6);
        });

        it('should have SUPER_ADMIN enabled', () => {
            expect(rawConfig.roles[RoleEnum.SUPER_ADMIN]?.enabled).toBe(true);
        });

        it('should have ADMIN enabled', () => {
            expect(rawConfig.roles[RoleEnum.ADMIN]?.enabled).toBe(true);
        });

        it('should have HOST enabled', () => {
            expect(rawConfig.roles[RoleEnum.HOST]?.enabled).toBe(true);
        });

        it('should have EDITOR enabled', () => {
            expect(rawConfig.roles[RoleEnum.EDITOR]?.enabled).toBe(true);
        });

        it('should have SPONSOR disabled (deferred)', () => {
            expect(rawConfig.roles[RoleEnum.SPONSOR]?.enabled).toBe(false);
        });

        it('should have CLIENT_MANAGER disabled (deferred)', () => {
            expect(rawConfig.roles[RoleEnum.CLIENT_MANAGER]?.enabled).toBe(false);
        });
    });
});
