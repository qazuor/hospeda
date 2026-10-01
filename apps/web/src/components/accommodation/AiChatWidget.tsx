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

import type { AiChatEntityType } from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from '@/components/shared/feedback/Spinner';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { useAccommodationChat } from '@/hooks/useAccommodationChat';
import { useDialogHistoryBack } from '@/hooks/useDialogHistoryBack';
import { useVisualViewportInset } from '@/hooks/useVisualViewportInset';
import { aiChatCopyKey, resolveAiChatCopy, resolveChatError } from '@/lib/ai-chat-copy';
import { renderChatMarkdown } from '@/lib/ai-search/render-chat-markdown';
// Shared with every other modal-like surface (Dialog, the AI search drawer).
// This file used to keep a private copy of the Tab-cycling logic, bound to
// the PANEL rather than `document` — worse than the shared trap's own prior
// bug, because a panel listener never runs once focus has fallen out to
// `<body>` (HOS-350).
import { trapFocus } from '@/lib/focus-trap';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { AiChatFab } from './AiChatFab';
import styles from './AiChatWidget.module.css';

/**
 * Below this many pixels a bottom inset is browser chrome (a collapsing
 * toolbar), not a keyboard, and the panel should keep its normal spacing.
 */
const KEYBOARD_INSET_THRESHOLD_PX = 120;

export { aiChatCopyKey };

export interface AiChatWidgetProps {
    /** Which kind of listing the chat is about (HOS-400). */
    readonly entityType: AiChatEntityType;
    /** The listing's id. */
    readonly entityId: string;
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
}

/**
 * Root component for the AI accommodation chat.
 * Renders both the FAB and the chat panel (single Astro island).
 *
 * @param props - Accommodation ID, locale, and API URL.
 */
export function AiChatWidget({ entityType, entityId, locale, apiUrl }: AiChatWidgetProps) {
    // Simple mode (no `initialUser`): `user` starts null, so the server and the
    // first paint render nothing — the anonymous variant (HOS-369 D-11).
    const { user } = useAccountPermissions();
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [draft, setDraft] = useState('');
    const chat = useAccommodationChat({ entityType, entityId, locale, apiUrl });
    const { t } = createTranslations(locale);
    /** Resolves one chat string; a miss falls to human copy, never a raw key. */
    const copy = (suffix: string): string => resolveAiChatCopy({ t, entityType, suffix });

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
    const { isTopmost } = useDialogHistoryBack({ isOpen, onClose: () => setIsOpen(false) });

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
            // `isTopmost` (HOS-350): when a second overlay opens above this
            // panel (e.g. the feedback modal via Ctrl+Shift+F), only the
            // outermost surface may close on a single Escape press.
            if (e.key === 'Escape') {
                if (isTopmost) setIsOpen(false);
                return;
            }

            // Focus trap: cycles Tab within the panel, and recovers focus
            // that was LOST while the panel was open. Bound to `document`
            // (not the panel) so it still catches Tab once focus has fallen
            // out to `<body>` — see `@/lib/focus-trap`.
            trapFocus(panel, e);
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isTopmost]);

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
                entityType={entityType}
            />
            {isOpen && (
                <div
                    // biome-ignore lint/a11y/useSemanticElements: React dialog needs ref handling; div with role is acceptable per SPEC-200
                    ref={panelRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label={copy('panelLabel')}
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
                        <h2 className={styles.title}>{copy('panelLabel')}</h2>
                        <div className={styles.headerActions}>
                            {/* HOS-552 / H-139: hidden below the mobile breakpoint via
                                 `.expandButton`'s media query — see AiChatWidget.module.css.
                                 On a narrow viewport the panel is already clamped to
                                 `max-width: calc(100vw - 48px)`, so expanding has no
                                 observable effect; a dead control is worse than none. */}
                            <button
                                type="button"
                                className={`${styles.iconButton} ${styles.expandButton}`}
                                onClick={() => setIsExpanded(!isExpanded)}
                                aria-label={isExpanded ? copy('collapse') : copy('expand')}
                            >
                                {isExpanded ? '↘' : '↗'}
                            </button>
                            <button
                                type="button"
                                className={styles.iconButton}
                                onClick={() => setIsOpen(false)}
                                aria-label={copy('close')}
                            >
                                ✕
                            </button>
                        </div>
                    </div>

                    <div className={styles.disclaimer}>{copy('headerDisclaimer')}</div>

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
                                aria-label={copy('thinking')}
                            >
                                <span>{copy('thinking')}</span>
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
                            <div className={styles.priceNotice}>{copy('priceDisclaimer')}</div>
                        )}
                        {chat.state.status === 'error' && (
                            <div className={styles.errorBubble}>
                                {resolveChatError({
                                    t,
                                    entityType,
                                    code: chat.state.errorCode,
                                    message: chat.state.errorMessage
                                })}
                            </div>
                        )}
                        {chat.state.status === 'at_cap' && (
                            <div className={styles.capBanner}>
                                {copy('atCapMessage')}
                                <button
                                    type="button"
                                    className={styles.resetButton}
                                    onClick={chat.reset}
                                >
                                    {copy('newConversation')}
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
                            placeholder={copy('placeholder')}
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
                                chat.state.status === 'streaming' ? copy('sending') : copy('send')
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
