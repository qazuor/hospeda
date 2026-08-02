/**
 * @file CommerceListingEditor.client.tsx
 * @description Operational + identity editor island for a commerce owner's
 * listing (SPEC-249 Part A, extended in SPEC-253 and HOS-166 D-1). Native
 * HTML form (no TanStack Form, per web conventions) that persists changes
 * through the vertical's protected PATCH endpoint (`updateOwn`).
 *
 * `slug` stays out of this form — it is server-derived at create time and
 * immutable post-create (HOS-166 OQ-3), shown read-only by the hosting page.
 *
 * Field-group coverage (SPEC-253 additions marked *, HOS-166 D-1 marked †):
 *   † name + destinationId (SPEC-239 decision #5 reversed — the owner now
 *     loads their own identity, see `GastronomyOwnerUpdateInputSchema`'s JSDoc)
 *   * type select (per-vertical enum, T-020)
 *   * summary textarea (min 10 / max 300, T-020)
 *   T-012 mechanics + richDescription
 *   T-013 simple fields (contactInfo — no website per AC-4)
 *   T-013 social networks (facebook/instagram/twitter/tiktok/youtube + *linkedIn)
 *   T-014 structured fields (openingHours)
 *   T-014 price group (gastronomy: priceRange + menuUrl | experience: isPriceOnRequest + *priceFrom + *priceUnit)
 *   T-015 media gallery
 *   T-016 amenities / features
 */

import type { Image, OpeningHours } from '@repo/schemas';
import { ExperienceOwnerUpdateInputSchema, GastronomyOwnerUpdateInputSchema } from '@repo/schemas';
import { type JSX, useCallback, useMemo, useState } from 'react';
import type { DestinationOption } from '@/components/gastronomy/CommerceLead.client';
import type { EditorSectionNavItem } from '@/components/host/editor/EditorSectionNav.client';
import { EditorSectionNav } from '@/components/host/editor/EditorSectionNav.client';
import { apiClient } from '@/lib/api/client';
import type { AmenityData } from '@/lib/api/types';
import type { CommerceListingDetail, CommerceVertical } from '@/lib/commerce/owner-listings';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import styles from './CommerceListingEditor.module.css';
import {
    type CommerceI18nValues,
    CommerceTranslationPanel,
    parseCommerceI18nValues
} from './CommerceTranslationPanel.client';
import { AmenitiesSection } from './editor/AmenitiesSection.client';
import { BasicInfoSection } from './editor/BasicInfoSection.client';
import { ContactSection } from './editor/ContactSection.client';
import {
    type CommerceEditData,
    type ContactValues,
    SOCIAL_KEYS,
    type SocialValues
} from './editor/commerce-edit-data';
import { MediaSection } from './editor/MediaSection.client';
import { OpeningHoursSection } from './editor/OpeningHoursSection.client';
import { PriceSection } from './editor/PriceSection.client';
import { SocialNetworksSection } from './editor/SocialNetworksSection.client';

export interface CommerceListingEditorProps {
    /** Which vertical this listing belongs to (drives the PATCH endpoint + price group). */
    readonly vertical: CommerceVertical;
    /** UUID of the listing being edited. */
    readonly listingId: string;
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /** Current operational + identity values fetched from the protected getById. */
    readonly initialData: CommerceListingDetail;
    /** Amenity catalog for the multi-select (fetched SSR from the public endpoint). */
    readonly amenities?: readonly AmenityData[];
    /** Feature catalog for the multi-select (fetched SSR from the public endpoint). */
    readonly features?: readonly AmenityData[];
    /**
     * Destination options for the destination select (HOS-166 D-1). Fetched
     * SSR by the hosting page, same pattern as `amenities`/`features`.
     */
    readonly destinations?: readonly DestinationOption[];
    /**
     * `true` when the SSR destination catalog fetch failed (as opposed to
     * succeeding with a genuinely empty catalog). `destinationId` is REQUIRED
     * for publish-readiness (`resolveListingCompleteness`), so silently
     * hiding the select on a failed fetch (the old `destinations.length > 0`
     * gate) left the owner with no way to ever complete their listing and no
     * indication why the field was missing. Defaults to `false` so existing
     * callers/tests that omit it keep the prior behaviour.
     */
    readonly destinationsLoadFailed?: boolean;
}

