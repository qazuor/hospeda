/**
 * @file AccommodationEditor.client.tsx
 * @description Orchestrator component for the accommodation edit form.
 *
 * Manages form state with useState per field, renders section subcomponents,
 * handles field changes, and implements submit with validation + API call.
 *
 * Follows the ProfileEditForm.client.tsx orchestrator pattern: one component
 * owns all state + handlers, delegates rendering to section subcomponents.
 */

import {
    AccommodationUpdateHttpSchema,
    InternationalPhoneRegex,
    PriceCurrencyEnumSchema
} from '@repo/schemas';
import { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';
import type {
    AccommodationEditData,
    AccommodationTranslationData,
    AmenityData,
    DestinationData,
    MediaImage
} from '@/lib/api/types';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import styles from './AccommodationEditor.module.css';
import { ExternalReputationSection } from './ExternalReputationSection.client';
import { ActionBar } from './editor/ActionBar.client';
import { AmenitiesSection } from './editor/AmenitiesSection.client';
import { BasicInfoSection } from './editor/BasicInfoSection.client';
import { CalendarSection } from './editor/CalendarSection.client';
import { CapacitySection } from './editor/CapacitySection.client';
import { ContactInfoSection } from './editor/ContactInfoSection.client';
import type { EditorSectionNavItem } from './editor/EditorSectionNav.client';
import { EditorSectionNav } from './editor/EditorSectionNav.client';
import { FeaturedToggleSection } from './editor/FeaturedToggleSection.client';
import { LocationPicker } from './editor/LocationPicker.client';
import { PhotoSection } from './editor/PhotoSection.client';
import { PlanEntitlementGate } from './editor/PlanEntitlementGate.client';
import { PricingSection } from './editor/PricingSection.client';
import { SocialNetworksSection } from './editor/SocialNetworksSection.client';
import { TranslationPanel } from './editor/TranslationPanel.client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for AccommodationEditor. */
export interface AccommodationEditorProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialData: AccommodationEditData;
    /**
     * Translation status data for the TranslationPanel (SPEC-212).
     * Kept separate from `initialData` / `AccommodationEditData` to ensure it
     * never enters the PATCH diff produced by `buildPatchPayload`.
     */
    readonly translationData?: AccommodationTranslationData | null;
    readonly destinations: readonly DestinationData[];
    readonly amenities: readonly AmenityData[];
    readonly features: readonly AmenityData[];
    readonly initialFeaturedImage?: MediaImage | null;
    readonly initialGallery?: readonly MediaImage[];
}

/**
 * PATCH-diff validation schema for the accommodation editor (HOS-190 slice 3).
 *
 * Extends the REAL `AccommodationUpdateHttpSchema` — the exact schema
 * `PATCH /api/v1/protected/accommodations/:id` validates the request body
 * against (see `apps/api/src/routes/accommodation/protected/patch.ts`) — so
 * email/URL/social-network field validation matches the server 1:1.
 *
 * Three fields are overridden because the HTTP schema is deliberately looser
 * than `AccommodationSchema` (the domain source of truth), and this editor
 * previously validated against the loose client-side bounds only:
 *  - `name`: HTTP schema allows up to 200 chars; the domain caps it at 100.
 *  - `description`: HTTP schema allows up to 5000 chars with no minimum; the
 *    domain requires 30–2000 (`AccommodationSchema.description`).
 *  - `basePrice`: HTTP schema accepts `0`; the domain's `PriceSchema.price`
 *    requires a strictly positive value.
 *  - `phone` / `whatsapp`: the HTTP schema types these as a bare
 *    `z.string().optional()` with NO format check (unlike `email`/`website`/all
 *    social URLs in the same schema), so `"asdasd"` used to pass both the client
 *    gate and the server. They are re-tightened here to the shared
 *    `InternationalPhoneRegex` — the SAME E.164 pattern `ProfileEditSchema.phone`
 *    already enforces (`ContactInfoSection` composes the value as
 *    `"<dialCode> <number>"`, which the regex accepts). `''` stays valid so a
 *    host can clear the field (HOS-190 validation-gap fix).
 *
 * The numeric fields that `AccommodationEditData` types as `number | null`
 * (latitude/longitude/maxGuests/bedrooms/bathrooms/basePrice/currency) are
 * widened with `.nullable()` — the inherited `z.coerce.number()` would
 * otherwise silently coerce an explicit `null` (host clearing the field) to
 * `0`, which then passes bounds checks it should not.
 */
