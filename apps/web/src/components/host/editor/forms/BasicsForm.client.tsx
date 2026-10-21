/**
 * @file BasicsForm.client.tsx
 * @description Form island for `…/editar/datos/` (HOS-318 T-020).
 *
 * Name, summary, description, type and destination — five fields, one screen,
 * one PATCH carrying only those keys.
 */

import { PublicationStatusEnum } from '@repo/schemas';
import { useCallback, useEffect, useState } from 'react';
import type { AccommodationEditData, DestinationData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { buildSlugRefreshPayload, getSlugRefreshOptInPlacement } from '@/lib/listing-slug-refresh';
import { ActionBar } from '../ActionBar.client';
import { AccommodationBasicsSchema } from '../accommodation-edit-form.schema';
import { BasicInfoSection } from '../BasicInfoSection.client';
import { PublishReadyDialog } from '../PublishReadyDialog.client';
import { useAccommodationSectionForm } from '../use-accommodation-section-form';
import { usePublishReadyPrompt } from '../use-publish-ready-prompt';
import styles from './SectionForm.module.css';

/** The fields this page owns. Nothing else can reach the PATCH body. */
const OWN_FIELDS = ['name', 'summary', 'description', 'type', 'destinationId'] as const;

interface BasicsFormProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialData: AccommodationEditData;
    readonly destinations: readonly DestinationData[];
    readonly hasMainImage: boolean;
    readonly trialDays: number;
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
    destinations,
    hasMainImage,
    trialDays
}: BasicsFormProps) {
    const [refreshSlugFromName, setRefreshSlugFromName] = useState(false);
    const prompt = usePublishReadyPrompt();
    const handleSaved = useCallback(
        ({ before, after }: { before: AccommodationEditData; after: AccommodationEditData }) => {
            void prompt.evaluate({
                before: {
                    description: before.description,
                    capacity: before.maxGuests,
                    minNights: before.minNights,
                    bedrooms: before.bedrooms,
                    bathrooms: before.bathrooms,
                    hasMainImage
                },
                after: {
                    description: after.description,
                    capacity: after.maxGuests,
                    minNights: after.minNights,
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
        schema: AccommodationBasicsSchema,
        onSaved: handleSaved,
        extendPayload: ({ payload, values, baseline }) => ({
            ...payload,
            // HOS-879: the slug is generated from `type` + `name`, so a
            // type-only change (e.g. COUNTRY_HOUSE -> CABIN) needs the same
            // opt-in as a rename does.
            ...buildSlugRefreshPayload({
                currentPublicationStatus: initialData.publicationStatus,
                initialName: baseline.name,
                currentName: values.name,
                initialType: baseline.type,
                currentType: values.type,
                refreshSlugFromName
            })
        })
    });

    const slugRefreshPlacement = getSlugRefreshOptInPlacement({
        currentPublicationStatus: initialData.publicationStatus,
        initialName: form.baselineValues.name,
        currentName: form.values.name,
        initialType: form.baselineValues.type,
        currentType: form.values.type
    });
    const shouldOfferSlugRefresh = slugRefreshPlacement.nearName || slugRefreshPlacement.nearType;

    useEffect(() => {
        if (!shouldOfferSlugRefresh) {
            setRefreshSlugFromName(false);
        }
    }, [shouldOfferSlugRefresh]);

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
                    shouldOfferSlugRefreshNearName={slugRefreshPlacement.nearName}
                    shouldOfferSlugRefreshNearType={slugRefreshPlacement.nearType}
                    refreshSlugFromName={refreshSlugFromName}
                    onRefreshSlugFromNameChange={setRefreshSlugFromName}
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
