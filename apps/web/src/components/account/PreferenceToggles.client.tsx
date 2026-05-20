/**
 * @file PreferenceToggles.client.tsx
 * @description React island for managing user web-surface preferences.
 *
 * Fetches the user's current settings on mount, then renders toggles for:
 *   - themeWeb     (system / light / dark) — applied via data-theme on <html>
 *   - languageWeb  (es / en / pt)
 *   - notifications.allowEmails
 *   - notifications.allowPush
 *   - notifications.allowSms
 *   - newsletter
 *
 * Admin-only fields (themeAdmin, languageAdmin) are intentionally NOT shown.
 *
 * Each toggle PATCHes the web-scoped settings endpoint optimistically. On
 * error the value reverts and a toast is shown.
 *
 * Hydration: caller must use `client:load`.
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './PreferenceToggles.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Theme preference for the web surface */
type ThemeWeb = 'system' | 'light' | 'dark';

/** Language preference for the web surface */
type LanguageWeb = 'es' | 'en' | 'pt';

/** Notification settings shape */
interface NotificationSettings {
    enabled: boolean;
    allowEmails: boolean;
    allowPush: boolean;
    allowSms: boolean;
}

/** Web-scoped settings managed by this component */
interface WebSettings {
    themeWeb: ThemeWeb;
    languageWeb: LanguageWeb;
    notifications: NotificationSettings;
    newsletter: boolean;
}

/** Raw user object returned by GET /api/v1/protected/users/:id */
interface UserApiResponse {
    readonly success: boolean;
    readonly data?: {
        readonly id?: string;
        readonly settings?: {
            readonly themeWeb?: string;
            readonly languageWeb?: string;
            readonly notifications?: {
                readonly enabled?: boolean;
                readonly allowEmails?: boolean;
                readonly allowPush?: boolean;
                readonly allowSms?: boolean;
            };
            readonly newsletter?: boolean;
        } | null;
    };
    readonly error?: { readonly message: string };
}

/** PATCH response */
interface PatchApiResponse {
    readonly success: boolean;
    readonly error?: { readonly message: string };
}

