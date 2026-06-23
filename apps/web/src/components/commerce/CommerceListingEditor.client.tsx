/**
 * @file CommerceListingEditor.client.tsx
 * @description Operational editor island for a commerce owner's listing
 * (SPEC-249 Part A). Native HTML form (no TanStack Form, per web conventions)
 * that edits ONLY the operational fields the owner may change and persists them
 * through the vertical's protected PATCH endpoint (`updateOwn`).
 *
 * Identity/core fields are rendered read-only by the hosting page, not here.
 *
 * Field-group coverage:
 *   T-012 mechanics + richDescription
 *   T-013 simple fields (contactInfo, price group: menuUrl/priceRange | isPriceOnRequest)
 *   T-014 structured fields (openingHours, socialNetworks)
 *   T-015 media gallery
 *   T-016 amenities / features
 */
import { apiClient } from '@/lib/api/client';
import type { AmenityData } from '@/lib/api/types';
import type { CommerceListingDetail, CommerceVertical } from '@/lib/commerce/owner-listings';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { PriceRangeEnum } from '@repo/schemas';
import type { Image, OpeningHours } from '@repo/schemas';
import { type JSX, useCallback, useState } from 'react';
import { AmenitiesFeaturesField } from './AmenitiesFeaturesField';
import styles from './CommerceListingEditor.module.css';
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
}

type SaveStatus =
    | { readonly kind: 'idle' }
    | { readonly kind: 'saving' }
    | { readonly kind: 'success' }
    | { readonly kind: 'error'; readonly message: string };

/** Subset of the contact JSONB block the owner edits in this surface. */
interface ContactValues {
    mobilePhone: string;
    workEmail: string;
    website: string;
}

/** Social URLs the owner edits (subset of SocialNetwork). */
interface SocialValues {
    facebook: string;
    instagram: string;
    twitter: string;
    tiktok: string;
    youtube: string;
}

const SOCIAL_KEYS: ReadonlyArray<keyof SocialValues> = [
    'facebook',
    'instagram',
    'twitter',
    'tiktok',
    'youtube'
];

