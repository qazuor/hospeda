/**
 * Multi-role write primitives (HOS-296 §6.8).
 *
 * Two functions — `grantRole` and `revokeRole` — are the ONLY sanctioned way to
 * mutate a user's set of hats. Every site that used to write the (now dropped)
 * `users.role` scalar routes through one of them, which is what turns a
 * destructive "replace the hat" into an additive "add a hat".
 *
 * Design contract, in order of importance:
 *
 * 1. **Additive and idempotent.** `grantRole` is a "grant if absent" leaning on
 *    the `(user_id, role)` primary key, so callers never need a prior read and
 *    granting a hat the user already wears is a successful no-op. `revokeRole`
 *    is symmetric: revoking a hat the user does not wear is a no-op too.
 * 2. **Never strands an account with zero roles.** `revokeRole` refuses to
 *    remove the last remaining hat (AC-5). Because that is a check-then-act, it
 *    takes a `SELECT ... FOR UPDATE` row lock on the `users` row first — without
 *    it, two concurrent revokes on a `{USER, HOST}` user can both read
 *    "count > 1, safe" and leave the account with nothing (AC-12).
 * 3. **Audited.** Every mutation that actually changes state writes one
 *    `user_role_audit` row in the SAME transaction, carrying `action`, `by` and
 *    `reason` (AC-6). A no-op writes nothing — an audit trail records state
 *    changes, and `_assignHostRoleIfNeeded` fires on every accommodation
 *    activation, so logging no-ops would bury the real history under duplicates.
 *    Because of that, both primitives report `{ changed }` in their success
 *    payload: it is the ONLY way a caller can tell a real write apart from an
 *    idempotent no-op, and it mirrors exactly whether an audit row exists.
 * 4. **Transaction-aware.** Both accept the caller's `ctx.tx` and enlist in it
 *    rather than opening a competing boundary (`archive-abandoned-drafts.job.ts`
 *    already wraps its own).
 *
 * Errors follow the repo's `ServiceOutput` envelope (the spec's `Result<T>`).
 * When the caller supplied a transaction, errors are RE-THROWN instead of being
 * returned, mirroring `BaseService.runWithLoggingAndValidation` — swallowing an
 * error inside someone else's transaction would let them commit half a unit of
 * work.
 *
 * @module services/user-role/user-role.service
 */

