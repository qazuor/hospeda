/**
 * @file catalog-attribute-badges.ts
 * @description Public-page presentation of the HOS-2058 catalog attributes:
 * the scope/availability badges on an amenity, and the decision to group a
 * feature list by category.
 *
 * Kept out of the `.astro` grids because Vitest cannot render `.astro` in this
 * repo; the branching lives here, where it executes under test.
 *
 * Two rules a future change must keep:
 * - A badge appears ONLY for a declared value. NULL means "not declared" and
 *   nothing is inferred from it (no "Compartido" default).
 * - A feature list is grouped only when at least one feature carries a
 *   category. The grid is shared with venue and experience, whose features
 *   have no category, and a single "Otras" heading over all of them would read
 *   worse than the flat grid they had.
 *
 * @module lib/catalog-attribute-badges
 */

import { type CategoryGroup, groupFeaturesByCategory } from '@/lib/catalog-categories';

/** Translator function shape (matches `createTranslations().t`). */
type Translate = (key: string, fallback?: string) => string;

const SCOPE_LABELS = {
    private: { key: 'accommodations.amenityAttributes.scope.private', fallback: 'Privado' },
    shared: { key: 'accommodations.amenityAttributes.scope.shared', fallback: 'Compartido' }
} as const;

const AVAILABILITY_LABELS = {
    year_round: {
        key: 'accommodations.amenityAttributes.availability.yearRound',
        fallback: 'Todo el año'
    },
    seasonal: {
        key: 'accommodations.amenityAttributes.availability.seasonal',
        fallback: 'De temporada'
    }
} as const;

/**
 * Resolves the badge labels for one amenity relation, scope first.
 *
 * @param params.scope - Declared scope, or null/undefined when not declared
 * @param params.availability - Declared availability, or null/undefined
 * @param params.extraCharge - `true` when the amenity is paid separately (HOS-2084)
 * @param params.t - Active locale translator
 * @returns Zero to three labels
 */
export function resolveAmenityAttributeBadges({
    scope,
    availability,
    extraCharge,
    t
}: {
    readonly scope?: string | null;
    readonly availability?: string | null;
    /** HOS-2084: the relation's `is_optional` flag (paid separately). */
    readonly extraCharge?: boolean | null;
    readonly t: Translate;
}): readonly string[] {
    const badges: string[] = [];
    const scopeLabel = scope === 'private' || scope === 'shared' ? SCOPE_LABELS[scope] : undefined;
    if (scopeLabel) badges.push(t(scopeLabel.key, scopeLabel.fallback));
    const availabilityLabel =
        availability === 'year_round' || availability === 'seasonal'
            ? AVAILABILITY_LABELS[availability]
            : undefined;
    if (availabilityLabel) badges.push(t(availabilityLabel.key, availabilityLabel.fallback));
    if (extraCharge === true) {
        badges.push(t('accommodations.amenityAttributes.extraCharge.badge', 'Con cargo'));
    }
    return badges;
}

/**
 * Groups a public feature list by category, or returns `null` when no feature
 * is classified so the caller renders the flat grid.
 *
 * @param params.features - Features as the detail page carries them
 * @param params.t - Active locale translator
 * @returns Ordered groups, or `null` for "render flat"
 */
export function groupFeaturesForDisplay<T extends { readonly category?: string | null }>({
    features,
    t
}: {
    readonly features: readonly T[];
    readonly t: Translate;
}): readonly CategoryGroup<T & { readonly category: string | null | undefined }>[] | null {
    if (!features.some((feature) => feature.category)) return null;
    return groupFeaturesByCategory({
        features: features as readonly (T & { readonly category: string | null | undefined })[],
        t
    });
}
