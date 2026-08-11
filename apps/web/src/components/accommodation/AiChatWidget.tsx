/**
 * @file AiChatWidget.tsx
 * @description AI chat widget for accommodation detail pages.
 * Renders a FAB + slide-out panel with focus trap, ESC-to-close,
 * aria-live region for streaming tokens, and price disclaimer.
 *
 * The chat is for signed-in visitors only, and that gate is resolved
 * CLIENT-SIDE (HOS-369 WB0-7). The page used to wrap the whole mount in
 * `{isAuthenticated && ...}`, which baked the visitor into HTML that must be
 * edge-cacheable; now the page mounts it unconditionally and the widget renders
 * nothing until a session resolves. Unlike the sidebar islands this needs no
 * placeholder: the FAB and panel are both `position: fixed`, so appearing after
 * hydration moves nothing on the page.
 *
 * @module AiChatWidget
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/shared/feedback/Spinner';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { useAccommodationChat } from '@/hooks/useAccommodationChat';
import { useDialogHistoryBack } from '@/hooks/useDialogHistoryBack';
import { useVisualViewportInset } from '@/hooks/useVisualViewportInset';
import { renderChatMarkdown } from '@/lib/ai-search/render-chat-markdown';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { AiChatFab } from './AiChatFab';
import styles from './AiChatWidget.module.css';

/**
 * Below this many pixels a bottom inset is browser chrome (a collapsing
 * toolbar), not a keyboard, and the panel should keep its normal spacing.
 */
const KEYBOARD_INSET_THRESHOLD_PX = 120;

export interface AiChatWidgetProps {
    readonly accommodationId: string;
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
}

// ---------------------------------------------------------------------------
// Error resolution (HOS-292)
// ---------------------------------------------------------------------------

/**
 * Sentinel passed as `t()`'s fallback to tell a real translation apart from a
 * miss. Necessary because `t()` returns the KEY ITSELF for an unknown key in
 * production (only DEV yields `[MISSING: ...]`) - which is exactly how a raw
 * `accommodations.aiChat.unavailable` ended up on screen.
 */
const UNRESOLVED = '__hospeda_unresolved__';

/** Looks like a dotted i18n key rather than human prose. */
const I18N_KEY_PATTERN = /^[a-zA-Z][\w-]*(\.[\w-]+)+$/;

/**
 * Localized copy per error code, used when the API's `message` is not a key we
 * can resolve. Mirrors `AiTextImprovePanel.client.tsx`'s `ERROR_FALLBACKS`
 * convention: Spanish fallbacks so the widget stays sensible even before the
 * `accommodations.aiChat.error.*` keys exist in every locale bundle.
 */
const ERROR_FALLBACKS: Readonly<Record<string, string>> = Object.freeze({
    UNAUTHORIZED: 'Necesitás iniciar sesión para usar el chat.',
    NOT_FOUND: 'No encontramos este alojamiento.',
    ENTITLEMENT_REQUIRED: 'El chat de IA no está disponible para este alojamiento.',
    LIMIT_REACHED: 'El chat de IA no está disponible para este alojamiento en este momento.',
    MODERATION_BLOCKED: 'Tu mensaje no pasa las políticas de uso. Probá reformularlo.',
    RATE_LIMIT_EXCEEDED: 'Demasiadas consultas seguidas. Esperá un momento e intentá de nuevo.',
    ENGINE_EXHAUSTED:
        'Los proveedores de IA no están disponibles temporalmente. Intentá más tarde.',
    FEATURE_DISABLED: 'El chat de IA está deshabilitado temporalmente.',
    CEILING_HIT: 'Se alcanzó el límite de costo de IA. Intentá más tarde.',
    SERVICE_UNAVAILABLE: 'Servicio temporalmente no disponible. Intentá más tarde.',
    NETWORK_INTERRUPTED: 'Se cortó la conexión. Reintentá.',
    INTERNAL_ERROR: 'Ocurrió un error inesperado. Intentá de nuevo.'
});

/**
 * Turns an API failure into copy a person can read.
 *
 * Precedence matters. The API sends a resolvable i18n key as the `message`
 * where it wants a SPECIFIC message - notably to tell the consumer-side quota
 * (`consumerLimitReached`, actionable: upgrade) apart from the owner-side one,
 * which share the `LIMIT_REACHED` code and would otherwise collapse into one
 * misleading string. So the message is tried first, the code second, and the
 * generic copy last. The raw message is never rendered: it is either an i18n
 * key or Spanish prose from the API, and both are wrong to show as-is.
 */
