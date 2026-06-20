/**
 * @file ExternalReputationSection.client.tsx
 * @description Owner-facing section inside the AccommodationEditor for managing
 * external platform listings and triggering reputation refreshes (SPEC-237 T-013).
 *
 * Provides:
 *  - Master toggle (showExternalReputation on/off)
 *  - "Add listing" form: platform select, URL, showLink/showReviews checkboxes
 *  - Per-listing row with PATCH (showLink/showReviews toggles) and DELETE
 *  - "Refresh reputation" button with rate-limit (429) message
 *  - Always-visible Google-only explainer note
 */

import { Spinner } from '@/components/shared/feedback/Spinner';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useEffect, useState } from 'react';
import styles from './ExternalReputationSection.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Platform values mirroring ExternalPlatformEnum (schema dependency-free). */
type ExternalPlatform = 'GOOGLE' | 'BOOKING' | 'AIRBNB' | 'OTHER';

/** A single external listing row returned by the API. */
export interface ExternalListingRow {
    readonly id: string;
    readonly platform: ExternalPlatform;
    readonly url: string;
    readonly showLink: boolean;
    readonly showReviews: boolean;
    readonly verified: boolean;
}

/** Reputation metadata returned by the GET listings endpoint. */
export interface ReputationMeta {
    readonly showExternalReputation: boolean;
    readonly aggregateFetchedAt: string | null;
}

/** Props for ExternalReputationSection. */
export interface ExternalReputationSectionProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLATFORMS: readonly ExternalPlatform[] = ['GOOGLE', 'BOOKING', 'AIRBNB', 'OTHER'];

/** Human-readable fallback labels when i18n key is not yet loaded. */
const PLATFORM_FALLBACK: Readonly<Record<ExternalPlatform, string>> = {
    GOOGLE: 'Google',
    BOOKING: 'Booking.com',
    AIRBNB: 'Airbnb',
    OTHER: 'Otra plataforma'
};

