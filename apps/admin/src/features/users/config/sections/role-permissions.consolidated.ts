import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { ConsolidatedSectionConfig } from '@/features/destinations/types/consolidated-config.types';
import { PermissionEnum, RoleEnum } from '@repo/schemas';

/**
 * Consolidated configuration for the Role & Permissions section of user
 */
export const createRolePermissionsConsolidatedSection = (): ConsolidatedSectionConfig => ({
    id: 'role-permissions',
    title: 'Rol y Permisos',
    description: 'Configuración de acceso y permisos del usuario',
    layout: LayoutTypeEnum.GRID,
    modes: ['view', 'edit'],
    permissions: {
        view: [PermissionEnum.USER_READ_ALL],
        edit: [PermissionEnum.USER_UPDATE_ROLES]
    },
    fields: [
        {
            id: 'role',
            type: FieldTypeEnum.SELECT,
            required: true,
            modes: ['view', 'edit'],
            label: 'Rol',
            description: 'Rol del usuario en el sistema',
            permissions: {
                view: [PermissionEnum.USER_READ_ALL],
                edit: [PermissionEnum.USER_UPDATE_ROLES]
            },
            typeConfig: {
                options: Object.values(RoleEnum).map((value) => ({
                    value,
                    label: getRoleLabel(value)
                }))
            }
        },
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
                    { value: 'CLERK', label: 'Clerk' },
                    { value: 'LOCAL', label: 'Local' },
                    { value: 'GOOGLE', label: 'Google' },
                    { value: 'FACEBOOK', label: 'Facebook' }
                ]
            }
        }
    ]
});

/**
 * Get human-readable label for role
 */
function getRoleLabel(role: RoleEnum): string {
    const labels: Record<RoleEnum, string> = {
        [RoleEnum.SUPER_ADMIN]: 'Super Administrador',
        [RoleEnum.ADMIN]: 'Administrador',
        [RoleEnum.CLIENT_MANAGER]: 'Gestor de Clientes',
        [RoleEnum.EDITOR]: 'Editor',
        [RoleEnum.HOST]: 'Anfitrión',
        [RoleEnum.USER]: 'Usuario',
        [RoleEnum.GUEST]: 'Invitado'
    };
    return labels[role] || role;
}
