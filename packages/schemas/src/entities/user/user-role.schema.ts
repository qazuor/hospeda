import { z } from 'zod';
import { UserIdSchema } from '../../common/id.schema.js';
import { RoleEnum } from '../../enums/role.enum.js';
import { RoleEnumSchema } from '../../enums/role.schema.js';

/**
 * Roles that may never be handed out to an account (HOS-296 §7).
 *
 * - `SYSTEM` belongs to the single reserved, non-loginable seeded account.
 * - `GUEST` is synthesised in memory for unauthenticated requests and is never
 *   stored. Granting it to a real account makes `isGuestActor()` true for a
 *   fully valid session, so `/auth/me` answers `isAuthenticated: false` and the
 *   holder is treated as anonymous everywhere — silently locked out of every
 *   `/mi-cuenta/*` page with no error anywhere.
 *
 * Declared here, next to the schema that enforces it, so the API and the admin
 * panel share ONE definition: an invariant that only lives in a React component
 * is not enforced at all.
 */
export const NON_ASSIGNABLE_ROLES: readonly RoleEnum[] = [
    RoleEnum.SYSTEM,
    RoleEnum.GUEST
] as const;

/**
 * A role an operator is allowed to grant.
 *
 * Deliberately NOT used by {@link GrantRoleInputSchema}: the service primitive
 * still has to be able to grant `SYSTEM`, because that is how the seed creates
 * the reserved system account. The restriction belongs on the HTTP boundary,
 * where the caller is a human operator.
 */
export const AssignableRoleEnumSchema = RoleEnumSchema.refine(
    (role) => !NON_ASSIGNABLE_ROLES.includes(role),
    { message: 'zodError.enums.role.notAssignable' }
);

/**
 * Machine-readable `reason` carried by the `VALIDATION_ERROR` that
 * `revokeRole` raises when asked to remove an account's LAST role (AC-5).
 *
 * Exists so consumers can recognise that specific refusal without matching on
 * the English message — which additionally embeds the subject's UUID and must
 * therefore never be rendered to an operator.
 */
export const LAST_ROLE_REVOKE_REASON = 'LAST_ROLE_REVOKE';

/**
 * Zod schema for a single row of `user_role` — one hat held by one user
 * (HOS-296).
 *
 * The relation is many-to-many: a user holds a SET of roles and granting one
 * never removes another. The composite primary key `(userId, role)` is what
 * makes {@link  grantRole} idempotent ("grant if absent") without a prior read.
 *
 * `grantedBy` is null when the grant was automatic (signup hook, accommodation
 * activation, cron) rather than performed by a human actor; the FK is
 * `ON DELETE SET NULL` so removing the granting account never cascades into
 * the grantee's capabilities.
 */
export const UserRoleSchema = z.object({
    userId: UserIdSchema,
    role: RoleEnumSchema,
    grantedAt: z.date(),
    grantedBy: UserIdSchema.nullable().describe(
        'Actor who granted the role; null = system/automatic'
    ),
    grantReason: z
        .string()
        .nullable()
        .describe("Why the hat was granted, e.g. 'accommodation_activated'")
});

/** A single held role (one row of `user_role`). */
export type UserRole = z.infer<typeof UserRoleSchema>;

/**
 * Input for the `grantRole` service primitive (HOS-296 §6.8).
 *
 * Idempotent by contract: granting a role the user already holds is a
 * successful no-op, so callers never need a prior "does the user already
 * have it" read.
 */
export const GrantRoleInputSchema = z.object({
    userId: UserIdSchema,
    role: RoleEnumSchema,
    grantedBy: UserIdSchema.nullish().describe(
        'Actor performing the grant; omit for system grants'
    ),
    reason: z.string().max(500).nullish().describe('Why the hat is being granted')
});

/** Input for the `grantRole` service primitive. */
export type GrantRoleInput = z.infer<typeof GrantRoleInputSchema>;

/**
 * Input for the `revokeRole` service primitive (HOS-296 §6.8).
 *
 * Idempotent by contract: revoking a role the user does not hold is a
 * successful no-op. Revoking a user's LAST role is rejected — every account
 * must keep at least one hat (AC-5 / AC-12).
 */
export const RevokeRoleInputSchema = z.object({
    userId: UserIdSchema,
    role: RoleEnumSchema,
    revokedBy: UserIdSchema.nullish().describe(
        'Actor performing the revoke; omit for system revokes'
    ),
    reason: z.string().max(500).nullish().describe('Why the hat is being revoked')
});

/** Input for the `revokeRole` service primitive. */
export type RevokeRoleInput = z.infer<typeof RevokeRoleInputSchema>;

/**
 * One held role as the admin panel needs to SEE it (HOS-296 §6.5 / §8).
 *
 * Richer than {@link UserRoleSchema} by exactly one field: `grantedByName`.
 * The admin multi-select has to show, per hat, **when it was granted and by
 * whom** — that visibility is the stated mitigation for R-1 (an account
 * silently accumulating hats nobody can account for). A raw `grantedBy` UUID
 * does not answer "by whom" for a human, so the granter's display name is
 * resolved server-side and travels with the row rather than forcing the panel
 * into an N+1 lookup per role.
 *
 * `grantedBy` / `grantedByName` are both null for automatic grants (signup
 * hook, accommodation activation, cron, seed) — the `grantReason` is what
 * explains those.
 */