type SaveStatus =
    | { readonly kind: 'idle' }
    | { readonly kind: 'saving' }
    | { readonly kind: 'success' }
    | { readonly kind: 'error' };

/** Resolve the owner PATCH endpoint for the given vertical. */
function patchPathFor({
    vertical,
    listingId
}: {
    vertical: CommerceVertical;
    listingId: string;
}): string {
    return vertical === 'gastronomy'
        ? `/api/v1/protected/gastronomies/${listingId}`
        : `/api/v1/protected/experiences/${listingId}`;
}

/** Read a nullable string field from an unknown record as a form-friendly string. */
function strField(source: Record<string, unknown>, key: string): string {
    const value = source[key];
    return typeof value === 'string' ? value : '';
}

/** Drop empty-string entries, mapping them to undefined for the payload. */
function nonEmpty(value: string): string | undefined {
    return value || undefined;
}

/**
 * Structural comparison for the nested values (openingHours, media, i18n).
 *
 * A serialization compare is key-order sensitive, so it can report a change
 * where none exists. That direction is harmless: a false positive sends a
 * redundant-but-correct value in the PATCH. The dangerous direction — reporting
 * "unchanged" for a real edit, which would silently drop the owner's work —
 * cannot be produced by key reordering, only by equal content. Every value
 * compared here is rebuilt by spreading the previous object, so ordering is
 * stable in practice anyway.
 */
function sameValue(a: unknown, b: unknown): boolean {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** Set equality by membership (order-independent). */
function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
    return a.size === b.size && [...a].every((id) => b.has(id));
}

/**
 * Build the PATCH body as the diff between the edited form and the last
 * persisted snapshot.
 *
 * This is NOT a uniform per-leaf diff, and the asymmetries are load-bearing:
 *
 *  - `contactInfo` / `socialNetworks` / `media` are JSONB blocks the API
 *    REPLACES rather than merges, so the whole block ships whenever any member
 *    changed — sending only the changed leaf would wipe the others.
 *  - The four i18n fields travel together, as the translation panel edits them
 *    as one unit.
 *  - Gastronomy's `priceRange`/`menuUrl` are `.nullish()` on the domain schema
 *    and clear to an explicit `null`; experience's `priceFrom`/`priceUnit` are
 *    NOT nullable and must omit the key instead (T-021 — sending `null` there
 *    fails validation whenever the owner clears the field).
 *  - `preservedMedia` (videos / archivedGallery) is re-sent with every media
 *    patch because the owner never edits it and the block is replaced wholesale.
 */
