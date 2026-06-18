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

import type {
    AccommodationEditData,
    AccommodationTranslationData,
    AmenityData,
    DestinationData
} from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useState } from 'react';
import styles from './AccommodationEditor.module.css';
import { ExternalReputationSection } from './ExternalReputationSection.client';
import { ActionBar } from './editor/ActionBar.client';
import { AmenitiesSection } from './editor/AmenitiesSection.client';
import { BasicInfoSection } from './editor/BasicInfoSection.client';
import { CapacitySection } from './editor/CapacitySection.client';
import { ContactInfoSection } from './editor/ContactInfoSection.client';
import { LocationPicker } from './editor/LocationPicker.client';
import { PhotoSection } from './editor/PhotoSection.client';
import type { MediaImage, PhotoSectionData } from './editor/PhotoSection.client';
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

type FieldErrors = {
    name?: string;
    summary?: string;
    description?: string;
    type?: string;
    destinationId?: string;
    maxGuests?: string;
    bedrooms?: string;
    bathrooms?: string;
    basePrice?: string;
    currency?: string;
    phone?: string;
    email?: string;
    website?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    twitterUrl?: string;
    linkedinUrl?: string;
    tiktokUrl?: string;
    youtubeUrl?: string;
    latitude?: string;
    longitude?: string;
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
    const [errors, setErrors] = useState<FieldErrors>({});
    const [isSaving, setIsSaving] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    // --- Photo state ---
    const [photoData, setPhotoData] = useState<PhotoSectionData>({
        featuredImage: initialFeaturedImage ?? null,
        gallery: initialGallery ?? []
    });

    // --- Field change handlers ---

    const handleTextFieldChange = useCallback(
        (field: keyof AccommodationEditData, value: string) => {
            setFormData((prev) => ({ ...prev, [field]: value }));
            // Clear field error on change
            setErrors((prev) => ({ ...prev, [field]: undefined }));
            setSubmitSuccess(false);
        },
        []
    );

    const handleNumberFieldChange = useCallback(
        (field: keyof AccommodationEditData, value: number | null) => {
            setFormData((prev) => ({ ...prev, [field]: value }));
            setErrors((prev) => ({ ...prev, [field]: undefined }));
            setSubmitSuccess(false);
        },
        []
    );

    const handleCurrencyFieldChange = useCallback(
        (field: keyof AccommodationEditData, value: number | string | null) => {
            setFormData((prev) => ({ ...prev, [field]: value }));
            setErrors((prev) => ({ ...prev, [field]: undefined }));
            setSubmitSuccess(false);
        },
        []
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

    // --- Photo handlers ---

    const handleFeaturedImageChange = useCallback((image: MediaImage | null) => {
        setPhotoData((prev) => ({ ...prev, featuredImage: image }));
    }, []);

    const handleGalleryChange = useCallback((gallery: readonly MediaImage[]) => {
        setPhotoData((prev) => ({ ...prev, gallery }));
    }, []);

    // --- Validation ---

    const validateForm = useCallback(
        (data: AccommodationEditData): FieldErrors => {
            const newErrors: FieldErrors = {};

            if (!data.name.trim()) {
                newErrors.name = t(
                    'host.properties.editor.validation.nameRequired',
                    'El nombre es obligatorio'
                );
            } else if (data.name.trim().length < 3) {
                newErrors.name = t(
                    'host.properties.editor.validation.nameMin',
                    'El nombre debe tener al menos 3 caracteres'
                );
            }

            if (!data.summary.trim()) {
                newErrors.summary = t(
                    'host.properties.editor.validation.summaryRequired',
                    'El resumen es obligatorio'
                );
            } else if (data.summary.trim().length < 10) {
                newErrors.summary = t(
                    'host.properties.editor.validation.summaryMin',
                    'El resumen debe tener al menos 10 caracteres'
                );
            }

            if (data.basePrice !== null && data.basePrice !== undefined && data.basePrice < 0) {
                newErrors.basePrice = t(
                    'host.properties.editor.validation.pricePositive',
                    'El precio debe ser un número positivo'
                );
            }

            if (data.currency !== null && data.currency !== undefined) {
                const validCurrencies = ['ARS', 'USD'];
                if (!validCurrencies.includes(data.currency)) {
                    newErrors.currency = t(
                        'host.properties.editor.validation.currencyInvalid',
                        'La moneda debe ser ARS o USD'
                    );
                }
            }

            return newErrors;
        },
        [t]
    );

    // --- Build PATCH payload (only changed fields) ---

    const buildPatchPayload = useCallback(
        (current: AccommodationEditData): Record<string, unknown> => {
            const payload: Record<string, unknown> = {};
            const initial = initialData;

            // Determine whether photo state has diverged from what was loaded.
            // Normalise both sides to null so that null === undefined doesn't
            // trigger a false positive (both mean "no image").
            const currentFeaturedUrl = photoData.featuredImage?.url ?? null;
            const initialFeaturedUrl = initialFeaturedImage?.url ?? null;
            const featuredChanged = currentFeaturedUrl !== initialFeaturedUrl;
            const normalizedInitialGallery = initialGallery ?? [];
            const galleryChanged =
                photoData.gallery.length !== normalizedInitialGallery.length ||
                photoData.gallery.some((img, i) => img.url !== normalizedInitialGallery[i]?.url);

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
            if (current.latitude !== initial.latitude) {
                payload.latitude = current.latitude;
            }
            if (current.longitude !== initial.longitude) {
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

            // SPEC-208: include media when photo state has changed.
            // The HTTP schema accepts images with only { url } — the API converter
            // supplies moderationState: APPROVED for images that lack it.
            if (featuredChanged || galleryChanged) {
                payload.media = {
                    featuredImage: photoData.featuredImage
                        ? { url: photoData.featuredImage.url }
                        : null,
                    gallery: photoData.gallery.map((img) => ({ url: img.url }))
                };
            }

            return payload;
        },
        [initialData, photoData, initialFeaturedImage, initialGallery]
    );

    // --- Submit handler ---

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            setSubmitError(null);
            setSubmitSuccess(false);

            const validationErrors = validateForm(formData);
            const hasErrors = Object.values(validationErrors).some(Boolean);
            if (hasErrors) {
                setErrors(validationErrors);
                return;
            }

            const payload = buildPatchPayload(formData);
            if (Object.keys(payload).length === 0) {
                // No changes — nothing to save
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
                    setSubmitSuccess(true);
                    setSubmitError(null);
                } else {
                    setSubmitError(
                        result.error.message ||
                            t('host.properties.editor.error.saveFailed', 'Error al guardar')
                    );
                }
            } catch {
                setSubmitError(t('host.properties.editor.error.network', 'Error de conexión'));
            } finally {
                setIsSaving(false);
            }
        },
        [formData, accommodationId, validateForm, buildPatchPayload, t]
    );

    // --- Cancel handler ---

    const handleCancel = useCallback(() => {
        // Navigate back to properties list
        if (typeof window !== 'undefined') {
            window.history.back();
        }
    }, []);

    return (
        <form
            className={styles.editor}
            onSubmit={handleSubmit}
        >
            <BasicInfoSection
                locale={locale}
                data={formData}
                destinations={destinations}
                errors={errors}
                onFieldChange={handleTextFieldChange}
            />

            <CapacitySection
                locale={locale}
                data={formData}
                errors={errors}
                onFieldChange={handleNumberFieldChange}
            />

            <PricingSection
                locale={locale}
                data={formData}
                errors={errors}
                onFieldChange={handleCurrencyFieldChange}
            />

            <LocationPicker
                locale={locale}
                value={{ latitude: formData.latitude, longitude: formData.longitude }}
                onChange={(coords) => {
                    setFormData((prev) => ({
                        ...prev,
                        latitude: coords.latitude,
                        longitude: coords.longitude
                    }));
                    setErrors((prev) => ({
                        ...prev,
                        latitude: undefined,
                        longitude: undefined
                    }));
                }}
                errors={errors}
            />

            <ContactInfoSection
                locale={locale}
                data={formData}
                errors={errors}
                onFieldChange={handleTextFieldChange}
            />

            <SocialNetworksSection
                locale={locale}
                data={formData}
                errors={errors}
                onFieldChange={handleTextFieldChange}
            />

            <AmenitiesSection
                locale={locale}
                data={formData}
                amenities={amenities}
                features={features}
                onToggleAmenity={handleToggleAmenity}
                onToggleFeature={handleToggleFeature}
            />

            <PhotoSection
                locale={locale}
                accommodationId={accommodationId}
                data={photoData}
                onFeaturedImageChange={handleFeaturedImageChange}
                onGalleryChange={handleGalleryChange}
            />

            {translationData && (
                <TranslationPanel
                    locale={locale}
                    accommodationId={accommodationId}
                    translations={translationData}
                />
            )}

            <ExternalReputationSection
                locale={locale}
                accommodationId={accommodationId}
            />

            {submitSuccess && (
                <output className={styles.submitSuccess}>
                    {t('host.properties.editor.toast.saveSuccess', 'Cambios guardados')}
                </output>
            )}

            {submitError && (
                <div
                    className={styles.submitError}
                    role="alert"
                >
                    {submitError}
                </div>
            )}

            <ActionBar
                locale={locale}
                isSaving={isSaving}
                onCancel={handleCancel}
            />
        </form>
    );
}
