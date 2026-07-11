/**
 * @file SearchChatPanel.client.tsx
 * @description Conversational AI search panel for the accommodations listing page.
 * SPEC-212 T-010.
 *
 * Renders inside one panel:
 *  - Message thread (user + assistant turns)
 *  - Live-streamed reply bubble (while isStreaming)
 *  - Thinking / loading indicator
 *  - T-011 chips mount point (filter chips — renders above results)
 *  - Results grid (accommodations matching current filters)
 *  - Error banner
 *  - Text input + send control
 *
 * Card decision: AccommodationCard.astro cannot be used inside a React island.
 * MapCardsSidebar (maps feature) carries too much map-specific state logic.
 * This component renders a compact ResultCard sub-component — same visual
 * signals (image, type, city, rating, price) but sized for the narrower panel
 * grid. This is intentional: the panel is not the listing page; it provides
 * quick-glance results, not a full browsing surface.
 *
 * apiUrl sourcing: mirrored from AiChatWidget — passed as a prop from the
 * Astro host page, which reads `PUBLIC_API_URL` at build/render time.
 * The island does not read env vars directly.
 *
 * @module SearchChatPanel
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { renderChatMarkdown } from '@/lib/ai-search/render-chat-markdown';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { ActiveFilterChips } from './ActiveFilterChips';
import { LoginCta } from './LoginCta';
import { NearbyDestinationsIndicator } from './NearbyDestinationsIndicator';
import { OnboardingExamples } from './OnboardingExamples';
import { ResultsSection } from './ResultsSection';
import styles from './SearchChatPanel.module.css';
import { LOW_CONFIDENCE_THRESHOLD, MAX_CONTENT_LENGTH } from './search-chat-panel.constants';
import { useSearchChat } from './useSearchChat';

// ─── Public types ──────────────────────────────────────────────────────────────

/**
 * Props for the SearchChatPanel React island.
 *
 * @property locale - Active locale for translations and detail links.
 * @property apiUrl - Base URL of the API server (e.g. `http://localhost:3001`).
 *   Passed by the Astro host from `import.meta.env.PUBLIC_API_URL`.
 * @property isAuthenticated - Whether the current visitor has an active session.
 *   When false, the chat UI is replaced by a login CTA (W14).
 * @property currentUrl - Full URL of the current page, used to build the
 *   post-login redirect href. Pass `Astro.url.href` from the host page.
 * @property destinations - Catalog of city destinations for chip label
 *   resolution (SPEC-265 A3). A record of `{ [uuid]: name }` built from the
 *   `destinationsApi.list` result in the host page. When provided, the
 *   destination filter chip shows the real city name instead of a generic
 *   "Destino filtrado" label.
 * @property pageType - Active accommodation type from the page URL (SPEC-265 B1b).
 *   When set (e.g., 'CABIN'), a type-specific example query is prepended to the
 *   empty-state example chips, tailoring the onboarding to the user's current
 *   browsing context. Optional — falls back to the generic pool when absent.
 */
export interface SearchChatPanelProps {
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
    readonly isAuthenticated: boolean;
    readonly currentUrl: string;
    readonly destinations?: Readonly<Record<string, string>>;
    readonly pageType?: string;
}

// Shared constants (LOW_CONFIDENCE_THRESHOLD, MAX_CONTENT_LENGTH,
// EXAMPLE_QUERY_KEYS, TYPE_EXAMPLE_KEY) live in ./search-chat-panel.constants —
// extracted alongside ResultCard/ResultsSection (HOS-111 follow-up) to keep
// this file under the repo's 500-line limit. Skeleton constants moved into
// ResultsSection, the only place that used them.

// ─── Main component ─────────────────────────────────────────────────────────

/**
 * SearchChatPanel — conversational AI search panel for SPEC-212.
 *
 * Consumes `useSearchChat` and renders the full conversation UI:
 * message thread, streamed reply, thinking indicator, active-filter
 * chips mount point (T-011), results grid with loading skeleton, error
 * banner, and message composer.
 *
 * This component is a React island (`.client.tsx`). Mount it with
 * `client:load` or `client:visible` from the Astro host page (T-012).
 *
 * @example
 * ```astro
 * <SearchChatPanel
 *   locale={locale}
 *   apiUrl={import.meta.env.PUBLIC_API_URL}
 *   client:load
 * />
 * ```
 */
