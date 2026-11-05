// @vitest-environment jsdom
/**
 * @file EntityFormSection.business-lines.test.tsx
 * Wiring test for the BUSINESS_LINES field branch (HOS-1873, TEST:7.1:5).
 *
 * `EntityFormSection` must read the listing type from the form `values` and
 * hand it to `BusinessLinesField`; that is what makes the type ↔ business-line
 * validation run inside the consolidated form.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EntityFormSection } from '@/components/entity-form/EntityFormSection';
import { FieldTypeEnum, LayoutTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';

// Heavy hooks/providers pulled in by EntityFormSection — stubbed so the field
// branch renders without a full app context.
vi.mock('@/features/billing/use-effective-set', () => ({
    useEffectiveSet: () => ({ has: () => true, isLoading: false })
}));
vi.mock('@/features/billing/LimitProgressIndicator', () => ({
    LimitProgressIndicator: () => null
}));
vi.mock('@/features/billing/PremiumBlock', () => ({
    PremiumBlock: () => null
}));
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

const NOT_ALLOWED_KEY = 'zodError.venue.businessLines.NOT_ALLOWED_FOR_TYPE';

const section: SectionConfig = {
    id: 'venue-specific',
    title: 'Detalles de Gastronomía',
    layout: LayoutTypeEnum.GRID,
    modes: ['edit', 'create'],
    fields: [
        {
            id: 'businessLines',
            type: FieldTypeEnum.BUSINESS_LINES,
            required: true,
            label: 'venue.owner.businessLines.legend',
            typeConfig: { vertical: 'venue', typeFieldId: 'type' }
        }
    ]
};

describe('EntityFormSection — BUSINESS_LINES branch', () => {
    it('reads the listing type from values and surfaces the type error', () => {
        render(
            <EntityFormSection
                config={section}
                values={{ type: 'HELADERIA', businessLines: ['food', 'nightlife'] }}
                errors={{}}
                onFieldChange={vi.fn()}
                onFieldBlur={vi.fn()}
                userPermissions={[]}
            />
        );

        // The field error node proves the branch read HELADERIA from `values`:
        // with no listing type there is no selection error at all.
        expect(screen.getByTestId('business-lines-error')).toHaveTextContent(NOT_ALLOWED_KEY);
        expect(
            screen.getByRole('button', { name: 'venue.owner.businessLines.useSuggested' })
        ).toBeInTheDocument();
    });
});
