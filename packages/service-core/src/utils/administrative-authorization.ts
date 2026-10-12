/**
 * Explicit, scoped signal that an administrative action authorized a service
 * call (ACC:15, HOS-1493).
 *
 * Action 15 ("edit the content of somebody else's listing") is authorized by
 * the API's listing-access chain (V5 step 3, the subject being the listing's
 * owner) — NEVER inferred from the actor's permissions in the service. Holding
 * `LISTING_FOREIGN_CONTENT_EDIT` alone opens nothing here: the route that ran
 * step 3 wraps its service call in {@link runWithAdministrativeAuthorization},
 * naming the action and the subject it authorized, and only calls inside that
 * scope see it.
 *
 * The permission hooks do not receive the service context, so the signal
 * travels through an `AsyncLocalStorage` scope rather than `ctx`. The scope is
 * bound to the SUBJECT (the owner) step 3 resolved: a write on a listing of a
 * different owner is not covered.
 *
 * @module utils/administrative-authorization
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { PermissionEnum } from '@repo/schemas';
import type { Actor } from '../types';
import { hasPermission } from './permission';

/** An administrative action a route authorized, bound to its subject. */
export interface AdministrativeAuthorization {
    /** The catalog action step 3 permitted. Only action 15 exists here today. */
    readonly action: 'ACC_15';
    /** The subject step 3 resolved: the owner of the listing. */
    readonly subjectId: string;
}

const storage = new AsyncLocalStorage<AdministrativeAuthorization>();

/**
 * Runs `run` inside the scope of an administrative authorization. Call it ONLY
 * from a route whose listing-access chain permitted that action on that subject.
 *
 * @param input.authorization - The action and the subject step 3 authorized.
 * @param input.run - The service call the authorization covers.
 * @returns Whatever `run` returns.
 */
export function runWithAdministrativeAuthorization<T>(input: {
    readonly authorization: AdministrativeAuthorization;
    readonly run: () => Promise<T>;
}): Promise<T> {
    return storage.run(input.authorization, input.run);
}

/**
 * Reads the administrative authorization of the current scope.
 *
 * @returns `{ authorization }`, `null` outside any authorized scope.
 */
export function resolveAdministrativeAuthorization(): {
    readonly authorization: AdministrativeAuthorization | null;
} {
    return { authorization: storage.getStore() ?? null };
}

/**
 * Whether the current write is action 15 on a listing of `ownerId`: an
 * authorized ACC_15 scope bound to that owner, an actor who is NOT the owner,
 * and the actor still holding action 15's own permission (defense in depth).
 *
 * @param input.actor - The actor of the write.
 * @param input.ownerId - The owner of the listing written.
 * @returns `true` only when all three hold.
 */
export function isAction15AuthorizedFor(input: {
    readonly actor: Actor;
    readonly ownerId?: string | null;
}): boolean {
    const { actor, ownerId } = input;
    if (!ownerId || actor.id === ownerId) return false;
    const { authorization } = resolveAdministrativeAuthorization();
    if (authorization?.action !== 'ACC_15' || authorization.subjectId !== ownerId) return false;
    return hasPermission(actor, PermissionEnum.LISTING_FOREIGN_CONTENT_EDIT);
}
