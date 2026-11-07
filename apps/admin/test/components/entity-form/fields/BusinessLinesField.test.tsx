/**
 * @file BusinessLinesField.test.tsx
 * Unit tests for the admin business-line checkbox group (HOS-1873, TEST:7.1:4).
 *
 * The catalog decides every option: these tests drive real venue types and
 * selections through `resolveBusinessLineOptions` / `validateBusinessLines`
 * and assert on the DOM the operator sees.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { BusinessLinesField } from '@/components/entity-form/fields/BusinessLinesField';
import type { FieldConfig } from '@/components/entity-form/types/field-config.types';

const buildConfig = (vertical: 'venue' | 'experience' = 'venue'): FieldConfig => ({
    id: 'businessLines',
    type: FieldTypeEnum.BUSINESS_LINES,
    label: 'venue.owner.businessLines.legend',
    typeConfig: { vertical, typeFieldId: 'type' }
});

const NOT_ALLOWED_KEY = 'zodError.venue.businessLines.NOT_ALLOWED_FOR_TYPE';

describe('BusinessLinesField', () => {
    it('shows both lines checked for a BAR carrying both', () => {
        render(
            <BusinessLinesField
                config={buildConfig()}
                value={['food', 'nightlife']}
                onChange={vi.fn()}
                listingType="BAR"
            />
        );

        expect(screen.getByTestId('business-line-food')).toBeChecked();
        expect(screen.getByTestId('business-line-nightlife')).toBeChecked();
    });

    it('hides nightlife for a HELADERIA that does not carry it', () => {
        render(
            <BusinessLinesField
                config={buildConfig()}
                value={['food']}
                onChange={vi.fn()}
                listingType="HELADERIA"
            />
        );

        expect(screen.getByTestId('business-line-food')).toBeChecked();
        expect(screen.queryByTestId('business-line-nightlife')).not.toBeInTheDocument();
    });

    it('shows a checked NOT_ALLOWED_FOR_TYPE line with its reason so it can be removed (AC:7:3)', async () => {
        const onChange = vi.fn();
        render(
            <BusinessLinesField
                config={buildConfig()}
                value={['food', 'nightlife']}
                onChange={onChange}
                listingType="HELADERIA"
            />
        );

        // The invalid line stays visible because the listing already carries
        // it: hiding it would leave an invisible invalid selection.
        expect(screen.getByTestId('business-line-nightlife')).toBeChecked();
        // The reason appears both on the option and as the field error.
        expect(screen.getAllByText(NOT_ALLOWED_KEY).length).toBeGreaterThan(0);

        await userEvent.click(
            screen.getByRole('button', { name: 'venue.owner.businessLines.useSuggested' })
        );

        expect(onChange).toHaveBeenCalledWith(['food']);
    });

    it('disables the last selected line', () => {
        render(
            <BusinessLinesField
                config={buildConfig()}
                value={['food']}
                onChange={vi.fn()}
                listingType="HELADERIA"
            />
        );

        expect(screen.getByTestId('business-line-food')).toBeDisabled();
    });

    it('prefills an empty selection with the type preselect (BOLICHE)', () => {
        const onChange = vi.fn();
        render(
            <BusinessLinesField
                config={buildConfig()}
                value={[]}
                onChange={onChange}
                listingType="BOLICHE"
            />
        );

        expect(onChange).toHaveBeenCalledWith(['nightlife']);
    });

    it('renders nothing for a vertical with a single business line', () => {
        const { container } = render(
            <BusinessLinesField
                config={buildConfig('experience')}
                value={[]}
                onChange={vi.fn()}
                listingType="EXCURSION"
            />
        );

        expect(container).toBeEmptyDOMElement();
    });
});
