/**
 * Who has a listing AI assistant, and so a reason to see what is said about it
 * (HOS-2602).
 *
 * Every accommodation, venue and experience listing carries an AI chat
 * assistant, and the weekly digest of the questions it could not answer goes
 * to the owner of the listing (`ai-questions-weekly-digest` cron, entity types
 * `accommodation` / `venue` / `experience`). A pure tourist, an editor or a
 * partner owns no such listing, so the Preferences toggle for that digest
 * would only talk to them about «the assistant of your listings».
 *
 * The decision reuses the shared business-vertical rule
 * (`resolveBusinessVerticals` from `@repo/schemas`), the same one the avatar
 * menu's «Administración» shortcuts and the sidebar's «Asistentes de IA» entry
 * read. It takes the EFFECTIVE permissions, never a role.
 *
 * @module lib/account/listing-assistant
 */

import { type BusinessVerticalId, resolveBusinessVerticals } from '@repo/schemas';

/** The business verticals whose listings carry an AI chat assistant. */
export const LISTING_ASSISTANT_VERTICALS = [
    'accommodations',
    'venues',
    'experiences'
] as const satisfies readonly BusinessVerticalId[];

/**
 * Whether the account can own a listing that has an AI chat assistant.
 *
 * @param input.permissions - The session's EFFECTIVE permissions
 *   (`SessionUser.permissions`: role ∪ grants, minus denies).
 * @returns `{ hasAssistant }`: `true` when the account has the accommodation,
 *   venue or experience vertical.
 */
export function hasListingAssistant({ permissions }: { readonly permissions: readonly string[] }): {
    readonly hasAssistant: boolean;
} {
    const { verticals } = resolveBusinessVerticals({
        permissions,
        ownsHostTradeListing: false,
        ownsPartner: false
    });
    const assistantVerticals: readonly BusinessVerticalId[] = LISTING_ASSISTANT_VERTICALS;
    return { hasAssistant: verticals.some((vertical) => assistantVerticals.includes(vertical)) };
}
