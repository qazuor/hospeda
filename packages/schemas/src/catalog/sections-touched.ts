import type {
    ListingSectionDefinitionBase,
    ListingVertical,
    UpdateInputOf
} from './listing-catalog.base-types.js';
import type { ListingSectionId } from './listing-catalog.ids.js';
import { LISTING_SECTIONS } from './listing-sections.js';
/**
 * Return sections with body fields set to non-null, defined values.
 *
 * `null` is skipped on purpose: a body that only clears fields declares no
 * section, so the section-access step never runs and the owner can always
 * empty a section that is `locked` by plan or `absent` by business line
 * (DEC-FAC-025, DEC-FAC-075). The owner "clear" flows depend on this contract
 * (HOS-2038 characterization tests in
 * `apps/api/test/routes/venue/protected/patch-null-is-delete.test.ts`).
 * Do not count `null` as a touch without revisiting that contract.
 */
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
