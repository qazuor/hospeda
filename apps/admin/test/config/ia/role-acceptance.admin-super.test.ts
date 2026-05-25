/**
 * Role acceptance tests — SUPER_ADMIN (AC-11) and ADMIN (AC-12), T-034
 *
 * Validates that both SUPER_ADMIN and ADMIN role configs match the locked
 * acceptance criteria from SPEC-154, with real permission bundles from the seed.
 *
 * AC-12 resolution (SPEC-154 §11, decision 2026-05-25):
 *
 *   - critical-settings: re-gated on SYSTEM_MAINTENANCE_MODE (SUPER_ADMIN-only in
 *     ROLE_PERMISSIONS). ADMIN lacks it → onMissing:'hide' → item HIDDEN for ADMIN.
 *     Satisfies AC-12 (Configuración crítica is SUPER_ADMIN-only).
 *   - audit-log: gated on AUDIT_LOG_VIEW, which ADMIN genuinely HOLDS in the real
 *     seed. Per the project principle "navigation access follows the user's REAL
 *     permissions, not role aspiration", ADMIN legitimately sees the audit log.
 *     doc 01 §16's "hide audit from ADMIN" is aspirational and superseded by the
 *     real ROLE_PERMISSIONS bundle.
 *   - debug (analisisSidebar, gate DEBUG_TOOLS_ACCESS): SUPER-only. ADMIN lacks it
 *     → hidden. Correct.
 *
 * Tests assert what the config computes against the REAL per-role permissions.
 * ROLE_PERMISSIONS source: packages/seed/src/required/rolePermissions.seed.ts
 * (inlined below — the const is not exported nor importable from the admin app;
 *  follow-up: export it from @repo/schemas to remove this duplication).
 */

import { validatedConfig } from '@/config/ia/validate';
import { hasSidebarAccessibleItem, isPermissionGateGranted } from '@/lib/nav/permission-visibility';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// SUPER_ADMIN permission bundle
// (source: packages/seed/src/required/rolePermissions.seed.ts — RoleEnum.SUPER_ADMIN)
// SUPER_ADMIN holds all permissions; we represent this with the full enum.
// ---------------------------------------------------------------------------

const SUPER_ADMIN_PERMISSIONS: readonly PermissionEnum[] = Object.values(PermissionEnum);

// ---------------------------------------------------------------------------
// ADMIN permission bundle
// (source: packages/seed/src/required/rolePermissions.seed.ts — RoleEnum.ADMIN)
// ---------------------------------------------------------------------------

