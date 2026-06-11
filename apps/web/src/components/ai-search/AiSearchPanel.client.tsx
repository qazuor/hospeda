/**
 * @file AiSearchPanel.client.tsx
 * @description Orchestrator React island for the AI natural-language search
 * feature (SPEC-199 §5.6). Owns all state and the API call. Renders
 * `NlSearchInput` for the input surface and exposes inline status/error
 * messages to the user.
 *
 * Two distinct flows:
 *  - **Anonymous**: on OPEN, immediately shows a login/register CTA and hides
 *    the input. Tracks `AiSearchLoginPrompted` on open. No API call is made.
 *  - **Authenticated**: on submit, POSTs to `/api/v1/protected/ai/search-intent`
 *    via `apiClient.postProtected`, tracks the result, persists `mappedParams`
 *    in sessionStorage, and navigates to the accommodations page.
 *
 * Error states handled:
 *  - 403 (ENTITLEMENT_REQUIRED or LIMIT_REACHED) → inline upgrade prompt.
 *  - 429 → inline rate-limit message.
 *  - 502/503 / network error → inline service-error message (no keyword fallback).
 *
 * Directive: `client:visible` (see `AiSearchTrigger.astro`).
 */

import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/posthog-client';
import { apiClient } from '@/lib/api/client';
import { buildLoginRedirect } from '@/lib/auth-redirect';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { AiSearchIntentResponseData } from '@repo/schemas';
import { useEffect, useRef, useState } from 'react';
import styles from './AiSearchPanel.module.css';
import { NlSearchInput } from './NlSearchInput';

// ─── Constants ────────────────────────────────────────────────────────────────

/** sessionStorage key that persists the last AI-extracted params. Matches IntentChips.tsx. */
const SESSION_KEY = 'ai_search_chips';

/** API endpoint for AI NL search intent extraction. */
const SEARCH_INTENT_PATH = '/api/v1/protected/ai/search-intent';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Props for the AiSearchPanel component.
 */
export interface AiSearchPanelProps {
    /** Active locale for i18n strings and navigation URLs. */
    readonly locale: 'es' | 'en' | 'pt';
    /** Whether the current visitor is signed in. Controls anonymous vs authenticated flow. */
    readonly isAuthenticated: boolean;
    /** Current page URL, forwarded as `returnUrl` in the login redirect. */
    readonly currentUrl: string;
}

/** Status of the AI search request. */
type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

/** Reason for the error state, used to select the right inline message. */
type ErrorType = null | 'quota' | 'ratelimit' | 'network' | 'lowConfidence';

// ─── sessionStorage helpers ───────────────────────────────────────────────────

/**
 * Write a JSON value to sessionStorage safely.
 * Silently no-ops on SSR or when access is denied (private mode, etc.).
 */
function writeSession(key: string, value: string): void {
    if (typeof sessionStorage === 'undefined') {
        return;
    }
    try {
        sessionStorage.setItem(key, value);
    } catch {
        // Private mode or storage quota exceeded — fail silently.
    }
}

// ─── URL serialisation ────────────────────────────────────────────────────────

/**
 * Serialize a `Record<string, unknown>` of mapped search params to a
 * `URLSearchParams` string. Array values are emitted as repeated params.
 *
 * @param params - URL-ready param record from the API response.
 * @returns Serialized query string (without leading `?`).
 */
function serializeMappedParams(params: Record<string, unknown>): string {
    const usp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === null || value === undefined) {
            continue;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                usp.append(key, String(item));
            }
        } else {
            usp.set(key, String(value));
        }
    }
    return usp.toString();
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * AiSearchPanel — floating panel that orchestrates AI natural-language search.
 *
 * Renders a collapsible panel with `NlSearchInput` as the controlled input
 * surface (authenticated users only). For guests, the panel body shows an
 * inline login/register CTA immediately on open, preventing wasted effort.
 *
 * On submit (authenticated flow), POSTs to the AI route, navigates to results.
 *
 * All sessionStorage access is guarded with a `typeof` check and try/catch
 * (follows the pattern in `toast-store.ts` and `IntentChips.tsx`).
 *
 * @example
 * ```astro
 * <AiSearchPanel
 *   locale={locale}
 *   isAuthenticated={!!session}
 *   currentUrl={Astro.url.pathname}
 *   client:visible
 * />
 * ```
 */
