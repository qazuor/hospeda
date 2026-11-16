/**
 * Single entry point that applies an accommodation OWNER's paid-field grants to
 * public accommodation payloads (HOS-1809).
 *
 * Every public accommodation reader goes through {@link projectPublicAccommodations}.
 * Which fields are paid is declared by the accommodation catalog (the field
 * traits of `basicInfo` and `photos`) and resolved by `resolveListingSections`;
 * `projectPublicListing` removes them. Nothing here reads the requesting user:
 * these payloads are shared-cached with no auth in the cache key, so anything
 * derived from the viewer would be computed once and replayed to everyone
 * (HOS-19, HOS-353).
 *
 * Three things are not "remove this field" and stay explicit steps after the
 * projector, each with a test:
 * - `isVerified` is forced to `false` (the public schema requires the key).
 * - `media.videos` (the copy HOS-372 splices from the `videos` column) is emptied
 *   and video URLs inside `description` and every locale of `descriptionI18n` are stripped.
 * - `contactInfo.whatsapp` never leaves, and `hasWhatsapp` is derived from it.
 *
 * Public occupancy is NOT projected by the `calendar` section (owner decision
 * Q-2): the availability read is a different route and keeps showing data.
 *
 * @module utils/public-accommodation-projection
 */

import { EntitlementKeyEnum, VerticalEnum } from '@repo/schemas';
import { resolveListingSections } from '@repo/verticals';
import { stripVideoEmbeds } from '../lib/content-detection.js';
import {
    deniedSet,
    projectPublicListing,
    readOwnerEffectiveSets
} from './public-listing-projector';

/** An accommodation row as the public readers hold it before serialization. */
export type PublicAccommodationRecord = object & { readonly ownerId?: unknown };

type SectionStates = ReturnType<typeof resolveListingSections>['sections'];

function ownerIdOf(listing: PublicAccommodationRecord): string | undefined {
    return typeof listing.ownerId === 'string' ? listing.ownerId : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasWhatsapp(contactInfo: unknown): boolean {
    if (!isPlainObject(contactInfo)) return false;
    const whatsapp = contactInfo.whatsapp;
    return typeof whatsapp === 'string' && whatsapp.trim().length > 0;
}

/** Steps that are not a field removal; see the module header. */
function applyNonRemovalSteps(args: {
    readonly projected: Record<string, unknown>;
    readonly original: Record<string, unknown>;
    readonly states: SectionStates;
}): Record<string, unknown> {
    const { projected, original, states } = args;
    const result: Record<string, unknown> = { ...projected };
    result.hasWhatsapp = hasWhatsapp(original.contactInfo);
    if (states.get('basicInfo')?.traits.get('verification') !== 'available') {
        result.isVerified = false;
    }
    if (states.get('photos')?.traits.get('videos') !== 'available') {
        if (typeof result.description === 'string') {
            result.description = stripVideoEmbeds(result.description);
        }
        // HOS-2191: the translated descriptions carry the same embeds, one per locale.
        const descriptionI18n = result.descriptionI18n;
        if (isPlainObject(descriptionI18n)) {
            result.descriptionI18n = Object.fromEntries(
                Object.entries(descriptionI18n).map(([locale, text]) => [
                    locale,
                    typeof text === 'string' ? stripVideoEmbeds(text) : text
                ])
            );
        }
        const media = result.media;
        if (isPlainObject(media) && 'videos' in media) result.media = { ...media, videos: [] };
    }
    const contactInfo = result.contactInfo;
    if (isPlainObject(contactInfo)) {
        const { whatsapp: _whatsapp, ...remaining } = contactInfo;
        result.contactInfo = remaining;
    }
    return result;
}

/**
 * Applies the owner-effective public-field gating to a page of accommodations
 * and reports, from the same single read, whether each owner offers the AI chat.
 *
 * Reads the effective set once per distinct owner. An owner whose set cannot be
 * read, or a row without an owner, is treated as holding nothing (fail closed).
 *
 * @param args.listings - Accommodation rows of one response page.
 * @returns The rows (same order, gated fields applied) and the owner-level AI chat
 *   flag (`hasAiChat` on public cards; a capability of the owner, not a section).
 */
export async function projectPublicAccommodationPage<T extends PublicAccommodationRecord>(args: {
    readonly listings: readonly T[];
}): Promise<{ readonly items: T[]; readonly aiChatByOwner: ReadonlyMap<string, boolean> }> {
    const ownerIds = args.listings
        .map(ownerIdOf)
        .filter((ownerId): ownerId is string => ownerId !== undefined);
    const effectiveByOwner = await readOwnerEffectiveSets({
        vertical: 'accommodation',
        ownerIds
    });
    const aiChatByOwner = new Map<string, boolean>(
        [...effectiveByOwner].map(([ownerId, effective]) => [
            ownerId,
            (effective.entitlements.get({
                key: EntitlementKeyEnum.AI_CHAT,
                userId: ownerId,
                vertical: VerticalEnum.ACCOMMODATION
            }) ?? 0) > 0
        ])
    );
    const items = args.listings.map((listing) => {
        const ownerId = ownerIdOf(listing);
        const userId = ownerId ?? '';
        const resolved = resolveListingSections({
            vertical: 'accommodation',
            // Every accommodation section is common to the single `standard` rubro,
            // so the stored business lines do not change what is offered.
            businessLines: [],
            effective:
                (ownerId && effectiveByOwner.get(ownerId)) || deniedSet(userId, 'accommodation'),
            userId
        });
        const original = listing as Record<string, unknown>;
        const projected = projectPublicListing({
            vertical: 'accommodation',
            listing: original,
            states: resolved.sections
        });
        return applyNonRemovalSteps({ projected, original, states: resolved.sections }) as T;
    });
    return { items, aiChatByOwner };
}

/**
 * Applies the owner-effective public-field gating to a page of accommodations.
 *
 * @param args.listings - Accommodation rows of one response page.
 * @returns The same rows, in the same order, with the gated fields applied.
 */
export async function projectPublicAccommodations<T extends PublicAccommodationRecord>(args: {
    readonly listings: readonly T[];
}): Promise<T[]> {
    return (await projectPublicAccommodationPage(args)).items;
}
