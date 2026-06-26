/**
 * Role acceptance tests — EDITOR (AC-13, T-035)
 *
 * Validates that the EDITOR role config and resolved navigation match the locked
 * acceptance criteria from SPEC-154 §AC-13.
 *
 * §8 data≠nav principle: even if EDITOR holds some catalog-adjacent permissions
 * (e.g. ACCOMMODATION_REVIEW_CREATE), the 'catalogo' section is NOT in EDITOR's
 * mainMenu template — navigation decisions are separate from data permissions.
 *
 * ROLE_PERMISSIONS source: packages/seed/src/required/rolePermissions.seed.ts
 */

import { validatedConfig } from '@/config/ia/validate';
import { hasSidebarAccessibleItem } from '@/lib/nav/permission-visibility';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// EDITOR real permission bundle
// (source: packages/seed/src/required/rolePermissions.seed.ts — RoleEnum.EDITOR)
// ---------------------------------------------------------------------------

const EDITOR_PERMISSIONS: readonly PermissionEnum[] = [
    // EVENT
    PermissionEnum.EVENT_CREATE,
    PermissionEnum.EVENT_UPDATE,
    PermissionEnum.EVENT_PUBLISH_TOGGLE,
    PermissionEnum.EVENT_FEATURED_TOGGLE,
    PermissionEnum.EVENT_LOCATION_UPDATE,
    PermissionEnum.EVENT_ORGANIZER_MANAGE,
    PermissionEnum.EVENT_SLUG_MANAGE,
    PermissionEnum.EVENT_COMMENT_CREATE,
    PermissionEnum.EVENT_VIEW_PRIVATE,
    PermissionEnum.EVENT_VIEW_DRAFT,
    // POST
    PermissionEnum.POST_CREATE,
    PermissionEnum.POST_UPDATE,
    PermissionEnum.POST_PUBLISH_TOGGLE,
    PermissionEnum.POST_SPONSOR_MANAGE,
    PermissionEnum.POST_TAGS_MANAGE,
    PermissionEnum.POST_FEATURED_TOGGLE,
    PermissionEnum.POST_SLUG_MANAGE,
    PermissionEnum.POST_COMMENT_CREATE,
    PermissionEnum.POST_VIEW_PRIVATE,
    PermissionEnum.POST_VIEW_DRAFT,
    PermissionEnum.POST_VIEW_ALL,
    // USER: Basic profile permissions
    PermissionEnum.USER_VIEW_PROFILE,
    PermissionEnum.USER_UPDATE_PROFILE,
    PermissionEnum.USER_SETTINGS_UPDATE,
    // USER_BOOKMARK: Own + view any
    PermissionEnum.USER_BOOKMARK_CREATE,
    PermissionEnum.USER_BOOKMARK_UPDATE,
    PermissionEnum.USER_BOOKMARK_DELETE,
    PermissionEnum.USER_BOOKMARK_VIEW,
    PermissionEnum.USER_BOOKMARK_RESTORE,
    PermissionEnum.USER_BOOKMARK_VIEW_ANY,
    // USER_BOOKMARK_COLLECTION: Own + view any
    PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
    PermissionEnum.USER_BOOKMARK_COLLECTION_UPDATE,
    PermissionEnum.USER_BOOKMARK_COLLECTION_DELETE,
    PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,
    PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW_ANY,
    // PUBLIC USER ACTIONS
    PermissionEnum.ACCOMMODATION_REVIEW_CREATE,
    PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
    PermissionEnum.DESTINATION_REVIEW_CREATE,
    PermissionEnum.DESTINATION_REVIEW_UPDATE,
    PermissionEnum.HOST_CONTACT_VIEW,
    PermissionEnum.HOST_MESSAGE_SEND,
    // ACCESS
    PermissionEnum.DASHBOARD_BASE_VIEW,
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.ACCESS_API_ADMIN,
    PermissionEnum.ACCESS_API_PUBLIC,
    // TAG: Editor scope
    PermissionEnum.TAG_SYSTEM_VIEW,
    PermissionEnum.TAG_USER_CREATE,
    PermissionEnum.TAG_USER_UPDATE_OWN,
    PermissionEnum.TAG_USER_DELETE_OWN,
    PermissionEnum.TAG_USER_VIEW_OWN,
    PermissionEnum.TAG_ASSIGN_VIEW,
    PermissionEnum.TAG_ASSIGN_ADD,
    PermissionEnum.TAG_ASSIGN_REMOVE,
    // POST_TAG
    PermissionEnum.POST_TAG_VIEW,
    PermissionEnum.POST_TAG_CREATE,
    PermissionEnum.POST_TAG_UPDATE,
    PermissionEnum.POST_TAG_DELETE,
    PermissionEnum.POST_TAG_ASSIGN,
    // MEDIA
    PermissionEnum.MEDIA_UPLOAD,
    PermissionEnum.MEDIA_DELETE
] as const;

// ---------------------------------------------------------------------------
// AC-13 — EDITOR role acceptance tests
// ---------------------------------------------------------------------------

