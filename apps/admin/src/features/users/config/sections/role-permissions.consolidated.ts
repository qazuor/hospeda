import { PermissionEnum } from '@repo/schemas';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';

/**
 * Consolidated configuration for the Role & Permissions section of user
 *
 * HOS-296: the scalar `role` `SELECT` that used to open this section is GONE.
 * `users.role` was dropped, `UserPatchInputSchema` no longer accepts a `role`
 * field, and a user now holds a SET of hats whose membership is mutated only
 * through the dedicated `POST`/`DELETE /admin/users/:id/roles` endpoints.
 * Leaving the field here would have submitted a key the API rejects, and no
 * entity-form field type can carry the per-hat provenance (`grantedAt`,
 * `grantedBy`, `grantReason`) that §6.5/§8 require the panel to display.
 *
 * The replacement is `UserRolesCard`, on the user's Permissions tab
 * (`/access/users/:id/permissions`) — a real multi-select over the role set
 * with grant/revoke actions. See
 * `features/users/components/roles/UserRolesCard.tsx`.
 */
export const createRolePermissionsConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'role-permissions',
    title: 'Rol y Permisos',
    description: 'Configuración de acceso y permisos del usuario',
    layout: LayoutTypeEnum.GRID,
    // View-only: the single remaining field (`authProvider`) is itself
    // `modes: ['view']`, and `filterSectionsByMode` filters FIELDS but never
    // drops a section that ends up empty — so advertising create/edit rendered
    // a titled, described, empty card on `/access/users/new` and `.../edit`.
    modes: ['view'],
    permissions: {
        view: [PermissionEnum.USER_READ_ALL],
        edit: [PermissionEnum.USER_UPDATE_ROLES]
    },
    fields: [
        {
            id: 'authProvider',
            type: FieldTypeEnum.SELECT,
            required: false,
            modes: ['view'],
            label: 'Proveedor de Autenticación',
            description: 'Método de autenticación del usuario',
            permissions: {
                view: [PermissionEnum.USER_READ_ALL],
                edit: []
            },
            typeConfig: {
                options: [
                    { value: 'BETTER_AUTH', label: 'Better Auth' },
                    { value: 'CLERK', label: 'Clerk (Legacy)' },
                    { value: 'AUTH0', label: 'Auth0' },
                    { value: 'CUSTOM', label: 'Custom' }
                ]
            }
        }
    ]
});

// `getRoleLabel` used to live here: a hardcoded Spanish
// `Record<RoleEnum, string>` outside `@repo/i18n`, read by the user page
// header while `UserRolesCard` rendered the same roles through
// `admin-pages.access.roles.catalog.<ROLE>.name`. Two catalogues for one set of
// labels on one screen. Both now go through
// `features/users/utils/role-label.ts` → `buildRoleLabelKey`.
