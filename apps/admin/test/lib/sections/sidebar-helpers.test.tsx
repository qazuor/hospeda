/**
 * Tests for sidebar-helpers.ts
 *
 * Tests the sidebar helper functions:
 * 1. sidebar.link() - creates link items
 * 2. sidebar.separator() - creates separator items
 * 3. sidebar.group() - creates group items
 * 4. sidebar.action() - creates action items
 * 5. sidebar.config() - creates sidebar config
 * 6. filterByPermissions() - filters items by permissions
 * 7. isGroupActive() - checks if group contains active item
 */

import {
    filterByPermissions,
    filterSectionsByPermissions,
    findActiveItem,
    getAllHrefs,
    isGroupActive,
    sidebar
} from '@/lib/sections/sidebar-helpers';
import type { SectionConfig, SidebarItem } from '@/lib/sections/types';
import { describe, expect, it } from 'vitest';

describe('sidebar-helpers', () => {
    describe('sidebar.link', () => {
        it('should create a link item with required properties', () => {
            const item = sidebar.link('home', 'Home', '/dashboard');

            expect(item.type).toBe('link');
            expect(item.id).toBe('home');
            expect(item.label).toBe('Home');
            expect(item.href).toBe('/dashboard');
        });

        it('should create a link item with optional icon', () => {
            const icon = <span>Icon</span>;
            const item = sidebar.link('home', 'Home', '/dashboard', icon);

            expect(item.icon).toBe(icon);
        });

        it('should create a link item with permissions', () => {
            const item = sidebar.link('admin', 'Admin', '/admin', undefined, ['admin:read']);

            expect(item.permissions).toEqual(['admin:read']);
        });
    });

    describe('sidebar.separator', () => {
        it('should create a separator item', () => {
            const item = sidebar.separator();

            expect(item.type).toBe('separator');
            expect(item.id).toMatch(/^sep-/);
        });

        it('should create unique ids for multiple separators', () => {
            const item1 = sidebar.separator();
            const item2 = sidebar.separator();

            expect(item1.id).not.toBe(item2.id);
        });
    });

    describe('sidebar.group', () => {
        it('should create a group item with children', () => {
            const children = [
                sidebar.link('child1', 'Child 1', '/child1'),
                sidebar.link('child2', 'Child 2', '/child2')
            ];

            const item = sidebar.group('parent', 'Parent', children);

            expect(item.type).toBe('group');
            expect(item.id).toBe('parent');
            expect(item.label).toBe('Parent');
            expect(item.items).toHaveLength(2);
        });

        it('should create a group with icon and defaultExpanded', () => {
            const icon = <span>Icon</span>;
            const item = sidebar.group('parent', 'Parent', [], icon, true);

            expect(item.icon).toBe(icon);
            expect(item.defaultExpanded).toBe(true);
        });

        it('should default defaultExpanded to false', () => {
            const item = sidebar.group('parent', 'Parent', []);

            expect(item.defaultExpanded).toBe(false);
        });
    });

    describe('sidebar.action', () => {
        it('should create an action item', () => {
            const onClick = () => {};
            const item = sidebar.action('logout', 'Logout', onClick);

            expect(item.type).toBe('action');
            expect(item.id).toBe('logout');
            expect(item.label).toBe('Logout');
            expect(item.onClick).toBe(onClick);
        });

        it('should create an action with icon and permissions', () => {
            const icon = <span>Icon</span>;
            const item = sidebar.action('admin', 'Admin Action', () => {}, icon, ['admin:write']);

            expect(item.icon).toBe(icon);
            expect(item.permissions).toEqual(['admin:write']);
        });
    });

    describe('sidebar.config', () => {
        it('should create a sidebar config', () => {
            const items = [sidebar.link('home', 'Home', '/home')];
            const config = sidebar.config('Menu', items);

            expect(config.title).toBe('Menu');
            expect(config.items).toBe(items);
        });

        it('should create a config with titleKey', () => {
            const config = sidebar.config('Menu', [], 'nav.menu');

            expect(config.titleKey).toBe('nav.menu');
        });
    });

    describe('filterSectionsByPermissions', () => {
        const sectionConfigs: SectionConfig[] = [
            {
                id: 'dashboard',
                label: 'Dashboard',
                routes: ['/dashboard'],
                defaultRoute: '/dashboard',
                sidebar: { title: 'Dashboard', items: [] },
                permissions: []
            },
            {
                id: 'content',
                label: 'Content',
                routes: ['/content'],
                defaultRoute: '/content',
                sidebar: { title: 'Content', items: [] },
                permissions: ['content:view', 'post:view']
            },
            {
                id: 'admin',
                label: 'Admin',
                routes: ['/admin'],
                defaultRoute: '/admin',
                sidebar: { title: 'Admin', items: [] },
                permissions: ['admin:manage']
            },
            {
                id: 'no-perms',
                label: 'No Perms',
                routes: ['/no-perms'],
                defaultRoute: '/no-perms',
                sidebar: { title: 'No Perms', items: [] }
            }
        ];

        it('should return all sections if userPermissions is undefined', () => {
            const result = filterSectionsByPermissions({
                sectionConfigs,
                userPermissions: undefined
            });
            expect(result).toHaveLength(4);
        });

        it('should show sections with empty permissions to all users', () => {
            const result = filterSectionsByPermissions({
                sectionConfigs,
                userPermissions: []
            });
            const ids = result.map((s) => s.id);
            expect(ids).toContain('dashboard');
            expect(ids).toContain('no-perms');
        });

        it('should show a section when user has any of its permissions (OR logic)', () => {
            const result = filterSectionsByPermissions({
                sectionConfigs,
                userPermissions: ['post:view']
            });
            expect(result.map((s) => s.id)).toContain('content');
        });

        it('should hide a section when user has none of its permissions', () => {
            const result = filterSectionsByPermissions({
                sectionConfigs,
                userPermissions: ['content:view']
            });
            expect(result.map((s) => s.id)).not.toContain('admin');
        });

        it('should handle sections without permissions property', () => {
            const result = filterSectionsByPermissions({
                sectionConfigs,
                userPermissions: []
            });
            expect(result.map((s) => s.id)).toContain('no-perms');
        });
    });

    describe('filterByPermissions', () => {
        const items: SidebarItem[] = [
            { type: 'link', id: 'public', label: 'Public', href: '/public' },
            {
                type: 'link',
                id: 'admin',
                label: 'Admin',
                href: '/admin',
                permissions: ['admin:read']
            },
            {
                type: 'link',
                id: 'super',
                label: 'Super',
                href: '/super',
                permissions: ['super:admin']
            },
            {
                type: 'group',
                id: 'group',
                label: 'Group',
                items: [
                    { type: 'link', id: 'nested-public', label: 'Nested Public', href: '/nested' },
                    {
                        type: 'link',
                        id: 'nested-admin',
                        label: 'Nested Admin',
                        href: '/nested-admin',
                        permissions: ['admin:read']
                    }
                ]
            }
        ];

        it('should return all items if userPermissions is undefined', () => {
            const filtered = filterByPermissions(items, undefined);
            expect(filtered).toHaveLength(4);
        });

        it('should filter items without matching permissions', () => {
            const filtered = filterByPermissions(items, ['admin:read']);

            // Should include: public (no perms), admin (has admin:read), group
            // Should exclude: super (needs super:admin)
            expect(filtered.map((i) => i.id)).toContain('public');
            expect(filtered.map((i) => i.id)).toContain('admin');
            expect(filtered.map((i) => i.id)).not.toContain('super');
        });

        it('should filter nested items in groups', () => {
            const filtered = filterByPermissions(items, []);

            const group = filtered.find((i) => i.id === 'group');
            expect(group?.items?.map((i) => i.id)).toContain('nested-public');
            expect(group?.items?.map((i) => i.id)).not.toContain('nested-admin');
        });

        it('should include items with empty permissions array', () => {
            const itemsWithEmpty: SidebarItem[] = [
                { type: 'link', id: 'empty', label: 'Empty Perms', href: '/empty', permissions: [] }
            ];

            const filtered = filterByPermissions(itemsWithEmpty, []);
            expect(filtered).toHaveLength(1);
        });
    });

    describe('isGroupActive', () => {
        const group: SidebarItem = {
            type: 'group',
            id: 'parent',
            label: 'Parent',
            items: [
                { type: 'link', id: 'child1', label: 'Child 1', href: '/parent/child1' },
                { type: 'link', id: 'child2', label: 'Child 2', href: '/parent/child2' },
                {
                    type: 'group',
                    id: 'nested',
                    label: 'Nested',
                    items: [
                        { type: 'link', id: 'deep', label: 'Deep', href: '/parent/nested/deep' }
                    ]
                }
            ]
        };

        it('should return true if current path matches a child href', () => {
            expect(isGroupActive(group, '/parent/child1')).toBe(true);
        });

        it('should return false if current path does not match any child', () => {
            expect(isGroupActive(group, '/other')).toBe(false);
        });

        it('should check nested groups recursively', () => {
            expect(isGroupActive(group, '/parent/nested/deep')).toBe(true);
        });

        it('should return false for non-group items', () => {
            const linkItem: SidebarItem = {
                type: 'link',
                id: 'link',
                label: 'Link',
                href: '/link'
            };
            expect(isGroupActive(linkItem, '/link')).toBe(false);
        });
    });

    describe('findActiveItem', () => {
        const items: SidebarItem[] = [
            { type: 'link', id: 'home', label: 'Home', href: '/home' },
            { type: 'link', id: 'about', label: 'About', href: '/about' },
            {
                type: 'group',
                id: 'group',
                label: 'Group',
                items: [{ type: 'link', id: 'nested', label: 'Nested', href: '/group/nested' }]
            }
        ];

        it('should find active item by exact path match', () => {
            const active = findActiveItem(items, '/home');
            expect(active?.id).toBe('home');
        });

        it('should find active item in nested groups', () => {
            const active = findActiveItem(items, '/group/nested');
            expect(active?.id).toBe('nested');
        });

        it('should return null if no match', () => {
            const active = findActiveItem(items, '/unknown');
            expect(active).toBeNull();
        });
    });

    describe('getAllHrefs', () => {
        const items: SidebarItem[] = [
            { type: 'link', id: 'home', label: 'Home', href: '/home' },
            { type: 'separator', id: 'sep-1' },
            { type: 'action', id: 'action', label: 'Action', onClick: () => {} },
            {
                type: 'group',
                id: 'group',
                label: 'Group',
                items: [
                    { type: 'link', id: 'nested1', label: 'Nested 1', href: '/group/nested1' },
                    { type: 'link', id: 'nested2', label: 'Nested 2', href: '/group/nested2' }
                ]
            }
        ];

        it('should collect all hrefs from items', () => {
            const hrefs = getAllHrefs(items);

            expect(hrefs).toContain('/home');
            expect(hrefs).toContain('/group/nested1');
            expect(hrefs).toContain('/group/nested2');
        });

        it('should not include separators or actions', () => {
            const hrefs = getAllHrefs(items);

            expect(hrefs).toHaveLength(3);
        });

        it('should return empty array for empty items', () => {
            const hrefs = getAllHrefs([]);
            expect(hrefs).toEqual([]);
        });
    });
});