export function AiSearchPanel({ locale, isAuthenticated, currentUrl }: AiSearchPanelProps) {
    const { t } = createTranslations(locale as SupportedLocale);

    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState<SearchStatus>('idle');
    const [errorType, setErrorType] = useState<ErrorType>(null);

    /**
     * Ref to the NlSearchInput textarea, forwarded via prop so we can focus it
     * when the panel opens (W14 — autofocus on open for authenticated users).
     */
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // W14: Focus the textarea when the panel opens (authenticated users only).
    // Guest users see the CTA block — no textarea is rendered for them.
    // Synchronous focus is safe here because the effect only runs when isOpen=true
    // (the panel and textarea are already in the DOM at this point).
    useEffect(() => {
        if (isOpen && isAuthenticated) {
            textareaRef.current?.focus();
        }
    }, [isOpen, isAuthenticated]);

    // ── Authenticated flow ──────────────────────────────────────────────────

    /**
     * Handle submit for authenticated users: POST to the AI route, interpret
     * the response, persist params, and navigate to search results.
     */
    async function handleAuthenticatedSubmit(): Promise<void> {
        const trimmedQuery = query.trim();
        if (!trimmedQuery) {
            return;
        }

        trackEvent(WebEvents.AiSearchSubmitted, {
            locale,
            queryLength: trimmedQuery.length
        });

        setStatus('loading');
        setErrorType(null);

        const result = await apiClient.postProtected<AiSearchIntentResponseData>({
            path: SEARCH_INTENT_PATH,
            body: { query: trimmedQuery, locale }
        });

        if (!result.ok) {
            handleApiError(result.error.status, trimmedQuery);
            return;
        }

        handleApiSuccess(result.data, trimmedQuery);
    }

    /**
     * Process a successful API response.
     * Navigates to intent-applied results page.
     *
     * @param data - Validated response data from the AI search-intent endpoint.
     * @param rawQuery - The original user query (unused; kept for future use).
     */
    function handleApiSuccess(data: AiSearchIntentResponseData, _rawQuery: string): void {
        if (data.fallbackToKeyword) {
            // Low-confidence: the AI could not interpret the query. Surface a
            // rephrase prompt instead of silently falling back to keyword search.
            trackEvent(WebEvents.AiSearchFallbackKeyword, {
                reason: 'low_confidence',
                confidence: data.confidence
            });
            setStatus('error');
            setErrorType('lowConfidence');
            return;
        }

        // Count non-null, non-undefined slots for the analytics event.
        const slotsExtracted = Object.values(data.mappedParams).filter(
            (v) => v !== null && v !== undefined
        ).length;

        trackEvent(WebEvents.AiSearchIntentApplied, {
            confidence: data.confidence,
            slotsExtracted,
            fallback: false
        });

        // Persist the mapped params so IntentChips can reconstruct on the results page.
        writeSession(SESSION_KEY, JSON.stringify(data.mappedParams));

        setStatus('success');

        const searchStr = serializeMappedParams(data.mappedParams);
        const target = searchStr
            ? `/${locale}/alojamientos/?${searchStr}`
            : `/${locale}/alojamientos/`;

        window.location.href = target;
    }

    /**
     * Process an API error response by setting the appropriate error type and
     * tracking a fallback event when applicable.
     *
     * @param httpStatus - HTTP status code from the failed request (0 = network error).
     * @param rawQuery - The original user query (unused after keyword fallback removal).
     */
    function handleApiError(httpStatus: number, _rawQuery: string): void {
        if (httpStatus === 403) {
            setStatus('error');
            setErrorType('quota');
            return;
        }

        if (httpStatus === 429) {
            setStatus('error');
            setErrorType('ratelimit');
            return;
        }

        // 502, 503, timeout (408), or network error (status === 0)
        trackEvent(WebEvents.AiSearchFallbackKeyword, { reason: 'api_error' });
        setStatus('error');
        setErrorType('network');
    }

    // ── Submit dispatcher ───────────────────────────────────────────────────

    /**
     * Dispatches to the authenticated submit handler.
     * Guests never reach this — the input is hidden for them.
     */
    function handleSubmit(): void {
        void handleAuthenticatedSubmit();
    }

    // ── Panel toggle ────────────────────────────────────────────────────────

    /**
     * Toggle panel open/closed.
     * On open for anonymous users, tracks `AiSearchLoginPrompted`.
     */
    function handleToggle(): void {
        const opening = !isOpen;
        setIsOpen(opening);

        if (opening) {
            if (!isAuthenticated) {
                // W1: track login prompt on open (not on submit) for anonymous users.
                trackEvent(WebEvents.AiSearchLoginPrompted, { locale });
            }
        } else {
            // Reset state on close so the panel is clean on re-open.
            setQuery('');
            setStatus('idle');
            setErrorType(null);
        }
    }

    // ── Login redirect URLs (W1) ────────────────────────────────────────────

    const loginHref = buildLoginRedirect({ locale: locale as SupportedLocale, currentUrl });
    const registerHref = `/${locale}/auth/signup/`;

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <div className={styles.root}>
            {/* Trigger button */}
            <button
                type="button"
                className={styles.trigger}
                aria-expanded={isOpen}
                aria-controls="ai-search-panel-body"
                onClick={handleToggle}
            >
                {t('aiSearch.triggerLabel', 'Buscá con IA')}
            </button>

            {/* Collapsible panel body */}
            {isOpen && (
                <dialog
                    id="ai-search-panel-body"
                    className={styles.panel}
                    open
                    aria-label={t('aiSearch.panelTitle', 'Búsqueda inteligente')}
                >
                    <div className={styles.panelHeader}>
                        <h2 className={styles.panelTitle}>
                            {t('aiSearch.panelTitle', 'Búsqueda inteligente')}
                        </h2>
                        <button
                            type="button"
                            className={styles.closeBtn}
                            aria-label={t('aiSearch.close', 'Cerrar')}
                            onClick={handleToggle}
                        >
                            ×
                        </button>
                    </div>

                    {/* W1: Anonymous users see the login CTA block immediately — no input rendered */}
                    {isAuthenticated ? (
                        <>
                            {/* W14: Input surface — textareaRef wired for autofocus on open */}
                            <NlSearchInput
                                locale={locale as SupportedLocale}
                                query={query}
                                status={status}
                                onChange={setQuery}
                                onSubmit={handleSubmit}
                                textareaRef={textareaRef}
                            />

                            {/* Error: quota / entitlement */}
                            {status === 'error' && errorType === 'quota' && (
                                <div
                                    className={styles.errorBlock}
                                    role="alert"
                                >
                                    <p className={styles.errorMessage}>
                                        {t(
                                            'aiSearch.quotaExhausted',
                                            'Alcanzaste el límite mensual de búsquedas con IA.'
                                        )}
                                    </p>
                                    <a
                                        href={`/${locale}/planes/`}
                                        className={styles.ctaLink}
                                    >
                                        {t('aiSearch.quotaUpgradeCta', 'Ver planes →')}
                                    </a>
                                </div>
                            )}

                            {/* Error: rate limit */}
                            {status === 'error' && errorType === 'ratelimit' && (
                                <p
                                    className={styles.errorMessage}
                                    role="alert"
                                >
                                    {t(
                                        'aiSearch.rateLimitError',
                                        'Demasiadas búsquedas. Esperá un momento.'
                                    )}
                                </p>
                            )}

                            {/* W13: network error — keyword fallback button removed, plain error message only */}
                            {status === 'error' && errorType === 'network' && (
                                <div
                                    className={styles.errorBlock}
                                    role="alert"
                                >
                                    <p className={styles.errorMessage}>
                                        {t(
                                            'aiSearch.serviceError',
                                            'El servicio no está disponible en este momento. Intentá de nuevo más tarde.'
                                        )}
                                    </p>
                                </div>
                            )}
                            {status === 'error' && errorType === 'lowConfidence' && (
                                <div
                                    className={styles.errorBlock}
                                    role="alert"
                                >
                                    <p className={styles.errorMessage}>
                                        {t(
                                            'aiSearch.lowConfidenceMessage',
                                            'No pudimos interpretar tu búsqueda. Probá reformularla con otras palabras.'
                                        )}
                                    </p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className={styles.loginCtaBlock}>
                            <h3 className={styles.loginCtaTitle}>
                                {t('aiSearch.loginPromptTitle', 'Iniciá sesión para buscar con IA')}
                            </h3>
                            <p className={styles.loginCtaMessage}>
                                {t(
                                    'aiSearch.loginPromptMessage',
                                    'La búsqueda inteligente está disponible para usuarios registrados.'
                                )}
                            </p>
                            <div className={styles.loginCtaActions}>
                                <a
                                    href={loginHref}
                                    className={styles.loginCtaSignIn}
                                >
                                    {t('aiSearch.loginPromptCta', 'Iniciar sesión')}
                                </a>
                                <a
                                    href={registerHref}
                                    className={styles.loginCtaRegister}
                                >
                                    {t('aiSearch.loginPromptRegisterCta', 'Crear cuenta')}
                                </a>
                            </div>
                        </div>
                    )}
                </dialog>
            )}
        </div>
    );
}
