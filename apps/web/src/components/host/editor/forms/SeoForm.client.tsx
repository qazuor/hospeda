/**
 * @file SeoForm.client.tsx
 * @description Form island for `…/editar/seo/` (G7 smoke, H-121).
 *
 * New section — SEO had no page before this. Placed on its own page (not
 * folded into BasicInfo or Contact) because it is a genuinely separate
 * concern from either: it governs how the listing appears in Google, not the
 * listing's own content or how to reach the host.
 */

import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { ActionBar } from '../ActionBar.client';
import { AccommodationSeoSchema } from '../accommodation-edit-form.schema';
import { SeoSection } from '../SeoSection.client';
import { useAccommodationSectionForm } from '../use-accommodation-section-form';
import styles from './SectionForm.module.css';

/** The fields this page owns. Nothing else can reach the PATCH body. */
const OWN_FIELDS = ['seoTitle', 'seoDescription'] as const;

interface SeoFormProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialData: AccommodationEditData;
}

/**
 * SEO override form for one accommodation.
 *
 * @param props - Locale, id, and the loaded entity.
 */
export function SeoForm({ locale, accommodationId, initialData }: SeoFormProps) {
    const form = useAccommodationSectionForm({
        locale,
        accommodationId,
        initialValues: initialData,
        ownFields: [...OWN_FIELDS],
        schema: AccommodationSeoSchema
    });

    return (
        <form
            className={styles.form}
            onSubmit={form.handleSubmit}
            noValidate
        >
            <div className={styles.card}>
                <SeoSection
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
