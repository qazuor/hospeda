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

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import type { AccommodationPublic } from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './SearchChatPanel.module.css';
import { useSearchChat } from './useSearchChat';

// ─── Public types ──────────────────────────────────────────────────────────────

/**
 * Props for the SearchChatPanel React island.
 *
 * @property locale - Active locale for translations and detail links.
 * @property apiUrl - Base URL of the API server (e.g. `http://localhost:3001`).
 *   Passed by the Astro host from `import.meta.env.PUBLIC_API_URL`.
 */
export interface SearchChatPanelProps {
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
}

// ─── Skeleton constants ─────────────────────────────────────────────────────

/** Number of skeleton cards to show while results are loading. */
const SKELETON_COUNT = 3;

/** Stable keys for the decorative loading skeletons (avoids array-index keys). */
const SKELETON_KEYS: readonly string[] = Array.from(
    { length: SKELETON_COUNT },
    (_unused, index) => `skeleton-${index}`
);

// ─── ResultCard sub-component ───────────────────────────────────────────────

/**
 * Compact accommodation card for the in-panel results grid.
 *
 * Displays image, type badge, city, star rating, and price with a link to
 * the detail page. Intentionally lighter than AccommodationCard.astro —
 * the panel is a quick-glance surface, not a full listing.
 */
interface ResultCardProps {
    readonly item: AccommodationPublic;
    readonly locale: SupportedLocale;
    readonly t: ReturnType<typeof createTranslations>['t'];
}

