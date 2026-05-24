/**
 * Admin IA Config Composer (T-017)
 *
 * Assembles the raw (un-parsed) AdminIAConfig object from the individual data
 * modules and re-exports it as {@link rawConfig}.
 *
 * This file does NOT run Zod validation — that happens in `validate.ts` so that
 * importing this module alone is side-effect-free. Only `validate.ts` (which
 * triggers validation at module load) should be imported by the admin shell
 * bootstrap.
 *
 * Shape: `z.input<typeof AdminIAConfigSchema>` — fields with Zod defaults
 * (`onMissing`, `exact`, `defaultOpen`, `labelOverrides`, etc.) may be omitted
 * here because they will be applied by the parser in `validate.ts`.
 *
 * @see apps/admin/src/config/ia/validate.ts   — boot-time validation entry point
 * @see apps/admin/src/config/ia/schema.ts      — AdminIAConfigSchema definition
 * @see .claude/audit/admin-redesign/proposals/02-config-schema.md §12, §14
 */

import { RoleEnum } from '@repo/schemas';
import type { z } from 'zod';
import { createActions } from './create-actions';
import { dashboards } from './dashboards';
import { adminRole } from './roles/admin';
import { clientManagerRole } from './roles/client-manager';
import { editorRole } from './roles/editor';
import { hostRole } from './roles/host';
import { sponsorRole } from './roles/sponsor';
import { superAdminRole } from './roles/super-admin';
import type { AdminIAConfigSchema } from './schema';
import { sections } from './sections';
import { sidebars } from './sidebars';
import { tabs } from './tabs';

/**
 * The 6 roles configured for the admin panel, keyed by RoleEnum value string.
 *
 * USER, GUEST, and SYSTEM are platform roles that do not participate in the
 * admin IA — they have no admin panel navigation. The `roles` field in
 * {@link AdminIAConfigSchema} uses `z.record(z.string(), ...)` (not
 * `z.nativeEnum(RoleEnum)`) so that a partial set of roles is accepted by
 * the Zod parser. See the schema comment for the full rationale.
 */
const roles: Record<string, z.input<typeof AdminIAConfigSchema>['roles'][string]> = {
    [RoleEnum.SUPER_ADMIN]: superAdminRole,
    [RoleEnum.ADMIN]: adminRole,
    [RoleEnum.HOST]: hostRole,
    [RoleEnum.EDITOR]: editorRole,
    [RoleEnum.SPONSOR]: sponsorRole,
    [RoleEnum.CLIENT_MANAGER]: clientManagerRole
};

/**
 * Raw (un-parsed) Admin IA configuration assembled from all data modules.
 *
 * Typed as `z.input<typeof AdminIAConfigSchema>` so that fields with Zod
 * `.default()` values (`onMissing`, `exact`, `defaultOpen`, `labelOverrides`,
 * `scope`) are optional at the input level — the parser in `validate.ts`
 * applies the defaults during `safeParse`.
 *
 * **Do not import `rawConfig` from application code.** Instead, import
 * `validatedConfig` from `./validate` — it carries the defaults-applied,
 * type-safe output type (`AdminIAConfig`).
 *
 * @example
 * ```ts
 * // In validate.ts only:
 * import { rawConfig } from './index';
 * const result = AdminIAConfigSchema.safeParse(rawConfig);
 * ```
 */
export const rawConfig: z.input<typeof AdminIAConfigSchema> = {
    sections,
    sidebars,
    dashboards,
    tabs,
    createActions,
    roles
};