interface PreferenceTogglesProps {
    /** Authenticated user ID (from Astro.locals.user) */
    readonly userId: string;
    /** Active locale for i18n */
    readonly locale: SupportedLocale;
    /** API base URL (PUBLIC_API_URL from env) */
    readonly apiUrl: string;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SETTINGS: WebSettings = {
    themeWeb: 'system',
    languageWeb: 'es',
    notifications: {
        enabled: true,
        allowEmails: true,
        allowPush: false,
        allowSms: false
    },
    newsletter: false
};

// ─── Theme application ────────────────────────────────────────────────────────

/**
 * Apply themeWeb by setting `data-theme` on the root `<html>` element.
 * 'system' follows the OS preference via `prefers-color-scheme`.
 */
function applyTheme(theme: ThemeWeb): void {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        root.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        root.setAttribute('data-theme', theme);
    }
    // Persist so FOUC-prevention script picks it up next load
    try {
        localStorage.setItem('theme', theme);
    } catch {
        // ignore storage errors
    }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Preference toggles island.
 * Web-surface only: no themeAdmin or languageAdmin fields.
 */
export function PreferenceToggles({ userId, locale, apiUrl }: PreferenceTogglesProps) {
    const { t } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');

    const [settings, setSettings] = useState<WebSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    /** Track which field is currently being saved (to show "Guardando" inline) */
    const [savingField, setSavingField] = useState<string | null>(null);

    // Debounce timer ref to batch rapid changes
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Fetch current settings ─────────────────────────────────────────────

    // Pre-compute the fetch-error fallback string here so the useCallback
    // below can depend on it without depending on `t` itself.
    // `createTranslations(locale)` returns a new object every render, so
    // putting `t` in the deps would re-create fetchSettings every render,
    // re-fire the useEffect below, and spam the API in an infinite loop
    // (it was hitting the 429 rate limit on mount before this rewrite).
    // The string returned from `t()` has value-based identity, so React
    // sees the same dep across renders.
    const fetchErrorMsg = t(
        'account.preferences.errors.fetchFailed',
        'Error al cargar preferencias'
    );

    const fetchSettings = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${base}/api/v1/protected/users/${userId}`, {
                credentials: 'include'
            });
            if (!res.ok) {
                throw new Error(fetchErrorMsg);
            }
            const body = (await res.json()) as UserApiResponse;
            if (!body.success) {
                throw new Error(body.error?.message ?? fetchErrorMsg);
            }
            const raw = body.data?.settings;
            setSettings({
                themeWeb: (raw?.themeWeb as ThemeWeb | undefined) ?? DEFAULT_SETTINGS.themeWeb,
                languageWeb:
                    (raw?.languageWeb as LanguageWeb | undefined) ?? DEFAULT_SETTINGS.languageWeb,
                notifications: {
                    enabled: raw?.notifications?.enabled ?? DEFAULT_SETTINGS.notifications.enabled,
                    allowEmails:
                        raw?.notifications?.allowEmails ??
                        DEFAULT_SETTINGS.notifications.allowEmails,
                    allowPush:
                        raw?.notifications?.allowPush ?? DEFAULT_SETTINGS.notifications.allowPush,
                    allowSms:
                        raw?.notifications?.allowSms ?? DEFAULT_SETTINGS.notifications.allowSms
                },
                newsletter: raw?.newsletter ?? DEFAULT_SETTINGS.newsletter
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : fetchErrorMsg;
            setError(msg);
        } finally {
            setLoading(false);
        }
    }, [base, userId, fetchErrorMsg]);

    useEffect(() => {
        void fetchSettings();
    }, [fetchSettings]);

    // ── Persist settings ───────────────────────────────────────────────────

    /**
     * PATCH the web-scoped settings (only themeWeb/languageWeb/notifications/newsletter).
     * Called optimistically — caller already updated local state.
     */
    async function persistSettings(
        patch: Partial<WebSettings>,
        fieldKey: string,
        previousSettings: WebSettings
    ): Promise<void> {
        setSavingField(fieldKey);
        try {
            const body: Record<string, unknown> = {};
            if (patch.themeWeb !== undefined) body.themeWeb = patch.themeWeb;
            if (patch.languageWeb !== undefined) body.languageWeb = patch.languageWeb;
            if (patch.notifications !== undefined) body.notifications = patch.notifications;
            if (patch.newsletter !== undefined) body.newsletter = patch.newsletter;

            const res = await fetch(`${base}/api/v1/protected/users/${userId}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ settings: body })
            });

            if (!res.ok) {
                let msg = t(
                    'account.preferences.errors.saveFailed',
                    'No se pudo guardar la preferencia'
                );
                try {
                    const errBody = (await res.json()) as PatchApiResponse;
                    if (errBody.error?.message) msg = errBody.error.message;
                } catch {
                    // ignore
                }
                throw new Error(msg);
            }
        } catch (err) {
            // Revert on failure
            setSettings(previousSettings);
            const msg =
                err instanceof Error
                    ? err.message
                    : t(
                          'account.preferences.errors.saveFailed',
                          'No se pudo guardar la preferencia'
                      );
            addToast({ type: 'error', message: msg });
        } finally {
            setSavingField(null);
        }
    }

    // ── Handlers ──────────────────────────────────────────────────────────

    function handleThemeChange(value: ThemeWeb) {
        const prev = { ...settings };
        const next = { ...settings, themeWeb: value };
        setSettings(next);
        applyTheme(value);
        void persistSettings({ themeWeb: value }, 'themeWeb', prev);
    }

    function handleLanguageChange(value: LanguageWeb) {
        const prev = { ...settings };
        const next = { ...settings, languageWeb: value };
        setSettings(next);
        void persistSettings({ languageWeb: value }, 'languageWeb', prev);
    }

    function handleNotifToggle(key: keyof NotificationSettings) {
        const prev = { ...settings };
        const nextNotif = { ...settings.notifications, [key]: !settings.notifications[key] };
        const next = { ...settings, notifications: nextNotif };
        setSettings(next);

        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            void persistSettings({ notifications: nextNotif }, `notif.${key}`, prev);
        }, 400);
    }

    function handleNewsletterToggle() {
        const prev = { ...settings };
        const next = { ...settings, newsletter: !settings.newsletter };
        setSettings(next);
        void persistSettings({ newsletter: next.newsletter }, 'newsletter', prev);
    }

    // ── Render ────────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div
                className={styles.loadingWrap}
                aria-live="polite"
                aria-busy="true"
            >
                {t('common.loading', 'Cargando…')}
            </div>
        );
    }

    if (error) {
        return (
            <div
                className={styles.errorWrap}
                role="alert"
            >
                {error}
            </div>
        );
    }

    return (
        <div className={styles.root}>
            {/* ── Appearance section ─────────────────────────────────── */}
            <section
                className={styles.section}
                aria-labelledby="appearance-title"
            >
                <h3
                    className={styles.sectionTitle}
                    id="appearance-title"
                >
                    {t('account.preferences.sections.appearance', 'Apariencia')}
                </h3>

                {/* themeWeb */}
                <div className={styles.prefRow}>
                    <div className={styles.prefInfo}>
                        <span className={styles.prefLabel}>
                            {t('account.preferences.theme.label', 'Tema')}
                        </span>
                        <span className={styles.prefDescription}>
                            {t('account.preferences.theme.description', 'Color de la interfaz web')}
                        </span>
                    </div>
                    <div className={styles.toggleWrap}>
                        <select
                            className={styles.select}
                            value={settings.themeWeb}
                            disabled={savingField === 'themeWeb'}
                            aria-label={t('account.preferences.theme.label', 'Tema')}
                            onChange={(e) => handleThemeChange(e.target.value as ThemeWeb)}
                        >
                            <option value="system">
                                {t('account.preferences.theme.system', 'Sistema')}
                            </option>
                            <option value="light">
                                {t('account.preferences.theme.light', 'Claro')}
                            </option>
                            <option value="dark">
                                {t('account.preferences.theme.dark', 'Oscuro')}
                            </option>
                        </select>
                        {savingField === 'themeWeb' && (
                            <span className={styles.toggleSaving}>
                                {t('common.saving', 'Guardando…')}
                            </span>
                        )}
                    </div>
                </div>

                {/* languageWeb */}
                <div className={styles.prefRow}>
                    <div className={styles.prefInfo}>
                        <span className={styles.prefLabel}>
                            {t('account.preferences.language.label', 'Idioma')}
                        </span>
                        <span className={styles.prefDescription}>
                            {t(
                                'account.preferences.language.description',
                                'Idioma de la plataforma web'
                            )}
                        </span>
                    </div>
                    <div className={styles.toggleWrap}>
                        <select
                            className={styles.select}
                            value={settings.languageWeb}
                            disabled={savingField === 'languageWeb'}
                            aria-label={t('account.preferences.language.label', 'Idioma')}
                            onChange={(e) => handleLanguageChange(e.target.value as LanguageWeb)}
                        >
                            <option value="es">Español</option>
                            <option value="en">English</option>
                            <option value="pt">Português</option>
                        </select>
                        {savingField === 'languageWeb' && (
                            <span className={styles.toggleSaving}>
                                {t('common.saving', 'Guardando…')}
                            </span>
                        )}
                    </div>
                </div>
            </section>

            {/* ── Notifications section ──────────────────────────────── */}
            <section
                className={styles.section}
                aria-labelledby="notifications-title"
            >
                <h3
                    className={styles.sectionTitle}
                    id="notifications-title"
                >
                    {t('account.preferences.sections.notifications', 'Notificaciones')}
                </h3>

                {/* allowEmails */}
                <ToggleRow
                    label={t('account.preferences.notifications.email.label', 'Correo electrónico')}
                    description={t(
                        'account.preferences.notifications.email.description',
                        'Recibir notificaciones por email'
                    )}
                    checked={settings.notifications.allowEmails}
                    saving={savingField === 'notif.allowEmails'}
                    id="pref-allow-emails"
                    savingLabel={t('common.saving', 'Guardando…')}
                    onToggle={() => handleNotifToggle('allowEmails')}
                />

                {/* allowPush */}
                <ToggleRow
                    label={t('account.preferences.notifications.push.label', 'Notificaciones push')}
                    description={t(
                        'account.preferences.notifications.push.description',
                        'Recibir notificaciones en el navegador'
                    )}
                    checked={settings.notifications.allowPush}
                    saving={savingField === 'notif.allowPush'}
                    id="pref-allow-push"
                    savingLabel={t('common.saving', 'Guardando…')}
                    onToggle={() => handleNotifToggle('allowPush')}
                />

                {/* allowSms */}
                <ToggleRow
                    label={t('account.preferences.notifications.sms.label', 'SMS')}
                    description={t(
                        'account.preferences.notifications.sms.description',
                        'Recibir notificaciones por SMS'
                    )}
                    checked={settings.notifications.allowSms}
                    saving={savingField === 'notif.allowSms'}
                    id="pref-allow-sms"
                    savingLabel={t('common.saving', 'Guardando…')}
                    onToggle={() => handleNotifToggle('allowSms')}
                />
            </section>

            {/* ── Newsletter section ─────────────────────────────────── */}
            <section
                className={styles.section}
                aria-labelledby="newsletter-title"
            >
                <h3
                    className={styles.sectionTitle}
                    id="newsletter-title"
                >
                    {t('account.preferences.sections.newsletter', 'Boletín de novedades')}
                </h3>

                <ToggleRow
                    label={t(
                        'account.preferences.newsletter.label',
                        'Recibir el boletín de novedades'
                    )}
                    description={t(
                        'account.preferences.newsletter.description',
                        'Recibir novedades, ofertas y destinos destacados'
                    )}
                    checked={settings.newsletter}
                    saving={savingField === 'newsletter'}
                    id="pref-newsletter"
                    savingLabel={t('common.saving', 'Guardando…')}
                    onToggle={handleNewsletterToggle}
                />
            </section>
        </div>
    );
}