const AccommodationEditFormSchema = AccommodationUpdateHttpSchema.extend({
    name: z
        .string()
        .min(3, { message: 'zodError.accommodation.name.min' })
        .max(100, { message: 'zodError.accommodation.name.max' })
        .optional(),
    description: z
        .string()
        .min(30, { message: 'zodError.accommodation.description.min' })
        .max(2000, { message: 'zodError.accommodation.description.max' })
        .optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    maxGuests: z.number().int().min(1).max(200).nullable().optional(),
    bedrooms: z.number().int().min(0).max(100).nullable().optional(),
    bathrooms: z.number().int().min(1).max(100).nullable().optional(),
    basePrice: z
        .number()
        .positive({ message: 'zodError.common.price.price.positive' })
        .nullable()
        .optional(),
    currency: PriceCurrencyEnumSchema.nullable().optional(),
    phone: z
        .union([
            z.literal(''),
            z.string().regex(InternationalPhoneRegex, {
                message: 'zodError.common.contact.mobilePhone.international'
            })
        ])
        .optional(),
    whatsapp: z
        .union([
            z.literal(''),
            z.string().regex(InternationalPhoneRegex, {
                message: 'zodError.common.contact.whatsapp.international'
            })
        ])
        .optional()
});

/** Field-level error shape consumed by every editor section (dotted/flat keys). */
type FieldErrors = Record<string, string>;

/**
 * Maps the schema-keyed social errors (`facebook`, `instagram`, ...) to the
 * `AccommodationEditData`-keyed shape `SocialNetworksSection` expects
 * (`facebookUrl`, `instagramUrl`, ...). The two differ only by the trailing
 * `Url` the form-local field names carry.
 */
function mapSocialFieldErrors(fieldErrors: FieldErrors): {
    facebookUrl?: string;
    instagramUrl?: string;
    twitterUrl?: string;
    linkedinUrl?: string;
    tiktokUrl?: string;
    youtubeUrl?: string;
} {
    return {
        facebookUrl: fieldErrors.facebook,
        instagramUrl: fieldErrors.instagram,
        twitterUrl: fieldErrors.twitter,
        linkedinUrl: fieldErrors.linkedin,
        tiktokUrl: fieldErrors.tiktok,
        youtubeUrl: fieldErrors.youtube
    };
}

/**
 * Social fields are named `<network>Url` in `AccommodationEditData` but the
 * validation schema (mirroring the flat HTTP payload) uses the bare platform
 * name — translate before clearing so the right key is touched.
 */
