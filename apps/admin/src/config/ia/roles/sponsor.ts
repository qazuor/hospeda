/**
 * Admin IA — SPONSOR role configuration (T-014)
 *
 * The SPONSOR role is currently deferred (`enabled: false`). Navigation fields
 * (mainMenu, dashboard, topbar, mobile) are intentionally omitted — the schema's
 * superRefine does not require them when `enabled` is false. This role will be
 * activated in a future spec once the sponsor-facing dashboard and section are
 * designed and implemented.
 *
 * Design source of truth:
 *   `.claude/audit/admin-redesign/proposals/01-information-architecture.md` §18.
 *
 * @see apps/admin/src/config/ia/schema.ts — RoleConfigSchema (enabled=false is valid)
 */

import type { z } from 'zod';
import type { RoleConfigSchema } from '../schema';

/**
 * Role configuration for SPONSOR — deferred, not yet active.
 *
 * When this role is eventually enabled it will need its own section set, a
 * sponsor-specific dashboard, and mobile navigation. Until then the schema
 * allows `enabled: false` with only the label defined.
 *
 * @example
 * ```ts
 * import { sponsorRole } from '@/config/ia/roles/sponsor';
 * sponsorRole.enabled; // false
 * ```
 */
export const sponsorRole: z.input<typeof RoleConfigSchema> = {
    enabled: false,
    label: { es: 'Sponsor', en: 'Sponsor', pt: 'Patrocinador' }
};
