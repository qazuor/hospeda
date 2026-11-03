import type {
    ListingSectionDefinitionBase,
    ListingVertical,
    UpdateInputOf
} from './listing-catalog.base-types.js';
import type { ListingSectionId } from './listing-catalog.ids.js';
import { LISTING_SECTIONS } from './listing-sections.js';
/** Return sections with body fields set to non-null, defined values. */
export function sectionsTouchedByBody<V extends ListingVertical>({
    vertical,
    body
}: {
    readonly vertical: V;
    readonly body: Partial<UpdateInputOf<V>> | Record<string, unknown> | undefined;
}): readonly ListingSectionId<V>[] {
    const values: Readonly<Record<string, unknown>> = body ?? {};
    return LISTING_SECTIONS[vertical]
        .filter((section) =>
            section.fields.some((field) => values[field] !== undefined && values[field] !== null)
        )
        .map(({ id }) => id);
}

/** Return trait ids with body fields set to non-null, defined values. */
export function sectionTraitsTouchedByBody<V extends ListingVertical>({
    vertical,
    body
}: {
    readonly vertical: V;
    readonly body: Partial<UpdateInputOf<V>> | Record<string, unknown> | undefined;
}): readonly string[] {
    const values: Readonly<Record<string, unknown>> = body ?? {};
    const sections = LISTING_SECTIONS[
        vertical
    ] as unknown as readonly ListingSectionDefinitionBase<V>[];
    return sections.flatMap((section) =>
        (section.traits ?? [])
            .filter((trait) => trait.fields?.some((field) => values[field] != null))
            .map(({ id }) => id)
    );
}