const SOCIAL_FIELD_TO_SCHEMA_KEY: Partial<Record<keyof AccommodationEditData, string>> = {
    facebookUrl: 'facebook',
    instagramUrl: 'instagram',
    twitterUrl: 'twitter',
    linkedinUrl: 'linkedin',
    tiktokUrl: 'tiktok',
    youtubeUrl: 'youtube'
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Accommodation editor form orchestrator.
 *
 * Initializes state from `initialData`, renders section components,
 * manages field-level state changes, validates required fields on submit,
 * builds a PATCH payload with only changed fields, and calls the API.
 */
export function AccommodationEditor({
    locale,
    accommodationId,
    initialData,
    translationData = null,
    destinations,
    amenities,
    features,
    initialFeaturedImage = null,
    initialGallery = []
}: AccommodationEditorProps) {
    const { t } = createTranslations(locale);

    // --- Form state ---
    const [formData, setFormData] = useState<AccommodationEditData>(initialData);
    // F6 (HOS-190): the PATCH diff is computed against this MUTABLE baseline,
    // resynced to the persisted values after every successful save (see
    // `handleSubmit`). Diffing against the load-time `initialData` prop instead
    // meant that reverting a just-saved field produced an empty diff ("no
    // changes") while the DB still held the new value — the change could not be
    // undone without a full page reload.
    const [baseline, setBaseline] = useState<AccommodationEditData>(initialData);
    // Field-level validation is delegated to the shared `useZodForm` primitive
    // (HOS-190 slice 3) against `AccommodationEditFormSchema` (see above) —
    // previously `validateForm` only checked name/summary/basePrice/currency,
    // leaving the ContactInfoSection/SocialNetworksSection/LocationPicker
    // error slots permanently unpopulated.
    const { fieldErrors, formError, validate, handleApiError, clearError, setFormError } =
        useZodForm({ schema: AccommodationEditFormSchema, t });
    const [isSaving, setIsSaving] = useState(false);

    // --- Field change handlers ---

    const handleTextFieldChange = useCallback(
        (field: keyof AccommodationEditData, value: string) => {
            setFormData((prev) => ({ ...prev, [field]: value }));
            clearError(SOCIAL_FIELD_TO_SCHEMA_KEY[field] ?? field);
        },
        [clearError]
    );

    const handleNumberFieldChange = useCallback(
        (field: keyof AccommodationEditData, value: number | null) => {
            setFormData((prev) => ({ ...prev, [field]: value }));
            clearError(field);
        },
        [clearError]
    );

    const handleCurrencyFieldChange = useCallback(
        (field: keyof AccommodationEditData, value: number | string | null) => {
            setFormData((prev) => ({ ...prev, [field]: value }));
            clearError(field);
        },
        [clearError]
    );

    const handleToggleAmenity = useCallback((amenityId: string) => {
        setFormData((prev) => ({
            ...prev,
            amenityIds: prev.amenityIds.includes(amenityId)
                ? prev.amenityIds.filter((id) => id !== amenityId)
                : [...prev.amenityIds, amenityId]
        }));
    }, []);

    const handleToggleFeature = useCallback((featureId: string) => {
        setFormData((prev) => ({
            ...prev,
            featureIds: prev.featureIds.includes(featureId)
                ? prev.featureIds.filter((id) => id !== featureId)
                : [...prev.featureIds, featureId]
        }));
    }, []);

    // --- Build PATCH payload (only changed fields) ---

    const buildPatchPayload = useCallback(
        (current: AccommodationEditData): Record<string, unknown> => {
            const payload: Record<string, unknown> = {};
            const initial = baseline;

            // Text fields
            if (current.name !== initial.name) {
                payload.name = current.name;
            }
            if (current.summary !== initial.summary) {
                payload.summary = current.summary;
            }
            if (current.description !== initial.description) {
                payload.description = current.description;
            }
            if (current.type !== initial.type) {
                payload.type = current.type;
            }
            if (current.destinationId !== initial.destinationId) {
                payload.destinationId = current.destinationId;
            }

            // Number fields
            //
            // Latitude/longitude MUST travel together: `httpToDomainAccommodationUpdate`
            // (packages/schemas) only emits `location.coordinates` when BOTH
            // `latitude` AND `longitude` are present in the HTTP body — a payload
            // carrying only one of the pair (e.g. the map-drag flow nudges
            // latitude by a hair while longitude happens to land back on its
            // original value) silently drops the coordinate update entirely, with
            // no error surfaced anywhere. Sending both whenever either changed
            // closes that gap (HOS-190 slice 3).
            if (current.latitude !== initial.latitude || current.longitude !== initial.longitude) {
                payload.latitude = current.latitude;
                payload.longitude = current.longitude;
            }
            if (current.maxGuests !== initial.maxGuests) {
                payload.maxGuests = current.maxGuests;
            }
            if (current.bedrooms !== initial.bedrooms) {
                payload.bedrooms = current.bedrooms;
            }
            if (current.bathrooms !== initial.bathrooms) {
                payload.bathrooms = current.bathrooms;
            }

            // Pricing
            if (current.basePrice !== initial.basePrice) {
                payload.basePrice = current.basePrice;
            }
            if (current.currency !== initial.currency) {
                payload.currency = current.currency;
            }

            // Amenities/Features
            const amenitiesChanged =
                current.amenityIds.length !== initial.amenityIds.length ||
                current.amenityIds.some((id) => !initial.amenityIds.includes(id));
            if (amenitiesChanged) {
                payload.amenityIds = [...current.amenityIds];
            }

            const featuresChanged =
                current.featureIds.length !== initial.featureIds.length ||
                current.featureIds.some((id) => !initial.featureIds.includes(id));
            if (featuresChanged) {
                payload.featureIds = [...current.featureIds];
            }

            // Phase B: Contact info (flat HTTP fields)
            if (current.phone !== initial.phone) {
                payload.phone = current.phone;
            }
            if (current.whatsapp !== initial.whatsapp) {
                payload.whatsapp = current.whatsapp;
            }
            if (current.email !== initial.email) {
                payload.email = current.email;
            }
            if (current.website !== initial.website) {
                payload.website = current.website;
            }

            // Phase B: Social networks (flat HTTP fields)
            if (current.facebookUrl !== initial.facebookUrl) {
                payload.facebook = current.facebookUrl;
            }
            if (current.instagramUrl !== initial.instagramUrl) {
                payload.instagram = current.instagramUrl;
            }
            if (current.twitterUrl !== initial.twitterUrl) {
                payload.twitter = current.twitterUrl;
            }
            if (current.linkedinUrl !== initial.linkedinUrl) {
                payload.linkedin = current.linkedinUrl;
            }
            if (current.tiktokUrl !== initial.tiktokUrl) {
                payload.tiktok = current.tiktokUrl;
            }
            if (current.youtubeUrl !== initial.youtubeUrl) {
                payload.youtube = current.youtubeUrl;
            }

            return payload;
        },
        [baseline]
    );

    // --- Submit handler ---

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            setFormError(null);
            const payload = buildPatchPayload(formData);
            if (Object.keys(payload).length === 0) {
                // No changes to persist. Never save silently (HOS-190): give
                // explicit feedback so "Save" always visibly does something.
                addToast({
                    type: 'info',
                    message: t(
                        'host.properties.editor.toast.noChanges',
                        'No hay cambios para guardar'
                    )
                });
                return;
            }

            // Full-diff validation against the real update schema (see
            // `AccommodationEditFormSchema` above) — only the changed fields are
            // checked, so a pre-existing invalid value the host isn't touching
            // never blocks an unrelated save.
            const parsed = validate(payload);
            if (!parsed.success) {
                return;
            }

            setIsSaving(true);
            try {
                const { accommodationEditApi } = await import('@/lib/api/endpoints-protected');
                const result = await accommodationEditApi.update({
                    id: accommodationId,
                    data: payload
                });

                if (result.ok) {
                    setFormError(null);
                    // F6: resync the baseline to what is now persisted so a
                    // subsequent revert of a just-saved field is correctly
                    // detected as a change (and not swallowed as "no changes").
                    setBaseline(formData);
                    addToast({
                        type: 'success',
                        message: t('host.properties.editor.toast.saveSuccess', 'Cambios guardados')
                    });
                } else {
                    handleApiError(
                        result.error,
                        t('host.properties.editor.error.saveFailed', 'Error al guardar')
                    );
                }
            } catch {
                setFormError(t('host.properties.editor.error.network', 'Error de conexión'));
            } finally {
                setIsSaving(false);
            }
        },
        [formData, accommodationId, buildPatchPayload, validate, handleApiError, setFormError, t]
    );

    // --- Cancel handler ---

    const handleCancel = useCallback(() => {
        // Navigate back to properties list
        if (typeof window !== 'undefined') {
            window.history.back();
        }
    }, []);

    // --- Card / section-nav labels (BETA-138) ---
    // Resolved once so the same translated string drives both the sticky
    // section nav and each card's `aria-label` (the wrapping <section> has no
    // visible heading of its own — the inner fieldset's <legend> is not
    // reachable as an accessible name for the outer wrapper).
    const sectionLabels = useMemo(
        () => ({
            basicInfo: t('host.properties.editor.section.basicInfo', 'Información básica'),
            capacity: t('host.properties.editor.section.capacity', 'Capacidad'),
            pricing: t('host.properties.editor.section.pricing', 'Precio'),
            location: t('host.properties.editor.section.location', 'Ubicación'),
            contact: t('host.properties.editor.section.contact', 'Contacto'),
            socialNetworks: t('host.properties.editor.section.socialNetworks', 'Redes sociales'),
            amenities: t('host.properties.editor.section.amenities', 'Servicios y comodidades'),
            photos: t('host.properties.editor.section.photos', 'Fotos'),
            calendar: t('host.properties.editor.section.calendar', 'Calendario'),
            translations: t('host.properties.editor.translation.sectionTitle', 'Traducciones'),
            externalReputation: t(
                'host.properties.editor.section.externalReputation',
                'Reputación externa'
            )
        }),
        [t]
    );

    const navSections = useMemo<EditorSectionNavItem[]>(() => {
        const sections: EditorSectionNavItem[] = [
            { id: 'editor-basicInfo', label: sectionLabels.basicInfo },
            { id: 'editor-capacity', label: sectionLabels.capacity },
            { id: 'editor-pricing', label: sectionLabels.pricing },
            { id: 'editor-location', label: sectionLabels.location },
            { id: 'editor-contact', label: sectionLabels.contact },
            { id: 'editor-socialNetworks', label: sectionLabels.socialNetworks },
            { id: 'editor-amenities', label: sectionLabels.amenities },
            { id: 'editor-photos', label: sectionLabels.photos },
            { id: 'editor-calendar', label: sectionLabels.calendar }
        ];
        if (translationData) {
            sections.push({ id: 'editor-translations', label: sectionLabels.translations });
        }
        sections.push({
            id: 'editor-externalReputation',
            label: sectionLabels.externalReputation
        });
        return sections;
    }, [sectionLabels, translationData]);

    return (
        <form
            className={styles.editor}
            onSubmit={handleSubmit}
            noValidate
        >
            <div className={styles.layout}>
                <div className={styles.navSlot}>
                    <EditorSectionNav
                        locale={locale}
                        sections={navSections}
                    />
                </div>

                <div className={styles.cardsColumn}>
                    <section
                        id="editor-basicInfo"
                        className={styles.card}
                        aria-label={sectionLabels.basicInfo}
                    >
                        <BasicInfoSection
                            locale={locale}
                            data={formData}
                            destinations={destinations}
                            errors={fieldErrors}
                            onFieldChange={handleTextFieldChange}
                        />
                    </section>

                    <section
                        id="editor-capacity"
                        className={styles.card}
                        aria-label={sectionLabels.capacity}
                    >
                        <CapacitySection
                            locale={locale}
                            data={formData}
                            errors={fieldErrors}
                            onFieldChange={handleNumberFieldChange}
                        />
                    </section>

                    <section
                        id="editor-pricing"
                        className={styles.card}
                        aria-label={sectionLabels.pricing}
                    >
                        <PricingSection
                            locale={locale}
                            data={formData}
                            errors={fieldErrors}
                            onFieldChange={handleCurrencyFieldChange}
                        />
                    </section>

                    <section
                        id="editor-location"
                        className={styles.card}
                        aria-label={sectionLabels.location}
                    >
                        <LocationPicker
                            locale={locale}
                            value={{ latitude: formData.latitude, longitude: formData.longitude }}
                            onChange={(coords) => {
                                setFormData((prev) => ({
                                    ...prev,
                                    latitude: coords.latitude,
                                    longitude: coords.longitude
                                }));
                                clearError('latitude');
                                clearError('longitude');
                            }}
                            errors={fieldErrors}
                        />
                    </section>

                    <section
                        id="editor-contact"
                        className={styles.card}
                        aria-label={sectionLabels.contact}
                    >
                        <ContactInfoSection
                            locale={locale}
                            data={formData}
                            errors={fieldErrors}
                            onFieldChange={handleTextFieldChange}
                        />
                    </section>

                    <section
                        id="editor-socialNetworks"
                        className={styles.card}
                        aria-label={sectionLabels.socialNetworks}
                    >
                        <SocialNetworksSection
                            locale={locale}
                            data={formData}
                            errors={mapSocialFieldErrors(fieldErrors)}
                            onFieldChange={handleTextFieldChange}
                        />
                    </section>

                    <section
                        id="editor-amenities"
                        className={styles.card}
                        aria-label={sectionLabels.amenities}
                    >
                        <AmenitiesSection
                            locale={locale}
                            data={formData}
                            amenities={amenities}
                            features={features}
                            onToggleAmenity={handleToggleAmenity}
                            onToggleFeature={handleToggleFeature}
                        />
                    </section>

                    <section
                        id="editor-photos"
                        className={styles.card}
                        aria-label={sectionLabels.photos}
                    >
                        <PhotoSection
                            locale={locale}
                            accommodationId={accommodationId}
                            initialFeaturedImage={initialFeaturedImage}
                            initialGallery={initialGallery}
                        />
                    </section>

                    <section
                        id="editor-calendar"
                        className={styles.card}
                        aria-label={sectionLabels.calendar}
                    >
                        <PlanEntitlementGate
                            entitlementKey="can_use_calendar"
                            locale={locale}
                            upgradeUrl="/suscriptores/planes/"
                        >
                            <CalendarSection
                                locale={locale}
                                accommodationId={accommodationId}
                            />
                        </PlanEntitlementGate>
                    </section>

                    {translationData && (
                        <section
                            id="editor-translations"
                            className={styles.card}
                            aria-label={sectionLabels.translations}
                        >
                            <TranslationPanel
                                locale={locale}
                                accommodationId={accommodationId}
                                translations={translationData}
                            />
                        </section>
                    )}

                    <section
                        id="editor-externalReputation"
                        className={styles.card}
                        aria-label={sectionLabels.externalReputation}
                    >
                        <ExternalReputationSection
                            locale={locale}
                            accommodationId={accommodationId}
                        />
                    </section>

                    {/*
                     * HOS-224: secondary self-service entry point for the
                     * featured toggle. Rendered WITHOUT the editor's section-card
                     * wrapper and WITHOUT a nav item on purpose: the component
                     * self-hides (returns null) for the majority of owners who
                     * lack an active FEATURED_LISTING entitlement, so a card
                     * wrapper would leave an empty card and a nav item would
                     * dead-end. When entitled, it renders its own fieldset card.
                     * Purchasing the visibility-boost addon lives on the canonical
                     * /mi-cuenta/addons page, not here — this only toggles an
                     * already-granted entitlement.
                     */}
                    <FeaturedToggleSection
                        locale={locale}
                        accommodationId={accommodationId}
                    />

                    {formError && (
                        <div
                            className={styles.submitError}
                            role="alert"
                        >
                            {formError}
                        </div>
                    )}

                    <ActionBar
                        locale={locale}
                        isSaving={isSaving}
                        onCancel={handleCancel}
                    />
                </div>
            </div>
        </form>
    );
}
