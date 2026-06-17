/**
 * @file CreatePropertyMiniForm.client.tsx
 * @description Minimum-viable property creation form for hosts.
 *
 * Asks only for name, summary, type and a CITY destination, POSTs the result
 * to `/api/v1/protected/host-onboarding/start`, and redirects the host to the
 * next step depending on whether they can reach the admin panel.
 *
 * Post-submit redirect rules:
 *  - HOST users WITHOUT `access.panelAdmin` (the default for the public
 *    onboarding flow) are sent to `accountPropertiesUrl` — the web's own
 *    listing page under `/mi-cuenta/propiedades/`. Sending them to the admin
 *    panel would land them on `/auth/forbidden`.
 *  - Users WITH `access.panelAdmin` (ADMIN / SUPER_ADMIN) are sent to the
 *    admin panel so they can complete the rest of the listing (price,
 *    photos, amenities, contact, etc.).
 *
 * The endpoint can answer with three terminal states:
 *  - `created`     -> a fresh DRAFT was inserted, redirect to its edit page
 *                     (admin) or to the web property list.
 *  - `resumed`     -> the user already had an active DRAFT, same redirect.
 *  - `already_host` -> the user is already HOST/ADMIN, redirect to the admin
 *                      home (if allowed) or to the web property list.
 *
 * On 503 (billing layer unavailable), the form surfaces a retry-friendly
 * message instead of a generic error.
 */

import { SearchableSelect } from '@/components/form/SearchableSelect.client';
import type { SelectableItem } from '@/components/form/SearchableSelect.client';
import { ImportFromUrl } from '@/components/host/ImportFromUrl.client';
import { getAccommodationTypeIcon } from '@/lib/accommodation-type-icons';
import { translateApiError } from '@/lib/api-errors';
import { destinationsApi } from '@/lib/api/endpoints';
import { buildLimitReachedPayloadFromDetails } from '@/lib/billing-limit-error';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { buildUrlWithParams } from '@/lib/urls';
import { addToast } from '@/store/toast-store';
import { AccommodationTypeEnum } from '@repo/schemas';
import type { AccommodationImportResponse, DestinationPublic, FieldSource } from '@repo/schemas';
import { useCallback, useId, useMemo, useState } from 'react';
import styles from './CreatePropertyMiniForm.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Props for {@link CreatePropertyMiniForm}. */
export type CreatePropertyMiniFormProps = {
    /** Active UI locale. */
    readonly locale: SupportedLocale;
    /** API base URL for the draft create endpoint. */
    readonly apiUrl: string;
    /** Admin panel base URL — used only when {@link canAccessAdminPanel} is true. */
    readonly adminUrl: string;
    /**
     * Absolute path on the web app to the host's property list
     * (e.g. `/es/mi-cuenta/propiedades/`). Used as the post-create
     * fallback for users without admin panel access.
     */
    readonly accountPropertiesUrl: string;
    /**
     * Whether the current user has `access.panelAdmin`. Plain HOST users
     * do NOT have this permission, so they are bounced from `/admin/*`
     * to `/auth/forbidden`. When false we keep the redirect on the web.
     */
    readonly canAccessAdminPanel: boolean;
};

type FieldErrors = Readonly<{
    name?: string;
    summary?: string;
    type?: string;
    destinationId?: string;
}>;

/**
 * Per-field import metadata stored when an import prefills the form.
 * Used to render confidence badges next to each prefilled field.
 */
type FieldImportMeta = {
    readonly confidence: number;
    readonly source: FieldSource;
};

/**
 * Import metadata for every field that was prefilled from an import response.
 */
type ImportMeta = Readonly<{
    name?: FieldImportMeta;
    summary?: FieldImportMeta;
    type?: FieldImportMeta;
}>;

/**
 * Destination hint carried from the import response.
 * Surfaces next to the City picker as a non-binding informational hint.
 */
type DestinationHint = {
    readonly scrapedLocality?: string;
    readonly candidates: ReadonlyArray<{ readonly id: string; readonly name: string }>;
};

type OnboardingStartStatus = 'created' | 'resumed' | 'already_host';

