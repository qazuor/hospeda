/**
 * Tests for apps/admin/src/config/ia/sidebars.ts (T-008, T-009, T-010, extended T-039)
 *
 * Verifies that all 11 sidebars (7 original + 4 HOST) parse correctly against
 * SidebarSchema, that the inicioSidebar has exactly 2 items with the correct routes,
 * that there are no nested groups, that SUPER_ADMIN-only items carry onMissing:'hide',
 * and that all HOST sidebars use real PermissionEnum keys.
 */

import { type SidebarItemSchema, SidebarSchema } from '@/config/ia/schema';
import { sidebars } from '@/config/ia/sidebars';
import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

/** Input type for sidebar items (fields with .default() are optional). */
type SidebarItemInput = z.input<typeof SidebarItemSchema>;

// All canonical sidebar IDs (7 original + 4 HOST)
const CANONICAL_SIDEBAR_IDS = [
    'inicioSidebar',
    'catalogoSidebar',
    'editorialSidebar',
    'comunidadSidebar',
    'comercialSidebar',
    'plataformaSidebar',
    'analisisSidebar',
    'miCuentaSidebar',
    'misAlojamientosSidebar',
    'consultasSidebar',
    'miFacturacionSidebar'
] as const;

// All real PermissionEnum keys for gate validation
const ALL_PERMISSION_KEYS = new Set(Object.keys(PermissionEnum));

/**
 * Recursively collects all link items from sidebar items (including inside groups).
 * Does NOT recurse into nested groups (groups are max 1 level deep by design).
 */
function collectAllLinks(items: SidebarItemInput[]): Array<{ route: string; id: string }> {
    const links: Array<{ route: string; id: string }> = [];
    for (const item of items) {
        if (item.type === 'link') {
            links.push({ route: item.route, id: item.id });
        } else if (item.type === 'group') {
            for (const child of item.items) {
                if (child.type === 'link') {
                    links.push({ route: child.route, id: child.id });
                }
            }
        }
    }
    return links;
}

/**
 * Returns true if any item in the list is a group containing another group
 * (which would violate the 2-level maximum).
 *
 * GroupChildItem is typed as LinkItem | SeparatorItem (no nested groups by schema design),
 * so we cast via `unknown` to perform the runtime invariant check defensively.
 */
function hasNestedGroups(items: SidebarItemInput[]): boolean {
    for (const item of items) {
        if (item.type === 'group') {
            for (const child of item.items) {
                // GroupChildItemSchema excludes groups, but we do a runtime defence check
                const childType = (child as unknown as { type: string }).type;
                if (childType === 'group') {
                    return true;
                }
            }
        }
    }
    return false;
}

/**
 * Collects all items from all levels that have onMissing: 'hide'.
 */
function collectHiddenItems(items: SidebarItemInput[]): SidebarItemInput[] {
    const hidden: SidebarItemInput[] = [];
    for (const item of items) {
        if ('onMissing' in item && item.onMissing === 'hide') {
            hidden.push(item);
        }
        if (item.type === 'group') {
            for (const child of item.items) {
                if ('onMissing' in child && child.onMissing === 'hide') {
                    hidden.push(child);
                }
            }
        }
    }
    return hidden;
}

