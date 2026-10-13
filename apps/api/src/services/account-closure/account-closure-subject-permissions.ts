import type { DrizzleClient } from '@repo/db';
import type { PermissionEnum } from '@repo/schemas';
import { getUserRoles } from '@repo/service-core';
import { resolveEffectivePermissions } from '../../middlewares/actor';

/** `error.reason` of the 403 when the subject holds a permission the actor lacks (Coord-235). */
export const SUBJECT_OUTRANKS_ACTOR = 'SUBJECT_OUTRANKS_ACTOR' as const;

/**
 * Reads the subject's effective permissions through the ONE resolver the actor
 * middleware uses (`resolveEffectivePermissions`, Coord-240): the SUPER_ADMIN
 * short-circuit, the role union and the grant/deny overrides, never a second
 * algebra. The held roles are read inside the closure transaction; the role
 * union and the overrides are read with `read: 'uncached'`, straight from the
 * database on the shared pool, before anything is decided, and a failed read
 * throws (the closure aborts) instead of degrading to a smaller set.
 *
 * Residue: those two reads run outside the transaction, and a role or permission
 * granted to the subject between them and the commit is not seen; the account
 * row is locked, but a grant does not touch it.
 *
 * @param input.tx - The closure transaction (the account row is already locked).
 * @param input.userId - The subject of action 24.
 * @returns `{ permissions }`, the subject's effective set.
 */
export async function readSubjectEffectivePermissions(input: {
    readonly tx: DrizzleClient;
    readonly userId: string;
}): Promise<{ readonly permissions: ReadonlySet<string> }> {
    const roles = await getUserRoles({ userId: input.userId, ctx: { tx: input.tx } });
    const { permissions } = await resolveEffectivePermissions({
        userId: input.userId,
        roles,
        read: 'uncached'
    });
    return { permissions: new Set<string>(permissions) };
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
