/**
 * @file catalog-categories.ts
 * @description The category axis of the amenity and feature catalogs for the
 * assistant tools (HOS-2327, spec HOS-2335 §6.2): which values exist per kind,
 * in which order the wizard walks them, and their Spanish labels.
 *
 * Amenities group by `type` (`AmenitiesTypeEnum`), features by `category`
 * (`FeatureCategoryEnum`). The labels are the `@repo/i18n` keys the portal uses
 * (`accommodations.amenityCategories.*`, `accommodations.featureCategories.*`),
 * keyed by the camelCase of the enum value. `apps/api` cannot import the web's
 * `catalog-categories.ts`, so the order and the key rule are restated here; the
 * label test iterates both enums (AC-C12), so a new value without a label fails.
 */

import { AmenitiesTypeEnum, FeatureCategoryEnum } from '@repo/schemas';
import { z } from 'zod';
import { humanizeCode, translateCatalogKey } from '../../../services/ai-context/listing-labels';

/** The two catalogs a listing links to. */
export const CATALOG_KINDS = ['amenity', 'feature'] as const;

/** `amenity` or `feature`. */
export type CatalogKind = (typeof CATALOG_KINDS)[number];

/** Zod schema of {@link CatalogKind}, for tool inputs. */
export const CatalogKindSchema = z.enum(CATALOG_KINDS);

/**
 * Amenity categories in the order the wizard walks them: enum declaration order
 * with the `GENERAL_APPLIANCES` catch-all last, as the portal editor shows them.
 */
export const AMENITY_CATEGORIES: readonly AmenitiesTypeEnum[] = [
    ...Object.values(AmenitiesTypeEnum).filter(
        (value) => value !== AmenitiesTypeEnum.GENERAL_APPLIANCES
    ),
    AmenitiesTypeEnum.GENERAL_APPLIANCES
];

/** Feature categories in enum declaration order. */
export const FEATURE_CATEGORIES: readonly FeatureCategoryEnum[] =
    Object.values(FeatureCategoryEnum);

const [FIRST_CATEGORY, ...OTHER_CATEGORIES] = [...AMENITY_CATEGORIES, ...FEATURE_CATEGORIES];
if (FIRST_CATEGORY === undefined) {
    throw new Error('the amenity and feature category enums are empty');
}

/** Every category value of either kind (the two enums share no value). Non-empty, as `z.enum` needs. */
export const ALL_CATALOG_CATEGORIES: readonly [string, ...string[]] = [
    FIRST_CATEGORY,
    ...OTHER_CATEGORIES
];

/**
 * The categories of one kind, in wizard order.
 *
 * @param args - The kind
 * @returns The category values of that kind
 */
export function categoriesOf(args: { readonly kind: CatalogKind }): readonly string[] {
    return args.kind === 'amenity' ? AMENITY_CATEGORIES : FEATURE_CATEGORIES;
}

/** `KITCHEN` → `kitchen`, `BED_AND_BATH` → `bedAndBath`: the i18n key suffix of a category. */
function categoryKeySuffix(category: string): string {
    return category
        .toLowerCase()
        .replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

/** Locale of the labels: the assistant answers owners in Spanish. */
const LABEL_LOCALE = 'es';

/**
 * The i18n key of a category label.
 *
 * @param args - The kind and category value
 * @returns The flattened translation key
 */
export function categoryLabelKey(args: {
    readonly kind: CatalogKind;
    readonly category: string;
}): string {
    const namespace = args.kind === 'amenity' ? 'amenityCategories' : 'featureCategories';
    return `accommodations.${namespace}.${categoryKeySuffix(args.category)}`;
}

/**
 * The Spanish label of a category, degrading to a humanized code when the key is
 * missing (never the raw enum value).
 *
 * @param args - The kind and category value
 * @returns The label
 */
export function categoryLabel(args: {
    readonly kind: CatalogKind;
    readonly category: string;
}): string {
    const { label } = translateCatalogKey({ key: categoryLabelKey(args), locale: LABEL_LOCALE });
    return label ?? humanizeCode({ code: args.category }).label;
}

/**
 * Tells when a category does not belong to the kind it is paired with (an amenity
 * `type` given with `kind: 'feature'`, or the reverse).
 *
 * @param args - The kind and category of a call
 * @returns The Spanish problem, or `undefined` when they match
 */
export function kindCategoryIssue(args: {
    readonly kind: CatalogKind;
    readonly category: string;
}): string | undefined {
    if (categoriesOf({ kind: args.kind }).includes(args.category)) {
        return undefined;
    }
    return `la categoría «${args.category}» no es de ${
        args.kind === 'amenity' ? 'comodidades' : 'características'
    }`;
}
