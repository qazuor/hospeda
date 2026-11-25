/**
 * @file owner-list-vertical.ts
 * @description The two owner lists of `/mi-cuenta/comercio` (HOS-2559):
 * «Comer y salir» (venues) and «Experiencias» (experiences). Each one is the
 * same page filtered by one vertical, selected with the `vertical` query
 * parameter (`/mi-cuenta/comercio/?vertical=venue|experience`, spec HOS-2414
 * A-4, D20).
 *
 * This module is the one place that knows:
 *
 * - the path of each list (the sidebar areas, the user-menu shortcuts, the
 *   discovery doors and the editors' way back all read {@link ownerListPath});
 * - the `activeSection` key of each list ({@link ownerListSectionKey}), which
 *   the list page and the editors under `/mi-cuenta/comercio/<vertical>/...`
 *   pass so the matching area is marked active;
 * - who may open each list: the vertical's own-edit permission
 *   (`VENUE_EDIT_OWN` / `EXPERIENCE_EDIT_OWN`), read from the EFFECTIVE
 *   permissions, never from a role.
 *
 * Pure: no `Astro`, no session read. Verticals are looked up in records, never
 * compared against a literal (G-FAC-05).
 *
 * @module lib/listing/owner-list-vertical
 */

import type { VenueOrExperience } from '@repo/schemas';
import { z } from 'zod';
import { canAccessPublisherArea } from '@/lib/account/publisher-access';

/** The two owner lists, in the owner's order (venues first). */
export const OWNER_LIST_VERTICALS = [
    'venue',
    'experience'
] as const satisfies readonly VenueOrExperience[];

/** Query parameter that selects the list. */
export const OWNER_LIST_VERTICAL_PARAM = 'vertical';

/** Path of the shared list page, without the query. */
export const OWNER_LIST_BASE_PATH = 'mi-cuenta/comercio';

/** Validates the `vertical` query parameter. */
export const OwnerListVerticalSchema = z.enum(OWNER_LIST_VERTICALS);

/**
 * i18n key of each list's name («Mis locales» / «Mis experiencias»): the
 * sidebar entry, the page heading and the editors' breadcrumb.
 */
export const OWNER_LIST_LABEL_KEYS: Readonly<Record<VenueOrExperience, string>> = {
    venue: 'account.nav.myVenues',
    experience: 'account.nav.myExperiences'
};

/**
 * Path (under the locale) of one vertical's list, query included.
 * `buildUrl` places the trailing slash before the query.
 *
 * @param input - Options object.
 * @param input.vertical - The list's vertical.
 * @returns E.g. `mi-cuenta/comercio?vertical=venue`.
 */
export function ownerListPath({ vertical }: { readonly vertical: VenueOrExperience }): string {
    return `${OWNER_LIST_BASE_PATH}?${OWNER_LIST_VERTICAL_PARAM}=${vertical}`;
}

/**
 * The `activeSection` key of one vertical's list. The list page and every
 * editor page of that vertical pass it to `AccountLayout`.
 *
 * @param input - Options object.
 * @param input.vertical - The list's vertical.
 * @returns E.g. `comercio-venue`.
 */
export function ownerListSectionKey({
    vertical
}: {
    readonly vertical: VenueOrExperience;
}): string {
    return `comercio-${vertical}`;
}

/**
 * Parses the raw `vertical` query value.
 *
 * @param input - Options object.
 * @param input.value - The raw value (`null` when absent).
 * @returns The vertical, or `null` when absent or unknown.
 */
export function parseOwnerListVertical({
    value
}: {
    readonly value: string | null;
}): VenueOrExperience | null {
    const parsed = OwnerListVerticalSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

/**
 * The lists a person may open, in {@link OWNER_LIST_VERTICALS} order.
 *
 * @param input - Options object.
 * @param input.permissions - The person's EFFECTIVE permissions.
 * @returns The granted verticals; empty when neither is granted.
 */
export function resolveOwnerListVerticals({
    permissions
}: {
    readonly permissions: readonly string[];
}): readonly VenueOrExperience[] {
    return OWNER_LIST_VERTICALS.filter((vertical) =>
        canAccessPublisherArea({ area: vertical, permissions })
    );
}

/** What the list page does with a request. */
export type OwnerListPageDecision =
    /** Neither vertical is granted: leave the page. */
    | { readonly kind: 'forbidden' }
    /** The URL names no list, or one the person cannot open: go to this one. */
    | { readonly kind: 'redirect'; readonly vertical: VenueOrExperience }
    /** Render this list. */
    | { readonly kind: 'render'; readonly vertical: VenueOrExperience };

/**
 * Decides which list the page renders.
 *
 * - No granted vertical → `forbidden`.
 * - The requested vertical is granted → `render` it.
 * - Otherwise (absent, unknown, or not granted) → `redirect` to the first
 *   granted one, so the URL, the sidebar and the content always agree.
 *
 * @param input - Options object.
 * @param input.requested - The raw `vertical` query value.
 * @param input.permissions - The person's EFFECTIVE permissions.
 * @returns See {@link OwnerListPageDecision}.
 */
export function resolveOwnerListPage({
    requested,
    permissions
}: {
    readonly requested: string | null;
    readonly permissions: readonly string[];
}): OwnerListPageDecision {
    const granted = resolveOwnerListVerticals({ permissions });
    const [first] = granted;
    if (!first) return { kind: 'forbidden' };
    const vertical = parseOwnerListVertical({ value: requested });
    if (vertical && granted.includes(vertical)) return { kind: 'render', vertical };
    return { kind: 'redirect', vertical: first };
}

/**
 * Keeps only the listings of one vertical, in their original order.
 *
 * @param input - Options object.
 * @param input.listings - The owner's listings across both verticals.
 * @param input.vertical - The list's vertical.
 * @returns The listings of that vertical.
 */
export function filterOwnerListingsByVertical<
    TListing extends { readonly vertical: VenueOrExperience }
>({
    listings,
    vertical
}: {
    readonly listings: readonly TListing[];
    readonly vertical: VenueOrExperience;
}): readonly TListing[] {
    return listings.filter((listing) => listing.vertical === vertical);
}
