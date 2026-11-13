/**
 * @file CapacityPricingForm.client.tsx
 * @description Form island for `…/editar/capacidad-precio/` (HOS-318 T-021).
 *
 * Guests, bedrooms, bathrooms, price, currency and the stay length
 * (`policies.minNights` HOS-2060, `policies.maxNights` HOS-2121). Needs no catalog at all, so
 * this page issues exactly one request.
 */

import { PublicationStatusEnum } from '@repo/schemas';
import { useCallback } from 'react';
import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { buildListingPoliciesPatch, setListingPolicy } from '@/lib/listing/listing-policies';
import { ActionBar } from '../ActionBar.client';
import { AccommodationCapacityPricingSchema } from '../accommodation-edit-form.schema';
import { CapacitySection } from '../CapacitySection.client';
import { PricingSection } from '../PricingSection.client';
import { PublishReadyDialog } from '../PublishReadyDialog.client';
import { useAccommodationSectionForm } from '../use-accommodation-section-form';
import { usePublishReadyPrompt } from '../use-publish-ready-prompt';
import styles from './SectionForm.module.css';

/**
 * The fields this page owns. Nothing else can reach the PATCH body, except the
 * `policies.minNights`/`policies.maxNights` keys `extendStayLength` adds.
 */
const OWN_FIELDS = ['maxGuests', 'bedrooms', 'bathrooms', 'basePrice', 'currency'] as const;

/** The stay-length policy keys this page owns (HOS-2060, HOS-2121). */
const STAY_LENGTH_POLICY_KEYS = ['minNights', 'maxNights'] as const;

/**
 * Adds the stay length as a `policies` PATCH (HOS-2060). The API merges it per
 * key, so the house rules the services page edits survive.
 *
 * A changed bound travels as its value (or `null` when emptied). When one
 * bound changed, the other travels too IF it holds a value (re-sending it is
 * idempotent). That puts the pair in front of the client-side
 * `maxNights >= minNights` refine together, so the error shows next to the
 * fields before the request instead of coming back as a 400 — a lone changed
 * bound would be checked against nothing.
 *
 * Emptying the minimum sends `minNights: null` (HOS-910): a draft may hold no
 * minimum; only publishing requires one.
 *
 * Module-level so the hook's payload memo does not recompute on every render.
 *
 * @param input.values - The edited entity.
 * @param input.baseline - The last persisted entity.
 * @returns `{ policies }` when a bound changed, otherwise `{}`.
 */
export function extendStayLength({
    values,
    baseline
}: {
    readonly values: AccommodationEditData;
    readonly baseline: AccommodationEditData;
}): Record<string, unknown> {
    const changed = buildListingPoliciesPatch({
        current: values.policies,
        baseline: baseline.policies,
        keys: STAY_LENGTH_POLICY_KEYS
    });
    if (!changed) return {};
    const policies: Record<string, unknown> = { ...changed };
    for (const key of STAY_LENGTH_POLICY_KEYS) {
        const value = values.policies[key];
        if (!(key in policies) && value !== undefined) policies[key] = value;
    }
    return { policies };
}

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

    // This section owns four blocking requirements. Basic info owns the
    // description and photos owns the main image; each section wires the same
    // transition prompt where its final field can be completed.
    const handleSaved = useCallback(
        ({ before, after }: { before: AccommodationEditData; after: AccommodationEditData }) => {
            void prompt.evaluate({
                before: {
                    description: before.description,
                    capacity: before.maxGuests,
                    minNights: before.policies.minNights ?? null,
                    bedrooms: before.bedrooms,
                    bathrooms: before.bathrooms,
                    hasMainImage
                },
                after: {
                    description: after.description,
                    capacity: after.maxGuests,
                    minNights: after.policies.minNights ?? null,
                    bedrooms: after.bedrooms,
                    bathrooms: after.bathrooms,
                    hasMainImage
                },
                isDraft: after.publicationStatus === PublicationStatusEnum.DRAFT
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
        extendPayload: extendStayLength,
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
                    onPolicyChange={(key, value) =>
                        form.setValue(
                            'policies',
                            setListingPolicy({ policies: form.values.policies, key, value })
                        )
                    }
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
