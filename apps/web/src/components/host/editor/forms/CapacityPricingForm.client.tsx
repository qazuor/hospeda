/**
 * @file CapacityPricingForm.client.tsx
 * @description Form island for `…/editar/capacidad-precio/` (HOS-318 T-021).
 *
 * Guests, bedrooms, bathrooms, price and currency. Needs no catalog at all, so
 * this page issues exactly one request.
 */

import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { ActionBar } from '../ActionBar.client';
import { AccommodationCapacityPricingSchema } from '../accommodation-edit-form.schema';
import { CapacitySection } from '../CapacitySection.client';
import { PricingSection } from '../PricingSection.client';
import { useAccommodationSectionForm } from '../use-accommodation-section-form';
import styles from './SectionForm.module.css';

/** The fields this page owns. Nothing else can reach the PATCH body. */
const OWN_FIELDS = ['maxGuests', 'bedrooms', 'bathrooms', 'basePrice', 'currency'] as const;

interface CapacityPricingFormProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialData: AccommodationEditData;
}

/**
 * Capacity and pricing form for one accommodation.
 *
 * @param props - Locale, id, and the loaded entity.
 */
export function CapacityPricingForm({
    locale,
    accommodationId,
    initialData
}: CapacityPricingFormProps) {
    const form = useAccommodationSectionForm({
        locale,
        accommodationId,
        initialValues: initialData,
        ownFields: [...OWN_FIELDS],
        schema: AccommodationCapacityPricingSchema
    });

    return (
        <form
            className={styles.form}
            onSubmit={form.handleSubmit}
            noValidate
        >
            <div className={styles.card}>
                <CapacitySection
                    locale={locale}
                    data={form.values}
                    errors={form.fieldErrors}
                    onFieldChange={(field, value) => form.setValue(field, value)}
                />
            </div>

            <div className={styles.card}>
                <PricingSection
                    locale={locale}
                    data={form.values}
                    errors={form.fieldErrors}
                    onFieldChange={(field, value) => form.setValue(field, value)}
                />
            </div>

            {form.formError && (
                <div
                    className={styles.error}
                    role="alert"
                >
                    {form.formError}
                </div>
            )}

            <ActionBar
                locale={locale}
                isSaving={form.isSaving}
                onCancel={form.handleCancel}
            />
        </form>
    );
}
