/**
 * @file CapacityPricingForm.client.tsx
 * @description Form island for `…/editar/capacidad-precio/` (HOS-318 T-021).
 *
 * Guests, bedrooms, bathrooms, price and currency. Needs no catalog at all, so
 * this page issues exactly one request.
 */

import { useCallback } from 'react';
import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { ActionBar } from '../ActionBar.client';
import { AccommodationCapacityPricingSchema } from '../accommodation-edit-form.schema';
import { CapacitySection } from '../CapacitySection.client';
import { PricingSection } from '../PricingSection.client';
import { PublishReadyDialog } from '../PublishReadyDialog.client';
import { useAccommodationSectionForm } from '../use-accommodation-section-form';
import { usePublishReadyPrompt } from '../use-publish-ready-prompt';
import styles from './SectionForm.module.css';

/** The fields this page owns. Nothing else can reach the PATCH body. */
const OWN_FIELDS = [
    'maxGuests',
    'bedrooms',
    'bathrooms',
    'basePrice',
    'currency',
    'minNights'
] as const;

interface CapacityPricingFormProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialData: AccommodationEditData;
    /**
     * Whether the listing already has a main image (HOS-1183).
     *
     * This section owns four of the five blocking publish requirements; the
     * fifth is the main photo, and readiness needs all five. It is a prop
     * rather than a fetch because the page loads the media anyway to answer it,
     * and a component that fetched it would do so on every render of a form
     * that mostly does not need it.
     */
    readonly hasMainImage: boolean;
    /** Trial length in days, for the publish prompt's copy. */
    readonly trialDays: number;
}

/**
 * Capacity and pricing form for one accommodation.
 *
 * @param props - Locale, id, the loaded entity, and the publish-readiness
 *   context this section does not own.
 */
export function CapacityPricingForm({
    locale,
    accommodationId,
    initialData,
    hasMainImage,
    trialDays
}: CapacityPricingFormProps) {
    const prompt = usePublishReadyPrompt();

    // This section is one of exactly two that can flip publish readiness (the
    // other is photos), which is why the prompt is wired here and not into the
    // shared form hook for all eleven routes.
    const handleSaved = useCallback(
        ({ before, after }: { before: AccommodationEditData; after: AccommodationEditData }) => {
            void prompt.evaluate({
                before: {
                    capacity: before.maxGuests,
                    minNights: before.minNights,
                    bedrooms: before.bedrooms,
                    bathrooms: before.bathrooms,
                    hasMainImage
                },
                after: {
                    capacity: after.maxGuests,
                    minNights: after.minNights,
                    bedrooms: after.bedrooms,
                    bathrooms: after.bathrooms,
                    hasMainImage
                },
                isDraft: after.lifecycleState === 'DRAFT'
            });
        },
        [prompt, hasMainImage]
    );

    const form = useAccommodationSectionForm({
        locale,
        accommodationId,
        initialValues: initialData,
        ownFields: [...OWN_FIELDS],
        schema: AccommodationCapacityPricingSchema,
        onSaved: handleSaved
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

            <PublishReadyDialog
                isOpen={prompt.isOpen}
                onClose={prompt.close}
                locale={locale}
                accommodationId={accommodationId}
                startsTrial={prompt.startsTrial}
                trialDays={trialDays}
            />
        </form>
    );
}
