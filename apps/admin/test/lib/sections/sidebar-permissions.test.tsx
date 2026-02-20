/**
 * Tests for filterByPermissions integration with PermissionEnum
 *
 * Verifies that the sidebar permission filtering system works correctly
 * when used together with real PermissionEnum values. These tests cover
 * the integration between sidebar config and the permission system
 * introduced in SPEC-015.
 *
 * @module sidebar-permissions.test
 */

import { filterByPermissions, sidebar } from '@/lib/sections/sidebar-helpers';
import type { SidebarItem } from '@/lib/sections/types';
import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

/**
 * Helper that builds a sample sidebar config using PermissionEnum values.
 * Mirrors the shape real section configs would have after SPEC-015.
 */
function buildPermissionedSidebar(): SidebarItem[] {
    return [
        sidebar.link('dashboard', 'Dashboard', '/dashboard'),
        sidebar.link('accommodations', 'Accommodations', '/accommodations', undefined, [
            PermissionEnum.ACCOMMODATION_VIEW_ALL
        ]),
        sidebar.link(
            'accommodations-create',
            'New Accommodation',
            '/accommodations/new',
            undefined,
            [PermissionEnum.ACCOMMODATION_CREATE]
        ),
        sidebar.link('users', 'Users', '/users', undefined, [PermissionEnum.USER_READ_ALL]),
        sidebar.group('content', 'Content', [
            sidebar.link('posts', 'Posts', '/posts', undefined, [PermissionEnum.POST_VIEW_ALL]),
            sidebar.link('events', 'Events', '/events', undefined, [PermissionEnum.EVENT_VIEW_ALL]),
            sidebar.link('public-link', 'Public Info', '/public')
        ]),
        sidebar.group('nested-groups', 'Nested Groups', [
            sidebar.group('inner-group', 'Inner Group', [
                sidebar.link('deep-link', 'Deep Protected', '/deep', undefined, [
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ])
            ])
        ])
    ];
}