const PROTECTED = '/api/v1/protected';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute retry minutes from a Retry-After header value (seconds). */
function retryAfterMinutes(retryAfterSeconds: string | null): number {
    if (!retryAfterSeconds) return 5;
    const secs = Number.parseInt(retryAfterSeconds, 10);
    if (Number.isNaN(secs) || secs <= 0) return 5;
    return Math.ceil(secs / 60);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Owner-facing external reputation management section.
 *
 * Self-contained: fetches its own data on mount, handles all CRUD operations
 * through direct fetch calls following the same credentials:'include' pattern
 * used by the apiClient helpers in endpoints-protected.ts.
 */
export function ExternalReputationSection({
    locale,
    accommodationId
}: ExternalReputationSectionProps) {
    const { t } = createTranslations(locale);

    // --- Remote state ---
    const [listings, setListings] = useState<readonly ExternalListingRow[]>([]);
    const [masterToggle, setMasterToggle] = useState(false);
    const [aggregateFetchedAt, setAggregateFetchedAt] = useState<string | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // --- Add-listing form state ---
    const [addPlatform, setAddPlatform] = useState<ExternalPlatform>('GOOGLE');
    const [addUrl, setAddUrl] = useState('');
    const [addShowLink, setAddShowLink] = useState(false);
    const [addShowReviews, setAddShowReviews] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    // --- Refresh state ---
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState<string | null>(null);
    const [rateLimitMinutes, setRateLimitMinutes] = useState<number | null>(null);

    // --- Master toggle state ---
    const [isTogglingMaster, setIsTogglingMaster] = useState(false);

    // --- Load listings ---
    const loadListings = useCallback(async () => {
        setIsLoadingData(true);
        setLoadError(null);
        try {
            const res = await fetch(
                `${PROTECTED}/accommodations/${accommodationId}/external-listings`,
                { credentials: 'include' }
            );
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            const body = (await res.json()) as {
                data: {
                    listings: ExternalListingRow[];
                    reputation: ReputationMeta;
                };
            };
            setListings(body.data.listings ?? []);
            setMasterToggle(body.data.reputation.showExternalReputation ?? false);
            setAggregateFetchedAt(body.data.reputation.aggregateFetchedAt ?? null);
        } catch {
            setLoadError(
                t(
                    'externalReputation.errors.fetchFailed',
                    'No se pudieron cargar las reseñas externas. Intentá de nuevo más tarde.'
                )
            );
        } finally {
            setIsLoadingData(false);
        }
    }, [accommodationId, t]);

    useEffect(() => {
        void loadListings();
    }, [loadListings]);

    // --- Master toggle handler ---
    const handleMasterToggle = useCallback(async () => {
        setIsTogglingMaster(true);
        try {
            const res = await fetch(
                `${PROTECTED}/accommodations/${accommodationId}/external-reputation/master-toggle`,
                {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ showExternalReputation: !masterToggle })
                }
            );
            if (res.ok) {
                setMasterToggle((prev) => !prev);
            }
        } finally {
            setIsTogglingMaster(false);
        }
    }, [accommodationId, masterToggle]);

    // --- Add listing handler ---
    const handleAddListing = useCallback(async () => {
        if (!addUrl.trim()) return;
        setIsAdding(true);
        setAddError(null);
        try {
            const res = await fetch(
                `${PROTECTED}/accommodations/${accommodationId}/external-listings`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accommodationId,
                        platform: addPlatform,
                        url: addUrl.trim(),
                        showLink: addShowLink,
                        showReviews: addShowReviews
                    })
                }
            );
            if (res.ok) {
                setAddUrl('');
                setAddShowLink(false);
                setAddShowReviews(false);
                await loadListings();
            } else {
                const errBody = (await res.json().catch(() => ({}))) as {
                    error?: { message?: string };
                };
                setAddError(
                    errBody.error?.message ??
                        t('externalReputation.errors.fetchFailed', 'Error al agregar el enlace.')
                );
            }
        } catch {
            setAddError(t('externalReputation.errors.fetchFailed', 'Error al agregar el enlace.'));
        } finally {
            setIsAdding(false);
        }
    }, [accommodationId, addPlatform, addUrl, addShowLink, addShowReviews, loadListings, t]);

    // --- Per-listing toggle handler ---
    const handleListingToggle = useCallback(
        async (listingId: string, field: 'showLink' | 'showReviews', current: boolean) => {
            try {
                const res = await fetch(
                    `${PROTECTED}/accommodations/${accommodationId}/external-listings/${listingId}`,
                    {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ [field]: !current })
                    }
                );
                if (res.ok) {
                    setListings((prev) =>
                        prev.map((l) => (l.id === listingId ? { ...l, [field]: !current } : l))
                    );
                }
            } catch {
                // Silently fail; user can retry
            }
        },
        [accommodationId]
    );

    // --- Per-listing remove handler ---
    const handleRemoveListing = useCallback(
        async (listingId: string) => {
            try {
                const res = await fetch(
                    `${PROTECTED}/accommodations/${accommodationId}/external-listings/${listingId}`,
                    {
                        method: 'DELETE',
                        credentials: 'include'
                    }
                );
                if (res.ok) {
                    setListings((prev) => prev.filter((l) => l.id !== listingId));
                }
            } catch {
                // Silently fail; user can retry
            }
        },
        [accommodationId]
    );

    // --- Refresh handler ---
    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        setRefreshError(null);
        setRateLimitMinutes(null);
        try {
            const res = await fetch(
                `${PROTECTED}/accommodations/${accommodationId}/external-reputation/refresh`,
                {
                    method: 'POST',
                    credentials: 'include'
                }
            );
            if (res.status === 429) {
                const minutes = retryAfterMinutes(res.headers.get('Retry-After'));
                setRateLimitMinutes(minutes);
            } else if (res.ok) {
                await loadListings();
            } else {
                setRefreshError(
                    t(
                        'externalReputation.errors.fetchFailed',
                        'No se pudo actualizar la reputación. Intentá de nuevo más tarde.'
                    )
                );
            }
        } catch {
            setRefreshError(
                t(
                    'externalReputation.errors.fetchFailed',
                    'No se pudo actualizar la reputación. Intentá de nuevo más tarde.'
                )
            );
        } finally {
            setIsRefreshing(false);
        }
    }, [accommodationId, loadListings, t]);

    // ---------------------------------------------------------------------------
    // Render helpers
    // ---------------------------------------------------------------------------

    const platformLabel = useCallback(
        (platform: ExternalPlatform) =>
            t(`externalReputation.platform.${platform.toLowerCase()}`, PLATFORM_FALLBACK[platform]),
        [t]
    );

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('externalReputation.ownerConfig.title', 'Configuración de reputación externa')}
            </legend>

            {/* Always-visible Google-only explainer */}
            <p className={styles.explainer}>
                {t(
                    'externalReputation.ownerConfig.googleOnlyExplainer',
                    'El texto de las reseñas solo está disponible para Google. Las demás plataformas muestran el puntaje y un enlace.'
                )}
            </p>

            {/* Master toggle */}
            <div className={styles.masterToggleRow}>
                <label
                    htmlFor="ext-rep-master-toggle"
                    className={styles.toggleLabel}
                >
                    {t(
                        'externalReputation.ownerConfig.masterToggle',
                        'Mostrar sección de reputación externa'
                    )}
                </label>
                <input
                    id="ext-rep-master-toggle"
                    type="checkbox"
                    className={styles.toggleInput}
                    checked={masterToggle}
                    onChange={handleMasterToggle}
                    disabled={isTogglingMaster || isLoadingData}
                />
            </div>

            {/* Load error */}
            {loadError && (
                <div
                    className={styles.errorBanner}
                    role="alert"
                >
                    {loadError}
                </div>
            )}

            {/* Loading state */}
            {isLoadingData && !loadError && (
                <Spinner
                    size="sm"
                    label={t('externalReputation.ownerConfig.loading', 'Cargando listados…')}
                    className={styles.loadingHint}
                />
            )}

            {/* Existing listings */}
            {!isLoadingData && listings.length === 0 && !loadError && (
                <p
                    className={styles.emptyState}
                    data-testid="ext-rep-empty"
                >
                    {t('externalReputation.aggregate.noData', 'Sin datos disponibles')}
                </p>
            )}

            {listings.length > 0 && (
                <ul
                    className={styles.listingList}
                    aria-label={t('externalReputation.ownerConfig.title', 'Plataformas')}
                >
                    {listings.map((listing) => (
                        <li
                            key={listing.id}
                            className={styles.listingRow}
                        >
                            <span className={styles.listingPlatform}>
                                {platformLabel(listing.platform)}
                            </span>
                            <span
                                className={styles.listingUrl}
                                title={listing.url}
                            >
                                {listing.url.length > 40
                                    ? `${listing.url.slice(0, 37)}...`
                                    : listing.url}
                            </span>

                            <label className={styles.inlineToggle}>
                                <input
                                    type="checkbox"
                                    checked={listing.showLink}
                                    onChange={() =>
                                        void handleListingToggle(
                                            listing.id,
                                            'showLink',
                                            listing.showLink
                                        )
                                    }
                                    aria-label={`${platformLabel(listing.platform)} - ${t('externalReputation.ownerConfig.showLink', 'Mostrar enlace a la plataforma')}`}
                                />
                                <span>
                                    {t('externalReputation.ownerConfig.showLink', 'Mostrar enlace')}
                                </span>
                            </label>

                            <label className={styles.inlineToggle}>
                                <input
                                    type="checkbox"
                                    checked={listing.showReviews}
                                    onChange={() =>
                                        void handleListingToggle(
                                            listing.id,
                                            'showReviews',
                                            listing.showReviews
                                        )
                                    }
                                    aria-label={`${platformLabel(listing.platform)} - ${t('externalReputation.ownerConfig.showReviews', 'Mostrar reseñas de texto')}`}
                                />
                                <span>
                                    {t(
                                        'externalReputation.ownerConfig.showReviews',
                                        'Mostrar reseñas'
                                    )}
                                </span>
                            </label>

                            <button
                                type="button"
                                className={styles.removeButton}
                                onClick={() => void handleRemoveListing(listing.id)}
                                aria-label={`Eliminar ${platformLabel(listing.platform)}`}
                            >
                                {'✕'}
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {/* Add listing form */}
            <div className={styles.addForm}>
                <p className={styles.addFormTitle}>
                    {t('externalReputation.ownerConfig.addListing', 'Agregar enlace de plataforma')}
                </p>

                <div className={styles.addFormRow}>
                    <label
                        htmlFor="ext-rep-platform"
                        className={styles.addFormLabel}
                    >
                        {'Plataforma'}
                    </label>
                    <select
                        id="ext-rep-platform"
                        className={styles.addFormSelect}
                        value={addPlatform}
                        onChange={(e) => setAddPlatform(e.target.value as ExternalPlatform)}
                    >
                        {PLATFORMS.map((p) => (
                            <option
                                key={p}
                                value={p}
                            >
                                {platformLabel(p)}
                            </option>
                        ))}
                    </select>
                </div>

                <div className={styles.addFormRow}>
                    <label
                        htmlFor="ext-rep-url"
                        className={styles.addFormLabel}
                    >
                        {'URL'}
                    </label>
                    <input
                        id="ext-rep-url"
                        type="url"
                        className={styles.addFormInput}
                        value={addUrl}
                        onChange={(e) => setAddUrl(e.target.value)}
                        placeholder={'https://...'}
                    />
                </div>

                <div className={styles.addFormCheckboxRow}>
                    <label className={styles.addFormCheckbox}>
                        <input
                            type="checkbox"
                            checked={addShowLink}
                            onChange={(e) => setAddShowLink(e.target.checked)}
                        />
                        <span>
                            {t(
                                'externalReputation.ownerConfig.showLink',
                                'Mostrar enlace a la plataforma'
                            )}
                        </span>
                    </label>

                    <label className={styles.addFormCheckbox}>
                        <input
                            type="checkbox"
                            checked={addShowReviews}
                            onChange={(e) => setAddShowReviews(e.target.checked)}
                        />
                        <span>
                            {t(
                                'externalReputation.ownerConfig.showReviews',
                                'Mostrar reseñas de texto'
                            )}
                        </span>
                    </label>
                </div>

                {addError && (
                    <div
                        className={styles.errorBanner}
                        role="alert"
                    >
                        {addError}
                    </div>
                )}

                <button
                    type="button"
                    className={styles.addButton}
                    onClick={() => void handleAddListing()}
                    disabled={isAdding || !addUrl.trim()}
                >
                    {isAdding
                        ? t('externalReputation.ownerConfig.addListing', 'Agregando...')
                        : t('externalReputation.ownerConfig.addListing', 'Agregar')}
                </button>
            </div>

            {/* Refresh button + last updated + rate-limit message */}
            <div className={styles.refreshRow}>
                <button
                    type="button"
                    className={styles.refreshButton}
                    onClick={() => void handleRefresh()}
                    disabled={isRefreshing}
                >
                    {t('externalReputation.ownerConfig.refresh', 'Actualizar reseñas')}
                </button>

                {aggregateFetchedAt && !rateLimitMinutes && (
                    <span className={styles.lastUpdated}>
                        {t(
                            'externalReputation.ownerConfig.lastUpdated',
                            'Última actualización: {{date}}'
                        ).replace('{{date}}', new Date(aggregateFetchedAt).toLocaleString(locale))}
                    </span>
                )}

                {rateLimitMinutes !== null && (
                    <span
                        className={styles.rateLimitMsg}
                        role="alert"
                        data-testid="rate-limit-msg"
                    >
                        {t(
                            'externalReputation.ownerConfig.rateLimitHit',
                            'Podés actualizar nuevamente en {{minutes}} minutos'
                        ).replace('{{minutes}}', String(rateLimitMinutes))}
                    </span>
                )}

                {refreshError && !rateLimitMinutes && (
                    <span
                        className={styles.errorBanner}
                        role="alert"
                    >
                        {refreshError}
                    </span>
                )}
            </div>
        </fieldset>
    );
}
