/**
 * @file ExternalReputationSection.client.tsx
 * @description Owner-facing section inside the AccommodationEditor for managing
 * external platform listings and triggering reputation refreshes (SPEC-237 T-013).
 *
 * SPEC-250 Phase 7 additions:
 *  - Polls `GET /external-reputation/status` while async Apify runs are in flight.
 *  - Renders per-platform status chips (pending/running/ok/error).
 *  - Disables the refresh button while any platform has runStatus != 'idle' (OQ-4).
 *  - Handles 202 (async enqueued) vs 200 (all inline) from the refresh endpoint.
 *
 * Original (SPEC-237 T-013):
 *  - Master toggle (showExternalReputation on/off)
 *  - "Add listing" form: platform select, URL, showLink/showReviews checkboxes
 *  - Per-listing row with PATCH (showLink/showReviews toggles) and DELETE
 *  - "Refresh reputation" button with rate-limit (429) message
 *  - Always-visible Google-only explainer note
 */

import type { AccommodationExternalListingsResponse } from '@repo/schemas';
import {
    AccommodationExternalListingSchema,
    AccommodationExternalListingsResponseSchema
} from '@repo/schemas';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PlatformStatusEntry } from '@/components/host/PlatformStatusChips';
import { PlatformStatusChips } from '@/components/host/PlatformStatusChips';
import { Spinner } from '@/components/shared/feedback/Spinner';
import { FieldError, fieldErrorId } from '@/components/ui/FieldError';
import { useReputationStatus } from '@/hooks/use-reputation-status';
import { getApiUrl } from '@/lib/env';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './ExternalReputationSection.module.css';
import chipStyles from './ReputationStatus.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Platform values mirroring ExternalPlatformEnum (schema dependency-free). */
type ExternalPlatform = 'GOOGLE' | 'BOOKING' | 'AIRBNB' | 'OTHER';

/**
 * A single external listing row returned by the API.
 *
 * HOS-290: INFERRED from the shared response schema rather than hand-written.
 * A local interface describing the server's payload is what let the client and
 * the server drift far enough for this whole section to break in production.
 */
export type ExternalListingRow = AccommodationExternalListingsResponse['listings'][number];

/**
 * Reputation metadata returned by the GET listings endpoint. Same rationale as
 * {@link ExternalListingRow}: inferred, never re-described.
 */
export type ReputationMeta = AccommodationExternalListingsResponse['reputation'];

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

/**
 * Fallback hint text (per platform) explaining where to find the public
 * listing URL to paste in the "Add listing" form. Used when the i18n key
 * is not yet loaded (BETA-136).
 */
const URL_HINT_FALLBACK: Readonly<Record<ExternalPlatform, string>> = {
    GOOGLE: 'Buscá tu negocio en Google Maps, abrí su ficha y copiá la URL desde el botón Compartir.',
    BOOKING:
        'Entrá al extranet de Booking, abrí tu propiedad y copiá el enlace público de la página del alojamiento.',
    AIRBNB: "En tu panel de anfitrión de Airbnb, abrí el anuncio y copiá la URL desde 'Vista previa del anuncio'.",
    OTHER: 'Pegá el enlace público directo a tu anuncio en esa plataforma.'
};

/**
 * Absolute API base + protected prefix, resolved PER CALL.
 *
 * HOS-290: these fetches used to be RELATIVE (`/api/v1/protected/...`), which
 * sends them to the Astro server rather than the API — `PUBLIC_API_URL` points
 * at a different host (`api.hospeda.com.ar` vs `hospeda.com.ar`) and the web
 * app serves no `/api/v1/*` route. Every call 404'd, which is the FIRST reason
 * this section only ever rendered its error banner; the response-shape mismatch
 * fixed alongside it was the second.
 *
 * Resolved inside the callbacks rather than at module scope on purpose:
 * `getApiUrl()` runs the whole env validation and THROWS when it fails, and
 * this module is imported statically by `AccommodationEditor.client.tsx`
 * (`client:load`). A module-scope throw would take down the entire property
 * editor; inside a callback it degrades to this section's own error banner.
 * That is also what the other ~20 `getApiUrl()` call sites in the app do.
 */
