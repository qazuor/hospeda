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

import { CityDestinationPicker } from '@/components/form/CityDestinationPicker.client';
import type { CityDestinationValue } from '@/components/form/CityDestinationPicker.client';
import { translateApiError } from '@/lib/api-errors';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { AccommodationTypeEnum } from '@repo/schemas';
import { useId, useState } from 'react';
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
    };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ACCOMMODATION_TYPE_VALUES = Object.values(AccommodationTypeEnum);

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
    canAccessAdminPanel
}: CreatePropertyMiniFormProps) {
    const { t } = createTranslations(locale);

    const nameId = useId();
    const summaryId = useId();
    const typeId = useId();

    const [name, setName] = useState('');
    const [summary, setSummary] = useState('');
    const [type, setType] = useState<string>('');
    const [city, setCity] = useState<CityDestinationValue | null>(null);
    const [errors, setErrors] = useState<FieldErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        if (!type) {
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
                        type,
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
                let apiError: { code?: string; message?: string } | undefined;
                try {
                    const body = (await response.json()) as OnboardingStartResponse;
                    if (body.error) apiError = body.error;
                } catch {
                    // Body wasn't JSON; keep the localized fallback message.
                }
                setSubmitError(
                    translateApiError({ error: apiError, t, fallback: localizedFallback })
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

            // `already_host`: the user already held a privileged role before
            // this submit, so the pre-submit `canAccessAdminPanel` flag is
            // still accurate. No session refresh is needed because nothing
            // changed in the user's role / permissions.
            if (data.status === 'already_host') {
                window.location.href = canAccessAdminPanel
                    ? `${adminBase}/accommodations`
                    : accountPropertiesUrl;
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
            className={styles.form}
            onSubmit={(event) => {
                void handleSubmit(event);
            }}
            noValidate
        >
            {/* Name */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor={nameId}
                >
                    {t('host.miniForm.fields.name', 'Nombre del alojamiento')}
                </label>
                <input
                    id={nameId}
                    className={styles.input}
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
                        className={styles.error}
                        role="alert"
                    >
                        {errors.name}
                    </p>
                )}
            </div>

            {/* Type */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor={typeId}
                >
                    {t('host.miniForm.fields.type', 'Tipo de alojamiento')}
                </label>
                <select
                    id={typeId}
                    className={styles.select}
                    value={type}
                    onChange={(event) => setType(event.target.value)}
                    required
                    aria-invalid={errors.type ? 'true' : 'false'}
                    aria-describedby={errors.type ? `${typeId}-error` : undefined}
                >
                    <option value="">
                        {t('host.miniForm.fields.typePlaceholder', 'Elegí una opción')}
                    </option>
                    {ACCOMMODATION_TYPE_VALUES.map((value) => (
                        <option
                            key={value}
                            value={value}
                        >
                            {t(`host.miniForm.types.${value}`, value)}
                        </option>
                    ))}
                </select>
                {errors.type && (
                    <p
                        id={`${typeId}-error`}
                        className={styles.error}
                        role="alert"
                    >
                        {errors.type}
                    </p>
                )}
            </div>

            {/* City picker */}
            <div className={styles.field}>
                <CityDestinationPicker
                    locale={locale}
                    value={city}
                    onSelect={(id, displayName) => setCity({ id, name: displayName })}
                    error={errors.destinationId ?? null}
                    required
                />
            </div>

            {/* Summary */}
            <div className={styles.field}>
                <label
                    className={styles.label}
                    htmlFor={summaryId}
                >
                    {t('host.miniForm.fields.summary', 'Descripción corta')}
                </label>
                <textarea
                    id={summaryId}
                    className={styles.textarea}
                    value={summary}
                    onChange={(event) => setSummary(event.target.value)}
                    rows={3}
                    maxLength={300}
                    required
                    aria-invalid={errors.summary ? 'true' : 'false'}
                    aria-describedby={errors.summary ? `${summaryId}-error` : undefined}
                />
                <p className={styles.hint}>
                    {t(
                        'host.miniForm.fields.summaryHint',
                        'Una frase de presentación. Después podés ampliar todo en el panel.'
                    )}
                </p>
                {errors.summary && (
                    <p
                        id={`${summaryId}-error`}
                        className={styles.error}
                        role="alert"
                    >
                        {errors.summary}
                    </p>
                )}
            </div>

            {submitError && (
                <p
                    className={styles.submitError}
                    role="alert"
                >
                    {submitError}
                </p>
            )}

            <div className={styles.actions}>
                <button
                    type="submit"
                    className={styles.submitBtn}
                    disabled={isSubmitting}
                >
                    {isSubmitting
                        ? t('host.miniForm.actions.submitting', 'Creando...')
                        : t('host.miniForm.actions.submit', 'Crear y continuar en el panel')}
                </button>
            </div>

            <p className={styles.disclaimer}>
                {t(
                    'host.miniForm.disclaimer',
                    'Vamos a crear un borrador con estos datos. Después te llevamos al panel para completar fotos, precios y demás.'
                )}
            </p>
        </form>
    );
}