function buildPatchPayload({
    current,
    baseline,
    vertical,
    preservedMedia
}: {
    current: CommerceEditData;
    baseline: CommerceEditData;
    vertical: CommerceVertical;
    preservedMedia: Record<string, unknown>;
}): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (current.name !== baseline.name) {
        payload.name = current.name;
    }
    if (current.destinationId !== baseline.destinationId) {
        payload.destinationId = current.destinationId || undefined;
    }
    if (current.listingType !== baseline.listingType) {
        payload.type = current.listingType || undefined;
    }
    if (current.summary !== baseline.summary) {
        payload.summary = current.summary || undefined;
    }
    if (current.description !== baseline.description) {
        payload.description = current.description || undefined;
    }
    if (current.richDescription !== baseline.richDescription) {
        payload.richDescription = current.richDescription;
    }

    if (!sameValue(current.i18nValues, baseline.i18nValues)) {
        payload.nameI18n = current.i18nValues.nameI18n;
        payload.summaryI18n = current.i18nValues.summaryI18n;
        payload.descriptionI18n = current.i18nValues.descriptionI18n;
        payload.richDescriptionI18n = current.i18nValues.richDescriptionI18n;
    }

    if (!sameValue(current.contact, baseline.contact)) {
        payload.contactInfo = {
            mobilePhone: nonEmpty(current.contact.mobilePhone),
            workEmail: nonEmpty(current.contact.workEmail)
        };
    }

    if (SOCIAL_KEYS.some((key) => current.social[key] !== baseline.social[key])) {
        payload.socialNetworks = {
            facebook: nonEmpty(current.social.facebook),
            instagram: nonEmpty(current.social.instagram),
            twitter: nonEmpty(current.social.twitter),
            tiktok: nonEmpty(current.social.tiktok),
            youtube: nonEmpty(current.social.youtube),
            linkedIn: nonEmpty(current.social.linkedIn)
        };
    }

    if (!sameValue(current.openingHours, baseline.openingHours)) {
        payload.openingHours = current.openingHours;
    }

    if (
        !sameValue(current.featuredImage, baseline.featuredImage) ||
        !sameValue(current.gallery, baseline.gallery)
    ) {
        payload.media = {
            ...preservedMedia,
            ...(current.featuredImage ? { featuredImage: current.featuredImage } : {}),
            gallery: current.gallery
        };
    }

    if (!sameSet(current.amenityIds, baseline.amenityIds)) {
        payload.amenityIds = [...current.amenityIds];
    }
    if (!sameSet(current.featureIds, baseline.featureIds)) {
        payload.featureIds = [...current.featureIds];
    }

    if (vertical === 'gastronomy') {
        if (current.priceRange !== baseline.priceRange) {
            payload.priceRange = current.priceRange || null;
        }
        if (current.menuUrl !== baseline.menuUrl) {
            payload.menuUrl = current.menuUrl || null;
        }
    } else {
        if (current.isPriceOnRequest !== baseline.isPriceOnRequest) {
            payload.isPriceOnRequest = current.isPriceOnRequest;
        }
        if (current.priceFrom !== baseline.priceFrom) {
            payload.priceFrom = current.priceFrom ?? undefined;
        }
        if (current.priceUnit !== baseline.priceUnit) {
            payload.priceUnit = current.priceUnit || undefined;
        }
    }

    return payload;
}

/**
 * Owner operational editor. Tracks which field groups changed and PATCHes ONLY
 * the dirty subset, so an owner who edits one section never re-submits the rest.
 */
