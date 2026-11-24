/**
 * @file PricingSection.client.tsx
 * @description Form section for accommodation pricing: basePrice (editable)
 * with a fixed «ARS» addon (BETA-137: multi-currency is not implemented, so
 * the currency is shown, never chosen). Kit `Section` + `Field` + `InputGroup`
 * since HOS-2503; the field id is unchanged.
 */

import type { JSX } from 'react';
import { Field } from '@/components/account/ui/Field';
import { InputGroup } from '@/components/account/ui/InputGroup';
import { Section } from '@/components/account/ui/Section';
import type { AccommodationEditData } from '@/lib/api/types';
import { sectionHelpId } from '@/lib/help/section-help-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { ACCOMMODATION_FIELD_PREFIX } from './field-ids';

/** Props for PricingSection. */
export interface PricingSectionProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationEditData;
    readonly errors: Readonly<{ basePrice?: string; currency?: string }>;
    readonly onFieldChange: (
        field: keyof AccommodationEditData,
        value: number | string | null
    ) => void;
}

/**
 * Pricing form section.
 *
 * The «ARS» addon is `aria-hidden` (kit rule), so the currency is also said in
 * words, as the field hint.
 *
 * @param props - See {@link PricingSectionProps}.
 * @returns One kit Section.
 */
export function PricingSection({
    locale,
    data,
    errors,
    onFieldChange
}: PricingSectionProps): JSX.Element {
    const { t } = createTranslations(locale);

    return (
        <Section
            id="editor-pricing"
            title={t('host.properties.editor.section.pricing', 'Precio')}
            helpId={sectionHelpId({ vertical: 'accommodation', slug: 'capacidad-precio' })}
        >
            <Field
                locale={locale}
                idParts={{ prefix: ACCOMMODATION_FIELD_PREFIX, name: 'basePrice' }}
                label={t('host.properties.editor.field.price', 'Precio por noche')}
                hint={t('host.properties.editor.field.currencyFixedArs', 'ARS — Peso argentino')}
                error={errors.basePrice}
            >
                <InputGroup
                    suffix="ARS"
                    type="number"
                    value={data.basePrice ?? ''}
                    min={0}
                    // Prices are whole ARS integers — any positive integer must
                    // save. `step={100}` made native browser validation reject
                    // any value that was not a multiple of 100 (BETA-179).
                    step={1}
                    // H-111: whole pesos, no cents. `step={1}` is what blocks a
                    // decimal value; this only steers mobile keyboards.
                    inputMode="numeric"
                    onChange={(e) =>
                        onFieldChange(
                            'basePrice',
                            e.target.value === '' ? null : Number(e.target.value)
                        )
                    }
                />
            </Field>
        </Section>
    );
}
