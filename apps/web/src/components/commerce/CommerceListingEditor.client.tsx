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
import {
    ExperienceOwnerUpdateInputSchema,
    ExperiencePriceUnitEnum,
    ExperienceTypeEnum,
    GastronomyOwnerUpdateInputSchema,
    GastronomyTypeEnum,
    PriceRangeEnum
} from '@repo/schemas';
import { type JSX, useCallback, useMemo, useState } from 'react';
import type { DestinationOption } from '@/components/gastronomy/CommerceLead.client';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import { apiClient } from '@/lib/api/client';
import type { AmenityData } from '@/lib/api/types';
import type { CommerceListingDetail, CommerceVertical } from '@/lib/commerce/owner-listings';
import { useZodForm } from '@/lib/forms/use-zod-form';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { AmenitiesFeaturesField } from './AmenitiesFeaturesField';
import styles from './CommerceListingEditor.module.css';
import {
    type CommerceI18nValues,
    CommerceTranslationPanel,
    parseCommerceI18nValues
} from './CommerceTranslationPanel.client';
import { MediaField } from './MediaField';
import { OpeningHoursField } from './OpeningHoursField';

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

/**
 * Subset of the contact JSONB block the owner edits in this surface.
 * NOTE: `website` is intentionally absent per SPEC-253 AC-4 — it is not
 * exposed in the owner editor UI even though it exists in ContactInfoSchema.
 */
interface ContactValues {
    mobilePhone: string;
    workEmail: string;
}

/** Social URLs the owner edits (subset of SocialNetwork, includes linkedIn per AC-4). */
interface SocialValues {
    facebook: string;
    instagram: string;
    twitter: string;
    tiktok: string;
    youtube: string;
    linkedIn: string;
}

const SOCIAL_KEYS: ReadonlyArray<keyof SocialValues> = [
    'facebook',
    'instagram',
    'twitter',
    'tiktok',
    'youtube',
    'linkedIn'
];

/** Gastronomy type options in display order. */
const GASTRONOMY_TYPE_OPTIONS = Object.values(GastronomyTypeEnum);

/** Experience type options in display order. */
const EXPERIENCE_TYPE_OPTIONS = Object.values(ExperienceTypeEnum);

/** Experience price unit options. */
const PRICE_UNIT_OPTIONS = Object.values(ExperiencePriceUnitEnum);

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
 * All owner-editable form state, held as ONE object (HOS-258 PR 1).
 *
 * Mirrors `AccommodationEditData` in the host editor: the orchestrator owns this
 * object plus a `baseline` snapshot, and the PATCH body is the diff between the
 * two. It replaces the 18 independent `useState` slots + manual `dirty` Set this
 * editor used to carry, which made per-section extraction impossible.
 *
 * `preservedMedia` is deliberately NOT part of this type — it is never editable,
 * never diffed, and only rides along on a media patch (see `buildPatchPayload`).
 */
interface CommerceEditData {
    readonly name: string;
    readonly destinationId: string;
    readonly description: string;
    readonly listingType: string;
    readonly summary: string;
    readonly richDescription: string;
    readonly contact: ContactValues;
    readonly social: SocialValues;
    readonly openingHours: OpeningHours | null;
    readonly priceRange: string;
    readonly menuUrl: string;
    readonly isPriceOnRequest: boolean;
    readonly priceFrom: number | null;
    readonly priceUnit: string;
    readonly featuredImage: Image | null;
    readonly gallery: readonly Image[];
    readonly amenityIds: ReadonlySet<string>;
    readonly featureIds: ReadonlySet<string>;
    readonly i18nValues: CommerceI18nValues;
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

    // Destructured so every value READ in the JSX below is untouched by the
    // HOS-258 state consolidation — only the change handlers moved.
    const {
        name,
        destinationId,
        description,
        listingType,
        summary,
        richDescription,
        contact,
        social,
        openingHours,
        priceRange,
        menuUrl,
        isPriceOnRequest,
        priceFrom,
        priceUnit,
        featuredImage,
        gallery,
        amenityIds,
        featureIds,
        i18nValues
    } = formData;

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

    const typeOptions =
        vertical === 'gastronomy' ? GASTRONOMY_TYPE_OPTIONS : EXPERIENCE_TYPE_OPTIONS;

