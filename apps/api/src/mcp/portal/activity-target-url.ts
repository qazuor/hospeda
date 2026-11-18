/**
 * @file activity-target-url.ts
 * @description The portal link of an assistant activity target (HOS-2348,
 * spec HOS-2335 §5.6 and §6.9).
 *
 * The shared activity reader (`McpActivityService`) takes a `buildTargetUrl`
 * port because the portal route map lives in the API (D-1). This module is
 * that port's implementation: a listing links to its editor, a conversation to
 * its inquiry thread, and anything else gets no link.
 *
 * The reader only calls it for a target the row's actor still owns and that
 * is still live (AC-C47), so this module decides WHERE a link points, never
 * WHETHER the actor may see it. Pure: the site URL comes in as an argument.
 */

import { LISTING_VERTICALS, type ListingVertical } from '@repo/schemas';
import { buildPortalUrl } from './build-portal-url';
import type { PortalDestination } from './portal-routes';

/** Target type of an inquiry in the audit rows (`auditTarget` of the inquiry tools). */
const CONVERSATION_TARGET_TYPE = 'conversation';

/** Arguments of {@link buildActivityTargetUrl}. RO-RO. */
export interface BuildActivityTargetUrlArgs {
    /** The audited target: its type and id as the binder recorded them. */
    readonly target: { readonly type: string; readonly id: string };
    /** Public base URL of the web app (`HOSPEDA_SITE_URL`). */
    readonly siteUrl: string;
}

/** Narrows a target type to a listing vertical. */
function toListingVertical(type: string): ListingVertical | undefined {
    return LISTING_VERTICALS.find((vertical) => vertical === type);
}

/**
 * The portal destination of a target, or `undefined` when no page shows it.
 *
 * @param args.target - The audited target
 * @returns The destination
 */
export function activityTargetDestination({
    target
}: Pick<BuildActivityTargetUrlArgs, 'target'>): PortalDestination | undefined {
    const vertical = toListingVertical(target.type);
    if (vertical !== undefined) {
        return { kind: 'listingEditor', vertical, id: target.id };
    }
    if (target.type === CONVERSATION_TARGET_TYPE) {
        return { kind: 'inquiry', conversationId: target.id };
    }
    return undefined;
}

/**
 * The absolute portal URL of an activity target. Never throws: a target with
 * no page, or a URL that cannot be built (an empty site URL, an empty id),
 * yields `undefined`, and the item then shows no link.
 *
 * @param args - The target and the site URL
 * @returns The URL, or `undefined`
 *
 * @example
 * ```typescript
 * buildActivityTargetUrl({
 *     target: { type: 'accommodation', id },
 *     siteUrl: env.HOSPEDA_SITE_URL
 * }); // 'https://hospeda.com.ar/es/mi-cuenta/propiedades/<id>/editar/'
 * ```
 */
export function buildActivityTargetUrl({
    target,
    siteUrl
}: BuildActivityTargetUrlArgs): string | undefined {
    const destination = activityTargetDestination({ target });
    if (destination === undefined) return undefined;
    try {
        return buildPortalUrl({ destination, siteUrl });
    } catch {
        return undefined;
    }
}