function resolveChatError({
    t,
    code,
    message
}: {
    readonly t: (key: string, fallback?: string) => string;
    readonly code: string | null;
    readonly message: string | null;
}): string {
    if (message && I18N_KEY_PATTERN.test(message)) {
        const translated = t(message, UNRESOLVED);
        if (translated !== UNRESOLVED) return translated;
    }

    if (code) {
        const fallback = ERROR_FALLBACKS[code];
        const translated = t(`accommodations.aiChat.error.${code}`, UNRESOLVED);
        if (translated !== UNRESOLVED) return translated;
        if (fallback) return fallback;
    }

    return t('accommodations.aiChat.errorDefault');
}

/**
 * Root component for the AI accommodation chat.
 * Renders both the FAB and the chat panel (single Astro island).
 *
 * @param props - Accommodation ID, locale, and API URL.
 */
export function AiChatWidget({ accommodationId, locale, apiUrl }: AiChatWidgetProps) {
    // Simple mode (no `initialUser`): `user` starts null, so the server and the
    // first paint render nothing — the anonymous variant (HOS-369 D-11).
    const { user } = useAccountPermissions();
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [draft, setDraft] = useState('');
    const chat = useAccommodationChat({ accommodationId, locale, apiUrl });
    const { t } = createTranslations(locale);

    const panelRef = useRef<HTMLDivElement>(null);
    const fabRef = useRef<HTMLButtonElement>(null);
    /**
     * Ref to the composer textarea. Used to focus it directly when the panel
     * opens (W14 — target the textarea, not the first focusable button).
     */
    const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
    /** Tracks whether the chat panel has been opened at least once. Prevents
     *  the focus-return effect from stealing focus on the initial render when
     *  `isOpen` is already `false` (WCAG dialog focus-return guard). */
    const hasBeenOpenedRef = useRef(false);

    // Back button closes the panel instead of leaving the accommodation page
    // (HOS-310). This widget builds its own `role="dialog"` rather than using
    // the shared `Dialog`, so it wires the same hook directly.
    useDialogHistoryBack({ isOpen, onClose: () => setIsOpen(false) });

    // Keep the panel inside the area the user can actually see. Without this
    // the mobile keyboard covers the composer: the panel is anchored with
    // `bottom` against a layout viewport that does not shrink for it (HOS-309).
    const { height: visibleHeight, bottomInset } = useVisualViewportInset({ enabled: isOpen });
    const isKeyboardOpen = bottomInset > KEYBOARD_INSET_THRESHOLD_PX;

    // Focus trap + ESC close
    useEffect(() => {
        if (!isOpen) return;
        // Mark that the dialog has been opened at least once so the focus-return
        // effect below knows a real open→close transition can occur.
        hasBeenOpenedRef.current = true;
        const panel = panelRef.current;
        if (!panel) return;

        // W14: Focus the composer textarea directly instead of the first focusable
        // element (which was the expand button). This gives users an immediately
        // useful focus target matching their intent (typing a question).
        // Synchronous call is safe here because this effect only runs when
        // isOpen=true, meaning the panel (and its textarea) are already in the DOM.
        composerTextareaRef.current?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                return;
            }

            // Focus trap: Tab cycles within the panel
            if (e.key === 'Tab') {
                const currentFocusables = panel.querySelectorAll<HTMLElement>(
                    'button, textarea, [tabindex]:not([tabindex="-1"])'
                );
                const first = currentFocusables[0];
                const last = currentFocusables[currentFocusables.length - 1];

                if (e.shiftKey) {
                    if (document.activeElement === first) {
                        e.preventDefault();
                        last?.focus();
                    }
                } else {
                    if (document.activeElement === last) {
                        e.preventDefault();
                        first?.focus();
                    }
                }
            }
        };

        panel.addEventListener('keydown', handleKeyDown);
        return () => panel.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Return focus to FAB when panel closes.
    // Guard: only fire after a real open→close transition, never on initial mount
    // when `isOpen` is already `false` (would steal focus on page load).
    useEffect(() => {
        if (!isOpen && hasBeenOpenedRef.current) {
            fabRef.current?.focus();
        }
    }, [isOpen]);

    const handleSend = useCallback(() => {
        const text = draft.trim();
        if (!text || chat.state.status === 'streaming') return;
        chat.send(text);
        setDraft('');
    }, [draft, chat]);

    /**
     * True while streaming has started but no assistant token has arrived yet.
     * Mirrors the same pattern from SearchChatPanel.client.tsx.
     */
    const showThinking = chat.state.status === 'streaming' && !chat.state.currentAssistantContent;

    // Every hook above runs unconditionally (Rules of Hooks); the gate is the
    // first thing after them. `user === null` covers both a real guest and the
    // not-yet-resolved window, and neither may see the chat.
    if (!user) return null;

    return (
        <>
            <AiChatFab
                ref={fabRef}
                isOpen={isOpen}
                onClick={() => setIsOpen(true)}
                locale={locale}
            />
            {isOpen && (
                <div
                    // biome-ignore lint/a11y/useSemanticElements: React dialog needs ref handling; div with role is acceptable per SPEC-200
                    ref={panelRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label={t('accommodations.aiChat.panelLabel')}
                    className={`${styles.panel} ${isExpanded ? styles.panelExpanded : ''}`}
                    data-keyboard-open={isKeyboardOpen ? 'true' : undefined}
                    style={
                        {
                            '--chat-keyboard-inset': `${bottomInset}px`,
                            ...(visibleHeight === null
                                ? {}
                                : { '--chat-visible-height': `${visibleHeight}px` })
                        } as React.CSSProperties
                    }
                >
                    <div className={styles.header}>
                        <h2 className={styles.title}>{t('accommodations.aiChat.panelLabel')}</h2>
                        <div className={styles.headerActions}>
                            <button
                                type="button"
                                className={styles.iconButton}
                                onClick={() => setIsExpanded(!isExpanded)}
                                aria-label={
                                    isExpanded
                                        ? t('accommodations.aiChat.collapse')
                                        : t('accommodations.aiChat.expand')
                                }
                            >
                                {isExpanded ? '↘' : '↗'}
                            </button>
                            <button
                                type="button"
                                className={styles.iconButton}
                                onClick={() => setIsOpen(false)}
                                aria-label={t('accommodations.aiChat.close')}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    <div className={styles.disclaimer}>
                        {t('accommodations.aiChat.headerDisclaimer')}
                    </div>

                    <div
                        className={styles.messages}
                        aria-live="polite"
                        aria-atomic="false"
                    >
                        {chat.state.messages.map((m, i) =>
                            m.role === 'assistant' ? (
                                <div
                                    // biome-ignore lint/suspicious/noArrayIndexKey: messages are append-only (never reordered/removed except a full reset), and ChatMessage has no stable id
                                    key={`${m.role}-${i}`}
                                    className={`${styles.bubble} ${styles.assistantBubble}`}
                                    // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via renderChatMarkdown (DOMPurify) before rendering
                                    dangerouslySetInnerHTML={{
                                        // nosemgrep:typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
                                        __html: renderChatMarkdown({ raw: m.content })
                                    }}
                                />
                            ) : (
                                <div
                                    // biome-ignore lint/suspicious/noArrayIndexKey: messages are append-only (never reordered/removed except a full reset), and ChatMessage has no stable id
                                    key={`${m.role}-${i}`}
                                    className={`${styles.bubble} ${styles.userBubble}`}
                                >
                                    {m.content}
                                </div>
                            )
                        )}
                        {chat.state.currentAssistantContent && (
                            <div
                                className={`${styles.bubble} ${styles.assistantBubble} ${styles.streaming}`}
                                // biome-ignore lint/security/noDangerouslySetInnerHtml: sanitized via renderChatMarkdown (DOMPurify) before rendering
                                dangerouslySetInnerHTML={{
                                    // nosemgrep:typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
                                    __html: renderChatMarkdown({
                                        raw: chat.state.currentAssistantContent
                                    })
                                }}
                            />
                        )}
                        {showThinking && (
                            <output
                                className={styles.thinking}
                                aria-label={t('accommodations.aiChat.thinking', 'Pensando…')}
                            >
                                <span>{t('accommodations.aiChat.thinking', 'Pensando…')}</span>
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
                        {chat.state.showPriceDisclaimer && (
                            <div className={styles.priceNotice}>
                                {t('accommodations.aiChat.priceDisclaimer')}
                            </div>
                        )}
                        {chat.state.status === 'error' && (
                            <div className={styles.errorBubble}>
                                {resolveChatError({
                                    t,
                                    code: chat.state.errorCode,
                                    message: chat.state.errorMessage
                                })}
                            </div>
                        )}
                        {chat.state.status === 'at_cap' && (
                            <div className={styles.capBanner}>
                                {t('accommodations.aiChat.atCapMessage')}
                                <button
                                    type="button"
                                    className={styles.resetButton}
                                    onClick={chat.reset}
                                >
                                    {t('accommodations.aiChat.newConversation')}
                                </button>
                            </div>
                        )}
                    </div>

                    <form
                        className={styles.composer}
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleSend();
                        }}
                    >
                        <textarea
                            ref={composerTextareaRef}
                            className={styles.textarea}
                            placeholder={t('accommodations.aiChat.placeholder')}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            disabled={
                                chat.state.status === 'streaming' || chat.state.status === 'at_cap'
                            }
                            rows={2}
                        />
                        <button
                            type="submit"
                            className={styles.sendButton}
                            disabled={
                                chat.state.status === 'streaming' ||
                                chat.state.status === 'at_cap' ||
                                !draft.trim()
                            }
                            aria-label={
                                chat.state.status === 'streaming'
                                    ? t('accommodations.aiChat.sending')
                                    : t('accommodations.aiChat.send')
                            }
                        >
                            {chat.state.status === 'streaming' ? <Spinner size="sm" /> : '↑'}
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
