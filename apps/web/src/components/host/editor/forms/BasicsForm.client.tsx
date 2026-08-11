/**
 * @file BasicsForm.client.tsx
 * @description Form island for `…/editar/datos/` (HOS-318 T-020).
 *
 * Name, summary, description, type and destination — five fields, one screen,
 * one PATCH carrying only those keys.
 */

import type { AccommodationEditData, DestinationData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { ActionBar } from '../ActionBar.client';
import { AccommodationBasicsSchema } from '../accommodation-edit-form.schema';
import { BasicInfoSection } from '../BasicInfoSection.client';
import { useAccommodationSectionForm } from '../use-accommodation-section-form';
import styles from './SectionForm.module.css';

/** The fields this page owns. Nothing else can reach the PATCH body. */
const OWN_FIELDS = ['name', 'summary', 'description', 'type', 'destinationId'] as const;

interface BasicsFormProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialData: AccommodationEditData;
    readonly destinations: readonly DestinationData[];
}

/**
 * Basic data form for one accommodation.
 *
 * @param props - Locale, id, the loaded entity, and the destination catalog.
 */
export function BasicsForm({
    locale,
    accommodationId,
    initialData,
    destinations
}: BasicsFormProps) {
    const form = useAccommodationSectionForm({
        locale,
        accommodationId,
        initialValues: initialData,
        ownFields: [...OWN_FIELDS],
        schema: AccommodationBasicsSchema
    });

    return (
        <form
            className={styles.form}
            onSubmit={form.handleSubmit}
            noValidate
        >
            <div className={styles.card}>
                <BasicInfoSection
                    locale={locale}
                    data={form.values}
                    destinations={destinations}
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