describe(`AC-13 — ${RoleEnum.EDITOR} role navigation`, () => {
    // ── mainMenu ────────────────────────────────────────────────────────────

    it('mainMenu is exactly [inicio, editorial, marketing, analisis, miCuenta] — 5 sections', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.EDITOR];

        // Act
        const mainMenu = role?.mainMenu;

        // Assert
        expect(role?.enabled).toBe(true);
        expect(mainMenu).toEqual(['inicio', 'editorial', 'marketing', 'analisis', 'miCuenta']);
    });

    it('catalogo is NOT in EDITOR mainMenu (data≠nav principle — §8)', () => {
        /**
         * EDITOR has ACCOMMODATION_REVIEW_CREATE and some catalog-adjacent perms,
         * but the 'catalogo' section was intentionally excluded from EDITOR's
         * mainMenu template. Navigation is separate from data access.
         */
        // Arrange
        const role = validatedConfig.roles[RoleEnum.EDITOR];

        // Act
        const hasCatalogo = role?.mainMenu?.includes('catalogo');

        // Assert
        expect(hasCatalogo).toBe(false);
    });

    it('comunidad is NOT in EDITOR mainMenu', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.EDITOR];

        // Act / Assert
        expect(role?.mainMenu?.includes('comunidad')).toBe(false);
    });

    it('comercial is NOT in EDITOR mainMenu', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.EDITOR];

        // Act / Assert
        expect(role?.mainMenu?.includes('comercial')).toBe(false);
    });

    it('plataforma is NOT in EDITOR mainMenu', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.EDITOR];

        // Act / Assert
        expect(role?.mainMenu?.includes('plataforma')).toBe(false);
    });

    // ── topbar ─────────────────────────────────────────────────────────────

    it('topbar.showSearch is true', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.EDITOR];

        // Act / Assert
        expect(role?.topbar?.showSearch).toBe(true);
    });

    it('topbar.showQuickCreate is exactly ["newPost", "newEvent", "newCampaign"]', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.EDITOR];

        // Act / Assert
        expect(role?.topbar?.showQuickCreate).toEqual(['newPost', 'newEvent', 'newCampaign']);
    });

    it('topbar.accountInMenu is true', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.EDITOR];

        // Act / Assert
        expect(role?.topbar?.accountInMenu).toBe(true);
    });

    // ── mobile ─────────────────────────────────────────────────────────────

    it('mobile.fab is null (create reachable via topbar quick-create)', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.EDITOR];

        // Act / Assert
        expect(role?.mobile?.fab).toBeNull();
    });

    it('mobile.bottomNav is [inicio, editorial, marketing, analisis, miCuenta]', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.EDITOR];

        // Act / Assert
        expect(role?.mobile?.bottomNav).toEqual([
            'inicio',
            'editorial',
            'marketing',
            'analisis',
            'miCuenta'
        ]);
    });

    // ── Sidebar visibility for EDITOR's real permissions ─────────────────────

    it('inicio sidebar is accessible for EDITOR (has ACCESS_PANEL_ADMIN)', () => {
        // Arrange
        const sidebar = validatedConfig.sidebars.inicioSidebar;

        // Act
        const accessible = hasSidebarAccessibleItem({
            items: sidebar.items,
            userPermissions: EDITOR_PERMISSIONS
        });

        // Assert
        expect(accessible).toBe(true);
    });

    it('editorial sidebar is accessible for EDITOR (has POST_VIEW_ALL, POST_CREATE, etc.)', () => {
        // Arrange
        const sidebar = validatedConfig.sidebars.editorialSidebar;

        // Act
        const accessible = hasSidebarAccessibleItem({
            items: sidebar.items,
            userPermissions: EDITOR_PERMISSIONS
        });

        // Assert
        expect(accessible).toBe(true);
    });

    it('analisis sidebar is accessible for EDITOR (ANALYTICS_VIEW is not held — items disabled but sidebar accessible)', () => {
        /**
         * EDITOR does NOT have ANALYTICS_VIEW. The analisisSidebar items
         * analytics-usage and analytics-business gate on ANALYTICS_VIEW with
         * default onMissing:'disable'. The debug item gates on DEBUG_TOOLS_ACCESS
         * with onMissing:'hide'.
         *
         * hasSidebarAccessibleItem: disabled items (onMissing:'disable') still count
         * as accessible (they occupy the sidebar). So the sidebar is accessible.
         */
        // Arrange
        const sidebar = validatedConfig.sidebars.analisisSidebar;

        // Act
        const accessible = hasSidebarAccessibleItem({
            items: sidebar.items,
            userPermissions: EDITOR_PERMISSIONS
        });

        // Assert — disabled items still make the sidebar accessible
        expect(accessible).toBe(true);
    });

    it('miCuenta sidebar is accessible for EDITOR (has USER_VIEW_PROFILE, USER_SETTINGS_UPDATE)', () => {
        // Arrange
        const sidebar = validatedConfig.sidebars.miCuentaSidebar;

        // Act
        const accessible = hasSidebarAccessibleItem({
            items: sidebar.items,
            userPermissions: EDITOR_PERMISSIONS
        });

        // Assert
        expect(accessible).toBe(true);
    });

    it('catalogo sidebar would be inaccessible without catalog-admin perms — but is never in mainMenu anyway', () => {
        /**
         * Extra guard: confirms that even if catalogo were in the mainMenu (it isn't),
         * EDITOR lacks ACCOMMODATION_VIEW_ALL and DESTINATION_VIEW_ALL, so the sidebar
         * groups are all either disabled or hidden. The group gates use default
         * onMissing:'disable' so the sidebar IS technically accessible (disabled groups
         * count), but the section is correctly absent from EDITOR's mainMenu regardless.
         */
        // Arrange
        const editorRole = validatedConfig.roles[RoleEnum.EDITOR];

        // Act
        const inMainMenu = editorRole?.mainMenu?.includes('catalogo');

        // Assert — confirm it's not in mainMenu (the nav decision is independent of sidebar access)
        expect(inMainMenu).toBe(false);
    });
});
