/**
 * @file locked-section-counts.ts
 * @description Server-side readers for the "how much is stored" counts the hub
 * and the section notice need on a `locked` section (HOS-1854, DEC-FAC-025).
 *
 * A locked section keeps its owner's data: the point of the hub line and of the
 * notice above the editor is to say "this is saved but not published", with a
 * real number. The number cannot be derived from the listing payload — a carta,
 * a menú del día and an agenda are nested documents with their own endpoints —
 * and the reads are NOT entitlement-gated (DEC-FAC-041), so the server can ask
 * them for a locked section too.
 *
 * Every reader degrades to `null`, never to `0`: a failed read renders the line
 * WITHOUT a count. Rendering "0 cargados" would claim the section is empty,
 * which is the one thing the code cannot know when the read failed.
 *
 * Only the sections listed here are read, and only when the caller passed them
 * as `locked` — the hub never pays for these GETs on an available section.
 */

import { apiClient } from '@/lib/api/client';
import type { ListingSectionStates } from '@/lib/editor/listing-editor-registry';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';

/** One count per section id; `null` means "could not be read". */
export type LockedSectionCounts = Readonly<Record<string, number | null>>;

/** Shape of `GET .../menu`, reduced to what the count needs. */
interface MenuCountEnvelope {
    readonly sections?: ReadonlyArray<{
        readonly items?: ReadonlyArray<unknown>;
    }>;
    readonly file?: unknown;
    readonly externalUrl?: string | null;
}

/** Shape of `GET .../daily-specials`, reduced to what the count needs. */
interface DailySpecialsCountEnvelope {
    readonly specials?: ReadonlyArray<unknown>;
}

/** Shape of `GET .../events`, reduced to what the count needs. */
interface EventsCountEnvelope {
    readonly events?: ReadonlyArray<unknown>;
}

/** A reader that turns one section's stored document into a count. */
type SectionCountReader = (params: {
    readonly listingId: string;
    readonly cookieHeader?: string;
}) => Promise<number | null>;

/**
 * The carta's "data" is the three things the section owns: dishes, the uploaded
 * photo/PDF and the external link (DEC-FAC-062). Counting only the dishes would
 * report a carta with a menu PDF as empty.
 */
async function readMenuCount({
    listingId,
    cookieHeader
}: {
    readonly listingId: string;
    readonly cookieHeader?: string;
}): Promise<number | null> {
    try {
        const result = await apiClient.getProtected<MenuCountEnvelope>({
            path: `/api/v1/protected/venues/${listingId}/menu`,
            cookieHeader
        });
        if (!result.ok) return null;

        const sections = Array.isArray(result.data.sections) ? result.data.sections : [];
        const dishes = sections.reduce(
            (total, section) => total + (Array.isArray(section.items) ? section.items.length : 0),
            0
        );
        return dishes + (result.data.file ? 1 : 0) + (result.data.externalUrl ? 1 : 0);
    } catch {
        return null;
    }
}

/** One stored special is one item. */
async function readDailySpecialsCount({
    listingId,
    cookieHeader
}: {
    readonly listingId: string;
    readonly cookieHeader?: string;
}): Promise<number | null> {
    try {
        const result = await apiClient.getProtected<DailySpecialsCountEnvelope>({
            path: `/api/v1/protected/venues/${listingId}/daily-specials`,
            cookieHeader
        });
        if (!result.ok) return null;
        return Array.isArray(result.data.specials) ? result.data.specials.length : 0;
    } catch {
        return null;
    }
}

/** One stored agenda entry is one item. */
async function readEventsCount({
    listingId,
    cookieHeader
}: {
    readonly listingId: string;
    readonly cookieHeader?: string;
}): Promise<number | null> {
    try {
        const result = await apiClient.getProtected<EventsCountEnvelope>({
            path: `/api/v1/protected/venues/${listingId}/events`,
            cookieHeader
        });
        if (!result.ok) return null;
        return Array.isArray(result.data.events) ? result.data.events.length : 0;
    } catch {
        return null;
    }
}

/**
 * Readers per vertical. An experience locked section has no nested document to
 * count in this leaf, so its map is empty and the hub says "Bloqueada por tu
 * plan" without a number.
 */
const READERS_BY_VERTICAL: Readonly<
    Record<VenueOrExperience, Readonly<Record<string, SectionCountReader>>>
> = {
    venue: {
        menu: readMenuCount,
        dailySpecials: readDailySpecialsCount,
        venueEvents: readEventsCount
    },
    experience: {}
};

/**
 * Reads the stored count for every section the caller passed as `locked`.
 *
 * @param params.vertical - The listing's vertical.
 * @param params.listingId - UUID of the listing.
 * @param params.sectionStates - The state map the resolver read from the API.
 *   Only entries whose `state` is `locked` are read.
 * @param params.cookieHeader - Session cookie forwarded from SSR.
 * @returns A count (or `null` on failure) keyed by section id.
 */
export async function readLockedSectionCounts({
    vertical,
    listingId,
    sectionStates,
    cookieHeader
}: {
    readonly vertical: VenueOrExperience;
    readonly listingId: string;
    readonly sectionStates: ListingSectionStates;
    readonly cookieHeader?: string;
}): Promise<LockedSectionCounts> {
    const readers = READERS_BY_VERTICAL[vertical] ?? {};
    const locked = Object.entries(sectionStates).filter(
        ([, section]) => section.state === 'locked'
    );

    const entries = await Promise.all(
        locked.map(async ([sectionId]) => {
            const reader = readers[sectionId];
            if (!reader) return [sectionId, null] as const;
            return [sectionId, await reader({ listingId, cookieHeader })] as const;
        })
    );

    return Object.fromEntries(entries);
}