export function SearchChatPanel({
    locale,
    apiUrl,
    isAuthenticated,
    currentUrl,
    destinations,
    pageType
}: SearchChatPanelProps) {
    const { t } = createTranslations(locale);
    const [draft, setDraft] = useState('');

    const chat = useSearchChat({ apiUrl, locale });

    // Ref to the bottom of the messages list — used to auto-scroll on new messages.
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Ref to the chat textarea — used to autofocus on mount for authenticated users (W14).
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Autofocus textarea on mount for authenticated users (W14).
    useEffect(() => {
        if (isAuthenticated) {
            textareaRef.current?.focus();
        }
    }, [isAuthenticated]);

    // Auto-scroll to bottom whenever a new message or streaming token arrives.
    // Guard: scrollIntoView is not available in jsdom (test environment) — the
    // optional-chain makes the effect a no-op in tests without extra stubs.
    // biome-ignore lint/correctness/useExhaustiveDependencies: messages + currentReply are intentional triggers (the effect re-scrolls on each new turn/token) even though it only reads the ref.
    useEffect(() => {
        if (typeof messagesEndRef.current?.scrollIntoView === 'function') {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chat.messages, chat.currentReply]);

    const handleSend = useCallback(() => {
        const text = draft.trim();
        if (!text || chat.isStreaming) return;
        chat.send(text);
        setDraft('');
    }, [draft, chat]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        },
        [handleSend]
    );

    // Example query click handler (SPEC-265 B1a) — sends the query immediately.
    const handleExampleClick = useCallback(
        (query: string) => {
            if (chat.isStreaming) return;
            chat.send(query);
            setDraft('');
        },
        [chat]
    );

    const hasMessages = chat.messages.length > 0;
    const showThinking = chat.isStreaming && !chat.currentReply;
    // BUG FIX: previously only `results.length > 0 || resultsLoading`, which
    // means a completed search with ZERO results (resultsLoading false,
    // results empty) never rendered the results section at all — the
    // `resultsEmpty` copy below was unreachable dead code. `hasSearched`
    // (true once the first accommodations GET has ever fired) keeps the
    // section — and its empty-state message — visible after a 0-result turn,
    // so the user sees "no matches" instead of an empty drawer that looks
    // like the search never ran.
    const showResults = chat.results.length > 0 || chat.resultsLoading || chat.hasSearched;

    // State-aware composer placeholder (HOS-111 T-007 / OQ-5): the copy
    // changes across three states so the hint always matches what the user
    // can usefully do next.
    // - has-results: at least one match — suggest refining further.
    // - no-results: a search completed with zero matches (not loading) —
    //   suggest loosening criteria or searching nearby.
    // - initial: no search has completed yet — the original onboarding copy.
    const composerPlaceholder = (() => {
        if (chat.results.length > 0) {
            return t(
                'aiSearch.chat.placeholderHasResults',
                'Afiná tu búsqueda: sumá precio, características, o pedí destinos cercanos'
            );
        }
        if (chat.hasSearched && !chat.resultsLoading) {
            return t(
                'aiSearch.chat.placeholderNoResults',
                'No encontré nada con esos filtros. Probá quitando alguno o buscá en destinos cercanos.'
            );
        }
        return t(
            'aiSearch.chat.placeholder',
            'Contame qué buscás, por ejemplo: cabaña para 4 con pileta cerca del río'
        );
    })();

    // Low-confidence notice (SPEC-265 A2): show once a turn has completed
    // (not during streaming) when EITHER the confidence is below threshold OR
    // the model extracted no usable slots — instead of showing 0 results in
    // silence. `confidence !== null` marks that a `filters` event arrived.
    // `lastTurnHadEntities` is a snapshot of THAT turn (not recomputed from the
    // mutable chip set), so removing chips by hand doesn't trip the notice.
    // No numeric badge — just the reformulation suggestion from i18n.
    const isLowConfidence =
        !chat.isStreaming &&
        chat.confidence !== null &&
        (chat.confidence < LOW_CONFIDENCE_THRESHOLD || !chat.lastTurnHadEntities);

    // Classified error copy (SPEC-265 C3): map HTTP status to translated
    // i18n keys instead of showing raw "HTTP 429" / provider messages.
    // 429 → rateLimitError, 5xx → serviceError, fallback → raw error string.
    const displayError = (() => {
        if (!chat.error) return null;
        if (chat.errorStatus === 429) {
            return t('aiSearch.rateLimitError', 'Demasiadas búsquedas. Esperá un momento.');
        }
        if (chat.errorStatus !== null && chat.errorStatus >= 500) {
            return t(
                'aiSearch.serviceError',
                'El servicio no está disponible en este momento. Intentá de nuevo más tarde.'
            );
        }
        return chat.error;
    })();

    // Anonymous visitors: replace the full chat UI with a login CTA (W14).
    // See LoginCta.tsx (HOS-111 follow-up extraction).
    if (!isAuthenticated) {
        return (
            <LoginCta
                locale={locale}
                currentUrl={currentUrl}
                t={t}
            />
        );
    }

    return (
        <section
            aria-label={t('aiSearch.chat.panelLabel', 'Panel de búsqueda conversacional con IA')}
            className={styles.panel}
        >
            {/* ── Header ──────────────────────────────────────────────────
                 HOS-111 T-001: the panel no longer renders its own title —
                 the drawer wrapper (AiSearchEntry) owns the single visible
                 heading ("Búsqueda inteligente") plus the maximize/close
                 controls. This strip only carries the reset action, and is
                 omitted entirely when there is nothing to show. ─────────── */}
            {hasMessages && (
                <div className={styles.header}>
                    <div className={styles.headerActions}>
                        <button
                            type="button"
                            className={styles.iconButton}
                            onClick={chat.reset}
                            aria-label={t('aiSearch.chat.newConversation', 'Nueva conversación')}
                            title={t('aiSearch.chat.newConversation', 'Nueva conversación')}
                        >
                            ↺
                        </button>
                    </div>
                </div>
            )}

            {/* ── Body: thread + chips + results ──────────────────────── */}
            <div className={styles.body}>
                {/* Message thread */}
                <div
                    className={styles.messages}
                    role="log"
                    aria-live="polite"
                    aria-atomic="false"
                    aria-label={t(
                        'aiSearch.chat.panelLabel',
                        'Panel de búsqueda conversacional con IA'
                    )}
                >
                    {/* Empty state — before first turn, with example query chips (SPEC-265 B1a) */}
                    {!hasMessages && !chat.isStreaming && (
                        <OnboardingExamples
                            pageType={pageType}
                            t={t}
                            onExampleClick={handleExampleClick}
                        />
                    )}

                    {/* Completed message history. Assistant replies are rendered as
                        sanitized markdown (bold/lists/links); user messages stay
                        plain text — no reason to interpret markdown the user typed. */}
                    {chat.messages.map((msg, idx) =>
                        msg.role === 'assistant' ? (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: message list grows monotonically; index is stable for already-committed messages
                                key={idx}
                                className={`${styles.bubble} ${styles.assistantBubble}`}
                                data-testid="ai-search-reply"
                                // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via renderChatMarkdown (DOMPurify) before rendering
                                dangerouslySetInnerHTML={{
                                    // nosemgrep:typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
                                    __html: renderChatMarkdown({ raw: msg.content })
                                }}
                            />
                        ) : (
                            <div
                                // biome-ignore lint/suspicious/noArrayIndexKey: message list grows monotonically; index is stable for already-committed messages
                                key={idx}
                                className={`${styles.bubble} ${styles.userBubble}`}
                            >
                                {msg.content}
                            </div>
                        )
                    )}

                    {/* Live-streamed reply — shown while isStreaming and tokens are arriving */}
                    {chat.isStreaming && chat.currentReply && (
                        <div
                            className={`${styles.bubble} ${styles.assistantBubble} ${styles.streaming}`}
                            aria-live="polite"
                            // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via renderChatMarkdown (DOMPurify) before rendering
                            dangerouslySetInnerHTML={{
                                // nosemgrep:typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
                                __html: renderChatMarkdown({ raw: chat.currentReply })
                            }}
                        />
                    )}

                    {/* Thinking indicator — shown while streaming but before first token */}
                    {showThinking && (
                        <output
                            className={styles.thinking}
                            aria-label={t('aiSearch.chat.thinking', 'Pensando…')}
                        >
                            <span>{t('aiSearch.chat.thinking', 'Pensando…')}</span>
                            <span
                                className={styles.thinkingDots}
                                aria-hidden="true"
                            >
                                <span className={styles.thinkingDot} />
                                <span className={styles.thinkingDot} />
                                <span className={styles.thinkingDot} />
                            </span>
                        </output>
                    )}

                    {/* Scroll anchor */}
                    <div
                        ref={messagesEndRef}
                        aria-hidden="true"
                    />
                </div>

                {/* Error banner — classified copy (SPEC-265 C3) */}
                {displayError && (
                    <div
                        className={styles.errorBanner}
                        role="alert"
                        aria-live="assertive"
                        data-testid="ai-search-error"
                    >
                        {displayError}
                    </div>
                )}

                {/* T-011: active-filter chips.
                     HOS-111 T-006: `appliedParams` is the last server-resolved
                     search params (what was ACTUALLY sent), so a chip never
                     renders for a slot the LLM extracted but the mapper
                     dropped (e.g. `maxGuests` — see ActiveFilterChips JSDoc). */}
                <div
                    className={styles.chipsMount}
                    data-slot="filter-chips"
                >
                    <ActiveFilterChips
                        filters={chat.currentFilters}
                        onRemove={chat.removeFilter}
                        locale={locale}
                        destinations={destinations}
                        appliedParams={chat.lastSearchParams}
                    />
                </div>

                {/* HOS-111 T-014: which nearby destinations were included (G-9) */}
                <NearbyDestinationsIndicator
                    nearbyDestinations={chat.nearbyDestinations}
                    t={t}
                />

                {/* Low-confidence notice (SPEC-265 A2) */}
                {isLowConfidence && (
                    <output
                        className={styles.lowConfidenceNotice}
                        aria-live="polite"
                        data-testid="ai-search-low-confidence"
                    >
                        {t(
                            'aiSearch.lowConfidenceMessage',
                            'No pudimos interpretar tu búsqueda. Probá reformularla con otras palabras.'
                        )}
                    </output>
                )}

                {/* Results section — see ResultsSection.tsx (HOS-111 T-003/T-004/T-008). */}
                {showResults && (
                    <ResultsSection
                        resultsLoading={chat.resultsLoading}
                        results={chat.results}
                        locale={locale}
                        t={t}
                    />
                )}
            </div>

            {/* ── Composer ────────────────────────────────────────────── */}
            <form
                className={styles.composer}
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                }}
            >
                {/* Visually hidden label keeps the textarea accessible */}
                <label
                    htmlFor="search-chat-input"
                    className={styles.composerLabel}
                >
                    {t('aiSearch.chat.inputLabel', 'Mensaje')}
                </label>
                <textarea
                    ref={textareaRef}
                    id="search-chat-input"
                    className={styles.textarea}
                    placeholder={composerPlaceholder}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={chat.isStreaming}
                    rows={2}
                    maxLength={MAX_CONTENT_LENGTH}
                    aria-disabled={chat.isStreaming}
                />
                {/* Char counter (SPEC-265 C2) */}
                <span
                    className={styles.charCounter}
                    aria-live="off"
                    data-testid="ai-search-char-count"
                >
                    {t('aiSearch.charCount', '{{count}}/500', { count: draft.length })}
                </span>
                {chat.isStreaming ? (
                    /* Stop button — aborts the current stream (SPEC-265 C1) */
                    <button
                        type="button"
                        className={styles.stopButton}
                        onClick={chat.abort}
                        aria-label={t('aiSearch.chat.stop', 'Detener')}
                        data-testid="ai-search-stop"
                    >
                        {t('aiSearch.chat.stop', 'Detener')}
                    </button>
                ) : (
                    <button
                        type="submit"
                        className={styles.sendButton}
                        disabled={!draft.trim()}
                        aria-label={t('aiSearch.chat.send', 'Enviar mensaje')}
                    >
                        {'↑'}
                    </button>
                )}
            </form>
        </section>
    );
}
