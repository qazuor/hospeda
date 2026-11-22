/**
 * Venue WhatsApp contact: what the public page may publish, and what a signed-in
 * visitor may be told (HOS-2256 section 7.8).
 *
 * The number lives in `contact_info.whatsapp` (JSONB) and the owner chooses who
 * may see it in `whatsapp_visibility`. Two helpers, one rule:
 *
 * - {@link resolveVenuePublicWhatsapp} (pure) decides what the PUBLIC, edge-cached
 *   payload carries. The number is included ONLY for `PUBLIC`; for
 *   `LOGGED_IN_ONLY` the payload says "there is a button" and nothing else, and
 *   a missing number or a missing choice (`null`, "not decided") yields nothing.
 *   `null` reads as hidden on purpose: it is what every listing did before the
 *   setting existed, so promoting it changes nothing until an owner opts in.
 * - {@link getVenueWhatsappForViewer} backs the protected endpoint a signed-in
 *   visitor calls. It never answers for an unpublished, deleted or unknown
 *   venue (all NOT_FOUND, indistinguishable), and never returns a number for a
 *   venue whose owner has not chosen a WhatsApp visibility.
 *
 * `VenuePublicContactInfoSchema` is untouched by design: it stays an allow-list
 * that never names the number (HOS-1076 / HOS-2042).
 *
 * @module services/venue/venue.whatsapp
 */

import type { VenueModel } from '@repo/db';
import {
    PublicationStatusEnum,
    ServiceErrorCode,
    type VenuePublicWhatsapp,
    VenueWhatsappVisibilityEnum
} from '@repo/schemas';
import type { ServiceOutput } from '../../types';
import { buildEntityNotFoundMessage } from '../../utils/not-found';

/** Reads a non-empty trimmed WhatsApp number out of a `contact_info` blob, or `null`. */
export function readVenueWhatsappNumber({
    contactInfo
}: {
    readonly contactInfo: unknown;
}): string | null {
    if (contactInfo === null || typeof contactInfo !== 'object') return null;
    const raw = (contactInfo as { whatsapp?: unknown }).whatsapp;
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
}

/**
 * The WhatsApp visibility a write must add so a WhatsApp number never lands undecided
 * (HOS-2557, owner decision: the default is `PUBLIC`).
 *
 * Single source for every write path (editor, API, MCP tools). It adds the default
 * only when the write sets a number AND carries no WhatsApp visibility AND nothing is stored;
 * an explicit choice (including an explicit `null`) and a stored choice are never
 * overridden.
 *
 * @param params.contactInfo - The `contact_info` of the write, if it carries one.
 * @param params.requested - The WhatsApp visibility the write requests (`undefined` when absent).
 * @param params.stored - The stored WhatsApp visibility; `null` for a create or an undecided row.
 * @returns `{ whatsappVisibility: PUBLIC }` to merge into the patch, or `{}`.
 */
export function resolveDefaultWhatsappVisibility({
    contactInfo,
    requested,
    stored
}: {
    readonly contactInfo: unknown;
    readonly requested: VenueWhatsappVisibilityEnum | null | undefined;
    readonly stored: VenueWhatsappVisibilityEnum | null | undefined;
}): { readonly whatsappVisibility?: VenueWhatsappVisibilityEnum } {
    if (requested !== undefined || (stored ?? null) !== null) return {};
    if (readVenueWhatsappNumber({ contactInfo }) === null) return {};
    return { whatsappVisibility: VenueWhatsappVisibilityEnum.PUBLIC };
}

/**
 * Decides the WhatsApp block of the PUBLIC venue payload.
 *
 * @param params.contactInfo - The stored `contact_info` blob.
 * @param params.mode - The owner's choice, or `null`/`undefined` when undecided.
 * @returns `{ mode: 'PUBLIC', number }`, `{ mode: 'LOGGED_IN_ONLY' }`, or `undefined` (no button).
 */
export function resolveVenuePublicWhatsapp({
    contactInfo,
    mode
}: {
    readonly contactInfo: unknown;
    readonly mode: VenueWhatsappVisibilityEnum | null | undefined;
}): VenuePublicWhatsapp | undefined {
    const number = readVenueWhatsappNumber({ contactInfo });
    if (number === null) return undefined;
    if (mode === VenueWhatsappVisibilityEnum.PUBLIC) {
        return { mode: 'PUBLIC', number };
    }
    if (mode === VenueWhatsappVisibilityEnum.LOGGED_IN_ONLY) {
        return { mode: 'LOGGED_IN_ONLY' };
    }
    return undefined;
}

/**
 * Returns the number to a SIGNED-IN visitor of a published venue.
 *
 * The caller (the protected route) has already rejected guests with 401. Every
 * other refusal is the same NOT_FOUND, so the answer is no oracle for "this id
 * exists but is a draft".
 *
 * @param model - VenueModel instance.
 * @param params.venueId - The venue id.
 * @returns `{ number }`, with `number: null` when the owner has not opted in or stores no number.
 */
export async function getVenueWhatsappForViewer(
    model: VenueModel,
    { venueId }: { readonly venueId: string }
): Promise<ServiceOutput<{ readonly number: string | null }>> {
    const venue = await model.findOne({ id: venueId });
    if (!venue || venue.deletedAt || venue.publicationStatus !== PublicationStatusEnum.PUBLISHED) {
        return {
            error: {
                code: ServiceErrorCode.NOT_FOUND,
                message: buildEntityNotFoundMessage({ entityName: 'venue' })
            }
        };
    }
    const exposed = resolveVenuePublicWhatsapp({
        contactInfo: venue.contactInfo,
        mode: venue.whatsappVisibility as VenueWhatsappVisibilityEnum | null | undefined
    });
    const number = readVenueWhatsappNumber({ contactInfo: venue.contactInfo });
    return { data: { number: exposed && number ? number : null } };
}