/**
 * Force Better Auth to re-read the session from the database and rotate its
 * cookie cache. Required after the onboarding endpoint promotes the user
 * USER → HOST in DB: without this call, the cached session cookie still
 * carries `role=USER` for up to 5 minutes (Better Auth's default
 * `cookieCache.maxAge`), and the admin guard would route the freshly
 * promoted host straight to `/auth/forbidden`.
 *
 * See:
 *   https://better-auth.com/docs/concepts/session-management
 *     → "Disable Cookie Cache"
 *
 * Best-effort: errors are swallowed so a network blip on this call does not
 * block the post-submit redirect.
 */
async function refreshSessionFromDatabase(apiUrl: string): Promise<void> {
    try {
        await fetch(`${apiUrl.replace(/\/$/, '')}/api/auth/get-session?disableCookieCache=true`, {
            credentials: 'include',
            cache: 'no-store'
        });
    } catch {
        // Non-fatal: the admin guard will still resolve correctly once the
        // 5-minute cookie cache expires.
    }
}

type OnboardingStartResponse = {
    readonly data?: {
        readonly status: OnboardingStartStatus;
        readonly accommodationId: string | null;
        readonly accommodationSlug: string | null;
    };
    readonly error?: {
        readonly message?: string;
        readonly code?: string;
        readonly details?: unknown;
    };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ACCOMMODATION_TYPE_VALUES = Object.values(AccommodationTypeEnum);

/** Max suggestions surfaced by the city autocomplete dropdown. */
const CITY_AUTOCOMPLETE_LIMIT = 10;

/**
 * Minimal create-property form. On submit, POSTs to the draft endpoint and
 * redirects to the admin edit page on success. Shows inline field errors and
 * a top-level submit error when the API fails.
 */
export function CreatePropertyMiniForm({
    locale,
    apiUrl,
    adminUrl,
    accountPropertiesUrl,
    canAccessAdminPanel: _canAccessAdminPanel
}: CreatePropertyMiniFormProps) {
    const { t } = createTranslations(locale);

    const nameId = useId();
    const summaryId = useId();
    const typeId = useId();

    const [name, setName] = useState('');
    const [summary, setSummary] = useState('');
    const [typeItem, setTypeItem] = useState<SelectableItem | null>(null);
    const [city, setCity] = useState<SelectableItem | null>(null);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Import section state
    const [importOpen, setImportOpen] = useState(false);
    const [importMeta, setImportMeta] = useState<ImportMeta>({});
    const [importedOnce, setImportedOnce] = useState(false);
    const [destinationHint, setDestinationHint] = useState<DestinationHint | null>(null);

    // Items for the accommodation type picker. Memoized so the dropdown
    // doesn't re-allocate on every render. Each item carries the matching
    // icon resolved via the shared helper — same affordances the home page
    // search bar uses.
    const typeItems = useMemo<ReadonlyArray<SelectableItem>>(
        () =>
            ACCOMMODATION_TYPE_VALUES.map((value) => ({
                id: value,
                label: t(`host.miniForm.types.${value}`, value),
                icon: getAccommodationTypeIcon({ type: value })
            })),
        [t]
    );

    /**
     * Called by the ImportFromUrl island after a successful import.
     * Pre-fills form fields from the response draft without submitting anything.
     * Per-field confidence badges are stored in `importMeta`.
     */
    const handleImported = useCallback(
        (response: AccommodationImportResponse): void => {
            const nextMeta: {
                name?: FieldImportMeta;
                summary?: FieldImportMeta;
                type?: FieldImportMeta;
            } = {};

            if (typeof response.draft.name?.value === 'string') {
                setName(response.draft.name.value);
                nextMeta.name = {
                    confidence: response.draft.name.confidence,
                    source: response.draft.name.source
                };
            }

            if (typeof response.draft.summary?.value === 'string') {
                setSummary(response.draft.summary.value);
                nextMeta.summary = {
                    confidence: response.draft.summary.confidence,
                    source: response.draft.summary.source
                };
            }

            if (typeof response.draft.type?.value === 'string') {
                const typeValue = response.draft.type.value;
                // Reuse the already-computed typeItems to resolve the human label.
                const matchedTypeItem = typeItems.find((item) => item.id === typeValue);
                setTypeItem(
                    matchedTypeItem ?? {
                        id: typeValue,
                        label: typeValue
                    }
                );
                nextMeta.type = {
                    confidence: response.draft.type.confidence,
                    source: response.draft.type.source
                };
            }

            setImportMeta(nextMeta);
            setImportedOnce(true);

            // Destination hint: surface when the response carries locality or candidates.
            if (response.destinationHint) {
                const hint = response.destinationHint;
                const hasLocality = Boolean(hint.scrapedLocality);
                const hasCandidates = hint.candidates.length > 0;
                if (hasLocality || hasCandidates) {
                    setDestinationHint({
                        scrapedLocality: hint.scrapedLocality,
                        candidates: hint.candidates
                    });
                }
            }

            webLogger.info('CreatePropertyMiniForm: prefilled from import', {
                fieldsFilled: Object.keys(nextMeta)
            });
        },
        // typeItems is a memoized array — safe dep; setters from useState are stable.
        [typeItems]
    );

    // City picker uses async mode — hits the public destinations endpoint
    // (CITY-typed, name-only search scope, ranked client-side so prefix
    // matches sort above substring matches).
    const loadCityItems = useCallback(
        async (query: string): Promise<ReadonlyArray<SelectableItem>> => {
            const response = await destinationsApi.list({
                destinationType: 'CITY',
                q: query,
                searchScope: 'name',
                pageSize: CITY_AUTOCOMPLETE_LIMIT
            });
            if (!response.ok) {
                webLogger.warn('CreatePropertyMiniForm city autocomplete failed', {
                    error: response.error.message
                });
                return [];
            }
            const needle = query.trim().toLowerCase();
            return response.data.items
                .filter(
                    (item: DestinationPublic): item is DestinationPublic & { id: string } =>
                        typeof item.id === 'string'
                )
                .map(
                    (item): SelectableItem => ({
                        id: item.id,
                        label: item.name,
                        featured: Boolean(item.isFeatured)
                    })
                )
                .sort((a, b) => {
                    const an = a.label.toLowerCase();
                    const bn = b.label.toLowerCase();
                    const aExact = an === needle;
                    const bExact = bn === needle;
                    if (aExact !== bExact) return aExact ? -1 : 1;
                    const aStarts = an.startsWith(needle);
                    const bStarts = bn.startsWith(needle);
                    if (aStarts !== bStarts) return aStarts ? -1 : 1;
                    return an.localeCompare(bn);
                });
        },
        []
    );

    // "No encuentro mi ciudad" → contact form, with the user's last query
    // inlined into the prefilled message when present so the support inbox
    // sees the exact spelling that failed to resolve.
    const cityNotFoundHref = useMemo(() => {
        return buildUrlWithParams({
            locale,
            path: 'contacto',
            params: {
                type: 'publish_accommodation',
                subject: t(
                    'host.form.sections.ubicacion.cityPicker.contactSubject',
                    'Solicitud de nueva ciudad'
                ),
                message: t(
                    'host.form.sections.ubicacion.cityPicker.contactMessage',
                    'No encontré mi ciudad en el buscador del formulario de publicación. Me gustaría poder publicar mi alojamiento ahí. ¿Pueden agregarla?'
                )
            }
        });
    }, [locale, t]);

    function validate(): FieldErrors {
        const next: Record<string, string> = {};
        if (name.trim().length < 3) {
            next.name = t(
                'host.miniForm.errors.name',
                'El nombre debe tener al menos 3 caracteres.'
            );
        }
        if (summary.trim().length < 10) {
            next.summary = t(
                'host.miniForm.errors.summary',
                'La descripción corta debe tener al menos 10 caracteres.'
            );
        }
        if (!typeItem) {
            next.type = t('host.miniForm.errors.type', 'Elegí el tipo de alojamiento.');
        }
        if (!city?.id) {
            next.destinationId = t(
                'host.miniForm.errors.destinationId',
                'Elegí la ciudad donde está tu alojamiento.'
            );
        }
        return next;
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (isSubmitting) return;

        setSubmitError(null);
        const fieldErrors = validate();
        setErrors(fieldErrors);
        if (Object.keys(fieldErrors).length > 0) return;

        setIsSubmitting(true);
        try {
            const response = await fetch(
                `${apiUrl.replace(/\/$/, '')}/api/v1/protected/host-onboarding/start`,
                {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: name.trim(),
                        summary: summary.trim(),
                        // typeItem.id is the AccommodationType enum value; guaranteed by validate()
                        type: typeItem?.id ?? '',
                        // city.id is guaranteed by validate()
                        destinationId: city?.id ?? ''
                    })
                }
            );

            // 503: billing layer unavailable, surface a retry-friendly message
            if (response.status === 503) {
                setSubmitError(
                    t(
                        'host.miniForm.errors.serviceUnavailable',
                        'No pudimos contactar al servicio de facturación en este momento. Probá de nuevo en un minuto.'
                    )
                );
                return;
            }

            if (!response.ok) {
                const localizedFallback = t(
                    'host.miniForm.errors.submit',
                    'No pudimos crear el alojamiento. Probá de nuevo en un momento.'
                );
                let parsedErrorBody: OnboardingStartResponse | undefined;
                try {
                    parsedErrorBody = (await response.json()) as OnboardingStartResponse;
                } catch {
                    // Body wasn't JSON; keep the localized fallback message.
                }

                // 403 LIMIT_REACHED: host has hit their accommodation publish limit.
                // Show a localized toast with an upgrade CTA instead of an inline form error.
                if (response.status === 403 && parsedErrorBody?.error?.code === 'LIMIT_REACHED') {
                    const limitPayload = buildLimitReachedPayloadFromDetails({
                        details: parsedErrorBody.error?.details,
                        locale
                    });
                    addToast({
                        type: 'error',
                        message: limitPayload.message,
                        action: limitPayload.action
                    });
                    return;
                }

                setSubmitError(
                    translateApiError({
                        error: parsedErrorBody?.error,
                        t,
                        fallback: localizedFallback
                    })
                );
                return;
            }

            const body = (await response.json()) as OnboardingStartResponse;
            const data = body.data;
            if (!data) {
                setSubmitError(
                    t(
                        'host.miniForm.errors.submit',
                        'No pudimos crear el alojamiento. Probá de nuevo en un momento.'
                    )
                );
                return;
            }

            const adminBase = adminUrl.replace(/\/$/, '');

            // `already_host`: the user already had an active HOST/ADMIN role
            // before this submit — nothing changed in their permissions, so
            // no session refresh is needed. Always send them to their own
            // property list on the web app (`/me/accommodations` path resolved
            // via `accountPropertiesUrl`). Redirecting admin-capable users to
            // the global admin list (`/accommodations`) is confusing because
            // they didn't create or resume any particular draft here.
            if (data.status === 'already_host') {
                window.location.href = accountPropertiesUrl;
                return;
            }

            // `created` / `resumed`: the endpoint just promoted the user
            // USER → HOST atomically with the draft creation. Better Auth's
            // cookie cache still carries the pre-promotion `role=USER` for
            // up to 5 minutes, so we force a session refresh from the DB
            // before redirecting to the admin. Otherwise the admin guard
            // would read the stale cookie and bounce the host to
            // `/auth/forbidden?reason=host-missing-permission`.
            await refreshSessionFromDatabase(apiUrl);

            if (!data.accommodationId) {
                setSubmitError(
                    t(
                        'host.miniForm.errors.missingId',
                        'No recibimos el ID del alojamiento creado. Probá de nuevo.'
                    )
                );
                return;
            }
            window.location.href = `${adminBase}/accommodations/${data.accommodationId}/edit`;
        } catch {
            setSubmitError(
                t(
                    'host.miniForm.errors.network',
                    'No pudimos conectar con el servidor. Verificá tu conexión e intentá de nuevo.'
                )
            );
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form
            className="form form--card"
            onSubmit={(event) => {
                void handleSubmit(event);
            }}
            noValidate
        >
            {/* Import from URL — collapsible section at the top of the form (T-025). */}
            <div
                className={styles.importSection}
                data-testid="import-section"
            >
                <button
                    type="button"
                    className={styles.importToggle}
                    aria-expanded={importOpen}
                    onClick={() => setImportOpen((prev) => !prev)}
                    data-testid="import-toggle"
                >
                    {t('host.importFromUrl.prefill.sectionToggle', 'Importar desde una URL')}
                    <span
                        className={`${styles.importToggleIcon} ${importOpen ? styles['importToggleIcon--open'] : ''}`}
                        aria-hidden="true"
                    >
                        ▼
                    </span>
                </button>
                {importOpen ? (
                    <div className={styles.importBody}>
                        <ImportFromUrl
                            locale={locale}
                            onImported={handleImported}
                        />
                    </div>
                ) : null}
            </div>

            {/* Review notice — shown once after the first successful import (AC-1.2/1.3). */}
            {importedOnce ? (
                <output
                    className={styles.reviewNotice}
                    data-testid="import-review-notice"
                >
                    <span
                        className={styles.reviewNoticeIcon}
                        aria-hidden="true"
                    >
                        ℹ
                    </span>
                    <span>
                        {t(
                            'host.importFromUrl.prefill.reviewNotice',
                            'Revisá y confirmá los datos importados antes de continuar.'
                        )}
                    </span>
                </output>
            ) : null}

            {/* Name */}
            <div className="form-field">
                <div className={styles.fieldWithBadge}>
                    <label
                        className="form-label"
                        htmlFor={nameId}
                    >
                        {t('host.miniForm.fields.name', 'Nombre del alojamiento')}
                        <span
                            className="form-required"
                            aria-hidden="true"
                        >
                            *
                        </span>
                    </label>
                    {importMeta.name ? (
                        <span
                            className={styles.confidenceBadge}
                            data-testid="import-badge-name"
                        >
                            {t('host.importFromUrl.prefill.badge.imported', 'Importado')}
                            <span aria-hidden="true">
                                {t('host.importFromUrl.prefill.badge.separator', '·')}
                            </span>
                            {`${String(importMeta.name.confidence)}%`}
                            <span aria-hidden="true">
                                {t('host.importFromUrl.prefill.badge.separator', '·')}
                            </span>
                            {importMeta.name.source}
                        </span>
                    ) : null}
                </div>
                <input
                    id={nameId}
                    className="form-input"
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={100}
                    required
                    aria-invalid={errors.name ? 'true' : 'false'}
                    aria-describedby={errors.name ? `${nameId}-error` : undefined}
                />
                {errors.name && (
                    <p
                        id={`${nameId}-error`}
                        className="form-error"
                        role="alert"
                    >
                        {errors.name}
                    </p>
                )}
            </div>

            {/* Type — shared SearchableSelect in local mode (icon affordance per type). */}
            <div className="form-field">
                {importMeta.type ? (
                    <span
                        className={styles.confidenceBadge}
                        data-testid="import-badge-type"
                    >
                        {t('host.importFromUrl.prefill.badge.imported', 'Importado')}
                        <span aria-hidden="true">
                            {t('host.importFromUrl.prefill.badge.separator', '·')}
                        </span>
                        {`${String(importMeta.type.confidence)}%`}
                        <span aria-hidden="true">
                            {t('host.importFromUrl.prefill.badge.separator', '·')}
                        </span>
                        {importMeta.type.source}
                    </span>
                ) : null}
                <SearchableSelect
                    locale={locale}
                    inputId={typeId}
                    label={t('host.miniForm.fields.type', 'Tipo de alojamiento')}
                    value={typeItem}
                    onChange={(item) => setTypeItem(item)}
                    items={typeItems}
                    placeholder={t('host.miniForm.fields.typePlaceholder', 'Elegí una opción')}
                    emptyLabel={t('host.miniForm.fields.typeEmpty', 'No hay tipos que coincidan')}
                    error={errors.type ?? null}
                    required
                    testId="property-type"
                />
            </div>

            {/* City — shared SearchableSelect in async mode (hits public destinations API). */}
            <div className="form-field">
                <SearchableSelect
                    locale={locale}
                    label={t('host.form.sections.ubicacion.cityPicker.label', 'Ciudad')}
                    value={city}
                    onChange={(item) => setCity(item)}
                    loadItems={loadCityItems}
                    minQueryLength={2}
                    placeholder={t(
                        'host.form.sections.ubicacion.cityPicker.placeholder',
                        'Buscá tu ciudad (mín. 2 letras)'
                    )}
                    loadingLabel={t(
                        'host.form.sections.ubicacion.cityPicker.loading',
                        'Buscando ciudades...'
                    )}
                    emptyLabel={t(
                        'host.form.sections.ubicacion.cityPicker.empty',
                        'No hay coincidencias'
                    )}
                    error={errors.destinationId ?? null}
                    required
                    testId="property-city"
                    footer={
                        <a
                            href={cityNotFoundHref}
                            className="combobox__helper-link"
                            data-testid="city-picker-not-found"
                        >
                            {t(
                                'host.form.sections.ubicacion.cityPicker.notFoundLink',
                                'No encuentro mi ciudad'
                            )}
                        </a>
                    }
                />
                {/* Destination hint — non-binding, advisory only (T-025). */}
                {destinationHint ? (
                    <div
                        className={styles.destinationHint}
                        data-testid="destination-hint"
                    >
                        <span className={styles.destinationHintLabel}>
                            {t(
                                'host.importFromUrl.prefill.destinationHint.label',
                                'Sugerencia de destino'
                            )}
                        </span>
                        {destinationHint.scrapedLocality ? (
                            <span className={styles.destinationHintText}>
                                {t(
                                    'host.importFromUrl.prefill.destinationHint.locality',
                                    `Se detectó la localidad: ${destinationHint.scrapedLocality}`
                                ).replace('{{locality}}', destinationHint.scrapedLocality)}
                            </span>
                        ) : null}
                        {destinationHint.candidates.length > 0 ? (
                            <span className={styles.destinationHintText}>
                                {t(
                                    'host.importFromUrl.prefill.destinationHint.candidates',
                                    `Destinos sugeridos: ${destinationHint.candidates.map((c) => c.name).join(', ')}`
                                ).replace(
                                    '{{names}}',
                                    destinationHint.candidates.map((c) => c.name).join(', ')
                                )}
                            </span>
                        ) : null}
                        <span className={styles.destinationHintCallout}>
                            {t(
                                'host.importFromUrl.prefill.destinationHint.hint',
                                'Elegí el destino manualmente en el campo Ciudad.'
                            )}
                        </span>
                    </div>
                ) : null}
            </div>

            {/* Summary */}
            <div className="form-field">
                <div className={styles.fieldWithBadge}>
                    <label
                        className="form-label"
                        htmlFor={summaryId}
                    >
                        {t('host.miniForm.fields.summary', 'Descripción corta')}
                        <span
                            className="form-required"
                            aria-hidden="true"
                        >
                            *
                        </span>
                    </label>
                    {importMeta.summary ? (
                        <span
                            className={styles.confidenceBadge}
                            data-testid="import-badge-summary"
                        >
                            {t('host.importFromUrl.prefill.badge.imported', 'Importado')}
                            <span aria-hidden="true">
                                {t('host.importFromUrl.prefill.badge.separator', '·')}
                            </span>
                            {`${String(importMeta.summary.confidence)}%`}
                            <span aria-hidden="true">
                                {t('host.importFromUrl.prefill.badge.separator', '·')}
                            </span>
                            {importMeta.summary.source}
                        </span>
                    ) : null}
                </div>
                <textarea
                    id={summaryId}
                    className="form-textarea"
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    rows={3}
                    maxLength={300}
                    required
                    aria-invalid={errors.summary ? 'true' : 'false'}
                    aria-describedby={errors.summary ? `${summaryId}-error` : undefined}
                />
                <p className="form-hint">
                    {t(
                        'host.miniForm.fields.summaryHint',
                        'Una frase de presentación. Después podés ampliar todo en el panel.'
                    )}
                </p>
                {errors.summary && (
                    <p
                        id={`${summaryId}-error`}
                        className="form-error"
                        role="alert"
                    >
                        {errors.summary}
                    </p>
                )}
            </div>

            {submitError && (
                <p
                    className="form-error-banner"
                    role="alert"
                >
                    {submitError}
                </p>
            )}

            <div className="form-actions">
                <button
                    type="submit"
                    className="btn-gradient btn-gradient--accent btn-gradient--shape-rounded"
                    disabled={isSubmitting}
                >
                    <span className="gradient-btn__label">
                        {isSubmitting
                            ? t('host.miniForm.actions.submitting', 'Creando...')
                            : t('host.miniForm.actions.submit', 'Crear y continuar en el panel')}
                    </span>
                </button>
            </div>

            <p className="form-disclaimer">
                {t(
                    'host.miniForm.disclaimer',
                    'Vamos a crear un borrador con estos datos. Después te llevamos al panel para completar fotos, precios y demás.'
                )}
            </p>
            <aside
                className="form-trial-callout"
                role="note"
            >
                <span
                    className="form-trial-callout__icon"
                    aria-hidden="true"
                >
                    🎁
                </span>
                <div className="form-trial-callout__body">
                    <p className="form-trial-callout__title">
                        {t('host.pages.nueva.trialCalloutTitle', '14 días gratis al publicar')}
                    </p>
                    <p className="form-trial-callout__text">
                        {t(
                            'host.pages.nueva.trialNote',
                            'Cuando publiques tu primera propiedad arranca tu trial gratis de 14 días. Sin tarjeta, sin compromiso. Podés probar todo el panel mientras armás tu borrador.'
                        )}
                    </p>
                </div>
            </aside>
        </form>
    );
}
