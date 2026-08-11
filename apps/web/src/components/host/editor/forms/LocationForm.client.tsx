/**
 * @file LocationForm.client.tsx
 * @description Form island for `…/editar/ubicacion/` (HOS-318 T-022).
 *
 * Split into its own page precisely because it is a map: a full-screen
 * interaction, and the single worst thing to embed inside a long mobile scroll
 * (D-4).
 *
 * Latitude and longitude always leave together — enforced by the shared hook,
 * which this page must not work around.
 */

import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { ActionBar } from '../ActionBar.client';
import { AccommodationLocationSchema } from '../accommodation-edit-form.schema';
import { LocationPicker } from '../LocationPicker.client';
import { useAccommodationSectionForm } from '../use-accommodation-section-form';
import styles from './SectionForm.module.css';

/** The fields this page owns. Nothing else can reach the PATCH body. */
const OWN_FIELDS = ['latitude', 'longitude'] as const;

interface LocationFormProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialData: AccommodationEditData;
}

/**
 * Location form for one accommodation.
 *
 * @param props - Locale, id, and the loaded entity.
 */
export function LocationForm({ locale, accommodationId, initialData }: LocationFormProps) {
    const form = useAccommodationSectionForm({
        locale,
        accommodationId,
        initialValues: initialData,
        ownFields: [...OWN_FIELDS],
        schema: AccommodationLocationSchema
    });

    return (
        <form
            className={styles.form}
            onSubmit={form.handleSubmit}
            noValidate
        >
            <div className={styles.card}>
                <LocationPicker
                    locale={locale}
                    value={{ latitude: form.values.latitude, longitude: form.values.longitude }}
                    onChange={(coords) => {
                        form.setValue('latitude', coords.latitude);
                        form.setValue('longitude', coords.longitude);
                    }}
                    errors={form.fieldErrors}
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
