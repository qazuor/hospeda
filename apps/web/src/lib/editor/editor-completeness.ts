/**
 * @file editor-completeness.ts
 * @description What the editor hub's `CompletenessMeter` shows (HOS-2499,
 * spec HOS-2415 §6.1): how many of the sections that hold a publish
 * requirement are complete, and which are not.
 *
 * It computes nothing new. Both editors already decide what blocks a publish:
 *
 * - accommodation: `ACCOMMODATION_PUBLISH_REQUIREMENTS` +
 *   `resolveMissingPublishRequirements` (each requirement names its
 *   `editorSectionId`), the same list the server rejects a publish from;
 * - venue / experience: `resolveListingCompleteness`, whose missing fields map
 *   to sections through `LISTING_MISSING_FIELD_SECTION` (the hub status model's
 *   own map).
 *
 * One pure function, {@link buildEditorCompleteness}, maps either to the same
 * `{ done, total, missing }` shape, counted in SECTIONS (the unit the meter
 * links to), not in fields.
 */

import {
    ACCOMMODATION_PUBLISH_REQUIREMENTS,
    type AccommodationPublishReadinessInput,
    type ListingCompletenessListing,
    resolveListingCompleteness,
    resolveMissingPublishRequirements
} from '@repo/schemas';
import { LISTING_MISSING_FIELD_SECTION } from '@/lib/editor/listing-editor-hub-status-model';
import type { VenueOrExperience } from '@/lib/listing/owner-listings';

/** The meter's input: section counts and the incomplete sections, in order. */
export interface EditorCompleteness {
    /** Sections with every requirement met. */
    readonly done: number;
    /** Sections that hold at least one requirement. */
    readonly total: number;
    /** Ids of the incomplete sections, in requirement order, without repeats. */
    readonly missing: readonly string[];
}

/** One requirement, reduced to the section that owns it. */
export interface EditorRequirementRef {
    /** The requirement id (a field name or a requirement id). */
    readonly id: string;
    /** The editor section id where the owner fixes it. */
    readonly sectionId: string;
}

/**
 * Maps a requirement list and its unmet ids to section completeness.
 *
 * @param params - Every requirement of the listing's vertical, and the ids of
 * those that are not met. Unmet ids absent from `requirements` are ignored.
 * @returns The {@link EditorCompleteness}.
 */
export function buildEditorCompleteness({
    requirements,
    missingIds
}: {
    readonly requirements: readonly EditorRequirementRef[];
    readonly missingIds: readonly string[];
}): EditorCompleteness {
    const unmet = new Set(missingIds);
    const sections: string[] = [];
    const missing: string[] = [];

    for (const requirement of requirements) {
        if (!sections.includes(requirement.sectionId)) sections.push(requirement.sectionId);
        if (unmet.has(requirement.id) && !missing.includes(requirement.sectionId)) {
            missing.push(requirement.sectionId);
        }
    }

    return { done: sections.length - missing.length, total: sections.length, missing };
}

/**
 * Accommodation completeness, from the shared publish requirements.
 *
 * @param params - The same readiness input the hub status model reads.
 * @returns The {@link EditorCompleteness}.
 */
export function resolveAccommodationCompleteness({
    input
}: {
    readonly input: AccommodationPublishReadinessInput;
}): EditorCompleteness {
    return buildEditorCompleteness({
        requirements: ACCOMMODATION_PUBLISH_REQUIREMENTS.map((requirement) => ({
            id: requirement.id,
            sectionId: requirement.editorSectionId
        })),
        missingIds: resolveMissingPublishRequirements({ input })
    });
}

/**
 * Lists the vertical's required fields that map to an editor section.
 *
 * Derived from the completeness resolver itself, run over an empty listing (it
 * reports every required field as missing), so this file holds no second list
 * of what a venue or an experience requires. A field with no section (today
 * only `ownerId`, which the owner cannot edit) is skipped.
 *
 * @param params - The vertical.
 * @returns One requirement per mapped required field.
 */
function listingRequirements({
    vertical
}: {
    readonly vertical: VenueOrExperience;
}): readonly EditorRequirementRef[] {
    return resolveListingCompleteness({ entityType: vertical, listing: {} }).missing.flatMap(
        (field) => {
            const sectionId = LISTING_MISSING_FIELD_SECTION[field];
            return sectionId === undefined ? [] : [{ id: field, sectionId }];
        }
    );
}

/**
 * Venue / experience completeness, from the shared listing completeness.
 *
 * @param params - The vertical and the listing facts the hub already reads.
 * @returns The {@link EditorCompleteness}.
 */
export function resolveListingEditorCompleteness({
    vertical,
    listing
}: {
    readonly vertical: VenueOrExperience;
    readonly listing: ListingCompletenessListing;
}): EditorCompleteness {
    return buildEditorCompleteness({
        requirements: listingRequirements({ vertical }),
        missingIds: resolveListingCompleteness({ entityType: vertical, listing }).missing
    });
}