import type { DrizzleClient } from '@repo/db';
import { and, asc, eq, getDb, userRole, userRoleAudit, users, withTransaction } from '@repo/db';
import type { GrantRoleInput, RevokeRoleInput, RoleEnum, UserRoleGrant } from '@repo/schemas';
import {
    GrantRoleInputSchema,
    LAST_ROLE_REVOKE_REASON,
    RevokeRoleInputSchema,
    RoleGrantActionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import type { ServiceContext, ServiceOutput } from '../../types/index.js';
import { ServiceError } from '../../types/index.js';

/**
 * Success payload of {@link grantRole} / {@link revokeRole}.
 *
 * Both primitives are idempotent, so "succeeded" alone does not tell a caller
 * whether anything actually happened: an already-worn hat and a freshly granted
 * one both return successfully. `changed` is what separates them.
 *
 * It exists because callers ACT on that distinction. The
 * `archive-abandoned-drafts` cron increments its `demoted` counter and logs an
 * `owner_demoted` event; doing that on a no-op asserts a state change that no
 * `user_role_audit` row corroborates (the audit table deliberately records only
 * real changes — see the module note). `changed` mirrors exactly the condition
 * under which an audit row was written.
 */
export interface RoleMutationOutcome {
    /**
     * `true` when a `user_role` row was inserted/deleted and an audit row was
     * written; `false` for the idempotent no-op.
     */
    readonly changed: boolean;
}

/** Input for {@link grantRole} — the schema shape plus the optional context. */
export type GrantRoleParams = GrantRoleInput & {
    /** Caller's service context; `ctx.tx` enlists this write in their transaction. */
    ctx?: ServiceContext;
};

/** Input for {@link revokeRole} — the schema shape plus the optional context. */
export type RevokeRoleParams = RevokeRoleInput & {
    /** Caller's service context; `ctx.tx` enlists this write in their transaction. */
    ctx?: ServiceContext;
};

/**
 * Writes one immutable `user_role_audit` row.
 *
 * Always called inside the same transaction as the `user_role` mutation it
 * describes, so a rolled-back grant leaves no phantom audit entry.
 *
 * @param params.tx - Transaction client to write through.
 * @param params.userId - Subject of the mutation.
 * @param params.role - Role that was granted or revoked.
 * @param params.action - Direction of the mutation.
 * @param params.by - Actor who performed it; `null` for system mutations.
 * @param params.reason - Free-text justification; `null` when unspecified.
 */
const insertAuditRow = async (params: {
    tx: DrizzleClient;
    userId: string;
    role: RoleEnum;
    action: RoleGrantActionEnum;
    by: string | null;
    reason: string | null;
}): Promise<void> => {
    const { tx, userId, role, action, by, reason } = params;
    await tx.insert(userRoleAudit).values({ userId, role, action, by, reason });
};

/**
 * Normalises the `nullish` actor/reason inputs to the `null` the columns store.
 *
 * @param value - Raw optional input value.
 * @returns The value, or `null` when it was `undefined`/`null`.
 */
const toNullable = (value: string | null | undefined): string | null => value ?? null;

/**
 * Maps a thrown error onto the `ServiceOutput` envelope, or re-throws it when
 * the caller owns the surrounding transaction.
 *
 * @param params.error - The caught error.
 * @param params.ctx - Caller context; presence of `ctx.tx` selects re-throw.
 * @param params.fallbackMessage - Message used when the error is not a `ServiceError`.
 * @returns The error-shaped `ServiceOutput`.
 */
const toErrorOutput = (params: {
    error: unknown;
    ctx?: ServiceContext;
    fallbackMessage: string;
}): ServiceOutput<RoleMutationOutcome> => {
    const { error, ctx, fallbackMessage } = params;
    const serviceError =
        error instanceof ServiceError
            ? error
            : new ServiceError(
                  ServiceErrorCode.INTERNAL_ERROR,
                  `${fallbackMessage}: ${error instanceof Error ? error.message : String(error)}`,
                  error
              );

    // Inside a caller-owned transaction the error MUST propagate, otherwise the
    // caller commits a partially-applied unit of work. Same rule as
    // BaseService.runWithLoggingAndValidation.
    if (ctx?.tx) {
        throw serviceError;
    }

    return { error: serviceError };
};

/**
 * Grants a role to a user, additively and idempotently (HOS-296 G-1/G-3).
 *
 * Granting never removes another hat — that is the whole point of the change.
 * If the user already holds the role the call succeeds without writing
 * anything, so callers can invoke it unconditionally on every accommodation
 * activation, commerce approval or host signup.
 *
 * @param params.userId - User receiving the hat.
 * @param params.role - Role to grant.
 * @param params.grantedBy - Actor performing the grant; omit for system grants.
 * @param params.reason - Why the hat is being granted (e.g. `accommodation_activated`).
 * @param params.ctx - Optional caller context; `ctx.tx` enlists in their transaction.
 * @returns `ServiceOutput<RoleMutationOutcome>` — `{ data: { changed } }` on
 *   success, where `changed` is `false` for the idempotent no-op; `{ error }`
 *   otherwise.
 * @throws {ServiceError} Only when `ctx.tx` is supplied — see the module note.
 *
 * @example
 * ```ts
 * const result = await grantRole({
 *     userId: owner.id,
 *     role: RoleEnum.HOST,
 *     grantedBy: null,
 *     reason: 'accommodation_activated'
 * });
 * if (result.error) { ... }
 * if (result.data?.changed) { ... }
 * ```
 */
export const grantRole = async (
    params: GrantRoleParams
): Promise<ServiceOutput<RoleMutationOutcome>> => {
    const { ctx, ...input } = params;

    const parsed = GrantRoleInputSchema.safeParse(input);
    if (!parsed.success) {
        return toErrorOutput({
            error: new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Invalid grantRole input.',
                parsed.error.flatten()
            ),
            ctx,
            fallbackMessage: 'Invalid grantRole input'
        });
    }

    const { userId, role } = parsed.data;
    const grantedBy = toNullable(parsed.data.grantedBy);
    const reason = toNullable(parsed.data.reason);

    try {
        const changed = await withTransaction(async (tx) => {
            // "Grant if absent" rides on the (user_id, role) primary key: no
            // read, no race. An existing row means the hat is already worn.
            const inserted = await tx
                .insert(userRole)
                .values({ userId, role, grantedBy, grantReason: reason })
                .onConflictDoNothing({ target: [userRole.userId, userRole.role] })
                .returning({ userId: userRole.userId });

            if (inserted.length === 0) {
                // Idempotent no-op — nothing changed, so nothing to audit.
                return false;
            }

            await insertAuditRow({
                tx,
                userId,
                role,
                action: RoleGrantActionEnum.GRANT,
                by: grantedBy,
                reason
            });

            return true;
        }, ctx?.tx);

        return { data: { changed } };
    } catch (error) {
        return toErrorOutput({ error, ctx, fallbackMessage: 'Failed to grant role' });
    }
};

