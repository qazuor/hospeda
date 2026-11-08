/**
 * listing-policies-lock.ts
 *
 * The stored side of the `policies` merge (HOS-2060), read under a row lock.
 *
 * The capacity and services pages of the owner editor each send their own
 * `policies` PATCH. If the update hook merged over an unlocked read, two
 * concurrent saves would both read the same stored object and the second
 * write would erase the first one's key. Reading with `SELECT ... FOR UPDATE`
 * inside the update transaction makes the read-merge-write atomic: the second
 * save blocks on the row until the first commits, then merges over its result.
 *
 * The lock is taken only when the body actually sends `policies`, so updates
 * that do not touch the house rules pay nothing.
 */

import { listingPoliciesModel } from '@repo/db';
import type { ServiceContext } from '../../types';
import type { PoliciesVertical } from './listing-policies-write';

/**
 * Resolves the stored `policies` to merge a PATCH over.
 *
 * @param args.vertical - The listing vertical.
 * @param args.listingId - The id being updated (undefined when unknown).
 * @param args.payload - The validated update body.
 * @param args.ctx - The service context; its `tx` is the update transaction.
 * @param args.fallback - The value from the hook's unlocked pre-read.
 * @returns `{ stored }`: the locked read when the body sends `policies` inside
 *   a transaction, otherwise `fallback` (nothing to merge, or no transaction
 *   to hold a lock in).
 */
export async function readStoredPoliciesForMerge({
    vertical,
    listingId,
    payload,
    ctx,
    fallback
}: {
    readonly vertical: PoliciesVertical;
    readonly listingId: string | undefined;
    readonly payload: Readonly<Record<string, unknown>>;
    readonly ctx: ServiceContext | undefined;
    readonly fallback: Readonly<Record<string, unknown>> | null | undefined;
}): Promise<{ readonly stored: Readonly<Record<string, unknown>> | null | undefined }> {
    const sendsPolicies = Object.hasOwn(payload, 'policies') && payload.policies !== undefined;
    if (!sendsPolicies || !listingId || !ctx?.tx) return { stored: fallback };
    const locked = await listingPoliciesModel.readForUpdate({
        tx: ctx.tx,
        vertical,
        listingId
    });
    return { stored: locked.found ? locked.policies : fallback };
}
