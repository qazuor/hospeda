/**
 * @file AiChatWidget.tsx
 * @description AI chat widget for accommodation detail pages.
 * Renders a FAB + slide-out panel with focus trap, ESC-to-close,
 * aria-live region for streaming tokens, and price disclaimer.
 *
 * Session-blind pages mount the island unconditionally (HOS-369 WB0-7).
 * Confirmed guests see a sign-up invitation instead of the composer.
 *
 * @module AiChatWidget
 */

import { ChevronUpIcon, CloseIcon, FullscreenIcon, MinimizeIcon } from '@repo/icons';
import type { AiChatEntityType } from '@repo/schemas';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DockPortal } from '@/components/shared/dock/DockPortal';
import { Spinner } from '@/components/shared/feedback/Spinner';
import { Dialog, DialogBody, DialogHeader } from '@/components/shared/ui/Dialog.client';
import { PlanBadge } from '@/components/shared/ui/PlanBadge';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { useListingChatPlan } from '@/hooks/use-listing-chat-plan';
import { useAccommodationChat } from '@/hooks/useAccommodationChat';
import { useDialogHistoryBack } from '@/hooks/useDialogHistoryBack';
import { useVisualViewportInset } from '@/hooks/useVisualViewportInset';
import { aiChatCopyKey, resolveAiChatCopy, resolveChatError } from '@/lib/ai-chat-copy';
import { renderChatMarkdown } from '@/lib/ai-search/render-chat-markdown';
import { trapFocus } from '@/lib/focus-trap';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { openListingContactPanel } from '@/lib/listing-contact/listing-contact-events';
import type { ListingContactPrice } from '@/lib/listing-contact/listing-contact-price';
import { buildUrl } from '@/lib/urls';
import chrome from './AiChatChrome.module.css';
import { AiChatFab } from './AiChatFab';
import { AiChatGuestUpsell } from './AiChatGuestUpsell';
import { AiChatIntro } from './AiChatIntro';
import { AiChatPriceStrip } from './AiChatPriceStrip';
import styles from './AiChatWidget.module.css';

/**
 * Below this many pixels a bottom inset is browser chrome (a collapsing
 * toolbar), not a keyboard, and the panel should keep its normal spacing.
 */
const KEYBOARD_INSET_THRESHOLD_PX = 120;

/**
 * Mobile breakpoint. Same value the shared `Dialog` sheet CSS and the rest of
 * this widget's stylesheet use (`max-width: 767px`), so the JS switch and the
 * CSS never disagree.
 */
const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

/** Sync the mobile breakpoint after hydration, before the user opens the chat. */
function useIsMobileViewport(): boolean {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
        setIsMobile(mq.matches);
        const onChange = (event: MediaQueryListEvent): void => setIsMobile(event.matches);
        mq.addEventListener?.('change', onChange);
        return () => mq.removeEventListener?.('change', onChange);
    }, []);
    return isMobile;
}

export { aiChatCopyKey };

/** Public listing context for the chat island. */
export interface AiChatWidgetProps {
    /** Which kind of listing the chat is about (HOS-400). */
    readonly entityType: AiChatEntityType;
    /** The listing's id. */
    readonly entityId: string;
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
    readonly listingPrice?: ListingContactPrice;
    readonly canConsult?: boolean;
}

/**
 * Root component for the AI accommodation chat.
 * Keeps the FAB's dock portal mounted while rendering the chat panel outside
 * that portal (single Astro island).
 *
 * @param props - Accommodation ID, locale, and API URL.
 */
