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
import { type JSX, useCallback, useState } from 'react';
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
    const [name, setName] = useState<string>(strField(data, 'name'));
    const [destinationId, setDestinationId] = useState<string>(strField(data, 'destinationId'));
    const [description, setDescription] = useState<string>(strField(data, 'description'));

    // T-020: type select state (per-vertical enum value)
    const [listingType, setListingType] = useState<string>(strField(data, 'type'));

    // T-020: summary textarea state (min 10 / max 300) — validated by `schema`
    // via `fieldErrors.summary` now (see `handleSubmit`); no local ad hoc check.
    const [summary, setSummary] = useState<string>(strField(data, 'summary'));

    const [richDescription, setRichDescription] = useState<string>(
        strField(data, 'richDescription')
    );
    // T-020: website removed from contact per AC-4; mobilePhone + workEmail only
    const [contact, setContact] = useState<ContactValues>({
        mobilePhone: strField(initialContact, 'mobilePhone'),
        workEmail: strField(initialContact, 'workEmail')
    });
    // T-020: added linkedIn to social per AC-4
    const [social, setSocial] = useState<SocialValues>({
        facebook: strField(initialSocial, 'facebook'),
        instagram: strField(initialSocial, 'instagram'),
        twitter: strField(initialSocial, 'twitter'),
        tiktok: strField(initialSocial, 'tiktok'),
        youtube: strField(initialSocial, 'youtube'),
        linkedIn: strField(initialSocial, 'linkedIn')
    });
    const [openingHours, setOpeningHours] = useState<OpeningHours | null>(
        (data.openingHours as OpeningHours | null | undefined) ?? null
    );
    const [priceRange, setPriceRange] = useState<string>(strField(data, 'priceRange'));
    const [menuUrl, setMenuUrl] = useState<string>(strField(data, 'menuUrl'));
    const [isPriceOnRequest, setIsPriceOnRequest] = useState<boolean>(
        data.isPriceOnRequest === true
    );
    // T-021: experience-only pricing fields
    const [priceFrom, setPriceFrom] = useState<number | null>(
        typeof data.priceFrom === 'number' ? data.priceFrom : null
    );
    const [priceUnit, setPriceUnit] = useState<string>(strField(data, 'priceUnit'));
    const [featuredImage, setFeaturedImage] = useState<Image | null>(
        (initialMedia.featuredImage as Image | undefined) ?? null
    );
    const [gallery, setGallery] = useState<readonly Image[]>(
        (initialMedia.gallery as Image[] | undefined) ?? []
    );
    // Media JSONB is REPLACED wholesale on save (gastronomy/experience do not
    // merge it), so preserve the owner-unmanaged sub-fields (videos,
    // archivedGallery) and re-send them with every media patch.
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
    const [amenityIds, setAmenityIds] = useState<ReadonlySet<string>>(
        () => new Set((data.amenityIds as string[] | undefined) ?? [])
    );
    const [featureIds, setFeatureIds] = useState<ReadonlySet<string>>(
        () => new Set((data.featureIds as string[] | undefined) ?? [])
    );

    // T-023: i18n fields state (nameI18n, summaryI18n, descriptionI18n, richDescriptionI18n)
    const [i18nValues, setI18nValues] = useState<CommerceI18nValues>(() =>
        parseCommerceI18nValues(data)
    );

    const [dirty, setDirty] = useState<ReadonlySet<string>>(new Set());
    const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

    const markDirty = useCallback((field: string) => {
        setDirty((prev) => {
            const next = new Set(prev);
            next.add(field);
            return next;
        });
        setStatus({ kind: 'idle' });
    }, []);

    const updateContact = useCallback(
        (patch: Partial<ContactValues>) => {
            setContact((prev) => ({ ...prev, ...patch }));
            markDirty('contactInfo');
        },
        [markDirty]
    );

    const updateSocial = useCallback(
        (key: keyof SocialValues, val: string) => {
            setSocial((prev) => ({ ...prev, [key]: val }));
            markDirty('socialNetworks');
        },
        [markDirty]
    );

    const updateMedia = useCallback(
        (next: { readonly featuredImage: Image | null; readonly gallery: readonly Image[] }) => {
            setFeaturedImage(next.featuredImage);
            setGallery(next.gallery);
            markDirty('media');
        },
        [markDirty]
    );

    const toggleAmenity = useCallback(
        (id: string) => {
            setAmenityIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) {
                    next.delete(id);
                } else {
                    next.add(id);
                }
                return next;
            });
            markDirty('amenityIds');
        },
        [markDirty]
    );

    const toggleFeature = useCallback(
        (id: string) => {
            setFeatureIds((prev) => {
                const next = new Set(prev);
                if (next.has(id)) {
                    next.delete(id);
                } else {
                    next.add(id);
                }
                return next;
            });
            markDirty('featureIds');
        },
        [markDirty]
    );

    /** Handle i18n panel changes — marks all four i18n fields dirty at once. */
    const handleI18nChange = useCallback(
        (updated: CommerceI18nValues) => {
            setI18nValues(updated);
            markDirty('i18n');
        },
        [markDirty]
    );

    /** Build the PATCH payload from the dirty field groups only. */
    const buildPayload = useCallback((): Record<string, unknown> => {
        const payload: Record<string, unknown> = {};
        if (dirty.has('name')) {
            payload.name = name;
        }
        if (dirty.has('destinationId')) {
            payload.destinationId = destinationId || undefined;
        }
        if (dirty.has('type')) {
            payload.type = listingType || undefined;
        }
        if (dirty.has('summary')) {
            payload.summary = summary || undefined;
        }
        if (dirty.has('description')) {
            payload.description = description || undefined;
        }
        // T-023: include i18n fields when any locale was edited
        if (dirty.has('i18n')) {
            payload.nameI18n = i18nValues.nameI18n;
            payload.summaryI18n = i18nValues.summaryI18n;
            payload.descriptionI18n = i18nValues.descriptionI18n;
            payload.richDescriptionI18n = i18nValues.richDescriptionI18n;
        }
        if (dirty.has('richDescription')) {
            payload.richDescription = richDescription;
        }
        if (dirty.has('contactInfo')) {
            payload.contactInfo = {
                mobilePhone: nonEmpty(contact.mobilePhone),
                workEmail: nonEmpty(contact.workEmail)
            };
        }
        if (dirty.has('socialNetworks')) {
            payload.socialNetworks = {
                facebook: nonEmpty(social.facebook),
                instagram: nonEmpty(social.instagram),
                twitter: nonEmpty(social.twitter),
                tiktok: nonEmpty(social.tiktok),
                youtube: nonEmpty(social.youtube),
                linkedIn: nonEmpty(social.linkedIn)
            };
        }
        if (dirty.has('openingHours')) {
            payload.openingHours = openingHours;
        }
        if (dirty.has('media')) {
            payload.media = {
                ...preservedMedia,
                ...(featuredImage ? { featuredImage } : {}),
                gallery
            };
        }
        if (dirty.has('amenityIds')) {
            payload.amenityIds = [...amenityIds];
        }
        if (dirty.has('featureIds')) {
            payload.featureIds = [...featureIds];
        }
        if (dirty.has('priceRange')) {
            payload.priceRange = priceRange || null;
        }
        if (dirty.has('menuUrl')) {
            payload.menuUrl = menuUrl || null;
        }
        if (dirty.has('isPriceOnRequest')) {
            payload.isPriceOnRequest = isPriceOnRequest;
        }
        // T-021: experience-only. `priceFrom`/`priceUnit` on `ExperienceSchema`
        // (`z.number().int().nonnegative()` / a native-enum schema) do NOT
        // accept `null` — unlike gastronomy's `priceRange`/`menuUrl` above,
        // which ARE `.nullish()` on the domain schema. Sending `null` here used
        // to fail validation whenever the owner cleared the field; send
        // `undefined` (omit the key = "no change") instead.
        if (dirty.has('priceFrom')) {
            payload.priceFrom = priceFrom ?? undefined;
        }
        if (dirty.has('priceUnit')) {
            payload.priceUnit = priceUnit || undefined;
        }
        return payload;
    }, [
        dirty,
        name,
        destinationId,
        listingType,
        summary,
        description,
        i18nValues,
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
        preservedMedia,
        amenityIds,
        featureIds
    ]);

    const handleSubmit = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (dirty.size === 0) {
                return;
            }

            const payload = buildPayload();

            // Full dirty-payload validation against the real per-vertical
            // owner-update schema (see `schema` above) — replaces the two ad
            // hoc summary/priceFrom checks this editor previously ran by hand.
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
                setDirty(new Set());
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
        [dirty, vertical, listingId, buildPayload, validate, handleApiError, t]
    );

    const isSaving = status.kind === 'saving';
    const canSave = dirty.size > 0 && !isSaving;

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
                        setName(event.target.value);
                        markDirty('name');
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
            ) : (
                destinations.length > 0 && (
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
                                fieldErrors.destinationId
                                    ? fieldErrorId('destinationId')
                                    : undefined
                            }
                            onChange={(event) => {
                                setDestinationId(event.target.value);
                                markDirty('destinationId');
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
                )
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
                        setListingType(event.target.value);
                        markDirty('type');
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
                        setSummary(event.target.value);
                        markDirty('summary');
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
                        setDescription(event.target.value);
                        markDirty('description');
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
                        setRichDescription(event.target.value);
                        markDirty('richDescription');
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
                        setOpeningHours(next);
                        markDirty('openingHours');
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
                            setPriceRange(event.target.value);
                            markDirty('priceRange');
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
                            setMenuUrl(event.target.value);
                            markDirty('menuUrl');
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
                                setIsPriceOnRequest(event.target.checked);
                                markDirty('isPriceOnRequest');
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
                            setPriceFrom(parsed);
                            markDirty('priceFrom');
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
                            setPriceUnit(event.target.value);
                            markDirty('priceUnit');
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