/**
 * Revokes a role from a user, refusing to remove their last one
 * (HOS-296 AC-5 / AC-12).
 *
 * Idempotent: revoking a hat the user does not wear succeeds without writing.
 * The last-role guard is a check-then-act, so the user row is locked with
 * `SELECT ... FOR UPDATE` before the held-roles count is read. Two concurrent
 * revokes on a `{USER, HOST}` user therefore serialize — the second observes
 * the post-delete state and is rejected, instead of both seeing "count > 1" and
 * stranding the account with zero roles.
 *
 * @param params.userId - User losing the hat.
 * @param params.role - Role to revoke.
 * @param params.revokedBy - Actor performing the revoke; omit for system revokes.
 * @param params.reason - Why the hat is being revoked (e.g. `last_accommodation_archived`).
 * @param params.ctx - Optional caller context; `ctx.tx` enlists in their transaction.
 * @returns `ServiceOutput<RoleMutationOutcome>` — `{ data: { changed } }` on
 *   success, where `changed` is `false` for the idempotent no-op (the hat was
 *   not worn by the time the row lock was taken, or the DELETE itself affected
 *   no row); `{ error }` otherwise.
 *   `VALIDATION_ERROR` when the role is the user's last one; `NOT_FOUND` when
 *   the user does not exist.
 * @throws {ServiceError} Only when `ctx.tx` is supplied — see the module note.
 */
export const revokeRole = async (
    params: RevokeRoleParams
): Promise<ServiceOutput<RoleMutationOutcome>> => {
    const { ctx, ...input } = params;

    const parsed = RevokeRoleInputSchema.safeParse(input);
    if (!parsed.success) {
        return toErrorOutput({
            error: new ServiceError(
                ServiceErrorCode.VALIDATION_ERROR,
                'Invalid revokeRole input.',
                parsed.error.flatten()
            ),
            ctx,
            fallbackMessage: 'Invalid revokeRole input'
        });
    }

    const { userId, role } = parsed.data;
    const revokedBy = toNullable(parsed.data.revokedBy);
    const reason = toNullable(parsed.data.reason);

    try {
        const changed = await withTransaction(async (tx) => {
            // AC-12: serialize concurrent revokes for this user BEFORE counting.
            // Locking the `users` row (rather than the `user_role` rows) gives a
            // single, always-present lock target — the rows being counted are
            // exactly the ones a competing call may be deleting.
            const lockedUsers = await tx
                .select({ id: users.id })
                .from(users)
                .where(eq(users.id, userId))
                .for('update');

            if (lockedUsers.length === 0) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, `User '${userId}' not found.`);
            }

            const heldRoles = await tx
                .select({ role: userRole.role })
                .from(userRole)
                .where(eq(userRole.userId, userId));

            if (!heldRoles.some((held) => held.role === role)) {
                // Idempotent no-op — the hat is not worn, nothing to audit.
                // Reported as `changed: false` so a caller that counts or logs
                // demotions cannot claim one that never happened (a concurrent
                // writer may have removed the hat since the caller's own
                // unlocked pre-check).
                return false;
            }

            if (heldRoles.length <= 1) {
                // The `reason` is what lets a UI recognise THIS refusal without
                // matching on the message — which embeds the subject's UUID and
                // must therefore never be rendered to an operator.
                throw new ServiceError(
                    ServiceErrorCode.VALIDATION_ERROR,
                    `Cannot revoke role '${role}': it is the last role held by user '${userId}'.`,
                    undefined,
                    LAST_ROLE_REVOKE_REASON
                );
            }

            const deleted = await tx
                .delete(userRole)
                .where(and(eq(userRole.userId, userId), eq(userRole.role, role)))
                .returning({ role: userRole.role });

            if (deleted.length === 0) {
                // `changed` is OBSERVED from the DELETE, never inferred from the
                // read above. The `FOR UPDATE` lock only serialises callers that
                // go through this function; any other path that removes the row
                // (a manual repair like the backfill runbook's Step 4, a future
                // admin tool, a cascade) makes this DELETE a no-op while the
                // pre-delete read still said the hat was held. Auditing and
                // reporting `changed: true` there would assert a revoke that
                // never happened — the exact claim `changed` exists to prevent.
                return false;
            }

            await insertAuditRow({
                tx,
                userId,
                role,
                action: RoleGrantActionEnum.REVOKE,
                by: revokedBy,
                reason
            });

            return true;
        }, ctx?.tx);

        return { data: { changed } };
    } catch (error) {
        return toErrorOutput({ error, ctx, fallbackMessage: 'Failed to revoke role' });
    }
};

