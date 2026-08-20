import { ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '../types';
import { ServiceError } from '../types';
import { entityNotFoundError } from './not-found';

/**
 * The columns this repo uses to record who owns a row (HOS-706).
 *
 * Deliberately a closed, explicit list rather than a heuristic: `id` is NOT here,
 * because every row has one and including it would classify every owner-less
 * catalog row (amenity, destination, partner, ...) as "owned by somebody else"
 * and turn an ordinary permission refusal into a 404.
 *
 * Kept in sync by intent with the ownership comparison the API-side guard
 * polices (`apps/api/test/utils/existence-disclosure.guard.test.ts`), which
 * recognises the same four spellings minus `createdById` — an audit column, not
 * an ownership one: a staff member who created a row on someone's behalf does
 * not own it.
 */
export const WRITE_PATH_OWNER_FIELDS = ['ownerId', 'authorId', 'userId'] as const;

/**
 * Reads the owner id off a fetched row, or `undefined` when the entity has no
 * ownership dimension at all.
 *
 * `undefined` and "owned by the actor" are treated differently on purpose — see
 * {@link maskForeignRowRefusal}.
 *
 * @param params - Parameters object.
 * @param params.entity - The row fetched from the database.
 * @returns The owner's user id, or `undefined` when the row records no owner.
 */
export const resolveEntityOwnerId = ({
    entity
}: {
    readonly entity: unknown;
}): string | undefined => {
    if (!entity || typeof entity !== 'object') {
        return undefined;
    }
    const row = entity as Record<string, unknown>;
    for (const field of WRITE_PATH_OWNER_FIELDS) {
        const value = row[field];
        if (typeof value === 'string' && value.length > 0) {
            return value;
        }
    }
    return undefined;
};

/**
 * Converts a write-path permission refusal on a FOREIGN row into the canonical
 * not-found error, so the refusal stops confirming that the id is real (HOS-706).
 *
 * The authorisation boundary is unchanged: the caller is refused either way.
 * Only what the refusal discloses changes — a caller holding `*_UPDATE_OWN` used
 * to learn from the 403 that the id existed, while an invented id answered 404.
 *
 * Three cases pass through UNMASKED, each for a different reason:
 *
 * 1. **Not a FORBIDDEN `ServiceError`** — an `UNAUTHORIZED` (no actor) belongs to
 *    an earlier tier of the contract, and a non-`ServiceError` is a bug, not a
 *    policy decision. Neither may be rewritten into a 404.
 * 2. **The row records no owner** — a catalog entity (amenity, destination,
 *    partner, ...) has no ownership dimension, so its 403 discloses nothing an
 *    admin-tier caller does not already know. Masking it would only make the
 *    admin panel lie about why the write failed.
 * 3. **The actor OWNS the row** — then the refusal is about the row's STATE, not
 *    its existence (`'Cannot edit this accommodation while the owner subscription
 *    is paused'`, `'Permission denied to update a published event'`). The owner
 *    already knows the row exists; answering 404 would hide a real, actionable
 *    reason. This is also why the mask cannot simply rewrite every 403.
 *
 * @param params - Parameters object.
 * @param params.error - Whatever the permission check threw.
 * @param params.actor - The actor the check refused.
 * @param params.entity - The row that was fetched before the check ran.
 * @param params.entityName - The service's `entityName`, used to compose the 404.
 * @returns The error to throw: the original one, or the canonical not-found error.
 */
export const maskForeignRowRefusal = ({
    error,
    actor,
    entity,
    entityName
}: {
    readonly error: unknown;
    readonly actor: Actor | undefined;
    readonly entity: unknown;
    readonly entityName: string;
}): unknown => {
    if (!(error instanceof ServiceError) || error.code !== ServiceErrorCode.FORBIDDEN) {
        return error;
    }
    const ownerId = resolveEntityOwnerId({ entity });
    if (ownerId === undefined || ownerId === actor?.id) {
        return error;
    }
    return entityNotFoundError({ entityName });
};
