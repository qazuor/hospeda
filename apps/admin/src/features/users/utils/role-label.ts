/**
 * Single source for a role's display label in the admin panel (HOS-296).
 *
 * There used to be TWO catalogues for the same data on the SAME screen: a
 * hardcoded Spanish `Record<RoleEnum, string>` (`getRoleLabel`, now deleted)
 * feeding the page header, and `admin-pages.access.roles.catalog.<ROLE>.name`
 * feeding `UserRolesCard`. One of them lived outside `@repo/i18n` entirely, so
 * it could never be translated and would drift the moment either side changed.
 *
 * This module resolves the i18n key only — the caller owns the `t()` call, so
 * the helper stays usable from components and hooks alike without smuggling a
 * translator into a non-React module.
 *
 * @module features/users/utils/role-label
 */

import type { TranslationKey } from '@repo/i18n';
import type { RoleEnum } from '@repo/schemas';

/**
 * Builds the i18n key holding a role's human-readable name.
 *
 * @param params.role - Role to label.
 * @returns The `@repo/i18n` key for that role's display name.
 *
 * @example
 * ```ts
 * const label = t(buildRoleLabelKey({ role: RoleEnum.HOST })); // "Anfitrión"
 * ```
 */
export const buildRoleLabelKey = (params: { role: RoleEnum }): TranslationKey =>
    `admin-pages.access.roles.catalog.${params.role}.name` as TranslationKey;
