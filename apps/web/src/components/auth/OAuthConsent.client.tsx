/**
 * @file OAuthConsent.client.tsx
 * @description OAuth consent screen island (HOS-2184 T-027).
 *
 * Shown when an AI assistant (Claude, ChatGPT, ...) asks to connect to a
 * Hospeda account. The API's OAuth provider redirects the browser to
 * `/{locale}/auth/consent/` with a signed authorization request in the query
 * string. The page itself is session-blind: everything per-user happens here,
 * in the browser.
 *
 * Flow:
 * 1. Parse the signed request from `window.location.search`.
 * 2. `GET /oauth2/public-client` returns the client's public metadata. The
 *    endpoint needs a session: a 401 sends the visitor to the sign-in page,
 *    which brings them back here once they are signed in.
 * 3. Allow / Cancel POST `/oauth2/consent` with the signed query. The API
 *    answers `{ redirect: true, url }` and the browser follows it back to the
 *    client (with the authorization code, or with `access_denied`).
 *
 * Client metadata is registered by third parties (CIMD documents and dynamic
 * registration), so it is untrusted: names render as React text only, and the
 * website and logo are used only when they are `https:` URLs.
 */

import { ExternalLinkIcon, ShieldAlertIcon, ShieldIcon } from '@repo/icons';
import { useEffect, useState } from 'react';
import { clearCachedAuthMe } from '@/lib/auth-cache';
import { authClient } from '@/lib/auth-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { maskEmail } from '@/lib/mask-email';
import {
    buildConsentSigninUrl,
    type ConsentRequest,
    isFollowableRedirectUrl,
    parseConsentRequest,
    toKnownOAuthScope,
    toSafeHttpsUrl
} from '@/lib/oauth-consent';
import { AI_ASSISTANTS_PATH } from '@/lib/routes';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import { buildUrl } from '@/lib/urls';
import styles from './OAuthConsent.module.css';

/** Public client fields returned by `GET /oauth2/public-client`. */
interface PublicClient {
    readonly client_name?: unknown;
    readonly client_uri?: unknown;
    readonly logo_uri?: unknown;
}

/** Body of a successful `POST /oauth2/consent`. */
interface ConsentRedirect {
    readonly redirect?: unknown;
    readonly url?: unknown;
}

/** Why the screen cannot be used. */
type ErrorKind = 'invalidRequest' | 'clientNotFound' | 'loadFailed' | 'submitFailed';

/** What the user is doing. `intent` is the decision being submitted. */
type ViewState =
    | { readonly status: 'loading' }
    | { readonly status: 'ready'; readonly client: PublicClient }
    | {
          readonly status: 'submitting';
          readonly client: PublicClient;
          readonly intent: 'allow' | 'deny';
      }
    | { readonly status: 'redirecting' }
    | { readonly status: 'error'; readonly kind: ErrorKind; readonly client?: PublicClient };

/** The signed-in account as shown on the screen (display name + masked email). */
interface AccountView {
    readonly name: string | null;
    readonly maskedEmail: string | null;
}

/** Props for {@link OAuthConsent}. */
export interface OAuthConsentProps {
    /** Active locale, used for copy and for the sign-in round trip. */
    readonly locale: SupportedLocale;
}

/** Capabilities the MCP connection grants (spec HOS-2184 section 8). */
const CAPABILITY_KEYS = ['read', 'edit', 'pause', 'reply'] as const;

/**
 * Consent screen for an OAuth authorization request.
 *
 * @example
 * ```astro
 * <OAuthConsent client:load locale={locale} />
 * ```
 */