function protectedBase(): string {
    return `${getApiUrl()}/api/v1/protected`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute retry minutes from a Retry-After header value (seconds). */
/**
 * Minutes to show in the rate-limit message.
 *
 * HOS-290: reads the value from the 429 JSON body (`error.details.retryAfter`,
 * which `refresh.ts` always sends) and only falls back to the `Retry-After`
 * header. Now that the request is genuinely cross-origin, that header is
 * unreadable — it is not CORS-safelisted and `API_CORS_EXPOSE_HEADERS` does not
 * include it — so header-only parsing would always yield the 5-minute default
 * while the real window is 10.
 */
function retryAfterMinutes(retryAfterSeconds: number | string | null | undefined): number {
    if (retryAfterSeconds === null || retryAfterSeconds === undefined) return 5;
    const secs =
        typeof retryAfterSeconds === 'number'
            ? retryAfterSeconds
            : Number.parseInt(retryAfterSeconds, 10);
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
    // Memoized so `t` keeps a stable reference across renders — otherwise it
    // recreates on every render, which cascades into `loadListings`'s
    // useCallback deps and re-triggers its mount effect in an infinite loop
    // (fetch -> setState -> render -> new `t` -> fetch -> ...).
    const { t, tPlural } = useMemo(() => createTranslations(locale), [locale]);

    // --- Remote state ---
    const [listings, setListings] = useState<readonly ExternalListingRow[]>([]);
    const [masterToggle, setMasterToggle] = useState(false);
    // Held as the `Date` the shared schema already coerced — no ISO round trip.
    const [aggregateFetchedAt, setAggregateFetchedAt] =
        useState<ReputationMeta['aggregateFetchedAt']>(null);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // --- Add-listing form state ---
    const [addPlatform, setAddPlatform] = useState<ExternalPlatform>('GOOGLE');
    const [addUrl, setAddUrl] = useState('');
    const [addShowLink, setAddShowLink] = useState(false);
    const [addShowReviews, setAddShowReviews] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    /** Field-level URL error (HOS-190): this sub-section has its own Save, so it
     * validates the URL client-side before POSTing instead of relying on the
     * server 400, whose message shape it used to mis-read into a generic banner. */
    const [addUrlError, setAddUrlError] = useState<string | null>(null);

    // --- Refresh state ---
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [refreshError, setRefreshError] = useState<string | null>(null);
    const [rateLimitMinutes, setRateLimitMinutes] = useState<number | null>(null);
    /**
     * Whether the last refresh triggered an async enqueue (202) or resolved
     * fully inline (200). Drives whether polling should be active.
     */
    const [asyncRefreshPending, setAsyncRefreshPending] = useState(false);
    /** Brief feedback message after a refresh action (enqueued / inline success). */
    const [refreshFeedback, setRefreshFeedback] = useState<'enqueued' | 'inlineSuccess' | null>(
        null
    );

    // --- Status polling (SPEC-250 Phase 7) ---
    const {
        platforms: statusPlatforms,
        allSettled,
        error: statusError
    } = useReputationStatus(accommodationId, asyncRefreshPending);

    // --- Master toggle state ---
    const [isTogglingMaster, setIsTogglingMaster] = useState(false);
    const [masterToggleError, setMasterToggleError] = useState<string | null>(null);

    // --- Load listings ---
    const loadListings = useCallback(async () => {
        setIsLoadingData(true);
        setLoadError(null);
        try {
            const res = await fetch(
                `${protectedBase()}/accommodations/${accommodationId}/external-listings`,
                { credentials: 'include' }
            );
            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }
            // Parsed through the SHARED schema rather than an inline cast: a
            // cast would happily "type" whatever the server actually sent, which
            // is exactly how this section shipped broken.
            const envelope = (await res.json()) as { data: unknown };
            const parsed = AccommodationExternalListingsResponseSchema.safeParse(envelope.data);
            if (!parsed.success) {
                throw new Error('Unexpected external-listings response shape');
            }

            setListings(parsed.data.listings);
            setMasterToggle(parsed.data.reputation.showExternalReputation);
            setAggregateFetchedAt(parsed.data.reputation.aggregateFetchedAt);
        } catch {
            setLoadError(
                t(
                    'external-reputation.errors.fetchFailed',
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
                `${protectedBase()}/accommodations/${accommodationId}/external-reputation/master-toggle`,
                {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    // HOS-290: the route's body schema is `{ value: boolean }`
                    // (`MasterToggleBodySchema`). This used to send
                    // `{ showExternalReputation }`, so the toggle 400'd every
                    // time — the third client/server contract mismatch in this
                    // one component.
                    body: JSON.stringify({ value: !masterToggle })
                }
            );
            if (res.ok) {
                setMasterToggle((prev) => !prev);
                setMasterToggleError(null);
            } else {
                // Never fail silently here: a 400 on EVERY toggle went unnoticed
                // all the way to production precisely because this branch did
                // nothing and the checkbox just snapped back (HOS-290).
                setMasterToggleError(
                    t(
                        'external-reputation.errors.masterToggleFailed',
                        'No se pudo cambiar la visibilidad. Intentá de nuevo.'
                    )
                );
            }
        } catch {
            setMasterToggleError(
                t(
                    'external-reputation.errors.masterToggleFailed',
                    'No se pudo cambiar la visibilidad. Intentá de nuevo.'
                )
            );
        } finally {
            setIsTogglingMaster(false);
        }
    }, [accommodationId, masterToggle, t]);

    // --- Add listing handler ---
    const handleAddListing = useCallback(async () => {
        const trimmedUrl = addUrl.trim();
        if (!trimmedUrl) return;

        // Client-side URL validation BEFORE the POST (HOS-190). Uses the exact
        // server rule (`AccommodationExternalListingSchema.shape.url`, a
        // `z.string().url()`), so a value like "csdcsdcsd" is caught here with a
        // field-level message under the input instead of round-tripping to a
        // server 400 that the old code mis-read into a generic banner (the API
        // sends `userFriendlyMessage`/`summary`, never `message`).
        const urlCheck = AccommodationExternalListingSchema.shape.url.safeParse(trimmedUrl);
        if (!urlCheck.success) {
            setAddError(null);
            setAddUrlError(
                t('external-reputation.errors.invalidUrl', 'Ingresá una URL válida (https://...).')
            );
            return;
        }
        setAddUrlError(null);

        setIsAdding(true);
        setAddError(null);
        try {
            const res = await fetch(
                `${protectedBase()}/accommodations/${accommodationId}/external-listings`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    // `accommodationId` is deliberately absent: the route's body
                    // schema omits it (it comes from the path param), and Zod
                    // only tolerates the extra key because the object is not
                    // strict.
                    body: JSON.stringify({
                        platform: addPlatform,
                        url: trimmedUrl,
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
                // The API has TWO 400 shapes: Hono/zod-openapi validation
                // failures (create-app.ts defaultHook) send `{ messageKey,
                // summary, userFriendlyMessage }`; a handler-thrown ServiceError
                // (e.g. DUPLICATE_PLATFORM — this route's documented primary 400)
                // is serialized by the global onError as `{ code, message,
                // details }`. Read all three so neither shape is swallowed.
                const errBody = (await res.json().catch(() => ({}))) as {
                    error?: { userFriendlyMessage?: string; summary?: string; message?: string };
                };
                setAddError(
                    errBody.error?.userFriendlyMessage ??
                        errBody.error?.summary ??
                        errBody.error?.message ??
                        t('external-reputation.errors.fetchFailed', 'Error al agregar el enlace.')
                );
            }
        } catch {
            setAddError(t('external-reputation.errors.fetchFailed', 'Error al agregar el enlace.'));
        } finally {
            setIsAdding(false);
        }
    }, [accommodationId, addPlatform, addUrl, addShowLink, addShowReviews, loadListings, t]);

    // --- Per-listing toggle handler ---
    const handleListingToggle = useCallback(
        async (listingId: string, field: 'showLink' | 'showReviews', current: boolean) => {
            try {
                const res = await fetch(
                    `${protectedBase()}/accommodations/${accommodationId}/external-listings/${listingId}`,
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
                    `${protectedBase()}/accommodations/${accommodationId}/external-listings/${listingId}`,
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
        setRefreshFeedback(null);
        try {
            const res = await fetch(
                `${protectedBase()}/accommodations/${accommodationId}/external-reputation/refresh`,
                {
                    method: 'POST',
                    credentials: 'include'
                }
            );
            if (res.status === 429) {
                const body = (await res.json().catch(() => null)) as {
                    error?: { details?: { retryAfter?: number } };
                } | null;
                setRateLimitMinutes(
                    retryAfterMinutes(
                        body?.error?.details?.retryAfter ?? res.headers.get('Retry-After')
                    )
                );
            } else if (res.status === 202) {
                // Async enqueue: Apify runs started in background — begin polling.
                setAsyncRefreshPending(true);
                setRefreshFeedback('enqueued');
                await loadListings();
            } else if (res.ok) {
                // All resolved inline (e.g. Google-only accommodation).
                setAsyncRefreshPending(false);
                setRefreshFeedback('inlineSuccess');
                await loadListings();
            } else {
                setRefreshError(
                    t(
                        'external-reputation.errors.fetchFailed',
                        'No se pudo actualizar la reputación. Intentá de nuevo más tarde.'
                    )
                );
            }
        } catch {
            setRefreshError(
                t(
                    'external-reputation.errors.fetchFailed',
                    'No se pudo actualizar la reputación. Intentá de nuevo más tarde.'
                )
            );
        } finally {
            setIsRefreshing(false);
        }
    }, [accommodationId, loadListings, t]);

    // Stop polling once all platforms have settled.
    useEffect(() => {
        if (allSettled && asyncRefreshPending) {
            setAsyncRefreshPending(false);
        }
    }, [allSettled, asyncRefreshPending]);

    // ---------------------------------------------------------------------------
    // Render helpers
    // ---------------------------------------------------------------------------

    const platformLabel = useCallback(
        (platform: ExternalPlatform) =>
            t(
                `external-reputation.platform.${platform.toLowerCase()}`,
                PLATFORM_FALLBACK[platform]
            ),
        [t]
    );

    /**
     * Instructions for where to find the public listing URL, dynamic on the
     * currently-selected `addPlatform` (BETA-136). Recomputed whenever the
     * platform selection changes.
     */
    const urlHint = useMemo(
        () =>
            t(
                `external-reputation.ownerConfig.urlHint.${addPlatform.toLowerCase()}`,
                URL_HINT_FALLBACK[addPlatform]
            ),
        [addPlatform, t]
    );

    /** Entries for PlatformStatusChips, built from the status polling data. */
    const platformStatusEntries = useMemo<readonly PlatformStatusEntry[]>(() => {
        return Object.entries(statusPlatforms).flatMap(([platform, status]) => {
            if (status === undefined) return [];
            return [
                {
                    platform,
                    label: platformLabel(platform as ExternalPlatform),
                    status
                }
            ];
        });
    }, [statusPlatforms, platformLabel]);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('external-reputation.ownerConfig.title', 'Configuración de reputación externa')}
            </legend>

            {/* Always-visible Google-only explainer */}
            <p className={styles.explainer}>
                {t(
                    'external-reputation.ownerConfig.googleOnlyExplainer',
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
                        'external-reputation.ownerConfig.masterToggle',
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

            {/* Master-toggle error (HOS-290: this used to fail silently) */}
            {masterToggleError && (
                <div
                    className={styles.errorBanner}
                    role="alert"
                >
                    {masterToggleError}
                </div>
            )}

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
                    label={t('external-reputation.ownerConfig.loading', 'Cargando listados…')}
                    className={styles.loadingHint}
                />
            )}

            {/* Existing listings */}
            {!isLoadingData && listings.length === 0 && !loadError && (
                <p
                    className={styles.emptyState}
                    data-testid="ext-rep-empty"
                >
                    {t('external-reputation.aggregate.noData', 'Sin datos disponibles')}
                </p>
            )}

            {listings.length > 0 && (
                <ul
                    className={styles.listingList}
                    aria-label={t('external-reputation.ownerConfig.title', 'Plataformas')}
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
                                    aria-label={`${platformLabel(listing.platform)} - ${t('external-reputation.ownerConfig.showLink', 'Mostrar enlace a la plataforma')}`}
                                />
                                <span>
                                    {t(
                                        'external-reputation.ownerConfig.showLink',
                                        'Mostrar enlace'
                                    )}
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
                                    aria-label={`${platformLabel(listing.platform)} - ${t('external-reputation.ownerConfig.showReviews', 'Mostrar reseñas de texto')}`}
                                />
                                <span>
                                    {t(
                                        'external-reputation.ownerConfig.showReviews',
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
                    {t(
                        'external-reputation.ownerConfig.addListing',
                        'Agregar enlace de plataforma'
                    )}
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

                <p
                    className={styles.fieldHint}
                    data-testid="ext-rep-url-hint"
                >
                    {urlHint}
                </p>

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
                        onChange={(e) => {
                            setAddUrl(e.target.value);
                            if (addUrlError) setAddUrlError(null);
                        }}
                        placeholder={'https://...'}
                        aria-invalid={addUrlError ? true : undefined}
                        aria-describedby={addUrlError ? fieldErrorId('ext-rep-url') : undefined}
                    />
                </div>
                <FieldError
                    id={fieldErrorId('ext-rep-url')}
                    message={addUrlError}
                />

                <div className={styles.addFormCheckboxRow}>
                    <label className={styles.addFormCheckbox}>
                        <input
                            type="checkbox"
                            checked={addShowLink}
                            onChange={(e) => setAddShowLink(e.target.checked)}
                        />
                        <span>
                            {t(
                                'external-reputation.ownerConfig.showLink',
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
                                'external-reputation.ownerConfig.showReviews',
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
                        ? t('external-reputation.ownerConfig.addListing', 'Agregando...')
                        : t('external-reputation.ownerConfig.addListing', 'Agregar')}
                </button>
            </div>

            {/* Per-platform async run status chips (SPEC-250 Phase 7) */}
            {platformStatusEntries.length > 0 && (
                <PlatformStatusChips
                    locale={locale}
                    platforms={platformStatusEntries}
                />
            )}

            {/* Status polling error (4xx/5xx from status endpoint) */}
            {statusError && (
                <div
                    className={styles.errorBanner}
                    role="alert"
                >
                    {t(
                        'external-reputation.errors.statusFailed',
                        'No se pudo obtener el estado de actualización.'
                    )}
                </div>
            )}

            {/* Async refresh feedback (enqueued / inline success) */}
            {refreshFeedback === 'enqueued' && (
                <div className={`${chipStyles.refreshStatus} ${chipStyles.refreshStatusEnqueued}`}>
                    {t('external-reputation.refresh.enqueued', 'Actualizando en segundo plano...')}
                </div>
            )}
            {refreshFeedback === 'inlineSuccess' && (
                <div className={`${chipStyles.refreshStatus} ${chipStyles.refreshStatusSuccess}`}>
                    {t('external-reputation.refresh.inlineSuccess', 'Actualizado')}
                </div>
            )}

            {/* Refresh button + last updated + rate-limit message */}
            <div className={styles.refreshRow}>
                <button
                    type="button"
                    className={styles.refreshButton}
                    onClick={() => void handleRefresh()}
                    disabled={isRefreshing || !allSettled}
                    aria-disabled={isRefreshing || !allSettled}
                    data-testid="refresh-button"
                >
                    {t('external-reputation.ownerConfig.refresh', 'Actualizar reseñas')}
                </button>

                {aggregateFetchedAt && !rateLimitMinutes && (
                    <span className={styles.lastUpdated}>
                        {t(
                            'external-reputation.ownerConfig.lastUpdated',
                            'Última actualización: {{date}}'
                        ).replace('{{date}}', aggregateFetchedAt.toLocaleString(locale))}
                    </span>
                )}

                {rateLimitMinutes !== null && (
                    <span
                        className={styles.rateLimitMsg}
                        role="alert"
                        data-testid="rate-limit-msg"
                    >
                        {tPlural('external-reputation.ownerConfig.rateLimitHit', rateLimitMinutes, {
                            minutes: rateLimitMinutes
                        })}
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
