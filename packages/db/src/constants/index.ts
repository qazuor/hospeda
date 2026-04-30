/**
 * Reserved UUID for the system actor used in automated operations.
 *
 * Used as the `assignedById` value in `r_entity_tag` for seed data, cron jobs,
 * webhooks, and any other automated tag assignment that has no real human actor.
 * This UUID must be seeded into the `users` table with role `SYSTEM`.
 *
 * Reference: SPEC-086 D-005
 *
 * @example
 * ```ts
 * import { SYSTEM_USER_ID } from '@repo/db';
 *
 * await tagModel.assign({
 *   tagId,
 *   entityId,
 *   entityType: 'ACCOMMODATION',
 *   assignedById: SYSTEM_USER_ID,
 * });
 * ```
 */
/**
 * Format: RFC4122 v4 UUID (version=4 in pos 13, variant=8 in pos 17).
 * Required because Zod v4 strict UUID validation rejects non-RFC formats.
 * Recognizable `a0000000-...-000001` pattern makes it easy to spot in DB rows.
 */
export const SYSTEM_USER_ID = 'a0000000-0000-4000-8000-000000000001' as const;

/**
 * Email address for the system actor account.
 *
 * The system user seeded into the `users` table uses this email. It is not a
 * real address and cannot be used to log in. Callers that need the system actor
 * for automated operations should use {@link SYSTEM_USER_ID} instead of the email.
 *
 * Reference: SPEC-086 D-005
 */
export const SYSTEM_USER_EMAIL = 'system@hospeda.internal' as const;
