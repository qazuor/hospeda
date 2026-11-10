/**
 * The one place that compares two business-line selections (HOS-1875,
 * G-FAC-03): which lines were added or removed and which catalog sections
 * appear or stop being visible because of that change.
 *
 * The inputs come from a stored `listing.edited` event (`old` / `new` of the
 * `businessLines` field), so they can carry values the catalog no longer
 * declares. Those values are discarded instead of thrown: a historical event
 * must stay readable.
 *
 * Presence is delegated to {@link resolveListingSectionPresence}: a section is
 * shown when it was absent before and present after, and hidden the other way
 * round. Sections are evaluated in catalog order and no ``if (vertical === …)``
 * decides anything here (G-FAC-05).
 *
 * @module listing-sections/business-lines-change
 */

import {
    BUSINESS_LINES,
    type BusinessLine,
    LISTING_SECTIONS,
    type ListingSectionId
} from '@repo/schemas';
import { resolveListingSectionPresence } from './resolve-listing-sections';

/** The verticals whose listings carry a business-line selection. */
type BusinessLinesChangeVertical = 'venue' | 'experience';

/** A section id of either vertical that carries business lines. */
type BusinessLinesChangeSectionId = ListingSectionId<BusinessLinesChangeVertical>;

/** The known line values of one vertical and the sections each one declares. */
type BusinessLineCatalogEntry = {
    readonly value: string;
    readonly sections: readonly string[];
};

/** The id of one section of the vertical's catalog, in catalog order. */
type ListingSectionCatalogEntry = { readonly id: string };

/**
 * Resolves which business lines and catalog sections changed between two
 * selections of the same vertical. Pure: no I/O, never throws on stale values.
 *
 * @param input.vertical - The listing's vertical.
 * @param input.before - The stored selection before the change.
 * @param input.after - The stored selection after the change.
 * @returns `{ addedLines, removedLines, shownSections, hiddenSections }`:
 *   catalog values and section ids, in catalog order. Unknown values are
 *   discarded.
 */
export function resolveBusinessLinesChange(input: {
    readonly vertical: BusinessLinesChangeVertical;
    readonly before: readonly string[];
    readonly after: readonly string[];
}): {
    readonly addedLines: readonly BusinessLine[];
    readonly removedLines: readonly BusinessLine[];
    readonly shownSections: readonly BusinessLinesChangeSectionId[];
    readonly hiddenSections: readonly BusinessLinesChangeSectionId[];
} {
    const linesCatalog = BUSINESS_LINES[input.vertical] as readonly BusinessLineCatalogEntry[];
    const sectionsCatalog = LISTING_SECTIONS[
        input.vertical
    ] as readonly ListingSectionCatalogEntry[];
    const knownLines = new Set(linesCatalog.map((line) => line.value));

    const before = input.before.filter((value) => knownLines.has(value));
    const after = input.after.filter((value) => knownLines.has(value));
    const beforeSet = new Set(before);
    const afterSet = new Set(after);

    const addedLines = after.filter((value) => !beforeSet.has(value)) as BusinessLine[];
    const removedLines = before.filter((value) => !afterSet.has(value)) as BusinessLine[];

    const declaredSections = sectionsCatalog
        .filter((section) => linesCatalog.some((line) => line.sections.includes(section.id)))
        .map((section) => section.id);

    const beforePresence = resolveListingSectionPresence({
        vertical: input.vertical,
        businessLines: before,
        requested: declaredSections
    });
    const afterPresence = resolveListingSectionPresence({
        vertical: input.vertical,
        businessLines: after,
        requested: declaredSections
    });

    const shownSections = declaredSections.filter(
        (id) => beforePresence.get(id) === true && afterPresence.get(id) === false
    );
    const hiddenSections = declaredSections.filter(
        (id) => beforePresence.get(id) === false && afterPresence.get(id) === true
    );

    return {
        addedLines,
        removedLines,
        shownSections: shownSections as BusinessLinesChangeSectionId[],
        hiddenSections: hiddenSections as BusinessLinesChangeSectionId[]
    };
}
