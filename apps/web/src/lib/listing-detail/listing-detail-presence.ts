/**
 * @file listing-detail-presence.ts
 * @description Whether a slot of a listing detail page has anything to show,
 * so the page only adds a sticky TAB for a slot that renders (HOS-2579 §6.2).
 *
 * Each predicate repeats the self-hide condition of the components the slot
 * holds. A tab that points at an empty slot leads nowhere, which is the one
 * thing `buildListingSectionTabs` promises never to do; the components stay
 * the source of truth for what they render, and the unit tests pin each
 * predicate to the matching component rule.
 */

import type { VenueDailySpecial, VenueEvent, VenueMenuSection } from '@/data/types';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import { hasNightInfoContent, type VenueNightInfoData } from '@/lib/venue/night-info';

/**
 * True when the description slot (3) renders: a summary, a plain description
 * or a non-blank markdown description (`VenueDescription`,
 * `ExperienceDescription`, accommodation `Description`).
 *
 * @param input.summary - Short summary.
 * @param input.descriptionText - Plain description, already rendered to text.
 * @param input.richDescription - Markdown description.
 * @returns Whether the slot has content.
 */
export function hasListingDescription({
    summary,
    descriptionText,
    richDescription
}: {
    readonly summary: string | null | undefined;
    readonly descriptionText: string | null | undefined;
    readonly richDescription?: string | null;
}): boolean {
    return Boolean(summary || descriptionText || richDescription?.trim());
}

/** The venue fields the «Lo que ofrece» slot (4) paints. */
export interface VenueOffersSource {
    readonly features: readonly unknown[];
    readonly amenities: readonly unknown[];
    readonly menuSections?: readonly VenueMenuSection[];
    readonly menuFileUrl?: string | null;
    readonly menuFileKind?: 'image' | 'pdf' | null;
    readonly dailySpecials?: readonly VenueDailySpecial[];
    readonly venueEvents?: readonly VenueEvent[];
    readonly nightInfo?: VenueNightInfoData | null;
}

/**
 * True when the venue «Lo que ofrece» slot (4) renders anything: features,
 * amenities, the menu (structured or an attached file with a safe URL), the
 * daily specials, the agenda, its events CTA or the night info (owner
 * decision D-3: the menu and the agenda live in this slot).
 *
 * @param input.venue - The venue detail fields of the slot.
 * @param input.showEventsCta - Whether the page renders `VenueEventsCta`.
 * @returns Whether the slot has content.
 */
export function hasVenueOffersContent({
    venue,
    showEventsCta
}: {
    readonly venue: VenueOffersSource;
    readonly showEventsCta: boolean;
}): boolean {
    const hasMenuFile = Boolean(resolveSafeExternalUrl(venue.menuFileUrl) && venue.menuFileKind);
    return (
        venue.features.length > 0 ||
        venue.amenities.length > 0 ||
        (venue.menuSections?.length ?? 0) > 0 ||
        hasMenuFile ||
        (venue.dailySpecials?.length ?? 0) > 0 ||
        (venue.venueEvents?.length ?? 0) > 0 ||
        showEventsCta ||
        (venue.nightInfo ? hasNightInfoContent(venue.nightInfo) : false)
    );
}
