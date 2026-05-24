/**
 * Tests for apps/admin/src/config/ia/tabs.ts (T-015)
 *
 * Verifies that all entity tab configurations parse against TabsConfigSchema,
 * respect the 9-tab maximum, and are keyed correctly.
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { TabsConfigSchema } from '../schema';
import { tabs } from '../tabs';

/** Input type for TabsConfig — onMissing on each Tab is optional (has .default()). */
type TabsConfigInput = z.input<typeof TabsConfigSchema>;

// Entity keys expected in the registry
const EXPECTED_ENTITY_KEYS = [
    'accommodation',
    'post',
    'event',
    'destination',
    'user',
    'subscription',
    'newsletterCampaign'
] as const;

/**
 * Collects all permission strings from all tabs in a TabsConfig.
 */
function collectPermissions(config: TabsConfigInput): string[] {
    const perms: string[] = [];
    for (const tab of config.tabs) {
        if (tab.permissions) {
            perms.push(...tab.permissions);
        }
    }
    return perms;
}

describe('tabs', () => {
    describe('registry shape', () => {
        it('should contain all expected entity keys', () => {
            const keys = Object.keys(tabs);
            for (const entity of EXPECTED_ENTITY_KEYS) {
                expect(keys).toContain(entity);
            }
        });
    });

    describe('schema validation', () => {
        it('should parse all tab configs against TabsConfigSchema without errors', () => {
            for (const [entity, config] of Object.entries(tabs)) {
                const result = TabsConfigSchema.safeParse(config);
                expect(
                    result.success,
                    `tabs['${entity}'] failed schema validation: ${JSON.stringify(result.error?.issues)}`
                ).toBe(true);
            }
        });

        it('should have entity field matching the registry key', () => {
            for (const [key, config] of Object.entries(tabs)) {
                expect(config.entity).toBe(key);
            }
        });
    });

    describe('tab count constraint', () => {
        it('should have no entity with more than 9 tabs', () => {
            for (const [entity, config] of Object.entries(tabs)) {
                expect(
                    config.tabs.length,
                    `tabs['${entity}'] has ${config.tabs.length} tabs, max is 9`
                ).toBeLessThanOrEqual(9);
            }
        });

        it('should have at least 1 tab per entity', () => {
            for (const [entity, config] of Object.entries(tabs)) {
                expect(config.tabs.length, `tabs['${entity}'] has no tabs`).toBeGreaterThanOrEqual(
                    1
                );
            }
        });
    });

    describe('i18n labels', () => {
        it('should have non-empty es/en/pt labels on every tab', () => {
            for (const [entity, config] of Object.entries(tabs)) {
                for (const tab of config.tabs) {
                    expect(tab.label.es, `tabs['${entity}'].${tab.id} missing es`).toBeTruthy();
                    expect(tab.label.en, `tabs['${entity}'].${tab.id} missing en`).toBeTruthy();
                    expect(tab.label.pt, `tabs['${entity}'].${tab.id} missing pt`).toBeTruthy();
                }
            }
        });
    });

    describe('permission validity', () => {
        it('should only use real PermissionEnum keys in tab permission gates', () => {
            // Arrange
            // The IA config uses PermissionEnum key names (e.g. ACCOMMODATION_CREATE),
            // not the dotted enum values (e.g. 'accommodation.create').
            // PermissionExpressionSchema accepts uppercase identifiers that match PermissionEnum keys.
            const validPermKeys = new Set<string>(Object.keys(PermissionEnum));

            for (const [entity, config] of Object.entries(tabs)) {
                const perms = collectPermissions(config);
                for (const perm of perms) {
                    expect(
                        validPermKeys.has(perm),
                        `tabs['${entity}'] uses unknown permission key '${perm}'`
                    ).toBe(true);
                }
            }
        });
    });

    describe('specific entity expectations', () => {
        it('accommodation tabs should include gallery and pricing tabs', () => {
            const ids = tabs.accommodation.tabs.map((t) => t.id);
            expect(ids).toContain('gallery');
            expect(ids).toContain('pricing');
        });

        it('post tabs should include seo and sponsorship tabs', () => {
            const ids = tabs.post.tabs.map((t) => t.id);
            expect(ids).toContain('seo');
            expect(ids).toContain('sponsorship');
        });

        it('event tabs should include tickets and asistentes', () => {
            const ids = tabs.event.tabs.map((t) => t.id);
            expect(ids).toContain('tickets');
            expect(ids).toContain('asistentes');
        });

        it('user tabs should include permissions tab', () => {
            const ids = tabs.user.tabs.map((t) => t.id);
            expect(ids).toContain('permissions');
        });

        it('newsletterCampaign tabs should include editor and metricas', () => {
            const ids = tabs.newsletterCampaign.tabs.map((t) => t.id);
            expect(ids).toContain('editor');
            expect(ids).toContain('metricas');
        });
    });
});
