/**
 * Role acceptance tests — HOST (AC-10, T-033)
 *
 * Validates that the HOST role config and its resolved navigation exactly match
 * the locked acceptance criteria from SPEC-154 §AC-10.
 *
 * ROLE_PERMISSIONS source: packages/seed/src/required/rolePermissions.seed.ts
 * (inlined here because @repo/seed is not a dependency of the admin app).
 *
 * Visibility model: a section is VISIBLE when its sidebar has ≥1 accessible
 * item for the user's real permissions via hasSidebarAccessibleItem.
 */

import { validatedConfig } from '@/config/ia/validate';
import { hasSidebarAccessibleItem } from '@/lib/nav/permission-visibility';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// HOST real permission bundle
// (source: packages/seed/src/required/rolePermissions.seed.ts — RoleEnum.HOST)
// ---------------------------------------------------------------------------

const HOST_PERMISSIONS: readonly PermissionEnum[] = [
    // ACCOMMODATION: Own accommodations only
    PermissionEnum.ACCOMMODATION_CREATE,
    PermissionEnum.ACCOMMODATION_UPDATE_OWN,
    PermissionEnum.ACCOMMODATION_DELETE_OWN,
    PermissionEnum.ACCOMMODATION_RESTORE_OWN,
    PermissionEnum.ACCOMMODATION_PUBLISH,
    PermissionEnum.ACCOMMODATION_VIEW_ALL,
    PermissionEnum.ACCOMMODATION_TAGS_MANAGE,
    PermissionEnum.ACCOMMODATION_FEATURES_EDIT,
    PermissionEnum.ACCOMMODATION_AMENITIES_EDIT,
    PermissionEnum.ACCOMMODATION_GALLERY_MANAGE,
    PermissionEnum.ACCOMMODATION_CONTACT_UPDATE,
    PermissionEnum.ACCOMMODATION_SLUG_MANAGE,
    PermissionEnum.ACCOMMODATION_BASIC_INFO_EDIT,
    PermissionEnum.ACCOMMODATION_CONTACT_INFO_EDIT,
    PermissionEnum.ACCOMMODATION_LOCATION_EDIT,
    PermissionEnum.ACCOMMODATION_SERVICES_EDIT,
    PermissionEnum.ACCOMMODATION_PRICE_EDIT,
    PermissionEnum.ACCOMMODATION_SCHEDULE_EDIT,
    PermissionEnum.ACCOMMODATION_MEDIA_EDIT,
    PermissionEnum.ACCOMMODATION_FAQS_EDIT,
    PermissionEnum.ACCOMMODATION_STATES_EDIT,
    PermissionEnum.ACCOMMODATION_SEO_EDIT,
    PermissionEnum.ACCOMMODATION_ADMIN_INFO_EDIT,
    PermissionEnum.ACCOMMODATION_VISIBILITY_CHANGE,
    // USER: Basic profile permissions
    PermissionEnum.USER_VIEW_PROFILE,
    PermissionEnum.USER_UPDATE_PROFILE,
    PermissionEnum.USER_SETTINGS_UPDATE,
    // USER_BOOKMARK: Own bookmarks
    PermissionEnum.USER_BOOKMARK_CREATE,
    PermissionEnum.USER_BOOKMARK_UPDATE,
    PermissionEnum.USER_BOOKMARK_DELETE,
    PermissionEnum.USER_BOOKMARK_VIEW,
    PermissionEnum.USER_BOOKMARK_RESTORE,
    // USER_BOOKMARK_COLLECTION: Own collections
    PermissionEnum.USER_BOOKMARK_COLLECTION_CREATE,
    PermissionEnum.USER_BOOKMARK_COLLECTION_UPDATE,
    PermissionEnum.USER_BOOKMARK_COLLECTION_DELETE,
    PermissionEnum.USER_BOOKMARK_COLLECTION_VIEW,
    // PUBLIC USER ACTIONS
    PermissionEnum.ACCOMMODATION_REVIEW_CREATE,
    PermissionEnum.ACCOMMODATION_REVIEW_UPDATE,
    PermissionEnum.DESTINATION_REVIEW_CREATE,
    PermissionEnum.DESTINATION_REVIEW_UPDATE,
    PermissionEnum.HOST_CONTACT_VIEW,
    PermissionEnum.HOST_MESSAGE_SEND,
    // SPONSORSHIP: Own only
    PermissionEnum.SPONSORSHIP_VIEW_OWN,
    PermissionEnum.SPONSORSHIP_UPDATE_OWN,
    PermissionEnum.SPONSORSHIP_SOFT_DELETE_OWN,
    PermissionEnum.SPONSORSHIP_RESTORE_OWN,
    PermissionEnum.SPONSORSHIP_UPDATE_VISIBILITY_OWN,
    // OWNER_PROMOTION: Own only
    PermissionEnum.OWNER_PROMOTION_VIEW_OWN,
    PermissionEnum.OWNER_PROMOTION_UPDATE_OWN,
    PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_OWN,
    PermissionEnum.OWNER_PROMOTION_RESTORE_OWN,
    PermissionEnum.OWNER_PROMOTION_UPDATE_VISIBILITY_OWN,
    // ACCESS: Basic access
    PermissionEnum.DASHBOARD_BASE_VIEW,
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.ACCESS_API_PUBLIC,
    // MEDIA
    PermissionEnum.MEDIA_UPLOAD,
    PermissionEnum.MEDIA_DELETE,
    // TAG: Host scope
    PermissionEnum.TAG_SYSTEM_VIEW,
    PermissionEnum.TAG_USER_CREATE,
    PermissionEnum.TAG_USER_UPDATE_OWN,
    PermissionEnum.TAG_USER_DELETE_OWN,
    PermissionEnum.TAG_USER_VIEW_OWN,
    PermissionEnum.TAG_ASSIGN_VIEW,
    PermissionEnum.TAG_ASSIGN_ADD,
    PermissionEnum.TAG_ASSIGN_REMOVE,
    // CONVERSATION: Own-scoped
    PermissionEnum.CONVERSATION_VIEW_OWN,
    PermissionEnum.CONVERSATION_REPLY_OWN,
    PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN,
    PermissionEnum.CONVERSATION_BLOCK_OWN
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the section IDs from the HOST role's mainMenu that have ≥1
 * accessible item in their sidebar for HOST's real permissions.
 */
function resolveVisibleSections(): string[] {
    const hostRole = validatedConfig.roles[RoleEnum.HOST];
    if (!hostRole?.enabled || !hostRole.mainMenu) {
        throw new Error('HOST role must be enabled with a mainMenu');
    }

    return hostRole.mainMenu.filter((sectionId) => {
        const section = validatedConfig.sections[sectionId];
        if (!section) return false;
        if (!section.sidebar) return true; // No sidebar means always visible.
        const sidebar = validatedConfig.sidebars[section.sidebar];
        if (!sidebar) return false;
        return hasSidebarAccessibleItem({
            items: sidebar.items,
            userPermissions: HOST_PERMISSIONS
        });
    });
}

// ---------------------------------------------------------------------------
// AC-10 — HOST role acceptance tests
// ---------------------------------------------------------------------------

describe(`AC-10 — ${RoleEnum.HOST} role navigation`, () => {
    // ── mainMenu ────────────────────────────────────────────────────────────

    it('mainMenu is exactly [inicio, misAlojamientos, consultas, miFacturacion, miCuenta]', () => {
        // Arrange
        const hostRole = validatedConfig.roles[RoleEnum.HOST];

        // Act
        const mainMenu = hostRole?.mainMenu;

        // Assert
        expect(hostRole?.enabled).toBe(true);
        expect(mainMenu).toEqual([
            'inicio',
            'misAlojamientos',
            'consultas',
            'miFacturacion',
            'miCuenta'
        ]);
    });

    it('miCuenta is IN the mainMenu (not hidden behind avatar dropdown only)', () => {
        // Arrange
        const hostRole = validatedConfig.roles[RoleEnum.HOST];

        // Act
        const hasMiCuenta = hostRole?.mainMenu?.includes('miCuenta');

        // Assert
        expect(hasMiCuenta).toBe(true);
    });

    // ── topbar ─────────────────────────────────────────────────────────────

    it('topbar.showSearch is false — no Cmd+K for HOST', () => {
        // Arrange
        const hostRole = validatedConfig.roles[RoleEnum.HOST];

        // Act / Assert
        expect(hostRole?.topbar?.showSearch).toBe(false);
    });

    it('topbar.showQuickCreate is exactly ["newAccommodation"]', () => {
        // Arrange
        const hostRole = validatedConfig.roles[RoleEnum.HOST];

        // Act / Assert
        expect(hostRole?.topbar?.showQuickCreate).toEqual(['newAccommodation']);
    });

    it('topbar.accountInMenu is true — Mi cuenta appears in main nav', () => {
        // Arrange
        const hostRole = validatedConfig.roles[RoleEnum.HOST];

        // Act / Assert
        expect(hostRole?.topbar?.accountInMenu).toBe(true);
    });

    // ── mobile ─────────────────────────────────────────────────────────────

    it('mobile.fab is null (create reachable via topbar quick-create)', () => {
        // Arrange
        const hostRole = validatedConfig.roles[RoleEnum.HOST];

        // Act / Assert
        expect(hostRole?.mobile?.fab).toBeNull();
    });

    it('mobile.bottomNav is exactly [inicio, misAlojamientos, consultas, miCuenta] — 4 items', () => {
        // Arrange
        const hostRole = validatedConfig.roles[RoleEnum.HOST];

        // Act / Assert
        expect(hostRole?.mobile?.bottomNav).toEqual([
            'inicio',
            'misAlojamientos',
            'consultas',
            'miCuenta'
        ]);
    });

    // ── Visible sections for HOST's real permissions ─────────────────────────

    it('inicio sidebar is accessible for HOST (has ACCESS_PANEL_ADMIN)', () => {
        // Arrange
        const sidebar = validatedConfig.sidebars.inicioSidebar;

        // Act
        const accessible = hasSidebarAccessibleItem({
            items: sidebar.items,
            userPermissions: HOST_PERMISSIONS
        });

        // Assert — HOST has ACCESS_PANEL_ADMIN, which gates both inicio items
        expect(accessible).toBe(true);
    });

    it('misAlojamientos sidebar is accessible for HOST (has ACCOMMODATION_UPDATE_OWN)', () => {
        // Arrange
        const sidebar = validatedConfig.sidebars.misAlojamientosSidebar;

        // Act
        const accessible = hasSidebarAccessibleItem({
            items: sidebar.items,
            userPermissions: HOST_PERMISSIONS
        });

        // Assert — HOST has ACCOMMODATION_UPDATE_OWN and ACCOMMODATION_CREATE
        expect(accessible).toBe(true);
    });

    it('consultas sidebar is accessible for HOST (has CONVERSATION_VIEW_OWN)', () => {
        // Arrange
        const sidebar = validatedConfig.sidebars.consultasSidebar;

        // Act
        const accessible = hasSidebarAccessibleItem({
            items: sidebar.items,
            userPermissions: HOST_PERMISSIONS
        });

        // Assert
        expect(accessible).toBe(true);
    });

    it('miCuenta sidebar is accessible for HOST (has USER_VIEW_PROFILE, USER_SETTINGS_UPDATE)', () => {
        // Arrange
        const sidebar = validatedConfig.sidebars.miCuentaSidebar;

        // Act
        const accessible = hasSidebarAccessibleItem({
            items: sidebar.items,
            userPermissions: HOST_PERMISSIONS
        });

        // Assert
        expect(accessible).toBe(true);
    });

    it('all 5 mainMenu sections resolve to at least one accessible sidebar item for HOST', () => {
        // Arrange + Act
        const visible = resolveVisibleSections();

        // Assert — all 5 sections have accessible items for HOST
        expect(visible).toHaveLength(5);
        expect(visible).toContain('inicio');
        expect(visible).toContain('misAlojamientos');
        expect(visible).toContain('consultas');
        expect(visible).toContain('miCuenta');
        // miFacturacion included too (SUBSCRIPTION_VIEW / PRICING_PLAN_VIEW are gated
        // but onMissing defaults to 'disable', so the items still occupy the sidebar)
        expect(visible).toContain('miFacturacion');
    });

    it('HOST does NOT have catalogo in mainMenu (data != nav principle)', () => {
        // Arrange
        const hostRole = validatedConfig.roles[RoleEnum.HOST];

        // Act
        const hasCatalogo = hostRole?.mainMenu?.includes('catalogo');

        // Assert — even though HOST has ACCOMMODATION_VIEW_ALL, catalogo is not in mainMenu
        expect(hasCatalogo).toBe(false);
    });
});
