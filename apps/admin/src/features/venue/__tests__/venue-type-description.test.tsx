import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { FieldTypeEnum } from '@/components/entity-form/enums/form-config.enums';
import { SelectField } from '@/components/entity-form/fields/SelectField';
import type {
    FieldConfig,
    SelectFieldConfig
} from '@/components/entity-form/types/field-config.types';
import { createVenueConsolidatedConfig } from '../config/venue-consolidated.config';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: (key: string) => key })
}));

describe('venue type description in the consolidated admin form', () => {
    it('shows the selected type description and replaces it when the selection changes', async () => {
        const formConfig = createVenueConsolidatedConfig((key) => key);
        const typeField = formConfig.sections
            .find((section) => section.id === 'venue-specific')
            ?.fields.find((field) => field.id === 'type');
        if (!typeField) throw new Error('Venue type field is missing');
        const fieldConfig = typeField as FieldConfig;
        const options =
            fieldConfig.type === FieldTypeEnum.SELECT
                ? (fieldConfig.typeConfig as SelectFieldConfig).options
                : [];

        function Harness() {
            const [value, setValue] = useState('BOLICHE');
            return (
                <SelectField
                    config={fieldConfig}
                    value={value}
                    onChange={setValue}
                    options={options}
                />
            );
        }

        render(<Harness />);
        expect(
            screen.getByText('admin-entities.venue.typeDescriptions.BOLICHE')
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole('combobox'));
        fireEvent.click(await screen.findByRole('option', { name: 'Pub' }));

        expect(screen.getByText('admin-entities.venue.typeDescriptions.PUB')).toBeInTheDocument();
        expect(
            screen.queryByText('admin-entities.venue.typeDescriptions.BOLICHE')
        ).not.toBeInTheDocument();
    });
});
