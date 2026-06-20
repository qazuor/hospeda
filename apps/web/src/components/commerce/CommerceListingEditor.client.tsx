/**
 * @file CommerceListingEditor.client.tsx
 * @description Operational editor island for a commerce owner's listing
 * (SPEC-249 Part A). Renders a native form whose field groups edit ONLY the
 * operational fields the owner is allowed to change; identity/core fields are
 * shown read-only by the hosting page, not here.
 *
 * Scaffolding (T-011/T-012): props + section layout. The per-group field
 * editors and the PATCH submit wiring land in T-012..T-016.
 */
import type { CommerceListingDetail, CommerceVertical } from '@/lib/commerce/owner-listings';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { JSX } from 'react';

export interface CommerceListingEditorProps {
    /** Which vertical this listing belongs to (drives the PATCH endpoint + price group). */
    readonly vertical: CommerceVertical;
    /** UUID of the listing being edited. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /** Current operational + identity values fetched from the protected getById. */
    readonly initialData: CommerceListingDetail;
}

/**
 * Owner operational editor. The form is intentionally native HTML (no TanStack
 * Form) per the web app conventions; submission persists through the vertical's
 * protected PATCH endpoint (wired in T-012).
 */
export function CommerceListingEditor({
    vertical,
    listingId,
    locale,
    initialData
}: CommerceListingEditorProps): JSX.Element {
    const { t } = createTranslations(locale);

    return (
        <form
            className="commerce-editor"
            data-vertical={vertical}
            data-listing-id={listingId}
            aria-label={t('commerce.owner.editor.sections.openingHours', 'Editor')}
        >
            {/*
             * Field groups are added in:
             *   T-013 simple fields (contactInfo, richDescription, price group)
             *   T-014 structured fields (openingHours, socialNetworks)
             *   T-015 media gallery
             *   T-016 amenities / features
             * initialData seeds each group's initial value.
             */}
            <input
                type="hidden"
                name="__listing"
                value={initialData.id}
            />
        </form>
    );
}
