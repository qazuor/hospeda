/**
 * @file AiChatWidget.tsx
 * @description AI chat widget for accommodation detail pages.
 * Renders a FAB + slide-out panel with focus trap, ESC-to-close,
 * aria-live region for streaming tokens, and price disclaimer.
 *
 * @module AiChatWidget
 */

import { useAccommodationChat } from '@/hooks/useAccommodationChat';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AiChatFab } from './AiChatFab';
import styles from './AiChatWidget.module.css';

export interface AiChatWidgetProps {
    readonly accommodationId: string;
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
}

/**
 * Root component for the AI accommodation chat.
 * Renders both the FAB and the chat panel (single Astro island).
 *
 * @param props - Accommodation ID, locale, and API URL.
 */
export function AiChatWidget({ accommodationId, locale, apiUrl }: AiChatWidgetProps) {
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
                        {chat.state.messages.map((m, i) => (
                            <div
                                key={`${m.role}-${i}`}
                                className={`${styles.bubble} ${m.role === 'user' ? styles.userBubble : styles.assistantBubble}`}
                            >
                                {m.content}
                            </div>
                        ))}
                        {chat.state.currentAssistantContent && (
                            <div
                                className={`${styles.bubble} ${styles.assistantBubble} ${styles.streaming}`}
                            >
                                {chat.state.currentAssistantContent}
                            </div>
                        )}
                        {chat.state.showPriceDisclaimer && (
                            <div className={styles.priceNotice}>
                                {t('accommodations.aiChat.priceDisclaimer')}
                            </div>
                        )}
                        {chat.state.status === 'error' && (
                            <div className={styles.errorBubble}>
                                {chat.state.errorMessage || t('accommodations.aiChat.errorDefault')}
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
                            {chat.state.status === 'streaming' ? '⏳' : '↑'}
                        </button>
                    </form>
                </div>
            )}
        </>
    );
}