export const UserRoleGrantSchema = z.object({
    role: RoleEnumSchema,
    grantedAt: z.date(),
    grantedBy: UserIdSchema.nullable().describe(
        'Actor who granted the role; null = system/automatic'
    ),
    grantedByName: z
        .string()
        .nullable()
        .describe('Display name of the granting actor; null when automatic or the account is gone'),
    grantReason: z
        .string()
        .nullable()
        .describe("Why the hat was granted, e.g. 'accommodation_activated'")
});

/** One held role, enriched with the granter's display name. */
export type UserRoleGrant = z.infer<typeof UserRoleGrantSchema>;

/**
 * Response body of `GET /api/v1/admin/users/{id}/roles`.
 *
 * Ordered oldest-grant-first so the list reads as the account's role history.
 */
export const UserRoleGrantsResponseSchema = z.object({
    userId: UserIdSchema,
    roles: z.array(UserRoleGrantSchema).describe('Every role held, oldest grant first')
});

/** Response body of the admin "read a user's hats" endpoint. */
export type UserRoleGrantsResponse = z.infer<typeof UserRoleGrantsResponseSchema>;

/**
 * Request body of `POST /api/v1/admin/users/{id}/roles`.
 *
 * `userId` is NOT part of the body — it is the path parameter, and accepting
 * it in both places would let the two disagree.
 *
 * `role` is an {@link AssignableRoleEnumSchema}, so `SYSTEM` and `GUEST` are
 * rejected with a 400 at the boundary rather than only being hidden from the
 * admin panel's dropdown — see {@link NON_ASSIGNABLE_ROLES} for why granting
 * `GUEST` silently un-authenticates the account.
 */
export const GrantUserRoleBodySchema = z.object({
    role: AssignableRoleEnumSchema,
    reason: z
        .string()
        .max(500)
        .optional()
        .describe('Operator justification, written to the audit row')
});

/** Request body of the admin grant-role endpoint. */
export type GrantUserRoleBody = z.infer<typeof GrantUserRoleBodySchema>;

/**
 * Query parameters of `DELETE /api/v1/admin/users/{id}/roles/{role}`.
 *
 * The reason travels as a query parameter rather than a body because Hono's
 * DELETE handlers never receive one (see `apps/api/CLAUDE.md` — "DELETE-body
 * factory gotcha"): a body here would be silently discarded and the audit row
 * would lose the operator's justification without any error.
 */
export const RevokeUserRoleQuerySchema = z.object({
    reason: z
        .string()
        .max(500)
        .optional()
        .describe('Operator justification, written to the audit row')
});

/** Query parameters of the admin revoke-role endpoint. */
export type RevokeUserRoleQuery = z.infer<typeof RevokeUserRoleQuerySchema>;

/**
 * Response body shared by the admin grant and revoke endpoints.
 *
 * Returns the resulting role SET rather than a bare `{ success: true }`: both
 * primitives are idempotent, so "did anything change" is not derivable from
 * the status code, and the panel needs the post-mutation set anyway to
 * re-render without a second round-trip.
 */
export const UserRoleMutationResponseSchema = z.object({
    userId: UserIdSchema,
    role: RoleEnumSchema.describe('The role that was granted or revoked'),
    roles: z.array(RoleEnumSchema).describe('Every role held AFTER the mutation')
});

/** Response body of the admin grant/revoke endpoints. */
export type UserRoleMutationResponse = z.infer<typeof UserRoleMutationResponseSchema>;

/**
 * Canonical `grant_reason` / audit `reason` values written by automatic
 * (non-admin) role mutations (HOS-296 §6.8).
 *
 * The reasons are the only thing that explains an accumulated set of hats after
 * the fact (R-1), and they are written from four different packages
 * (`service-core`, `apps/api` routes, `apps/api` crons, `seed`). A free-text
 * literal per call site drifts on the first typo and silently splits the audit
 * trail in two, so the strings live here — the one place every writer already
 * depends on.
 *
 * Admin-initiated grants/revokes do NOT use these: they carry the operator's
 * own justification text.
 */
export const RoleGrantReason = {
    /** Better Auth signup hook — the baseline `USER` hat every account starts with. */
    SIGNUP: 'signup',
    /** Staff-provisioned host account (`POST /auth/signup-as-host`). */
    SIGNUP_AS_HOST: 'signup_as_host',
    /** Admin created the account through the admin panel. */
    ADMIN_USER_CREATED: 'admin_user_created',
    /** Admin granted the hat through `UserService.assignRole` with no free-text note. */
    ADMIN_ASSIGN_ROLE: 'admin_assign_role',
    /** Host-onboarding draft created (`AccommodationService.createForOnboarding`). */
    ACCOMMODATION_CREATED: 'accommodation_created',
    /** An accommodation transitioned to `ACTIVE` (the G-6 site). */
    ACCOMMODATION_ACTIVATED: 'accommodation_activated',
    /** The owner's last non-archived accommodation was archived — a revoke. */
    LAST_ACCOMMODATION_ARCHIVED: 'last_accommodation_archived',
    /** A commerce lead was approved and provisioned to this account. */
    COMMERCE_LEAD_APPROVED: 'commerce_lead_approved',
    /** Written by database seeds so fixture accounts are distinguishable. */
    SEED: 'seed'
} as const;

/** One of the canonical automatic grant reasons. */
export type RoleGrantReasonValue = (typeof RoleGrantReason)[keyof typeof RoleGrantReason];
