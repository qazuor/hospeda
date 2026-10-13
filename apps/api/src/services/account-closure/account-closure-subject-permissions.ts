import { type DrizzleClient, sql } from '@repo/db';
import type { PermissionEnum } from '@repo/schemas';

/** `error.reason` of the 403 when the subject holds a permission the actor lacks (Coord-235). */
export const SUBJECT_OUTRANKS_ACTOR = 'SUBJECT_OUTRANKS_ACTOR' as const;

/**
 * Reads the subject's effective permissions inside the caller's transaction, with the
 * same set algebra the actor middleware applies (`apps/api/src/middlewares/actor.ts`):
 * the union of the `role_permission` rows of every role it holds (`user_role`), plus its
 * per-user grants, minus its per-user denies (`user_permission`, deny wins). It never
 * compares a role: the roles only select their permission rows.
 *
 * @param input.tx - The closure transaction (the account row is already locked).
 * @param input.userId - The subject of action 24.
 * @returns `{ permissions }`, the subject's effective set.
 */
export async function readSubjectEffectivePermissions(input: {
    readonly tx: DrizzleClient;
    readonly userId: string;
}): Promise<{ readonly permissions: ReadonlySet<string> }> {
    const result = await input.tx.execute(sql`
        SELECT DISTINCT granted.permission::text AS permission
        FROM (
            SELECT rp.permission
            FROM user_role ur
            JOIN role_permission rp ON rp.role = ur.role
            WHERE ur.user_id = ${input.userId}
            UNION
            SELECT up.permission
            FROM user_permission up
            WHERE up.user_id = ${input.userId} AND up.effect = 'grant'
        ) AS granted
        WHERE NOT EXISTS (
            SELECT 1 FROM user_permission denied
            WHERE denied.user_id = ${input.userId}
              AND denied.effect = 'deny'
              AND denied.permission = granted.permission
        )`);
    return { permissions: new Set(result.rows.map((row) => String(row.permission))) };
}

/**
 * The permissions the subject holds and the actor does not. Action 24 refuses
 * (403, {@link SUBJECT_OUTRANKS_ACTOR}) whenever this is not empty: support may close
 * a peer or a less privileged account, never one with more power than its own
 * (Coord-235). Fails closed: any single extra permission blocks.
 *
 * @param input.subjectPermissions - The subject's effective set.
 * @param input.actorPermissions - The actor's effective set.
 * @returns `{ missing }`, sorted for stable logs.
 */
export function permissionsActorLacks(input: {
    readonly subjectPermissions: ReadonlySet<string>;
    readonly actorPermissions: readonly PermissionEnum[] | undefined;
}): { readonly missing: readonly string[] } {
    const actor = new Set<string>(input.actorPermissions ?? []);
    const missing = [...input.subjectPermissions].filter((permission) => !actor.has(permission));
    return { missing: missing.sort() };
}