const ADMIN_PERMISSIONS: readonly PermissionEnum[] = [
    // ACCOMMODATION: Most permissions (no hard delete)
    PermissionEnum.ACCOMMODATION_CREATE,
    PermissionEnum.ACCOMMODATION_UPDATE_ANY,
    PermissionEnum.ACCOMMODATION_DELETE_ANY,
    PermissionEnum.ACCOMMODATION_RESTORE_ANY,
    PermissionEnum.ACCOMMODATION_SOFT_DELETE_VIEW,
    PermissionEnum.ACCOMMODATION_PUBLISH,
    PermissionEnum.ACCOMMODATION_REVIEW_MODERATE,
    PermissionEnum.ACCOMMODATION_VIEW_ALL,
    PermissionEnum.ACCOMMODATION_VIEW_PRIVATE,
    PermissionEnum.ACCOMMODATION_VIEW_DRAFT,
    PermissionEnum.ACCOMMODATION_LOCATION_EXACT_VIEW,
    PermissionEnum.ACCOMMODATION_TAGS_MANAGE,
    PermissionEnum.ACCOMMODATION_FEATURES_EDIT,
    PermissionEnum.ACCOMMODATION_AMENITIES_EDIT,
    PermissionEnum.ACCOMMODATION_GALLERY_MANAGE,
    PermissionEnum.ACCOMMODATION_CONTACT_UPDATE,
    PermissionEnum.ACCOMMODATION_IA_SUGGESTIONS_VIEW,
    PermissionEnum.ACCOMMODATION_IA_CONTENT_APPROVE,
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
    PermissionEnum.ACCOMMODATION_OWNER_CHANGE,
    PermissionEnum.ACCOMMODATION_FEATURED_TOGGLE,
    PermissionEnum.ACCOMMODATION_VISIBILITY_CHANGE,
    PermissionEnum.ACCOMMODATION_LIFECYCLE_CHANGE,
    PermissionEnum.ACCOMMODATION_MODERATION_CHANGE,
    PermissionEnum.AMENITY_CREATE,
    PermissionEnum.AMENITY_UPDATE,
    PermissionEnum.AMENITY_DELETE,
    PermissionEnum.FEATURE_CREATE,
    PermissionEnum.FEATURE_UPDATE,
    PermissionEnum.FEATURE_DELETE,
    // DESTINATION: Most permissions (no hard delete)
    PermissionEnum.DESTINATION_CREATE,
    PermissionEnum.DESTINATION_UPDATE,
    PermissionEnum.DESTINATION_DELETE,
    PermissionEnum.DESTINATION_RESTORE,
    PermissionEnum.DESTINATION_SOFT_DELETE_VIEW,
    PermissionEnum.DESTINATION_FEATURED_TOGGLE,
    PermissionEnum.DESTINATION_VISIBILITY_TOGGLE,
    PermissionEnum.DESTINATION_REVIEW_MODERATE,
    PermissionEnum.DESTINATION_TAGS_MANAGE,
    PermissionEnum.DESTINATION_GALLERY_MANAGE,
    PermissionEnum.DESTINATION_IA_SUGGESTIONS_VIEW,
    PermissionEnum.DESTINATION_IA_CONTENT_APPROVE,
    PermissionEnum.DESTINATION_SLUG_MANAGE,
    PermissionEnum.DESTINATION_VIEW_PRIVATE,
    PermissionEnum.DESTINATION_VIEW_DRAFT,
    PermissionEnum.DESTINATION_VIEW_ALL,
    PermissionEnum.DESTINATION_ATTRACTION_MANAGE,
    // EVENT: Most permissions (no hard delete)
    PermissionEnum.EVENT_CREATE,
    PermissionEnum.EVENT_UPDATE,
    PermissionEnum.EVENT_DELETE,
    PermissionEnum.EVENT_RESTORE,
    PermissionEnum.EVENT_SOFT_DELETE_VIEW,
    PermissionEnum.EVENT_PUBLISH_TOGGLE,
    PermissionEnum.EVENT_FEATURED_TOGGLE,
    PermissionEnum.EVENT_LOCATION_UPDATE,
    PermissionEnum.EVENT_ORGANIZER_MANAGE,
    PermissionEnum.EVENT_SLUG_MANAGE,
    PermissionEnum.EVENT_COMMENT_CREATE,
    PermissionEnum.EVENT_VIEW_PRIVATE,
    PermissionEnum.EVENT_VIEW_DRAFT,
    PermissionEnum.EVENT_VIEW_ALL,
    PermissionEnum.EVENT_LOCATION_MANAGE,
    // POST: Most permissions (no hard delete)
    PermissionEnum.POST_CREATE,
    PermissionEnum.POST_UPDATE,
    PermissionEnum.POST_DELETE,
    PermissionEnum.POST_RESTORE,
    PermissionEnum.POST_SOFT_DELETE_VIEW,
    PermissionEnum.POST_PUBLISH_TOGGLE,
    PermissionEnum.POST_SPONSOR_MANAGE,
    PermissionEnum.POST_TAGS_MANAGE,
    PermissionEnum.POST_FEATURED_TOGGLE,
    PermissionEnum.POST_SLUG_MANAGE,
    PermissionEnum.POST_COMMENT_CREATE,
    PermissionEnum.POST_VIEW_PRIVATE,
    PermissionEnum.POST_VIEW_DRAFT,
    PermissionEnum.POST_VIEW_ALL,
    // USER: Most permissions (no impersonate, no hard delete)
    PermissionEnum.USER_READ_ALL,
    PermissionEnum.USER_CREATE,
    PermissionEnum.USER_UPDATE_ROLES,
    PermissionEnum.USER_DELETE,
    PermissionEnum.USER_BOOKMARK_MANAGE,
    PermissionEnum.USER_VIEW_PROFILE,
    PermissionEnum.USER_BLOCK,
    PermissionEnum.USER_RESTORE,
    PermissionEnum.USER_SOFT_DELETE_VIEW,
    PermissionEnum.USER_ACTIVITY_LOG_VIEW,
    PermissionEnum.USER_PASSWORD_RESET,
    PermissionEnum.USER_UPDATE_PROFILE,
    PermissionEnum.USER_SETTINGS_UPDATE,
    PermissionEnum.USER_BOOKMARK_VIEW_ANY,
    PermissionEnum.USER_BOOKMARK_CREATE,
    PermissionEnum.USER_BOOKMARK_UPDATE,
    PermissionEnum.USER_BOOKMARK_DELETE,
    PermissionEnum.USER_BOOKMARK_VIEW,
    PermissionEnum.USER_BOOKMARK_RESTORE,
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
    // SYSTEM: Most permissions (no maintenance mode)
    PermissionEnum.AUDIT_LOG_VIEW,
    PermissionEnum.TRANSLATIONS_MANAGE,
    PermissionEnum.MULTILANGUAGE_CONTENT_EDIT,
    PermissionEnum.DASHBOARD_BASE_VIEW,
    PermissionEnum.DASHBOARD_FULL_VIEW,
    PermissionEnum.SETTINGS_MANAGE,
    PermissionEnum.STATS_VIEW,
    PermissionEnum.NOTIFICATION_SEND,
    PermissionEnum.NOTIFICATION_CONFIGURE,
    // NEWSLETTER
    PermissionEnum.NEWSLETTER_CAMPAIGN_VIEW,
    PermissionEnum.NEWSLETTER_CAMPAIGN_WRITE,
    PermissionEnum.NEWSLETTER_CAMPAIGN_SEND,
    PermissionEnum.NEWSLETTER_SUBSCRIBER_VIEW,
    PermissionEnum.SEO_MANAGE,
    // ACCESS
    PermissionEnum.ACCESS_PANEL_ADMIN,
    PermissionEnum.ACCESS_API_ADMIN,
    PermissionEnum.ACCESS_API_PUBLIC,
    // Note: NO ACCESS_PERMISSIONS_MANAGE (SUPER_ADMIN only)
    // LOGGING & ERROR TRACKING
    PermissionEnum.LOGS_VIEW_ALL,
    PermissionEnum.ERRORS_VIEW,
    PermissionEnum.ANALYTICS_VIEW,
    // DEBUG & DEPLOY: Bulk operations only (NO DEBUG_TOOLS_ACCESS)
    PermissionEnum.ENTITIES_BULK_IMPORT,
    PermissionEnum.ENTITIES_BULK_EXPORT,
    // UI / CUSTOMIZATION
    PermissionEnum.THEME_EDIT,
    PermissionEnum.HOMEPAGE_LAYOUT_CONFIGURE,
    // TAG
    PermissionEnum.TAG_INTERNAL_UPDATE,
    PermissionEnum.TAG_INTERNAL_DELETE,
    PermissionEnum.TAG_INTERNAL_VIEW,
    PermissionEnum.TAG_INTERNAL_ASSIGN,
    PermissionEnum.TAG_SYSTEM_CREATE,
    PermissionEnum.TAG_SYSTEM_UPDATE,
    PermissionEnum.TAG_SYSTEM_DELETE,
    PermissionEnum.TAG_SYSTEM_VIEW,
    PermissionEnum.TAG_VIEW_ALL_USER_TAGS,
    PermissionEnum.TAG_VIEW_ALL_ASSIGNMENTS,
    PermissionEnum.TAG_ASSIGN_VIEW,
    PermissionEnum.TAG_ASSIGN_ADD,
    PermissionEnum.TAG_ASSIGN_REMOVE,
    // POST_TAG
    PermissionEnum.POST_TAG_VIEW,
    PermissionEnum.POST_TAG_CREATE,
    PermissionEnum.POST_TAG_UPDATE,
    PermissionEnum.POST_TAG_DELETE,
    PermissionEnum.POST_TAG_ASSIGN,
    // METRICS
    PermissionEnum.METRICS_RESET,
    // POST Sponsorship management
    PermissionEnum.POST_SPONSORSHIP_MANAGE,
    // SPONSORSHIP: _ANY
    PermissionEnum.SPONSORSHIP_VIEW_ANY,
    PermissionEnum.SPONSORSHIP_UPDATE_ANY,
    PermissionEnum.SPONSORSHIP_SOFT_DELETE_ANY,
    PermissionEnum.SPONSORSHIP_HARD_DELETE_ANY,
    PermissionEnum.SPONSORSHIP_RESTORE_ANY,
    PermissionEnum.SPONSORSHIP_UPDATE_VISIBILITY_ANY,
    // OWNER_PROMOTION: _ANY
    PermissionEnum.OWNER_PROMOTION_VIEW_ANY,
    PermissionEnum.OWNER_PROMOTION_UPDATE_ANY,
    PermissionEnum.OWNER_PROMOTION_SOFT_DELETE_ANY,
    PermissionEnum.OWNER_PROMOTION_HARD_DELETE_ANY,
    PermissionEnum.OWNER_PROMOTION_RESTORE_ANY,
    PermissionEnum.OWNER_PROMOTION_UPDATE_VISIBILITY_ANY,
    // BILLING
    PermissionEnum.BILLING_READ_ALL,
    PermissionEnum.BILLING_PROMO_CODE_READ,
    PermissionEnum.BILLING_PROMO_CODE_MANAGE,
    PermissionEnum.BILLING_METRICS_READ,
    // REVALIDATION
    PermissionEnum.REVALIDATION_TRIGGER,
    PermissionEnum.REVALIDATION_CONFIG_VIEW,
    PermissionEnum.REVALIDATION_CONFIG_EDIT,
    PermissionEnum.REVALIDATION_LOG_VIEW,
    // MEDIA
    PermissionEnum.MEDIA_UPLOAD,
    PermissionEnum.MEDIA_DELETE,
    // CONVERSATION: All except DELETE_ANY
    PermissionEnum.CONVERSATION_VIEW_OWN,
    PermissionEnum.CONVERSATION_VIEW_ANY,
    PermissionEnum.CONVERSATION_VIEW_ALL,
    PermissionEnum.CONVERSATION_REPLY_OWN,
    PermissionEnum.CONVERSATION_REPLY_ANY,
    PermissionEnum.CONVERSATION_UPDATE_STATUS_OWN,
    PermissionEnum.CONVERSATION_UPDATE_STATUS_ANY,
    PermissionEnum.CONVERSATION_BLOCK_OWN,
    PermissionEnum.CONVERSATION_BLOCK_ANY
] as const;

