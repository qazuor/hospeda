/**
 * @file amenity-attribute-summary.ts
 * @description The compact, human-readable summary of what an owner declared
 * about one amenity (scope, availability, extra charge), shown next to the
 * "Detalles" link of a selected tile in the catalog browser (HOS-2123).
 *
 * The labels are the SAME i18n keys the radio options use
 * (`AmenityAttributeControls.client.tsx`), so the summary can never disagree
 * with what the dialog shows. "Not specified" contributes nothing: it is NULL
 * on the relation row and the public page shows no badge for it either.
 */

import {
    type AmenityAttributeTranslate,
    AVAILABILITY_OPTIONS,
    SCOPE_OPTIONS
} from '@/components/shared/catalog-picker/AmenityAttributeControls.client';
import type { AmenityAttributeValue } from '@/lib/api/types';

/**
 * Labels for every attribute the owner actually declared, in render order.
 *
 * @param params.value - The declared attributes (possibly undefined)
 * @param params.t - Translator
 * @returns Zero to three labels; empty means "nothing declared yet"
 */
export function summarizeAmenityAttributes({
    value,
    t
}: {
    readonly value: AmenityAttributeValue | undefined;
    readonly t: AmenityAttributeTranslate;
}): readonly string[] {
    if (!value) return [];
    const labels: string[] = [];

    const scope = SCOPE_OPTIONS.find(
        (option) => option.value !== null && option.value === value.scope
    );
    if (scope) {
        labels.push(t(`accommodations.amenityAttributes.scope.${scope.i18nKey}`, scope.fallback));
    }

    const availability = AVAILABILITY_OPTIONS.find(
        (option) => option.value !== null && option.value === value.availability
    );
    if (availability) {
        labels.push(
            t(
                `accommodations.amenityAttributes.availability.${availability.i18nKey}`,
                availability.fallback
            )
        );
    }

    if (value.extraCharge === true) {
        labels.push(t('accommodations.amenityAttributes.extraCharge.label', 'Con cargo extra'));
    }

    return labels;
}