export function AiChatWidget({
    entityType,
    entityId,
    locale,
    apiUrl,
    listingPrice,
    canConsult
}: AiChatWidgetProps) {
    // Wait for a confirmed guest or user before rendering the FAB.
    const { user, isResolved } = useAccountPermissions();
    const isGuest = isResolved && !user;
    const [isOpen, setIsOpen] = useState(false);
    const isMobile = useIsMobileViewport();
    const [isExpanded, setIsExpanded] = useState(false);
    const [draft, setDraft] = useState('');
    const chat = useAccommodationChat({ entityType, entityId, locale, apiUrl });
    const plan = useListingChatPlan({ apiUrl, enabled: isOpen, viewer: user?.id ?? null });
    const { t } = createTranslations(locale);
    /** Resolves one chat string; a miss falls to human copy, never a raw key. */
    const copy = (suffix: string): string => resolveAiChatCopy({ t, entityType, suffix });

    const panelRef = useRef<HTMLDivElement>(null);
    const fabRef = useRef<HTMLButtonElement>(null);
    const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
    /** Guest panel has no composer: focus lands on the primary CTA instead. */
    const guestCtaRef = useRef<HTMLAnchorElement>(null);
    /** Tracks whether the chat panel has been opened at least once. Prevents
     *  the focus-return effect from stealing focus on the initial render when
     *  `isOpen` is already `false` (WCAG dialog focus-return guard). */
    const hasBeenOpenedRef = useRef(false);

    // The shared mobile Dialog owns its own history and focus handling.
    const { isTopmost } = useDialogHistoryBack({
        isOpen: isOpen && !isMobile,
        onClose: () => setIsOpen(false)
    });

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

        if (isMobile) {
            // The sheet's `Dialog` queues its own default focus in the opening
            // frame; wait two frames so the composer wins, as the contact
            // panel does.
            let inner = 0;
            const outer = requestAnimationFrame(() => {
                inner = requestAnimationFrame(() => {
                    (composerTextareaRef.current ?? guestCtaRef.current)?.focus();
                });
            });
            return () => {
                cancelAnimationFrame(outer);
                cancelAnimationFrame(inner);
            };
        }

        const panel = panelRef.current;
        if (!panel) return;

        // W14: Focus the composer rather than the first header control.
        (composerTextareaRef.current ?? guestCtaRef.current)?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            // `isTopmost` (HOS-350): when a second overlay opens above this
            // panel (e.g. the feedback modal via Ctrl+Shift+F), only the
            // outermost surface may close on a single Escape press.
            if (e.key === 'Escape') {
                if (isTopmost) setIsOpen(false);
                return;
            }

            // Listen on document to recover focus even after it escapes the panel.
            trapFocus(panel, e);
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, isTopmost, isMobile]);

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

    const showThinking = chat.state.status === 'streaming' && !chat.state.currentAssistantContent;
    const consult = () => {
        setIsOpen(false);
        openListingContactPanel({ origin: 'bar' });
    };
    // HOS-2666 (CARD-037 H-1): the VIP viewer's plan shows as the shared PlanBadge
    // (crown + name). When the catalog name cannot be resolved the VIP label is
    // the fallback, so a VIP never sees a chip-less header.
    const planBadgeName =
        plan?.name ?? (plan?.vip ? t('billing.checkout.signup.vertical.tourist') : null);
    const planChip = planBadgeName ? (
        <span className={chrome.planBadgeSlot}>
            <PlanBadge name={planBadgeName} />
        </span>
    ) : null;
    const selectSuggestion = (question: string) => {
        setDraft(question);
        composerTextareaRef.current?.focus();
    };

    // Every hook above runs unconditionally (Rules of Hooks); the gate is the
    // first thing after them. Not-yet-resolved renders nothing; a confirmed
    // guest gets the upsell panel; a signed-in visitor gets the chat.
    if (!user && !isGuest) return null;

    /** Current page, read client-side only (this branch never runs on the server). */
    const returnUrl =
        typeof window === 'undefined'
            ? ''
            : `${window.location.pathname}${window.location.search}${window.location.hash}`;

    const chatBody = (
        <>
            {isGuest ? (
                <AiChatGuestUpsell
                    entityType={entityType}
                    locale={locale}
                    returnUrl={returnUrl}
                    primaryRef={guestCtaRef}
                    monthlyQuota={plan?.quota}
                />
            ) : (
                <>
                    <div
                        className={styles.messages}
                        aria-live="polite"
                        aria-atomic="false"
                    >
                        <AiChatIntro
                            copy={copy}
                            locale={locale}
                            allowance={plan?.quota}
                            onSuggestion={
                                chat.state.status === 'idle' && chat.state.messages.length === 0
                                    ? selectSuggestion
                                    : undefined
                            }
                        />
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
                                {chat.state.errorCode === 'LIMIT_REACHED' &&
                                    chat.state.errorMessage ===
                                        'accommodations.aiChat.consumerLimitReached' && (
                                        <p>
                                            <a
                                                href={buildUrl({
                                                    locale,
                                                    path: 'planes/turistas/precios/'
                                                })}
                                            >
                                                {t('accommodations.aiChat.consumerLimitUpgradeCta')}
                                            </a>
                                        </p>
                                    )}
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
                            {chat.state.status === 'streaming' ? (
                                <Spinner size="sm" />
                            ) : (
                                <ChevronUpIcon
                                    size={18}
                                    aria-hidden="true"
                                />
                            )}
                        </button>
                    </form>
                </>
            )}
        </>
    );

    return (
        <>
            <DockPortal slot="ai-chat">
                <AiChatFab
                    ref={fabRef}
                    isOpen={isOpen}
                    onClick={() => setIsOpen(true)}
                    locale={locale}
                    entityType={entityType}
                />
            </DockPortal>
            {isOpen && isMobile && (
                <Dialog
                    variant="sheet"
                    isOpen
                    onClose={() => setIsOpen(false)}
                    ariaLabel={copy('panelLabel')}
                >
                    <DialogHeader
                        onClose={() => setIsOpen(false)}
                        closeLabel={copy('close')}
                    >
                        {copy('panelLabel')}
                        {planChip}
                    </DialogHeader>
                    <DialogBody bare>
                        <div
                            className={styles.sheetContent}
                            data-keyboard-open={isKeyboardOpen ? 'true' : undefined}
                            style={
                                visibleHeight === null
                                    ? undefined
                                    : ({
                                          '--chat-visible-height': `${visibleHeight}px`
                                      } as React.CSSProperties)
                            }
                        >
                            {chatBody}
                        </div>
                    </DialogBody>
                </Dialog>
            )}
            {isOpen && !isMobile && (
                <div
                    ref={panelRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label={copy('panelLabel')}
                    className={`${styles.panel} ${isExpanded ? styles.panelExpanded : ''} ${isGuest ? styles.panelGuest : ''}`}
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
                    {listingPrice !== undefined && (
                        <AiChatPriceStrip
                            price={listingPrice}
                            locale={locale}
                            onConsult={canConsult ? consult : undefined}
                        />
                    )}
                    <div className={styles.header}>
                        <h2 className={styles.title}>
                            {copy('panelLabel')}
                            {planChip}
                        </h2>
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
                                {isExpanded ? (
                                    <MinimizeIcon
                                        size={16}
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <FullscreenIcon
                                        size={16}
                                        aria-hidden="true"
                                    />
                                )}
                            </button>
                            <button
                                type="button"
                                className={styles.iconButton}
                                onClick={() => setIsOpen(false)}
                                aria-label={copy('close')}
                            >
                                <CloseIcon
                                    size={16}
                                    aria-hidden="true"
                                />
                            </button>
                        </div>
                    </div>

                    {chatBody}
                </div>
            )}
        </>
    );
}
