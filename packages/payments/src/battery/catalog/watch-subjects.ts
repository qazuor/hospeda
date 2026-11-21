/**
 * What the battery's own subjects look like: the reference they carry, the reason the payer page
 * shows, and how a measurement reads its per-deployment settings (HOS-1512).
 *
 * @module battery/catalog/watch-subjects
 */
import type { WatchContext } from '../types';

/**
 * Prefix of the `external_reference` of every authorization the battery creates. The re-reads of
 * real objects skip it, so "the most recent real authorizations" are never the battery's own.
 */
export const WATCH_REFERENCE_PREFIX = 'hospeda-watch-';

/** The `reason` of every authorization the battery creates. */
export const WATCH_REASON = 'Hospeda provider watch (cancelled in the same run)';

/**
 * The reference of one authorization a measurement creates: unique per run and per use.
 *
 * @param args.ctx - The measurement's context
 * @param args.use - What the authorization is for (`lifecycle`, `duplicate`...)
 * @returns The reference
 */
export function watchReference(args: { readonly ctx: WatchContext; readonly use: string }): string {
    return `${WATCH_REFERENCE_PREFIX}${args.ctx.runId}-${args.use}`;
}

/**
 * Whether a reference is one the battery wrote.
 *
 * @param reference - The `external_reference` read from the provider
 */
export function isWatchReference(reference: unknown): boolean {
    return typeof reference === 'string' && reference.startsWith(WATCH_REFERENCE_PREFIX);
}

/**
 * The settings a creating measurement needs, or an error naming what is missing. The run then
 * fails loudly instead of measuring nothing and reporting green.
 *
 * @param ctx - The measurement's context
 * @returns The payer email and return URL
 * @throws {Error} When either is not configured
 */
export function requireCreationSettings(ctx: WatchContext): {
    readonly payerEmail: string;
    readonly returnUrl: string;
} {
    const { payerEmail, returnUrl } = ctx.settings;
    if (!payerEmail) {
        throw new Error('No payer email is configured for the watch battery: nothing was created');
    }
    if (!returnUrl) {
        throw new Error('No return URL is configured for the watch battery: nothing was created');
    }
    return { payerEmail, returnUrl };
}