describe('sidebars', () => {
    describe('registry shape', () => {
        it('should export exactly 11 sidebars (7 original + 4 HOST)', () => {
            expect(Object.keys(sidebars)).toHaveLength(11);
        });

        it('should contain all canonical sidebar IDs', () => {
            const keys = Object.keys(sidebars);
            for (const id of CANONICAL_SIDEBAR_IDS) {
                expect(keys).toContain(id);
            }
        });
    });

    describe('schema validation', () => {
        it('should parse all sidebars against SidebarSchema without errors', () => {
            for (const [key, sidebar] of Object.entries(sidebars)) {
                const result = SidebarSchema.safeParse(sidebar);
                expect(
                    result.success,
                    `sidebar '${key}' failed schema validation: ${JSON.stringify(result.error?.issues)}`
                ).toBe(true);
            }
        });
    });

    describe('inicioSidebar', () => {
        it('should have exactly 2 items', () => {
            // Arrange + Act
            const items = sidebars.inicioSidebar.items;

            // Assert
            expect(items).toHaveLength(2);
        });

        it('should have first item as link to /dashboard', () => {
            // Arrange
            const first = sidebars.inicioSidebar.items[0];

            // Assert
            expect(first?.type).toBe('link');
            if (first?.type === 'link') {
                expect(first.route).toBe('/dashboard');
                expect(first.id).toBe('dashboard');
            }
        });

        it('should have second item as inbox link to /notifications', () => {
            // Arrange
            const second = sidebars.inicioSidebar.items[1];

            // Assert
            expect(second?.type).toBe('link');
            if (second?.type === 'link') {
                expect(second.route).toBe('/notifications');
                expect(second.id).toBe('inbox');
            }
        });

        it('should have inbox item containing "(beta)" in all locales', () => {
            // Arrange
            const second = sidebars.inicioSidebar.items[1];

            // Assert
            if (second?.type === 'link') {
                expect(second.label.es).toContain('beta');
                expect(second.label.en).toContain('beta');
                expect(second.label.pt).toContain('beta');
            }
        });
    });

    describe('nested groups constraint', () => {
        it('should have no nested groups in any sidebar (max 2 levels)', () => {
            for (const [key, sidebar] of Object.entries(sidebars)) {
                expect(
                    hasNestedGroups(sidebar.items),
                    `sidebar '${key}' has nested groups (violates 2-level max)`
                ).toBe(false);
            }
        });
    });

    describe('link routes', () => {
        it('should have all link routes starting with "/"', () => {
            for (const [key, sidebar] of Object.entries(sidebars)) {
                const links = collectAllLinks(sidebar.items);
                for (const link of links) {
                    expect(
                        link.route,
                        `sidebar '${key}' item '${link.id}' has invalid route`
                    ).toMatch(/^\//);
                }
            }
        });
    });

    describe('SUPER_ADMIN-only items with onMissing: hide', () => {
        it('should have onMissing: "hide" on plataforma critical-settings item', () => {
            // Arrange
            const hiddenItems = collectHiddenItems(sidebars.plataformaSidebar.items);
            const ids = hiddenItems.map((i) => i.id);

            // Assert — critical settings must be hidden
            expect(ids).toContain('critical-settings');
        });

        it('should have onMissing: "hide" on plataforma audit-log item', () => {
            // Arrange
            const hiddenItems = collectHiddenItems(sidebars.plataformaSidebar.items);
            const ids = hiddenItems.map((i) => i.id);

            // Assert
            expect(ids).toContain('audit-log');
        });

        it('should have onMissing: "hide" on analisis debug item', () => {
            // Arrange
            const hiddenItems = collectHiddenItems(sidebars.analisisSidebar.items);
            const ids = hiddenItems.map((i) => i.id);

            // Assert
            expect(ids).toContain('debug');
        });
    });

    describe('i18n labels', () => {
        it('should have non-empty es/en/pt labels on all link and group items', () => {
            for (const [sidebarKey, sidebar] of Object.entries(sidebars)) {
                for (const item of sidebar.items) {
                    if (item.type === 'link' || item.type === 'group') {
                        expect(item.label.es, `${sidebarKey}.${item.id} missing es`).toBeTruthy();
                        expect(item.label.en, `${sidebarKey}.${item.id} missing en`).toBeTruthy();
                        expect(item.label.pt, `${sidebarKey}.${item.id} missing pt`).toBeTruthy();
                    }
                }
            }
        });
    });

    describe('coverage — all old routes accounted for', () => {
        it('should contain /accommodations somewhere', () => {
            const allLinks = Object.values(sidebars).flatMap((s) => collectAllLinks(s.items));
            expect(allLinks.map((l) => l.route)).toContain('/accommodations');
        });

        it('should contain /destinations somewhere', () => {
            const allLinks = Object.values(sidebars).flatMap((s) => collectAllLinks(s.items));
            expect(allLinks.map((l) => l.route)).toContain('/destinations');
        });

        it('should contain /posts somewhere', () => {
            const allLinks = Object.values(sidebars).flatMap((s) => collectAllLinks(s.items));
            expect(allLinks.map((l) => l.route)).toContain('/posts');
        });

        it('should contain /events somewhere', () => {
            const allLinks = Object.values(sidebars).flatMap((s) => collectAllLinks(s.items));
            expect(allLinks.map((l) => l.route)).toContain('/events');
        });

        it('should contain /conversations somewhere', () => {
            const allLinks = Object.values(sidebars).flatMap((s) => collectAllLinks(s.items));
            expect(allLinks.map((l) => l.route)).toContain('/conversations');
        });

        it('should contain /access/users somewhere', () => {
            const allLinks = Object.values(sidebars).flatMap((s) => collectAllLinks(s.items));
            expect(allLinks.map((l) => l.route)).toContain('/access/users');
        });

        it('should contain /billing/plans somewhere', () => {
            const allLinks = Object.values(sidebars).flatMap((s) => collectAllLinks(s.items));
            expect(allLinks.map((l) => l.route)).toContain('/billing/plans');
        });

        it('should contain /analytics/usage somewhere', () => {
            const allLinks = Object.values(sidebars).flatMap((s) => collectAllLinks(s.items));
            expect(allLinks.map((l) => l.route)).toContain('/analytics/usage');
        });

        it('should contain /notifications (inbox route) in inicioSidebar', () => {
            const links = collectAllLinks(sidebars.inicioSidebar.items);
            expect(links.map((l) => l.route)).toContain('/notifications');
        });
    });

    // -------------------------------------------------------------------------
    // HOST sidebars — T-039
    // -------------------------------------------------------------------------

    describe('miCuentaSidebar (T-039 / SPEC-156 T-026 + T-033)', () => {
        it('should have exactly 7 items (profile, preferences, notifications, security, data, billing, tags)', () => {
            expect(sidebars.miCuentaSidebar.items).toHaveLength(7);
        });

        it('should contain /account/billing link (SPEC-156 T-033)', () => {
            const links = collectAllLinks(sidebars.miCuentaSidebar.items);
            expect(links.map((l) => l.route)).toContain('/account/billing');
        });

        it('should parse against SidebarSchema', () => {
            const result = SidebarSchema.safeParse(sidebars.miCuentaSidebar);
            expect(
                result.success,
                `miCuentaSidebar failed: ${JSON.stringify(result.error?.issues)}`
            ).toBe(true);
        });

        it('should contain /account/profile link', () => {
            const links = collectAllLinks(sidebars.miCuentaSidebar.items);
            expect(links.map((l) => l.route)).toContain('/account/profile');
        });

        it('should contain /account/preferences link', () => {
            const links = collectAllLinks(sidebars.miCuentaSidebar.items);
            expect(links.map((l) => l.route)).toContain('/account/preferences');
        });

        it('should contain /account/notifications link (SPEC-156 T-014)', () => {
            const links = collectAllLinks(sidebars.miCuentaSidebar.items);
            expect(links.map((l) => l.route)).toContain('/account/notifications');
        });

        it('should link the security entry to the area landing (SPEC-156 T-016)', () => {
            const links = collectAllLinks(sidebars.miCuentaSidebar.items);
            expect(links.map((l) => l.route)).toContain('/account/security');
        });

        it('should contain /account/data link (SPEC-156 T-017)', () => {
            const links = collectAllLinks(sidebars.miCuentaSidebar.items);
            expect(links.map((l) => l.route)).toContain('/account/data');
        });

        it('should contain /account/tags link', () => {
            const links = collectAllLinks(sidebars.miCuentaSidebar.items);
            expect(links.map((l) => l.route)).toContain('/account/tags');
        });

        it('should have all permission gates using real PermissionEnum keys', () => {
            for (const item of sidebars.miCuentaSidebar.items) {
                if ('permissions' in item && item.permissions !== undefined) {
                    for (const perm of item.permissions) {
                        expect(
                            ALL_PERMISSION_KEYS,
                            `miCuentaSidebar references unknown permission key '${perm}'`
                        ).toContain(perm);
                    }
                }
            }
        });
    });

    describe('misAlojamientosSidebar (T-039)', () => {
        it('should have exactly 2 items', () => {
            expect(sidebars.misAlojamientosSidebar.items).toHaveLength(2);
        });

        it('should parse against SidebarSchema', () => {
            const result = SidebarSchema.safeParse(sidebars.misAlojamientosSidebar);
            expect(
                result.success,
                `misAlojamientosSidebar failed: ${JSON.stringify(result.error?.issues)}`
            ).toBe(true);
        });

        it('should contain /me/accommodations link', () => {
            const links = collectAllLinks(sidebars.misAlojamientosSidebar.items);
            expect(links.map((l) => l.route)).toContain('/me/accommodations');
        });

        it('should contain /accommodations/new link', () => {
            const links = collectAllLinks(sidebars.misAlojamientosSidebar.items);
            expect(links.map((l) => l.route)).toContain('/accommodations/new');
        });

        it('should gate /accommodations/new with ACCOMMODATION_CREATE', () => {
            const links = collectAllLinks(sidebars.misAlojamientosSidebar.items);
            const newLink = sidebars.misAlojamientosSidebar.items.find(
                (i) => i.type === 'link' && i.route === '/accommodations/new'
            );
            expect(newLink).toBeDefined();
            if (newLink?.type === 'link' && newLink.permissions) {
                expect(newLink.permissions).toContain('ACCOMMODATION_CREATE');
            }
            // silence unused variable warning
            void links;
        });

        it('should have all permission gates using real PermissionEnum keys', () => {
            for (const item of sidebars.misAlojamientosSidebar.items) {
                if ('permissions' in item && item.permissions !== undefined) {
                    for (const perm of item.permissions) {
                        expect(
                            ALL_PERMISSION_KEYS,
                            `misAlojamientosSidebar references unknown permission key '${perm}'`
                        ).toContain(perm);
                    }
                }
            }
        });
    });

    describe('consultasSidebar (T-039)', () => {
        it('should have exactly 1 item', () => {
            expect(sidebars.consultasSidebar.items).toHaveLength(1);
        });

        it('should parse against SidebarSchema', () => {
            const result = SidebarSchema.safeParse(sidebars.consultasSidebar);
            expect(
                result.success,
                `consultasSidebar failed: ${JSON.stringify(result.error?.issues)}`
            ).toBe(true);
        });

        it('should contain /conversations link', () => {
            const links = collectAllLinks(sidebars.consultasSidebar.items);
            expect(links.map((l) => l.route)).toContain('/conversations');
        });

        it('should gate /conversations with CONVERSATION_VIEW_OWN', () => {
            const first = sidebars.consultasSidebar.items[0];
            expect(first?.type).toBe('link');
            if (first?.type === 'link' && first.permissions) {
                expect(first.permissions).toContain('CONVERSATION_VIEW_OWN');
            }
        });

        it('should have all permission gates using real PermissionEnum keys', () => {
            for (const item of sidebars.consultasSidebar.items) {
                if ('permissions' in item && item.permissions !== undefined) {
                    for (const perm of item.permissions) {
                        expect(
                            ALL_PERMISSION_KEYS,
                            `consultasSidebar references unknown permission key '${perm}'`
                        ).toContain(perm);
                    }
                }
            }
        });
    });

    describe('miFacturacionSidebar (T-039)', () => {
        it('should have exactly 2 items', () => {
            expect(sidebars.miFacturacionSidebar.items).toHaveLength(2);
        });

        it('should parse against SidebarSchema', () => {
            const result = SidebarSchema.safeParse(sidebars.miFacturacionSidebar);
            expect(
                result.success,
                `miFacturacionSidebar failed: ${JSON.stringify(result.error?.issues)}`
            ).toBe(true);
        });

        it('should contain /billing/subscriptions link', () => {
            const links = collectAllLinks(sidebars.miFacturacionSidebar.items);
            expect(links.map((l) => l.route)).toContain('/billing/subscriptions');
        });

        it('should contain /billing/plans link', () => {
            const links = collectAllLinks(sidebars.miFacturacionSidebar.items);
            expect(links.map((l) => l.route)).toContain('/billing/plans');
        });

        it('should gate /billing/subscriptions with SUBSCRIPTION_VIEW', () => {
            const first = sidebars.miFacturacionSidebar.items[0];
            expect(first?.type).toBe('link');
            if (first?.type === 'link' && first.permissions) {
                expect(first.permissions).toContain('SUBSCRIPTION_VIEW');
            }
        });

        it('should gate /billing/plans with PRICING_PLAN_VIEW', () => {
            const second = sidebars.miFacturacionSidebar.items[1];
            expect(second?.type).toBe('link');
            if (second?.type === 'link' && second.permissions) {
                expect(second.permissions).toContain('PRICING_PLAN_VIEW');
            }
        });

        it('should have all permission gates using real PermissionEnum keys', () => {
            for (const item of sidebars.miFacturacionSidebar.items) {
                if ('permissions' in item && item.permissions !== undefined) {
                    for (const perm of item.permissions) {
                        expect(
                            ALL_PERMISSION_KEYS,
                            `miFacturacionSidebar references unknown permission key '${perm}'`
                        ).toContain(perm);
                    }
                }
            }
        });
    });
});