function ResultCard({ item, locale, t }: ResultCardProps) {
    const detailHref = buildUrl({ locale, path: `/alojamientos/${item.slug}/` });
    const thumbnail = item.media?.featuredImage?.url ?? null;
    const cityName = item.cityDestination?.name ?? null;

    const priceAmount = item.price?.amount;
    const priceCurrency = item.price?.currency ?? 'ARS';
    const formattedPrice =
        priceAmount != null
            ? new Intl.NumberFormat(
                  locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : 'es-AR',
                  {
                      style: 'currency',
                      currency: priceCurrency,
                      maximumFractionDigits: 0
                  }
              ).format(priceAmount / 100)
            : null;

    const rating = item.averageRating;
    const hasRating = typeof rating === 'number' && rating > 0;

    return (
        <a
            href={detailHref}
            className={styles.resultCard}
            aria-label={item.name}
        >
            {thumbnail ? (
                <img
                    src={thumbnail}
                    alt={item.name}
                    className={styles.resultCardImage}
                    loading="lazy"
                />
            ) : (
                <div
                    className={styles.resultCardImagePlaceholder}
                    aria-hidden="true"
                >
                    {t('aiSearch.chat.noImage', 'Sin imagen')}
                </div>
            )}

            <div className={styles.resultCardBody}>
                <h3 className={styles.resultCardName}>{item.name}</h3>

                <div className={styles.resultCardMeta}>
                    {item.type && <span className={styles.resultCardType}>{item.type}</span>}
                    {cityName && <span className={styles.resultCardCity}>{cityName}</span>}
                </div>

                {hasRating && (
                    <div
                        className={styles.resultCardRating}
                        aria-label={`${rating?.toFixed(1)} stars`}
                    >
                        {'★'.repeat(Math.floor(rating ?? 0))}
                        <span>{rating?.toFixed(1)}</span>
                        {item.reviewsCount ? <span>({item.reviewsCount})</span> : null}
                    </div>
                )}

                {formattedPrice ? (
                    <p className={styles.resultCardPrice}>
                        <span className={styles.resultCardPriceSub}>
                            {t('aiSearch.chat.priceFrom', 'Desde')}
                        </span>{' '}
                        {formattedPrice}
                        <span className={styles.resultCardPriceSub}>
                            {t('aiSearch.chat.pricePerNight', '/ noche')}
                        </span>
                    </p>
                ) : (
                    <p className={styles.resultCardPrice}>
                        {t('aiSearch.chat.priceConsult', 'Consultar precio')}
                    </p>
                )}
            </div>
        </a>
    );
}

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
export function SearchChatPanel({ locale, apiUrl }: SearchChatPanelProps) {
    const { t } = createTranslations(locale);
    const [draft, setDraft] = useState('');

    const chat = useSearchChat({ apiUrl, locale });

    // Ref to the bottom of the messages list — used to auto-scroll on new messages.
    const messagesEndRef = useRef<HTMLDivElement>(null);

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

    const hasMessages = chat.messages.length > 0;
    const showThinking = chat.isStreaming && !chat.currentReply;
    const showResults = chat.results.length > 0 || chat.resultsLoading;

    return (
        <section
            aria-label={t('aiSearch.chat.panelLabel', 'Panel de búsqueda conversacional con IA')}
            className={styles.panel}
        >
            {/* ── Header ──────────────────────────────────────────────── */}
            <div className={styles.header}>
                <h2 className={styles.title}>
                    {t('aiSearch.chat.title', 'Búsqueda conversacional')}
                </h2>
                <div className={styles.headerActions}>
                    {hasMessages && (
                        <button
                            type="button"
                            className={styles.iconButton}
                            onClick={chat.reset}
                            aria-label={t('aiSearch.chat.newConversation', 'Nueva conversación')}
                            title={t('aiSearch.chat.newConversation', 'Nueva conversación')}
                        >
                            ↺
                        </button>
                    )}
                </div>
            </div>

            {/* ── Body: thread + chips + results ──────────────────────── */}
            <div className={styles.body}>
                {/* Message thread */}
                <div
                    className={styles.messages}
                    aria-live="polite"
                    aria-atomic="false"
                    aria-label={t(
                        'aiSearch.chat.panelLabel',
                        'Panel de búsqueda conversacional con IA'
                    )}
                >
                    {/* Empty state — before first turn */}
                    {!hasMessages && !chat.isStreaming && (
                        <div className={styles.emptyState}>
                            {t(
                                'aiSearch.chat.emptyState',
                                'Hacé tu primera pregunta y te ayudo a encontrar el alojamiento ideal.'
                            )}
                        </div>
                    )}

                    {/* Completed message history */}
                    {chat.messages.map((msg, idx) => (
                        <div
                            // biome-ignore lint/suspicious/noArrayIndexKey: message list grows monotonically; index is stable for already-committed messages
                            key={idx}
                            className={`${styles.bubble} ${
                                msg.role === 'user' ? styles.userBubble : styles.assistantBubble
                            }`}
                        >
                            {msg.content}
                        </div>
                    ))}

                    {/* Live-streamed reply — shown while isStreaming and tokens are arriving */}
                    {chat.isStreaming && chat.currentReply && (
                        <div
                            className={`${styles.bubble} ${styles.assistantBubble} ${styles.streaming}`}
                            aria-live="polite"
                        >
                            {chat.currentReply}
                        </div>
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

                {/* Error banner */}
                {chat.error && (
                    <div
                        className={styles.errorBanner}
                        role="alert"
                        aria-live="assertive"
                    >
                        {chat.error}
                    </div>
                )}

                {/* T-011: active-filter chips mount here.
                    T-011 will render an <IntentChipsList> or equivalent component
                    inside this region. It receives `currentFilters` and `removeFilter`
                    from the hook to render dismissible chips for each active slot.
                    The parent (T-012) is responsible for passing those props down or
                    co-locating the chips component here. */}
                <div
                    className={styles.chipsMount}
                    data-slot="filter-chips"
                >
                    {/* {/* T-011: active-filter chips mount here */}
                </div>

                {/* Results section */}
                {showResults && (
                    <div className={styles.results}>
                        <div className={styles.resultsHeader}>
                            <span className={styles.resultsLabel}>
                                {t('aiSearch.chat.resultsLabel', 'Resultados')}
                            </span>
                            {!chat.resultsLoading && (
                                <span className={styles.resultsCount}>{chat.results.length}</span>
                            )}
                        </div>

                        {chat.resultsLoading ? (
                            /* Skeleton grid while the accommodations GET is in flight.
                               D-9: resultsLoading and isStreaming can both be true at once
                               (filters event arrives before the reply finishes). */
                            <output
                                className={styles.skeletonGrid}
                                aria-label={t(
                                    'aiSearch.chat.resultsLoading',
                                    'Buscando alojamientos…'
                                )}
                            >
                                {SKELETON_KEYS.map((key) => (
                                    <div
                                        key={key}
                                        className={styles.skeletonCard}
                                        aria-hidden="true"
                                    />
                                ))}
                            </output>
                        ) : chat.results.length > 0 ? (
                            <ul
                                className={styles.resultsGrid}
                                aria-label={t(
                                    'aiSearch.chat.resultsLabel',
                                    'Resultados encontrados'
                                )}
                            >
                                {chat.results.map((item) => (
                                    <li key={item.id}>
                                        <ResultCard
                                            item={item}
                                            locale={locale}
                                            t={t}
                                        />
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className={styles.resultsEmpty}>
                                {t(
                                    'aiSearch.chat.resultsEmpty',
                                    'No encontramos alojamientos con esos filtros.'
                                )}
                            </p>
                        )}
                    </div>
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
                    id="search-chat-input"
                    className={styles.textarea}
                    placeholder={t(
                        'aiSearch.chat.placeholder',
                        'Contame qué buscás, por ejemplo: cabaña para 4 con pileta cerca del río'
                    )}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={chat.isStreaming}
                    rows={2}
                    aria-disabled={chat.isStreaming}
                />
                <button
                    type="submit"
                    className={styles.sendButton}
                    disabled={chat.isStreaming || !draft.trim()}
                    aria-label={
                        chat.isStreaming
                            ? t('aiSearch.chat.sending', 'Enviando…')
                            : t('aiSearch.chat.send', 'Enviar mensaje')
                    }
                >
                    {chat.isStreaming ? '⏳' : '↑'}
                </button>
            </form>
        </section>
    );
}