/**
 * Reads the set of roles a user currently holds.
 *
 * Exposed alongside the write primitives because every consumer of the dropped
 * `users.role` column needs a replacement read path, and duplicating this
 * two-line query across services is exactly how the three divergent permission
 * resolvers in §5.2 came to exist.
 *
 * This read is UNCACHED, deliberately. `actorMiddleware` calls it on every
 * authenticated request, so a process-local cache was tried (60s TTL,
 * invalidated by `grantRole`/`revokeRole`) and REMOVED again, because it was
 * not correct:
 *
 * - `withTransaction` short-circuits on an existing transaction, so when a
 *   caller passes `ctx.tx` the write primitives return with that transaction
 *   still OPEN. Invalidating there fires BEFORE the commit, and a concurrent
 *   non-transactional read (this middleware, on every request) immediately
 *   re-populates the entry with the pre-commit set. Nothing invalidates after
 *   the commit, so the stale set is served for the whole TTL. Four callers
 *   pass `ctx.tx` today, including the `archive-abandoned-drafts` cron — where
 *   the symptom is a privilege RETAINED past a revoke.
 * - Stale roles after a grant is the exact failure mode for which Better
 *   Auth's `customSession` was rejected in HOS-296 OQ-4. Trading it back in to
 *   save one indexed `SELECT` inverts that decision.
 *
 * Do NOT reintroduce a cache without first solving POST-COMMIT invalidation
 * (a transaction-completion hook, or invalidation owned by the outermost
 * caller). The per-request cost of this query is an explicit, measurable
 * decision — not an accident.
 *
 * @param params.userId - User whose hats to read.
 * @param params.ctx - Optional caller context; `ctx.tx` reads through their
 *   transaction.
 * @returns Every role held by the user, in no guaranteed order. Empty when the
 *   user does not exist.
 */
export const getUserRoles = async (params: {
    userId: string;
    ctx?: ServiceContext;
}): Promise<readonly RoleEnum[]> => {
    const { userId, ctx } = params;

    const db = ctx?.tx ?? getDb();

    const rows = await db
        .select({ role: userRole.role })
        .from(userRole)
        .where(eq(userRole.userId, userId));

    // `role_enum` is generated from `RoleEnum` (see enums.dbschema.ts), but
    // Drizzle widens the pgEnum tuple to `string`, so the narrowing is ours to
    // assert rather than something the column type carries.
    return rows.map((row) => row.role as RoleEnum);
};

/**
 * Reads a user's held roles together with the grant metadata the admin panel
 * needs to display them (HOS-296 §6.5 / §8).
 *
 * Distinct from {@link getUserRoles}, which answers the hot-path question
 * "which hats does this actor wear" on every request and must stay a single
 * indexed lookup. This one is the cold-path admin read: it additionally
 * resolves WHEN each hat was granted and BY WHOM, which is the stated
 * mitigation for R-1 — an operator cannot administer a set of hats they
 * cannot see the provenance of.
 *
 * The granter's display name comes from a LEFT join, so a grant whose granting
 * account was since deleted (the FK is `ON DELETE SET NULL`) still returns its
 * row with `grantedByName: null` rather than disappearing from the history.
 *
 * @param params.userId - User whose hats to read.
 * @param params.ctx - Optional caller context; `ctx.tx` reads through their transaction.
 * @returns Every held role, oldest grant first. Empty when the user does not exist.
 */
export const getUserRoleGrants = async (params: {
    userId: string;
    ctx?: ServiceContext;
}): Promise<readonly UserRoleGrant[]> => {
    const { userId, ctx } = params;
    const db = ctx?.tx ?? getDb();

    const rows = await db
        .select({
            role: userRole.role,
            grantedAt: userRole.grantedAt,
            grantedBy: userRole.grantedBy,
            grantedByName: users.displayName,
            grantReason: userRole.grantReason
        })
        .from(userRole)
        .leftJoin(users, eq(userRole.grantedBy, users.id))
        .where(eq(userRole.userId, userId))
        .orderBy(asc(userRole.grantedAt));

    // `role_enum` is generated from `RoleEnum` (see enums.dbschema.ts), but
    // Drizzle widens the pgEnum tuple to `string`, so the narrowing is ours to
    // assert rather than something the column type carries.
    return rows.map((row) => ({
        role: row.role as RoleEnum,
        grantedAt: row.grantedAt,
        grantedBy: row.grantedBy,
        grantedByName: row.grantedByName ?? null,
        grantReason: row.grantReason
    }));
};