    return (
        <form
            className={styles.editor}
            onSubmit={handleSubmit}
            aria-busy={isSaving}
            noValidate
        >
            {/* HOS-166 D-1: name — identity field, now owner-editable */}
            <section className={styles.section}>
                <label
                    className={styles.label}
                    htmlFor="ce-name"
                >
                    {t('commerce.owner.editor.sections.name', 'Nombre del comercio')}
                </label>
                <input
                    id="ce-name"
                    className={styles.input}
                    type="text"
                    value={name}
                    aria-invalid={fieldErrors.name ? 'true' : 'false'}
                    aria-describedby={fieldErrors.name ? fieldErrorId('name') : undefined}
                    onChange={(event) => {
                        onFieldChange('name', event.target.value);
                    }}
                />
                <FieldError
                    id={fieldErrorId('name')}
                    message={fieldErrors.name}
                />
            </section>

            {/* HOS-166 D-1: destinationId — identity field, now owner-editable.
                `destinationsLoadFailed` (judgment-day fix) surfaces a failed SSR
                catalog fetch explicitly instead of silently omitting a REQUIRED
                field (completeness needs `destinationId`) — see the prop's doc. */}
            {destinationsLoadFailed ? (
                <section className={styles.section}>
                    <p
                        className={styles.error}
                        role="alert"
                    >
                        {t(
                            'commerce.owner.editor.sections.destinationLoadError',
                            'No pudimos cargar el listado de ciudades / destinos. Recargá la página para reintentar.'
                        )}
                    </p>
                </section>
            ) : destinations.length > 0 ? (
                <section className={styles.section}>
                    <label
                        className={styles.label}
                        htmlFor="ce-destinationId"
                    >
                        {t('commerce.owner.editor.sections.destination', 'Ciudad / Destino')}
                    </label>
                    <select
                        id="ce-destinationId"
                        className={styles.input}
                        value={destinationId}
                        aria-invalid={fieldErrors.destinationId ? 'true' : 'false'}
                        aria-describedby={
                            fieldErrors.destinationId ? fieldErrorId('destinationId') : undefined
                        }
                        onChange={(event) => {
                            onFieldChange('destinationId', event.target.value);
                        }}
                    >
                        <option value="">—</option>
                        {destinations.map((d) => (
                            <option
                                key={d.id}
                                value={d.id}
                            >
                                {d.name}
                            </option>
                        ))}
                    </select>
                    <FieldError
                        id={fieldErrorId('destinationId')}
                        message={fieldErrors.destinationId}
                    />
                </section>
            ) : (
                // HOS-260: catalog fetch SUCCEEDED but returned zero rows. The old
                // `destinations.length > 0` gate silently omitted the field here
                // too, leaving `destinationId` (required for completeness)
                // unfillable with no indication why. Distinct from the
                // `destinationsLoadFailed` branch above (fetch failure).
                <section className={styles.section}>
                    <p
                        className={styles.error}
                        role="alert"
                    >
                        {t(
                            'commerce.owner.editor.sections.destinationEmpty',
                            'Todavía no hay ciudades / destinos cargados. Contactanos para poder completar este campo.'
                        )}
                    </p>
                </section>
            )}

            {/* T-020: type select */}
            <section className={styles.section}>
                <label
                    className={styles.label}
                    htmlFor="ce-type"
                >
                    {t('commerce.owner.editor.sections.type', 'Categoría')}
                </label>
                <select
                    id="ce-type"
                    className={styles.input}
                    value={listingType}
                    onChange={(event) => {
                        onFieldChange('listingType', event.target.value);
                    }}
                >
                    <option value="">—</option>
                    {typeOptions.map((opt) => (
                        <option
                            key={opt}
                            value={opt}
                        >
                            {t(`commerce.owner.editor.typeOption.${opt}`, opt)}
                        </option>
                    ))}
                </select>
            </section>

            {/* T-020: summary textarea (min 10 / max 300) */}
            <section className={styles.section}>
                <label
                    className={styles.label}
                    htmlFor="ce-summary"
                >
                    {t('commerce.owner.editor.sections.summary', 'Resumen')}
                </label>
                <textarea
                    id="ce-summary"
                    className={styles.textarea}
                    value={summary}
                    rows={3}
                    minLength={10}
                    maxLength={300}
                    aria-invalid={fieldErrors.summary ? 'true' : 'false'}
                    aria-describedby={
                        fieldErrors.summary ? fieldErrorId('summary') : 'ce-summary-hint'
                    }
                    onChange={(event) => {
                        onFieldChange('summary', event.target.value);
                    }}
                />
                <span
                    id="ce-summary-hint"
                    className={styles.hint}
                    aria-live="polite"
                >
                    {t('commerce.owner.editor.validation.summaryHint', '{{count}}/300', {
                        count: summary.length
                    })}
                </span>
                <FieldError
                    id={fieldErrorId('summary')}
                    message={fieldErrors.summary}
                />
            </section>

            {/* HOS-166 judgment-day W2: description — identity field, already
                owner-editable server-side (D-1) but never exposed here. */}
            <section className={styles.section}>
                <label
                    className={styles.label}
                    htmlFor="ce-description"
                >
                    {t('commerce.owner.editor.sections.description', 'Descripción')}
                </label>
                <textarea
                    id="ce-description"
                    className={styles.textarea}
                    value={description}
                    rows={5}
                    aria-invalid={fieldErrors.description ? 'true' : 'false'}
                    aria-describedby={
                        fieldErrors.description ? fieldErrorId('description') : undefined
                    }
                    onChange={(event) => {
                        onFieldChange('description', event.target.value);
                    }}
                />
                <FieldError
                    id={fieldErrorId('description')}
                    message={fieldErrors.description}
                />
            </section>

            <section className={styles.section}>
                <label
                    className={styles.label}
                    htmlFor="ce-richDescription"
                >
                    {t('commerce.owner.editor.sections.richDescription', 'Descripción ampliada')}
                </label>
                <textarea
                    id="ce-richDescription"
                    className={styles.textarea}
                    value={richDescription}
                    rows={6}
                    onChange={(event) => {
                        onFieldChange('richDescription', event.target.value);
                    }}
                />
            </section>

            {/* Contact: mobilePhone + workEmail only (no website per AC-4) */}
            <fieldset className={styles.section}>
                <legend className={styles.label}>
                    {t('commerce.owner.editor.sections.contactInfo', 'Información de contacto')}
                </legend>
                <input
                    className={styles.input}
                    type="tel"
                    aria-label={t('commerce.owner.editor.contactField.mobilePhone', 'Teléfono')}
                    value={contact.mobilePhone}
                    placeholder="+54..."
                    aria-invalid={fieldErrors['contactInfo.mobilePhone'] ? 'true' : 'false'}
                    aria-describedby={
                        fieldErrors['contactInfo.mobilePhone']
                            ? fieldErrorId('contactInfo.mobilePhone')
                            : undefined
                    }
                    onChange={(event) => updateContact({ mobilePhone: event.target.value })}
                />
                <FieldError
                    id={fieldErrorId('contactInfo.mobilePhone')}
                    message={fieldErrors['contactInfo.mobilePhone']}
                />
                <input
                    className={styles.input}
                    type="email"
                    aria-label={t('commerce.owner.editor.contactField.workEmail', 'Email')}
                    value={contact.workEmail}
                    aria-invalid={fieldErrors['contactInfo.workEmail'] ? 'true' : 'false'}
                    aria-describedby={
                        fieldErrors['contactInfo.workEmail']
                            ? fieldErrorId('contactInfo.workEmail')
                            : undefined
                    }
                    onChange={(event) => updateContact({ workEmail: event.target.value })}
                />
                <FieldError
                    id={fieldErrorId('contactInfo.workEmail')}
                    message={fieldErrors['contactInfo.workEmail']}
                />
            </fieldset>

            {/* Social: facebook/instagram/twitter/tiktok/youtube + linkedIn (AC-4) */}
            <fieldset className={styles.section}>
                <legend className={styles.label}>
                    {t('commerce.owner.editor.sections.socialNetworks', 'Redes sociales')}
                </legend>
                {SOCIAL_KEYS.map((key) => {
                    const errorKey = `socialNetworks.${key}`;
                    return (
                        <div key={key}>
                            <input
                                className={styles.input}
                                type="url"
                                aria-label={key}
                                value={social[key]}
                                placeholder={`https://${key === 'linkedIn' ? 'linkedin' : key}.com/...`}
                                aria-invalid={fieldErrors[errorKey] ? 'true' : 'false'}
                                aria-describedby={
                                    fieldErrors[errorKey] ? fieldErrorId(errorKey) : undefined
                                }
                                onChange={(event) => updateSocial(key, event.target.value)}
                            />
                            <FieldError
                                id={fieldErrorId(errorKey)}
                                message={fieldErrors[errorKey]}
                            />
                        </div>
                    );
                })}
            </fieldset>

            <section className={styles.section}>
                <span className={styles.label}>
                    {t('commerce.owner.editor.sections.openingHours', 'Horarios de atención')}
                </span>
                <OpeningHoursField
                    value={openingHours}
                    classes={styles}
                    onChange={(next) => {
                        onFieldChange('openingHours', next);
                    }}
                />
                <FieldError
                    id={fieldErrorId('openingHours')}
                    message={fieldErrors.openingHours}
                />
            </section>

            <section className={styles.section}>
                <span className={styles.label}>
                    {t('commerce.owner.editor.sections.media', 'Galería de fotos')}
                </span>
                <MediaField
                    vertical={vertical}
                    listingId={listingId}
                    featuredImage={featuredImage}
                    gallery={gallery}
                    onChange={updateMedia}
                    t={t}
                    classes={styles}
                />
            </section>

            {/* T-023: i18n editing panel */}
            <CommerceTranslationPanel
                locale={locale}
                initialValues={i18nValues}
                onChange={handleI18nChange}
            />

            {(amenities.length > 0 || features.length > 0) && (
                <section className={styles.section}>
                    <AmenitiesFeaturesField
                        amenities={amenities}
                        features={features}
                        selectedAmenityIds={amenityIds}
                        selectedFeatureIds={featureIds}
                        onToggleAmenity={toggleAmenity}
                        onToggleFeature={toggleFeature}
                        t={t}
                        classes={styles}
                    />
                </section>
            )}

            {vertical === 'gastronomy' ? (
                <section className={styles.section}>
                    <label
                        className={styles.label}
                        htmlFor="ce-priceRange"
                    >
                        {t('commerce.owner.editor.sections.priceRange', 'Rango de precios')}
                    </label>
                    <select
                        id="ce-priceRange"
                        className={styles.input}
                        value={priceRange}
                        onChange={(event) => {
                            onFieldChange('priceRange', event.target.value);
                        }}
                    >
                        <option value="">—</option>
                        {Object.values(PriceRangeEnum).map((tier) => (
                            <option
                                key={tier}
                                value={tier}
                            >
                                {tier}
                            </option>
                        ))}
                    </select>

                    <label
                        className={styles.label}
                        htmlFor="ce-menuUrl"
                    >
                        {t('commerce.owner.editor.sections.menuUrl', 'Enlace al menú')}
                    </label>
                    <input
                        id="ce-menuUrl"
                        className={styles.input}
                        type="url"
                        value={menuUrl}
                        placeholder="https://..."
                        aria-invalid={fieldErrors.menuUrl ? 'true' : 'false'}
                        aria-describedby={fieldErrors.menuUrl ? fieldErrorId('menuUrl') : undefined}
                        onChange={(event) => {
                            onFieldChange('menuUrl', event.target.value);
                        }}
                    />
                    <FieldError
                        id={fieldErrorId('menuUrl')}
                        message={fieldErrors.menuUrl}
                    />
                </section>
            ) : (
                <section className={styles.section}>
                    {/* isPriceOnRequest toggle */}
                    <label className={styles.checkbox}>
                        <input
                            type="checkbox"
                            checked={isPriceOnRequest}
                            onChange={(event) => {
                                onFieldChange('isPriceOnRequest', event.target.checked);
                            }}
                        />
                        {t('commerce.owner.editor.sections.isPriceOnRequest', 'Precio a consultar')}
                    </label>

                    {/* T-021: priceFrom — disabled when isPriceOnRequest */}
                    <label
                        className={styles.label}
                        htmlFor="ce-priceFrom"
                    >
                        {t('commerce.owner.editor.sections.priceFrom', 'Precio desde (centavos)')}
                    </label>
                    <input
                        id="ce-priceFrom"
                        className={styles.input}
                        type="number"
                        min={0}
                        step={1}
                        disabled={isPriceOnRequest}
                        value={priceFrom ?? ''}
                        aria-invalid={fieldErrors.priceFrom ? 'true' : 'false'}
                        aria-describedby={
                            fieldErrors.priceFrom ? fieldErrorId('priceFrom') : undefined
                        }
                        onChange={(event) => {
                            const raw = event.target.value;
                            const parsed = raw === '' ? null : Math.floor(Number(raw));
                            onFieldChange('priceFrom', parsed);
                        }}
                    />
                    <FieldError
                        id={fieldErrorId('priceFrom')}
                        message={fieldErrors.priceFrom}
                    />

                    {/* T-021: priceUnit select — disabled when isPriceOnRequest */}
                    <label
                        className={styles.label}
                        htmlFor="ce-priceUnit"
                    >
                        {t('commerce.owner.editor.sections.priceUnit', 'Unidad de precio')}
                    </label>
                    <select
                        id="ce-priceUnit"
                        className={styles.input}
                        value={priceUnit}
                        disabled={isPriceOnRequest}
                        aria-invalid={fieldErrors.priceUnit ? 'true' : 'false'}
                        aria-describedby={
                            fieldErrors.priceUnit ? fieldErrorId('priceUnit') : undefined
                        }
                        onChange={(event) => {
                            onFieldChange('priceUnit', event.target.value);
                        }}
                    >
                        <option value="">—</option>
                        {PRICE_UNIT_OPTIONS.map((unit) => (
                            <option
                                key={unit}
                                value={unit}
                            >
                                {t(`commerce.owner.editor.priceUnitOption.${unit}`, unit)}
                            </option>
                        ))}
                    </select>
                    <FieldError
                        id={fieldErrorId('priceUnit')}
                        message={fieldErrors.priceUnit}
                    />
                </section>
            )}

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
        </form>
    );
}