export function CommerceListingEditor({
    vertical,
    listingId,
    locale,
    initialData,
    amenities = [],
    features = [],
    destinations = [],
    destinationsLoadFailed = false
}: CommerceListingEditorProps): JSX.Element {
    const { t } = createTranslations(locale);

    // Field-level validation is delegated to the shared `useZodForm` primitive
    // (HOS-190 slice 3) against the REAL per-vertical owner-update schema — the
    // exact schema `PATCH /api/v1/protected/{gastronomies|experiences}/:id`
    // validates the request body against (`apps/api/src/routes/.../protected/patch.ts`).
    // Validating the full dirty-field payload against it (instead of the two ad
    // hoc summary/priceFrom checks this editor had) closes contact
    // (mobilePhone/workEmail), social networks, opening hours, menuUrl, and the
    // priceFrom/priceUnit null-vs-undefined bug (see `buildPayload` below).
    const schema =
        vertical === 'gastronomy'
            ? GastronomyOwnerUpdateInputSchema
            : ExperienceOwnerUpdateInputSchema;
    const { fieldErrors, formError, validate, handleApiError } = useZodForm({ schema, t });

    // TYPE-WORKAROUND: the detail is a gastronomy|experience union; we read heterogeneous operational fields by key, which the union type cannot express.
    const data = initialData as unknown as Record<string, unknown>;
    const initialContact = (data.contactInfo ?? {}) as Record<string, unknown>;
    const initialSocial = (data.socialNetworks ?? {}) as Record<string, unknown>;
    const initialMedia = (data.media ?? {}) as Record<string, unknown>;

    // HOS-166 D-1: name + destinationId + description — identity fields now
    // owner-editable (description was widened alongside name/destinationId on
    // the schema — see `GastronomyOwnerUpdateInputSchema`/
    // `ExperienceOwnerUpdateInputSchema` — but the FORM never exposed it,
    // leaving it settable only at create, contradicting AC-19).
    // Media JSONB is REPLACED wholesale on save (gastronomy/experience do not
    // merge it), so preserve the owner-unmanaged sub-fields (videos,
    // archivedGallery) and re-send them with every media patch. Deliberately
    // outside `formData`: never editable, never diffed.
    const [preservedMedia] = useState<Record<string, unknown>>(() => {
        const preserved: Record<string, unknown> = {};
        if (Array.isArray(initialMedia.videos)) {
            preserved.videos = initialMedia.videos;
        }
        if (Array.isArray(initialMedia.archivedGallery)) {
            preserved.archivedGallery = initialMedia.archivedGallery;
        }
        return preserved;
    });

    // HOS-166 D-1: name + destinationId + description are identity fields the
    // owner may edit (description was widened alongside name/destinationId on
    // the schema — see `GastronomyOwnerUpdateInputSchema`/
    // `ExperienceOwnerUpdateInputSchema` — but the FORM never exposed it,
    // leaving it settable only at create, contradicting AC-19).
    const buildInitialEditData = (): CommerceEditData => ({
        name: strField(data, 'name'),
        destinationId: strField(data, 'destinationId'),
        description: strField(data, 'description'),
        // T-020: type select state (per-vertical enum value)
        listingType: strField(data, 'type'),
        // T-020: summary (min 10 / max 300) — validated by `schema` through
        // `fieldErrors.summary`; no local ad hoc check.
        summary: strField(data, 'summary'),
        richDescription: strField(data, 'richDescription'),
        // T-020: website removed from contact per AC-4; mobilePhone + workEmail only
        contact: {
            mobilePhone: strField(initialContact, 'mobilePhone'),
            workEmail: strField(initialContact, 'workEmail')
        },
        // T-020: added linkedIn to social per AC-4
        social: {
            facebook: strField(initialSocial, 'facebook'),
            instagram: strField(initialSocial, 'instagram'),
            twitter: strField(initialSocial, 'twitter'),
            tiktok: strField(initialSocial, 'tiktok'),
            youtube: strField(initialSocial, 'youtube'),
            linkedIn: strField(initialSocial, 'linkedIn')
        },
        openingHours: (data.openingHours as OpeningHours | null | undefined) ?? null,
        priceRange: strField(data, 'priceRange'),
        menuUrl: strField(data, 'menuUrl'),
        isPriceOnRequest: data.isPriceOnRequest === true,
        // T-021: experience-only pricing fields
        priceFrom: typeof data.priceFrom === 'number' ? data.priceFrom : null,
        priceUnit: strField(data, 'priceUnit'),
        featuredImage: (initialMedia.featuredImage as Image | undefined) ?? null,
        gallery: (initialMedia.gallery as Image[] | undefined) ?? [],
        amenityIds: new Set((data.amenityIds as string[] | undefined) ?? []),
        featureIds: new Set((data.featureIds as string[] | undefined) ?? []),
        // T-023: i18n fields (nameI18n, summaryI18n, descriptionI18n, richDescriptionI18n)
        i18nValues: parseCommerceI18nValues(data)
    });

    const [formData, setFormData] = useState<CommerceEditData>(buildInitialEditData);
    // The PATCH diff is computed against this MUTABLE baseline, resynced to the
    // persisted values after every successful save — mirroring the accommodation
    // editor (HOS-190 F6). Diffing against the load-time `initialData` prop
    // instead would make reverting a just-saved field produce an empty diff
    // while the DB still held the new value, leaving the owner unable to undo
    // the change without a full page reload.
    const [baseline, setBaseline] = useState<CommerceEditData>(buildInitialEditData);

    // Only the values still read by the orchestrator's own JSX. Everything else
    // reaches its section component through the `data` prop (HOS-258 PR 2).
    const { openingHours, featuredImage, gallery, amenityIds, featureIds, i18nValues } = formData;

    const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

    /**
     * Generic single-field change, shared by every scalar input in the form —
     * the commerce counterpart of the accommodation editor's
     * `handleTextFieldChange`. Resets any stale save status, exactly as the
     * former `markDirty` did.
     */
    const onFieldChange = useCallback(
        <K extends keyof CommerceEditData>(field: K, value: CommerceEditData[K]) => {
            setFormData((prev) => ({ ...prev, [field]: value }));
            setStatus({ kind: 'idle' });
        },
        []
    );

    const updateContact = useCallback((patch: Partial<ContactValues>) => {
        setFormData((prev) => ({ ...prev, contact: { ...prev.contact, ...patch } }));
        setStatus({ kind: 'idle' });
    }, []);

    const updateSocial = useCallback((key: keyof SocialValues, val: string) => {
        setFormData((prev) => ({ ...prev, social: { ...prev.social, [key]: val } }));
        setStatus({ kind: 'idle' });
    }, []);

    const updateMedia = useCallback(
        (next: { readonly featuredImage: Image | null; readonly gallery: readonly Image[] }) => {
            setFormData((prev) => ({
                ...prev,
                featuredImage: next.featuredImage,
                gallery: next.gallery
            }));
            setStatus({ kind: 'idle' });
        },
        []
    );

    const toggleAmenity = useCallback((id: string) => {
        setFormData((prev) => {
            const next = new Set(prev.amenityIds);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return { ...prev, amenityIds: next };
        });
        setStatus({ kind: 'idle' });
    }, []);

    const toggleFeature = useCallback((id: string) => {
        setFormData((prev) => {
            const next = new Set(prev.featureIds);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return { ...prev, featureIds: next };
        });
        setStatus({ kind: 'idle' });
    }, []);

    /** Handle i18n panel changes — the four i18n fields travel as one unit. */
    const handleI18nChange = useCallback((updated: CommerceI18nValues) => {
        setFormData((prev) => ({ ...prev, i18nValues: updated }));
        setStatus({ kind: 'idle' });
    }, []);

    /**
     * The PATCH body: the diff between the edited form and the last persisted
     * snapshot (see `buildPatchPayload` for the per-field contract). Memoized so
     * `canSave` can be derived from it without rebuilding the payload on every
     * render.
     */
    const patchPayload = useMemo(
        () => buildPatchPayload({ current: formData, baseline, vertical, preservedMedia }),
        [formData, baseline, vertical, preservedMedia]
    );

    const handleSubmit = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (Object.keys(patchPayload).length === 0) {
                return;
            }

            const payload = patchPayload;
            // Snapshot the values this request persists, so the baseline resync
            // below records exactly what was saved even if the owner keeps
            // typing while the request is in flight.
            const persisted = formData;

            // Full payload validation against the real per-vertical owner-update
            // schema (see `schema` above) — replaces the two ad hoc
            // summary/priceFrom checks this editor previously ran by hand.
            const parsed = validate(payload);
            if (!parsed.success) {
                return;
            }

            setStatus({ kind: 'saving' });

            const result = await apiClient.patch<unknown>({
                path: patchPathFor({ vertical, listingId }),
                body: payload
            });

            if (result.ok) {
                setBaseline(persisted);
                setStatus({ kind: 'idle' });
                addToast({
                    type: 'success',
                    message: t('commerce.owner.editor.success', 'Cambios guardados.')
                });
            } else {
                // Previously discarded `result.error` entirely and always showed
                // a fixed banner string. `handleApiError` maps per-field details
                // when the API sent them, falling back to a real (translated)
                // banner message otherwise — see `field-errors.ts` module doc.
                handleApiError(
                    result.error,
                    t('commerce.owner.editor.error', 'No se pudieron guardar los cambios.')
                );
                setStatus({ kind: 'error' });
            }
        },
        [patchPayload, formData, vertical, listingId, validate, handleApiError, t]
    );

    const isSaving = status.kind === 'saving';
    // Derived from the diff, so reverting an edit by hand disables the button
    // again — the accommodation editor behaves the same way.
    const canSave = Object.keys(patchPayload).length > 0 && !isSaving;

    // The amenities section renders nothing when both catalogs are empty, so
    // its nav entry has to disappear with it — a link to a section that is not
    // on the page scrolls nowhere and reads as a broken control.
    const hasCatalogs = amenities.length > 0 || features.length > 0;

    const navSections = useMemo<EditorSectionNavItem[]>(() => {
        const sections: EditorSectionNavItem[] = [
            {
                id: 'editor-basicInfo',
                label: t('commerce.owner.editor.sectionNav.basicInfo', 'Información básica')
            },
            {
                id: 'editor-contact',
                label: t('commerce.owner.editor.sectionNav.contactInfo', 'Contacto')
            },
            {
                id: 'editor-socialNetworks',
                label: t('commerce.owner.editor.sectionNav.socialNetworks', 'Redes sociales')
            },
            {
                id: 'editor-openingHours',
                label: t('commerce.owner.editor.sectionNav.openingHours', 'Horarios')
            },
            { id: 'editor-media', label: t('commerce.owner.editor.sectionNav.media', 'Fotos') },
            {
                id: 'editor-translations',
                label: t('commerce.owner.editor.sectionNav.translations', 'Traducciones')
            }
        ];
        if (hasCatalogs) {
            sections.push({
                id: 'editor-amenities',
                label: t('commerce.owner.editor.sectionNav.amenities', 'Servicios')
            });
        }
        sections.push({
            id: 'editor-price',
            label: t('commerce.owner.editor.sectionNav.price', 'Precio')
        });
        return sections;
    }, [t, hasCatalogs]);

    return (
        <form
            className={styles.editor}
            onSubmit={handleSubmit}
            aria-busy={isSaving}
            noValidate
        >
            <div className={styles.layout}>
                <div className={styles.navSlot}>
                    <EditorSectionNav
                        locale={locale}
                        sections={navSections}
                    />
                </div>

                <div className={styles.sectionsColumn}>
                    <BasicInfoSection
                        locale={locale}
                        vertical={vertical}
                        data={formData}
                        destinations={destinations}
                        destinationsLoadFailed={destinationsLoadFailed}
                        errors={fieldErrors}
                        onFieldChange={onFieldChange}
                    />

                    <ContactSection
                        locale={locale}
                        contact={formData.contact}
                        errors={fieldErrors}
                        onContactChange={updateContact}
                    />

                    <SocialNetworksSection
                        locale={locale}
                        social={formData.social}
                        errors={fieldErrors}
                        onSocialChange={updateSocial}
                    />

                    <OpeningHoursSection
                        locale={locale}
                        value={openingHours}
                        error={fieldErrors.openingHours}
                        onChange={(next) => {
                            onFieldChange('openingHours', next);
                        }}
                    />

                    <MediaSection
                        locale={locale}
                        vertical={vertical}
                        listingId={listingId}
                        featuredImage={featuredImage}
                        gallery={gallery}
                        onChange={updateMedia}
                    />

                    {/* T-023: i18n editing panel. Wrapped only to carry the nav anchor —
                the panel is shared and renders its own bare `<fieldset>`. */}
                    <div id="editor-translations">
                        <CommerceTranslationPanel
                            locale={locale}
                            initialValues={i18nValues}
                            onChange={handleI18nChange}
                        />
                    </div>

                    <AmenitiesSection
                        locale={locale}
                        amenities={amenities}
                        features={features}
                        selectedAmenityIds={amenityIds}
                        selectedFeatureIds={featureIds}
                        onToggleAmenity={toggleAmenity}
                        onToggleFeature={toggleFeature}
                    />

                    <PriceSection
                        locale={locale}
                        vertical={vertical}
                        data={formData}
                        errors={fieldErrors}
                        onFieldChange={onFieldChange}
                    />

                    {formError && (
                        <p
                            className={styles.error}
                            role="alert"
                        >
                            {formError}
                        </p>
                    )}

                    <div className={styles.actions}>
                        <a
                            className={styles.cancel}
                            href={`/${locale}/mi-cuenta/comercio/`}
                        >
                            {t('commerce.owner.editor.cancel', 'Cancelar')}
                        </a>
                        <button
                            type="submit"
                            className={styles.save}
                            disabled={!canSave}
                        >
                            {isSaving
                                ? t('commerce.owner.editor.saving', 'Guardando...')
                                : t('commerce.owner.editor.save', 'Guardar cambios')}
                        </button>
                    </div>
                </div>
            </div>
        </form>
    );
}