// ─── Toggle row sub-component ─────────────────────────────────────────────────

interface ToggleRowProps {
    readonly label: string;
    readonly description: string;
    readonly checked: boolean;
    readonly saving: boolean;
    readonly id: string;
    readonly savingLabel: string;
    readonly onToggle: () => void;
}

/**
 * Accessible toggle row with label, description, and custom switch UI.
 */
function ToggleRow({
    label,
    description,
    checked,
    saving,
    id,
    savingLabel,
    onToggle
}: ToggleRowProps) {
    return (
        <div className={styles.prefRow}>
            <div className={styles.prefInfo}>
                <label
                    className={styles.prefLabel}
                    htmlFor={id}
                >
                    {label}
                </label>
                <span className={styles.prefDescription}>{description}</span>
            </div>
            <div className={styles.toggleWrap}>
                <label
                    className={styles.toggle}
                    aria-label={label}
                >
                    <input
                        id={id}
                        type="checkbox"
                        checked={checked}
                        disabled={saving}
                        onChange={onToggle}
                        aria-describedby={`${id}-desc`}
                    />
                    <span
                        className={styles.toggleTrack}
                        aria-hidden="true"
                    />
                    <span
                        className={styles.toggleThumb}
                        aria-hidden="true"
                    />
                </label>
                {saving && (
                    <span
                        className={styles.toggleSaving}
                        aria-live="polite"
                    >
                        {savingLabel}
                    </span>
                )}
            </div>
        </div>
    );
}
