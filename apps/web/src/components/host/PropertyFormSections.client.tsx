/**
 * @file PropertyFormSections.client.tsx
 * @description Section content dispatcher + section renderers 4-8 for the
 * PropertyForm wizard. Sections 1-3 live in PropertyFormBasicSections.client.tsx.
 *
 * Extracted from PropertyForm.client.tsx to stay under 500 lines per file.
 */

import type { usePropertyForm } from '@/hooks/usePropertyForm';
import type { SupportedLocale } from '@/lib/i18n';
import type { ModerationStatusEnum } from '@repo/schemas';
import { PropertyFormAmenities } from './PropertyFormAmenities.client';
import {
    Section1BasicData,
    Section2Location,
    Section3Capacity
} from './PropertyFormBasicSections.client';
import { PropertyFormContact } from './PropertyFormContact.client';
import { PropertyFormPhotos } from './PropertyFormPhotos.client';
import { PropertyFormPrice } from './PropertyFormPrice.client';
import { PropertyFormPublish } from './PropertyFormPublish.client';

// ---------------------------------------------------------------------------
// SectionContentProps (exported — used by PropertyForm.client.tsx)
// ---------------------------------------------------------------------------

/** Shared props passed to every section renderer. */
export interface SectionContentProps {
    readonly sectionKey: string;
    readonly form: ReturnType<typeof usePropertyForm>['form'];
    readonly selectedAmenityIds: ReadonlyArray<string>;
    readonly setSelectedAmenityIds: (ids: ReadonlyArray<string>) => void;
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
    readonly resolvedAccommodationId: string | undefined;
    readonly onFieldChange: (field: string, value: unknown) => void;
    readonly onBlur: () => void;
    readonly getError: (field: string) => string | undefined;
    readonly t: (key: string, fallback?: string) => string;
    // Section 8 — publish specific
    readonly missingRequiredFields: readonly string[];
    readonly isFormComplete: boolean;
    readonly publishError: string | null;
    readonly onSaveDraft: () => void;
    readonly onPublish: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// SectionContent dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatches to the correct section renderer based on `sectionKey`.
 */
export function SectionContent(props: SectionContentProps) {
    const { sectionKey } = props;
    switch (sectionKey) {
        case 'datos-basicos':
            return <Section1BasicData {...props} />;
        case 'ubicacion':
            return <Section2Location {...props} />;
        case 'capacidad':
            return <Section3Capacity {...props} />;
        case 'amenities':
            return <Section4Amenities {...props} />;
        case 'fotos':
            return <Section5Photos {...props} />;
        case 'precio':
            return <Section6Price {...props} />;
        case 'contacto':
            return <Section7Contact {...props} />;
        case 'publicar':
            return <Section8Publish {...props} />;
        default:
            return null;
    }
}

// ---------------------------------------------------------------------------
// Section 4 — Amenities
// ---------------------------------------------------------------------------

function Section4Amenities({
    selectedAmenityIds,
    setSelectedAmenityIds,
    locale,
    apiUrl
}: SectionContentProps) {
    return (
        <PropertyFormAmenities
            selectedIds={selectedAmenityIds}
            onChange={setSelectedAmenityIds}
            locale={locale}
            apiUrl={apiUrl}
        />
    );
}

// ---------------------------------------------------------------------------
// Section 5 — Photos
// ---------------------------------------------------------------------------

function Section5Photos({
    form,
    onFieldChange,
    resolvedAccommodationId,
    apiUrl,
    locale
}: SectionContentProps) {
    type GalleryItem = {
        url: string;
        caption?: string;
        description?: string;
        moderationState: ModerationStatusEnum;
    };
    type MediaValues = { gallery?: GalleryItem[] };
    const media = (form.values.media ?? {}) as MediaValues;
    const gallery = media.gallery ?? [];

    function handleGalleryChange(items: ReadonlyArray<GalleryItem>): void {
        onFieldChange('media.gallery', [...items]);
    }

    return (
        <PropertyFormPhotos
            gallery={gallery}
            onChange={handleGalleryChange}
            entityId={resolvedAccommodationId}
            apiUrl={apiUrl}
            locale={locale}
            maxImages={20}
        />
    );
}

// ---------------------------------------------------------------------------
// Section 6 — Price
// ---------------------------------------------------------------------------

function Section6Price({ form, onFieldChange, onBlur, getError, locale }: SectionContentProps) {
    type PriceValues = { price?: number; currency?: string };
    const price = (form.values.price ?? {}) as PriceValues;

    return (
        <PropertyFormPrice
            priceValue={price.price}
            currencyValue={price.currency}
            onPriceChange={(v) => onFieldChange('price.price', v)}
            onCurrencyChange={(v) => onFieldChange('price.currency', v)}
            onBlur={onBlur}
            priceError={getError('price.price')}
            currencyError={getError('price.currency')}
            locale={locale}
        />
    );
}

// ---------------------------------------------------------------------------
// Section 7 — Contact
// ---------------------------------------------------------------------------

function Section7Contact({ form, onFieldChange, onBlur, getError, locale }: SectionContentProps) {
    type ContactValues = { mobilePhone?: string; personalEmail?: string; preferredPhone?: string };
    const contactInfo = (form.values.contactInfo ?? {}) as ContactValues;

    return (
        <PropertyFormContact
            mobilePhone={contactInfo.mobilePhone}
            personalEmail={contactInfo.personalEmail}
            preferredPhone={contactInfo.preferredPhone}
            onMobilePhoneChange={(v) => onFieldChange('contactInfo.mobilePhone', v)}
            onPersonalEmailChange={(v) => onFieldChange('contactInfo.personalEmail', v)}
            onPreferredPhoneChange={(v) => onFieldChange('contactInfo.preferredPhone', v)}
            onBlur={onBlur}
            mobilePhoneError={getError('contactInfo.mobilePhone')}
            personalEmailError={getError('contactInfo.personalEmail')}
            locale={locale}
        />
    );
}

// ---------------------------------------------------------------------------
// Section 8 — Publish
// ---------------------------------------------------------------------------

function Section8Publish({
    form,
    missingRequiredFields,
    isFormComplete,
    publishError,
    onSaveDraft,
    onPublish,
    locale
}: SectionContentProps) {
    return (
        <PropertyFormPublish
            missingRequiredFields={missingRequiredFields}
            isFormComplete={isFormComplete}
            isSubmitting={form.isSubmitting}
            publishError={publishError}
            onSaveDraft={onSaveDraft}
            onPublish={onPublish}
            locale={locale}
        />
    );
}