export function OAuthConsent({ locale }: OAuthConsentProps) {
    const { t } = createTranslations(locale);
    const [state, setState] = useState<ViewState>({ status: 'loading' });
    const [request, setRequest] = useState<ConsentRequest | null>(null);
    const [account, setAccount] = useState<AccountView | null>(null);
    const [switching, setSwitching] = useState(false);

    // biome-ignore lint/correctness/useExhaustiveDependencies: runs once on mount; `locale` never changes for a mounted island.
    useEffect(() => {
        const search = window.location.search;
        const parsed = parseConsentRequest({ search });
        if (!parsed) {
            setState({ status: 'error', kind: 'invalidRequest' });
            return;
        }
        setRequest(parsed);

        let cancelled = false;
        // The account line is informational: any failure just hides it.
        async function loadAccount(): Promise<void> {
            try {
                const session = await authClient.getSession();
                const user = session.data?.user;
                if (cancelled || !user) {
                    return;
                }
                const name = typeof user.name === 'string' ? user.name.trim() : '';
                const maskedEmail = maskEmail({ email: user.email });
                if (name || maskedEmail) {
                    setAccount({ name: name || null, maskedEmail });
                }
            } catch {
                // Session unreadable: keep the screen without the account line.
            }
        }
        async function loadClient(consentRequest: ConsentRequest): Promise<void> {
            try {
                const result = await authClient.$fetch<PublicClient>('/oauth2/public-client', {
                    method: 'GET',
                    query: { client_id: consentRequest.clientId }
                });
                if (cancelled) {
                    return;
                }
                if (result.error) {
                    if (result.error.status === 401) {
                        window.location.replace(buildConsentSigninUrl({ locale, search }));
                        return;
                    }
                    setState({
                        status: 'error',
                        kind: result.error.status === 404 ? 'clientNotFound' : 'loadFailed'
                    });
                    return;
                }
                setState({ status: 'ready', client: result.data ?? {} });
                void loadAccount();
            } catch {
                if (!cancelled) {
                    setState({ status: 'error', kind: 'loadFailed' });
                }
            }
        }
        void loadClient(parsed);

        return () => {
            cancelled = true;
        };
    }, []);

    async function switchAccount(): Promise<void> {
        if (!request || switching) {
            return;
        }
        setSwitching(true);
        try {
            clearCachedAuthMe();
            await authClient.signOut();
        } catch {
            // Best effort: the sign-in page re-checks the session anyway.
        } finally {
            window.location.assign(
                buildConsentSigninUrl({ locale, search: window.location.search })
            );
        }
    }

    async function decide({
        accept,
        client
    }: {
        readonly accept: boolean;
        readonly client: PublicClient;
    }): Promise<void> {
        if (!request) {
            return;
        }
        setState({ status: 'submitting', client, intent: accept ? 'allow' : 'deny' });
        try {
            const result = await authClient.$fetch<ConsentRedirect>('/oauth2/consent', {
                method: 'POST',
                body: { accept, oauth_query: request.oauthQuery }
            });
            const url = result.data?.url;
            if (result.error || !isFollowableRedirectUrl({ raw: url })) {
                setState({
                    status: 'error',
                    kind: result.error?.status === 400 ? 'invalidRequest' : 'submitFailed',
                    client
                });
                return;
            }
            setState({ status: 'redirecting' });
            window.location.assign(url as string);
        } catch {
            setState({ status: 'error', kind: 'submitFailed', client });
        }
    }

    if (state.status === 'loading' || state.status === 'redirecting') {
        return (
            <div
                className={styles.statusBox}
                role="status"
                aria-live="polite"
            >
                <div
                    className={styles.spinner}
                    aria-hidden="true"
                />
                <p className={styles.statusText}>
                    {state.status === 'loading'
                        ? t('auth.consent.loading', 'Cargando la solicitud...')
                        : t('auth.consent.redirecting', 'Volviendo a la aplicación...')}
                </p>
            </div>
        );
    }

    if (state.status === 'error') {
        const fallbacks: Record<ErrorKind, string> = {
            invalidRequest:
                'El enlace de autorización no es válido o venció. Volvé a iniciar la conexión desde tu asistente.',
            clientNotFound: 'No encontramos la aplicación que pide acceso.',
            loadFailed: 'No pudimos cargar la solicitud. Probá de nuevo.',
            submitFailed: 'No pudimos completar la autorización. Probá de nuevo.'
        };
        const canRetry = state.kind === 'loadFailed' || state.kind === 'submitFailed';
        return (
            <div className={styles.statusBox}>
                <span
                    className={styles.errorIcon}
                    aria-hidden="true"
                >
                    <ShieldAlertIcon
                        size={40}
                        weight="duotone"
                    />
                </span>
                <h1 className={styles.title}>
                    {t('auth.consent.errorTitle', 'No se pudo conectar')}
                </h1>
                <p
                    role="alert"
                    className={styles.statusText}
                >
                    {t(`auth.consent.errors.${state.kind}`, fallbacks[state.kind])}
                </p>
                {canRetry && (
                    <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => {
                            if (state.client) {
                                setState({ status: 'ready', client: state.client });
                            } else {
                                window.location.reload();
                            }
                        }}
                    >
                        {t('auth.consent.retry', 'Reintentar')}
                    </button>
                )}
            </div>
        );
    }

    const { client } = state;
    const submitting = state.status === 'submitting';
    const clientName =
        typeof client.client_name === 'string' && client.client_name.trim().length > 0
            ? client.client_name.trim()
            : null;
    const logoUrl = toSafeHttpsUrl({ raw: client.logo_uri });
    const siteUrl = resolveSafeExternalUrl(toSafeHttpsUrl({ raw: client.client_uri }) ?? undefined);
    const scopes = request?.scopes ?? [];

    return (
        <section
            className={styles.consent}
            aria-labelledby="oauth-consent-title"
        >
            <div className={styles.header}>
                <span
                    className={styles.shield}
                    aria-hidden="true"
                >
                    <ShieldIcon
                        size={32}
                        weight="duotone"
                    />
                </span>
                {logoUrl && (
                    <img
                        className={styles.logo}
                        src={logoUrl}
                        alt=""
                        width={48}
                        height={48}
                        referrerPolicy="no-referrer"
                        loading="lazy"
                    />
                )}
                <h1
                    id="oauth-consent-title"
                    className={styles.title}
                >
                    {clientName
                        ? t(
                              'auth.consent.heading',
                              '{{client}} quiere conectarse a tu cuenta de Hospeda',
                              { client: clientName }
                          )
                        : t(
                              'auth.consent.headingUnnamed',
                              'Una aplicación quiere conectarse a tu cuenta de Hospeda'
                          )}
                </h1>
                {siteUrl && (
                    <a
                        className={styles.siteLink}
                        href={siteUrl}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                    >
                        {new URL(siteUrl).host}
                        <ExternalLinkIcon size={14} />
                    </a>
                )}
            </div>

            <p className={styles.intro}>
                {t(
                    'auth.consent.intro',
                    'Va a actuar en tu nombre. Revisá qué podrá hacer antes de permitirlo.'
                )}
            </p>

            <h2 className={styles.sectionTitle}>
                {t('auth.consent.capabilitiesTitle', 'Con tu cuenta, podrá')}
            </h2>
            <ul className={styles.list}>
                {CAPABILITY_KEYS.map((key) => (
                    <li key={key}>
                        {t(`auth.consent.capabilities.${key}`, CAPABILITY_FALLBACKS[key])}
                    </li>
                ))}
            </ul>

            {scopes.length > 0 && (
                <>
                    <h2 className={styles.sectionTitle}>
                        {t(
                            'auth.consent.scopesTitle',
                            'Información que comparte con la aplicación'
                        )}
                    </h2>
                    <ul className={styles.list}>
                        {scopes.map((scope) => {
                            const known = toKnownOAuthScope({ scope });
                            return (
                                <li key={scope}>
                                    {known
                                        ? t(`auth.consent.scopes.${known}`, SCOPE_FALLBACKS[known])
                                        : t(
                                              'auth.consent.scopes.unknown',
                                              'Un permiso adicional ({{scope}})',
                                              { scope }
                                          )}
                                </li>
                            );
                        })}
                    </ul>
                </>
            )}

            <p className={styles.note}>
                {t(
                    'auth.consent.revokeNotePrefix',
                    'Podés desconectarla cuando quieras desde Mi cuenta ›'
                )}{' '}
                <a
                    className={styles.noteLink}
                    href={buildUrl({ locale, path: AI_ASSISTANTS_PATH })}
                >
                    {t('auth.consent.revokeNoteLink', 'Asistentes de IA')}
                </a>
                .
            </p>

            {account && (
                <p className={styles.account}>
                    <span>
                        {account.name && account.maskedEmail
                            ? t(
                                  'auth.consent.account.signedInAsWithEmail',
                                  'Sesión iniciada como {{name}} ({{email}})',
                                  { name: account.name, email: account.maskedEmail }
                              )
                            : account.name
                              ? t(
                                    'auth.consent.account.signedInAs',
                                    'Sesión iniciada como {{name}}',
                                    { name: account.name }
                                )
                              : t(
                                    'auth.consent.account.signedInAsEmailOnly',
                                    'Sesión iniciada como {{email}}',
                                    { email: account.maskedEmail ?? '' }
                                )}
                    </span>{' '}
                    <span>{t('auth.consent.account.notYou', '¿No sos vos?')}</span>{' '}
                    <button
                        type="button"
                        className={styles.linkButton}
                        disabled={submitting || switching}
                        onClick={() => void switchAccount()}
                    >
                        {t('auth.consent.account.switch', 'Cambiar de cuenta')}
                    </button>
                </p>
            )}

            <div className={styles.actions}>
                <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={submitting}
                    onClick={() => void decide({ accept: false, client })}
                >
                    {state.status === 'submitting' && state.intent === 'deny'
                        ? t('auth.consent.denying', 'Cancelando...')
                        : t('auth.consent.deny', 'Cancelar')}
                </button>
                <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={submitting}
                    onClick={() => void decide({ accept: true, client })}
                >
                    {state.status === 'submitting' && state.intent === 'allow'
                        ? t('auth.consent.allowing', 'Conectando...')
                        : t('auth.consent.allow', 'Permitir')}
                </button>
            </div>
        </section>
    );
}

/** Spanish fallbacks for the capability list (the locale files are the source). */
const CAPABILITY_FALLBACKS: Readonly<Record<(typeof CAPABILITY_KEYS)[number], string>> = {
    read: 'Ver tus publicaciones y sus estadísticas',
    edit: 'Editar datos básicos (descripción, contacto, horarios, servicios)',
    pause: 'Pausar o reanudar tus publicaciones',
    reply: 'Responder consultas de tus alojamientos'
};

/** Spanish fallbacks for the known scopes (the locale files are the source). */
const SCOPE_FALLBACKS = {
    openid: 'Confirmar tu identidad en Hospeda',
    profile: 'Tu nombre y foto de perfil',
    email: 'Tu correo electrónico',
    offline_access: 'Mantener la conexión sin pedirte permiso cada vez'
} as const;
