/**
 * Admin IA — CLIENT_MANAGER role configuration (T-014)
 *
 * The CLIENT_MANAGER role is currently deferred (`enabled: false`). Navigation
 * fields are intentionally omitted — the schema's superRefine only enforces their
 * presence when `enabled` is true. This role will be activated in a future spec
 * once the client-management workflow is designed.
 *
 * Design source of truth:
 *   `.claude/audit/admin-redesign/proposals/01-information-architecture.md` §18.
 *
 * @see apps/admin/src/config/ia/schema.ts — RoleConfigSchema (enabled=false is valid)
 */

import type { z } from 'zod';
import type { RoleConfigSchema } from '../schema';

/**
 * Role configuration for CLIENT_MANAGER — deferred, not yet active.
 *
 * When this role is eventually enabled it will need a dedicated section set
 * covering client-account management, reporting, and communication workflows.
 * Until then only the label is defined.
 *
 * @example
 * ```ts
 * import { clientManagerRole } from '@/config/ia/roles/client-manager';
 * clientManagerRole.enabled; // false
 * ```
 */
export const clientManagerRole: z.input<typeof RoleConfigSchema> = {
    enabled: false,
    label: { es: 'Client manager', en: 'Client manager', pt: 'Gestor de clientes' }
};
