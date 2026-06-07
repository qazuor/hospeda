import { PermissionEnum } from '../../enums/permission.enum.js';

/**
 * Permission-based access checks for content moderation terms (SPEC-195).
 * Each function takes a permissions array and returns whether the actor
 * is authorized for the given action.
 */

export function canViewTerms(permissions: readonly string[]): boolean {
    return permissions.includes(PermissionEnum.MODERATION_TERM_VIEW);
}

export function canCreateTerm(permissions: readonly string[]): boolean {
    return permissions.includes(PermissionEnum.MODERATION_TERM_CREATE);
}

export function canUpdateTerm(permissions: readonly string[]): boolean {
    return permissions.includes(PermissionEnum.MODERATION_TERM_UPDATE);
}

export function canDeleteTerm(permissions: readonly string[]): boolean {
    return permissions.includes(PermissionEnum.MODERATION_TERM_DELETE);
}

export function canRestoreTerm(permissions: readonly string[]): boolean {
    return permissions.includes(PermissionEnum.MODERATION_TERM_RESTORE);
}

export function canHardDeleteTerm(permissions: readonly string[]): boolean {
    return permissions.includes(PermissionEnum.MODERATION_TERM_HARD_DELETE);
}
