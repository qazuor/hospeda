import type { ListingSectionId } from './listing-catalog.ids.js';
import type { ListingVertical, UpdateInputOf } from './listing-catalog.types.js';
import { LISTING_SECTIONS } from './listing-sections.js';
/** Return sections with body fields set to non-null, defined values. */
export function sectionsTouchedByBody<V extends ListingVertical>({
    vertical,
    body
}: {
    readonly vertical: V;
    readonly body: Partial<UpdateInputOf<V>>;
}): readonly ListingSectionId<V>[] {
    const values: Readonly<Record<string, unknown>> = body;
    return LISTING_SECTIONS[vertical]
        .filter((section) =>
            section.fields.some((field) => values[field] !== undefined && values[field] !== null)
        )
        .map(({ id }) => id);
}