describe('filterByPermissions with PermissionEnum values', () => {
    describe('when userPermissions is undefined (development mode)', () => {
        it('returns all items without filtering', () => {
            // Arrange
            const items = buildPermissionedSidebar();

            // Act
            const result = filterByPermissions(items, undefined);

            // Assert
            expect(result).toHaveLength(items.length);
            expect(result.map((i) => i.id)).toEqual(items.map((i) => i.id));
        });
    });

    describe('when user lacks a required permission', () => {
        it('hides a link item when user does not have the required permission', () => {
            // Arrange
            const items = buildPermissionedSidebar();
            const userPermissions: string[] = [PermissionEnum.ACCOMMODATION_VIEW_ALL];

            // Act
            const result = filterByPermissions(items, userPermissions);

            // Assert - users link requires USER_READ_ALL which the user lacks
            expect(result.map((i) => i.id)).not.toContain('users');
        });
    });

    describe('when user has the required permission', () => {
        it('shows a link item when user has its required permission', () => {
            // Arrange
            const items = buildPermissionedSidebar();
            const userPermissions: string[] = [PermissionEnum.ACCOMMODATION_VIEW_ALL];

            // Act
            const result = filterByPermissions(items, userPermissions);

            // Assert
            expect(result.map((i) => i.id)).toContain('accommodations');
        });
    });

    describe('items without a permissions property', () => {
        it('always shows items that have no permissions defined', () => {
            // Arrange
            const items = buildPermissionedSidebar();
            const userPermissions: string[] = [];

            // Act
            const result = filterByPermissions(items, userPermissions);

            // Assert - dashboard has no permissions so it always shows
            expect(result.map((i) => i.id)).toContain('dashboard');
        });
    });

    describe('group filtering', () => {
        it('hides an entire group when all children lack permissions', () => {
            // Arrange - the nested-groups group only contains inner-group which
            // only contains deep-link that requires ACCOMMODATION_UPDATE
            const items = buildPermissionedSidebar();
            const userPermissions: string[] = [PermissionEnum.ACCOMMODATION_VIEW_ALL];

            // Act
            const result = filterByPermissions(items, userPermissions);

            // Assert - nested-groups group should be removed entirely
            expect(result.map((i) => i.id)).not.toContain('nested-groups');
        });

        it('shows a group with only the permitted children', () => {
            // Arrange - content group has posts, events, public-link
            // user only has POST_READ
            const items = buildPermissionedSidebar();
            const userPermissions: string[] = [PermissionEnum.POST_VIEW_ALL];

            // Act
            const result = filterByPermissions(items, userPermissions);

            // Assert - content group still exists
            const contentGroup = result.find((i) => i.id === 'content');
            expect(contentGroup).toBeDefined();

            // Only posts (has POST_READ) and public-link (no perms) should remain
            const childIds = contentGroup?.items?.map((i) => i.id) ?? [];
            expect(childIds).toContain('posts');
            expect(childIds).toContain('public-link');
            expect(childIds).not.toContain('events');
        });

        it('handles nested groups recursively', () => {
            // Arrange - give user ACCOMMODATION_UPDATE so the deep nested link is accessible
            const items = buildPermissionedSidebar();
            const userPermissions: string[] = [PermissionEnum.ACCOMMODATION_UPDATE_ANY];

            // Act
            const result = filterByPermissions(items, userPermissions);

            // Assert - nested-groups > inner-group > deep-link should be reachable
            const nestedGroup = result.find((i) => i.id === 'nested-groups');
            expect(nestedGroup).toBeDefined();

            const innerGroup = nestedGroup?.items?.find((i) => i.id === 'inner-group');
            expect(innerGroup).toBeDefined();

            const deepLink = innerGroup?.items?.find((i) => i.id === 'deep-link');
            expect(deepLink).toBeDefined();
        });
    });

    describe('with an empty permissions array', () => {
        it('shows only items that have no permissions requirement', () => {
            // Arrange
            const items = buildPermissionedSidebar();
            const userPermissions: string[] = [];

            // Act
            const result = filterByPermissions(items, userPermissions);

            // Assert - only dashboard (no perms) should survive at the top level
            // content group survives because public-link has no permissions
            const topLevelIds = result.map((i) => i.id);
            expect(topLevelIds).toContain('dashboard');
            expect(topLevelIds).not.toContain('accommodations');
            expect(topLevelIds).not.toContain('accommodations-create');
            expect(topLevelIds).not.toContain('users');
        });

        it('keeps a group when at least one child has no permissions requirement', () => {
            // Arrange - content group has public-link with no permissions
            const items = buildPermissionedSidebar();
            const userPermissions: string[] = [];

            // Act
            const result = filterByPermissions(items, userPermissions);

            // Assert
            const contentGroup = result.find((i) => i.id === 'content');
            expect(contentGroup).toBeDefined();
            expect(contentGroup?.items?.map((i) => i.id)).toContain('public-link');
        });
    });

    describe('multiple permissions on a single item (OR semantics)', () => {
        it('shows the item when user has any one of the listed permissions', () => {
            // Arrange
            const items: SidebarItem[] = [
                sidebar.link('multi', 'Multi-perm', '/multi', undefined, [
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ])
            ];
            const userPermissions: string[] = [PermissionEnum.ACCOMMODATION_UPDATE_ANY];

            // Act
            const result = filterByPermissions(items, userPermissions);

            // Assert
            expect(result.map((i) => i.id)).toContain('multi');
        });

        it('hides the item when user has none of the listed permissions', () => {
            // Arrange
            const items: SidebarItem[] = [
                sidebar.link('multi', 'Multi-perm', '/multi', undefined, [
                    PermissionEnum.ACCOMMODATION_CREATE,
                    PermissionEnum.ACCOMMODATION_UPDATE_ANY
                ])
            ];
            const userPermissions: string[] = [PermissionEnum.ACCOMMODATION_VIEW_ALL];

            // Act
            const result = filterByPermissions(items, userPermissions);

            // Assert
            expect(result.map((i) => i.id)).not.toContain('multi');
        });
    });
});