// ---------------------------------------------------------------------------
// AC-11 — SUPER_ADMIN
// ---------------------------------------------------------------------------

describe(`AC-11 — ${RoleEnum.SUPER_ADMIN} role navigation`, () => {
    const EXPECTED_MAIN_MENU = [
        'inicio',
        'catalogo',
        'editorial',
        'comunidad',
        'comercial',
        'plataforma',
        'analisis'
    ] as const;

    it('mainMenu is exactly the 7 platform sections in order', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.SUPER_ADMIN];

        // Act
        const mainMenu = role?.mainMenu;

        // Assert
        expect(role?.enabled).toBe(true);
        expect(mainMenu).toEqual([...EXPECTED_MAIN_MENU]);
    });

    it('topbar.showSearch is true', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.SUPER_ADMIN];

        // Act / Assert
        expect(role?.topbar?.showSearch).toBe(true);
    });

    it('topbar.showQuickCreate is "all"', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.SUPER_ADMIN];

        // Act / Assert
        expect(role?.topbar?.showQuickCreate).toBe('all');
    });

    it('topbar.accountInMenu is false', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.SUPER_ADMIN];

        // Act / Assert
        expect(role?.topbar?.accountInMenu).toBe(false);
    });

    it('mobile.bottomNav is null — SUPER_ADMIN is desktop-only', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.SUPER_ADMIN];

        // Act / Assert
        expect(role?.mobile?.bottomNav).toBeNull();
    });

    it('all 7 sections have ≥1 accessible sidebar item for SUPER_ADMIN', () => {
        // SUPER_ADMIN holds all permissions — every item is accessible.
        for (const sectionId of EXPECTED_MAIN_MENU) {
            // Arrange
            const section = validatedConfig.sections[sectionId];
            expect(section).toBeDefined();
            if (!section?.sidebar) continue;
            const sidebar = validatedConfig.sidebars[section.sidebar];
            expect(sidebar).toBeDefined();
            if (!sidebar) continue;

            // Act
            const accessible = hasSidebarAccessibleItem({
                items: sidebar.items,
                userPermissions: SUPER_ADMIN_PERMISSIONS
            });

            // Assert
            expect(accessible).toBe(true);
        }
    });

    it('SUPER_ADMIN-only debug item in analisisSidebar is visible (DEBUG_TOOLS_ACCESS)', () => {
        // Arrange — the debug link in analisisSidebar has onMissing:'hide'
        const analisisSidebar = validatedConfig.sidebars.analisisSidebar;
        const debugItem = analisisSidebar.items.find((item) => item.id === 'debug');
        expect(debugItem).toBeDefined();
        expect(debugItem?.type).toBe('link');

        // Act — SUPER_ADMIN has DEBUG_TOOLS_ACCESS
        const granted = isPermissionGateGranted({
            gate: debugItem?.type === 'link' ? debugItem.permissions : undefined,
            userPermissions: SUPER_ADMIN_PERMISSIONS
        });

        // Assert
        expect(granted).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// AC-12 — ADMIN
// ---------------------------------------------------------------------------

describe(`AC-12 — ${RoleEnum.ADMIN} role navigation`, () => {
    const EXPECTED_MAIN_MENU = [
        'inicio',
        'catalogo',
        'editorial',
        'comunidad',
        'comercial',
        'plataforma',
        'analisis'
    ] as const;

    it('mainMenu is exactly the same 7-section list as SUPER_ADMIN', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.ADMIN];

        // Act
        const mainMenu = role?.mainMenu;

        // Assert
        expect(role?.enabled).toBe(true);
        expect(mainMenu).toEqual([...EXPECTED_MAIN_MENU]);
    });

    it('topbar.showSearch is true (Cmd+K enabled)', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.ADMIN];

        // Act / Assert
        expect(role?.topbar?.showSearch).toBe(true);
    });

    it('topbar.showQuickCreate is "all"', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.ADMIN];

        // Act / Assert
        expect(role?.topbar?.showQuickCreate).toBe('all');
    });

    it('topbar.accountInMenu is false', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.ADMIN];

        // Act / Assert
        expect(role?.topbar?.accountInMenu).toBe(false);
    });

    it('mobile.bottomNav is null — ADMIN is desktop-only', () => {
        // Arrange
        const role = validatedConfig.roles[RoleEnum.ADMIN];

        // Act / Assert
        expect(role?.mobile?.bottomNav).toBeNull();
    });

    // ── AC-12 KEY ASSERTIONS — SUPER_ADMIN-only item visibility ─────────────

    it('[AC-12] critical-settings is hidden for ADMIN (gated on SUPER-only SYSTEM_MAINTENANCE_MODE)', () => {
        /**
         * critical-settings is gated on SYSTEM_MAINTENANCE_MODE (SUPER_ADMIN-only).
         * ADMIN does NOT hold it → onMissing:'hide' → item hidden for ADMIN.
         * Satisfies AC-12 (Configuración crítica is SUPER_ADMIN-only).
         */
        // Arrange
        const plataformaSidebar = validatedConfig.sidebars.plataformaSidebar;
        const configGeneralGroup = plataformaSidebar.items.find(
            (item) => item.id === 'config-general'
        );
        expect(configGeneralGroup?.type).toBe('group');
        const criticalSettingsItem =
            configGeneralGroup?.type === 'group'
                ? configGeneralGroup.items.find((item) => item.id === 'critical-settings')
                : undefined;
        expect(criticalSettingsItem).toBeDefined();
        expect(criticalSettingsItem?.type).toBe('link');

        // Act — ADMIN does NOT hold SYSTEM_MAINTENANCE_MODE
        const granted = isPermissionGateGranted({
            gate:
                criticalSettingsItem?.type === 'link'
                    ? criticalSettingsItem.permissions
                    : undefined,
            userPermissions: ADMIN_PERMISSIONS
        });

        // Assert — hidden for ADMIN (AC-12 satisfied)
        expect(granted).toBe(false);
    });

    it('[AC-12] audit-log IS visible to ADMIN — ADMIN holds AUDIT_LOG_VIEW (access follows real permissions)', () => {
        /**
         * audit-log is gated on AUDIT_LOG_VIEW. ADMIN genuinely holds it in the
         * real ROLE_PERMISSIONS bundle, so ADMIN legitimately sees the audit log.
         * Navigation access follows the user's REAL permissions; doc 01 §16's
         * "hide audit from ADMIN" is superseded by the real permission model.
         */
        // Arrange
        const plataformaSidebar = validatedConfig.sidebars.plataformaSidebar;
        const auditLogItem = plataformaSidebar.items.find((item) => item.id === 'audit-log');
        expect(auditLogItem).toBeDefined();
        expect(auditLogItem?.type).toBe('link');

        // Act
        const adminHasAuditLogView = ADMIN_PERMISSIONS.includes(PermissionEnum.AUDIT_LOG_VIEW);
        const granted = isPermissionGateGranted({
            gate: auditLogItem?.type === 'link' ? auditLogItem.permissions : undefined,
            userPermissions: ADMIN_PERMISSIONS
        });

        // Assert — visible because ADMIN holds the permission
        expect(adminHasAuditLogView).toBe(true);
        expect(granted).toBe(true);
    });

    it('[AC-12 CORRECT] debug item in analisisSidebar is NOT visible to ADMIN (ADMIN lacks DEBUG_TOOLS_ACCESS)', () => {
        /**
         * This item is correctly gated: ADMIN does NOT have DEBUG_TOOLS_ACCESS,
         * and onMissing: 'hide', so it is correctly hidden for ADMIN.
         */
        // Arrange
        const analisisSidebar = validatedConfig.sidebars.analisisSidebar;
        const debugItem = analisisSidebar.items.find((item) => item.id === 'debug');
        expect(debugItem).toBeDefined();
        expect(debugItem?.type).toBe('link');

        // Act — ADMIN does NOT have DEBUG_TOOLS_ACCESS
        const adminHasDebugAccess = ADMIN_PERMISSIONS.includes(PermissionEnum.DEBUG_TOOLS_ACCESS);
        const granted = isPermissionGateGranted({
            gate: debugItem?.type === 'link' ? debugItem.permissions : undefined,
            userPermissions: ADMIN_PERMISSIONS
        });

        // Assert — correctly hidden
        expect(adminHasDebugAccess).toBe(false);
        expect(granted).toBe(false);
    });

    it('ADMIN does NOT hold SYSTEM_MAINTENANCE_MODE (SUPER_ADMIN-exclusive)', () => {
        // Arrange / Act
        const adminHasMaintenance = ADMIN_PERMISSIONS.includes(
            PermissionEnum.SYSTEM_MAINTENANCE_MODE
        );

        // Assert
        expect(adminHasMaintenance).toBe(false);
    });

    it('ADMIN does NOT hold DEBUG_TOOLS_ACCESS (SUPER_ADMIN-exclusive)', () => {
        // Arrange / Act
        const adminHasDebug = ADMIN_PERMISSIONS.includes(PermissionEnum.DEBUG_TOOLS_ACCESS);

        // Assert
        expect(adminHasDebug).toBe(false);
    });

    it('all 7 sections have ≥1 accessible sidebar item for ADMIN', () => {
        for (const sectionId of EXPECTED_MAIN_MENU) {
            // Arrange
            const section = validatedConfig.sections[sectionId];
            expect(section).toBeDefined();
            if (!section?.sidebar) continue;
            const sidebar = validatedConfig.sidebars[section.sidebar];
            expect(sidebar).toBeDefined();
            if (!sidebar) continue;

            // Act
            const accessible = hasSidebarAccessibleItem({
                items: sidebar.items,
                userPermissions: ADMIN_PERMISSIONS
            });

            // Assert
            expect(accessible).toBe(true);
        }
    });
});