/** Resolve the owner PATCH endpoint for the given vertical. */
function patchPathFor({
    vertical,
    listingId
}: { vertical: CommerceVertical; listingId: string }): string {
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
    features = []
}: CommerceListingEditorProps): JSX.Element {
    const { t } = createTranslations(locale);

    // TYPE-WORKAROUND: the detail is a gastronomy|experience union; we read heterogeneous operational fields by key, which the union type cannot express.
    const data = initialData as unknown as Record<string, unknown>;
    const initialContact = (data.contactInfo ?? {}) as Record<string, unknown>;
    const initialSocial = (data.socialNetworks ?? {}) as Record<string, unknown>;
    const initialMedia = (data.media ?? {}) as Record<string, unknown>;

    const [richDescription, setRichDescription] = useState<string>(
        strField(data, 'richDescription')
    );
    const [contact, setContact] = useState<ContactValues>({
        mobilePhone: strField(initialContact, 'mobilePhone'),
        workEmail: strField(initialContact, 'workEmail'),
        website: strField(initialContact, 'website')
    });
    const [social, setSocial] = useState<SocialValues>({
        facebook: strField(initialSocial, 'facebook'),
        instagram: strField(initialSocial, 'instagram'),
        twitter: strField(initialSocial, 'twitter'),
        tiktok: strField(initialSocial, 'tiktok'),
        youtube: strField(initialSocial, 'youtube')
    });
    const [openingHours, setOpeningHours] = useState<OpeningHours | null>(
        (data.openingHours as OpeningHours | null | undefined) ?? null
    );
    const [priceRange, setPriceRange] = useState<string>(strField(data, 'priceRange'));
    const [menuUrl, setMenuUrl] = useState<string>(strField(data, 'menuUrl'));
    const [isPriceOnRequest, setIsPriceOnRequest] = useState<boolean>(
        data.isPriceOnRequest === true
    );
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

    /** Build the PATCH payload from the dirty field groups only. */
    const buildPayload = useCallback((): Record<string, unknown> => {
        const payload: Record<string, unknown> = {};
        if (dirty.has('richDescription')) {
            payload.richDescription = richDescription;
        }
        if (dirty.has('contactInfo')) {
            payload.contactInfo = {
                mobilePhone: nonEmpty(contact.mobilePhone),
                workEmail: nonEmpty(contact.workEmail),
                website: nonEmpty(contact.website)
            };
        }
        if (dirty.has('socialNetworks')) {
            payload.socialNetworks = {
                facebook: nonEmpty(social.facebook),
                instagram: nonEmpty(social.instagram),
                twitter: nonEmpty(social.twitter),
                tiktok: nonEmpty(social.tiktok),
                youtube: nonEmpty(social.youtube)
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
        return payload;
    }, [
        dirty,
        richDescription,
        contact,
        social,
        openingHours,
        priceRange,
        menuUrl,
        isPriceOnRequest,
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
            setStatus({ kind: 'saving' });

            const result = await apiClient.patch<unknown>({
                path: patchPathFor({ vertical, listingId }),
                body: buildPayload()
            });

            if (result.ok) {
                setDirty(new Set());
                setStatus({ kind: 'success' });
            } else {
                setStatus({
                    kind: 'error',
                    message: t('commerce.owner.editor.error', 'No se pudieron guardar los cambios.')
                });
            }
        },
        [dirty, vertical, listingId, buildPayload, t]
    );

    const isSaving = status.kind === 'saving';
    const canSave = dirty.size > 0 && !isSaving;

    return (
        <form
            className={styles.editor}
            onSubmit={handleSubmit}
            aria-busy={isSaving}
        >
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

            <fieldset className={styles.section}>
                <legend className={styles.label}>
                    {t('commerce.owner.editor.sections.contactInfo', 'Información de contacto')}
                </legend>
                <input
                    className={styles.input}
                    type="tel"
                    aria-label={t('commerce.owner.editor.sections.contactInfo', 'Teléfono')}
                    value={contact.mobilePhone}
                    placeholder="+54..."
                    onChange={(event) => updateContact({ mobilePhone: event.target.value })}
                />
                <input
                    className={styles.input}
                    type="email"
                    aria-label="email"
                    value={contact.workEmail}
                    onChange={(event) => updateContact({ workEmail: event.target.value })}
                />
                <input
                    className={styles.input}
                    type="url"
                    aria-label="website"
                    value={contact.website}
                    onChange={(event) => updateContact({ website: event.target.value })}
                />
            </fieldset>

            <fieldset className={styles.section}>
                <legend className={styles.label}>
                    {t('commerce.owner.editor.sections.socialNetworks', 'Redes sociales')}
                </legend>
                {SOCIAL_KEYS.map((key) => (
                    <input
                        key={key}
                        className={styles.input}
                        type="url"
                        aria-label={key}
                        value={social[key]}
                        placeholder={`https://${key}.com/...`}
                        onChange={(event) => updateSocial(key, event.target.value)}
                    />
                ))}
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
                        onChange={(event) => {
                            setMenuUrl(event.target.value);
                            markDirty('menuUrl');
                        }}
                    />
                </section>
            ) : (
                <section className={styles.section}>
                    <label className={styles.checkbox}>
                        <input
                            type="checkbox"
                            checked={isPriceOnRequest}
                            onChange={(event) => {
                                setIsPriceOnRequest(event.target.checked);
                                markDirty('isPriceOnRequest');
                            }}
                        />
                        {t('commerce.owner.editor.sections.priceRange', 'Precio a consultar')}
                    </label>
                </section>
            )}

            {status.kind === 'success' && (
                <output className={styles.success}>
                    {t('commerce.owner.editor.success', 'Cambios guardados.')}
                </output>
            )}
            {status.kind === 'error' && (
                <p
                    className={styles.error}
                    role="alert"
                >
                    {status.message}
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
