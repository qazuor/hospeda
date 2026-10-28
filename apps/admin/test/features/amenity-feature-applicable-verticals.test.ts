import { APPLICABLE_VERTICALS } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { createBasicInfoConsolidatedSection as createAmenitySection } from '../../src/features/amenities/config/sections/basic-info.consolidated';
import type { ConsolidatedSectionConfig } from '../../src/features/destinations/types/consolidated-config.types';
import { createBasicInfoConsolidatedSection as createFeatureSection } from '../../src/features/features/config/sections/basic-info.consolidated';

type FieldWithOptions = {
    readonly typeConfig?: { readonly options?: readonly { readonly value: string }[] };
};

const applicableVerticalOptions = (
    section: ConsolidatedSectionConfig
): readonly { value: string }[] => {
    const field = section.fields.find(({ id }) => id === 'applicableVerticals') as
        | FieldWithOptions
        | undefined;
    return field?.typeConfig?.options ?? [];
};

describe('amenity and feature applicable vertical options', () => {
    it('uses values accepted by the schemas enum, including venue', () => {
        const options = [
            ...applicableVerticalOptions(createAmenitySection()),
            ...applicableVerticalOptions(createFeatureSection())
        ];

        expect(options.map(({ value }) => value)).toEqual([
            'accommodation',
            'venue',
            'experience',
            'accommodation',
            'venue',
            'experience'
        ]);
        for (const { value } of options) {
            expect(APPLICABLE_VERTICALS).toContain(value);
        }
    });
});
