/**
 * @file AiSearchEntry.client.tsx
 * @description Entry point + drawer wrapper for the AI search panel (SPEC-265 D).
 *
 * Implements the **hybrid layout** decision with progressive disclosure:
 *
 * 1. **Search-bar entry point** — a fake search input that looks like a natural
 *    part of the listing page. Clicking it opens the drawer.
 * 2. **Floating FAB** — when the search bar scrolls out of viewport, a floating
 *    action button appears at the bottom-right so the AI search is always
 *    accessible. Positioned above the FeedbackFAB to avoid overlap.
 * 3. **Drawer overlay** — right-side on desktop, full-screen on mobile.
 *
 * Revives the previously-dead i18n keys `triggerLabel` (entry point)
 * and `panelTitle` (drawer header).
 *
 * @module AiSearchEntry
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './AiSearchEntry.module.css';
import { SearchChatPanel } from './SearchChatPanel.client';

/**
 * Selector matching the elements that can receive keyboard focus inside the
 * drawer. Used for the initial-focus move and the focus trap (a11y).
 */
const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * `useLayoutEffect` runs before paint (so focus restore on drawer close does
 * not flash through `document.body`), but warns during SSR. This island is
 * server-rendered by Astro before hydration, so fall back to `useEffect` on
 * the server where layout effects are a no-op anyway.
 */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Props for the AiSearchEntry React island.
 *
 * All props are forwarded to the inner SearchChatPanel when the drawer
 * is open. See {@link SearchChatPanelProps} for their semantics.
 */
export interface AiSearchEntryProps {
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
    readonly isAuthenticated: boolean;
    readonly currentUrl: string;
    readonly destinations?: Readonly<Record<string, string>>;
    readonly pageType?: string;
}

/**
 * AiSearchEntry — hybrid layout with progressive disclosure (SPEC-265 D).
 *
 * Renders a fake search-bar entry point that opens a drawer overlay.
 * When the search bar scrolls out of viewport, a floating FAB appears.
 *
 * @example
 * ```astro
 * <AiSearchEntry
 *   locale={locale}
 *   apiUrl={import.meta.env.PUBLIC_API_URL}
 *   isAuthenticated={isAuthenticated}
 *   currentUrl={Astro.url.href}
 *   client:load
 * />
 * ```
 */
export function AiSearchEntry({
    locale,
    apiUrl,
    isAuthenticated,
    currentUrl,
    destinations,
    pageType
}: AiSearchEntryProps) {
    const { t } = createTranslations(locale);
    const [isOpen, setIsOpen] = useState(false);
    const [isFabVisible, setIsFabVisible] = useState(false);

    // Ref to the search-bar entry point — used by IntersectionObserver to
    // detect when it scrolls out of viewport and show the FAB.
    const searchBarRef = useRef<HTMLButtonElement>(null);

    // Drawer element + the element focused before opening (to restore on close).
    const drawerRef = useRef<HTMLElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    const handleOpen = useCallback((): void => setIsOpen(true), []);
    const handleClose = useCallback((): void => setIsOpen(false), []);

    // Focus trap: keep Tab focus cycling inside the modal drawer (a11y).
    const handleDrawerKeyDown = useCallback((e: React.KeyboardEvent): void => {
        if (e.key !== 'Tab') return;
        const drawer = drawerRef.current;
        if (!drawer) return;
        const focusables = drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    }, []);

    // IntersectionObserver: show FAB when search bar leaves viewport.
    useEffect(() => {
        const target = searchBarRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    setIsFabVisible(!entry.isIntersecting);
                }
            },
            { threshold: 0 }
        );
        observer.observe(target);
        return () => observer.disconnect();
    }, []);

    // Lock body scroll while the drawer is open (SPEC-265 D).
    useEffect(() => {
        if (!isOpen) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [isOpen]);

    // Close on Escape key (SPEC-265 D).
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen]);

    // Focus management (a11y): on open, remember the trigger and move focus
    // into the drawer; on close, restore focus to the trigger. Runs as a layout
    // effect so the restore happens before paint (no focus flash to <body>).
    useIsomorphicLayoutEffect(() => {
        if (!isOpen) return;
        previousFocusRef.current = document.activeElement as HTMLElement | null;
        const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
        firstFocusable?.focus();
        return () => {
            previousFocusRef.current?.focus();
        };
    }, [isOpen]);

    return (
        <>
            {/* Search-bar entry point — looks like a natural search input.
                 Revives triggerLabel (SPEC-265 D). */}
            <button
                ref={searchBarRef}
                type="button"
                className={styles.searchBar}
                onClick={handleOpen}
                aria-label={t('aiSearch.triggerLabel', 'Buscá con IA')}
                data-testid="ai-search-entry"
            >
                <span
                    className={styles.searchBarIcon}
                    aria-hidden="true"
                >
                    ✨
                </span>
                <span className={styles.searchBarPlaceholder}>
                    {t(
                        'aiSearch.chat.placeholder',
                        'Contame qué buscás, por ejemplo: cabaña para 4 con pileta cerca del río'
                    )}
                </span>
                <span
                    className={styles.searchBarBadge}
                    aria-hidden="true"
                >
                    IA
                </span>
            </button>

            {/* Floating FAB — appears when the search bar is out of viewport.
                 Positioned above the FeedbackFAB (bottom: 5rem vs 1rem). */}
            {isFabVisible && !isOpen && (
                <button
                    type="button"
                    className={styles.fab}
                    onClick={handleOpen}
                    aria-label={t('aiSearch.triggerLabel', 'Buscá con IA')}
                    data-testid="ai-search-fab"
                >
                    <span aria-hidden="true">✨</span>
                </button>
            )}

            {/* Drawer overlay — revives panelTitle (SPEC-265 D).
                 Click on backdrop (not drawer) closes; Escape is handled by
                 the global keydown listener above. */}
            {isOpen && (
                // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click-to-close is a mouse convenience; keyboard close is via Escape (global listener above)
                <div
                    className={styles.overlay}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) handleClose();
                    }}
                    role="presentation"
                    data-testid="ai-search-overlay"
                >
                    <section
                        ref={drawerRef}
                        className={styles.drawer}
                        // biome-ignore lint/a11y/useSemanticElements: a native <dialog> would need imperative showModal()/close() that conflicts with this React-controlled open state, the custom CSS backdrop overlay, and the drawer transition; role=dialog + aria-modal + the manual focus trap/restore below cover the a11y requirement
                        role="dialog"
                        aria-modal="true"
                        aria-label={t('aiSearch.panelTitle', 'Búsqueda inteligente')}
                        onKeyDown={handleDrawerKeyDown}
                    >
                        <div className={styles.drawerHeader}>
                            <h2 className={styles.drawerTitle}>
                                {t('aiSearch.panelTitle', 'Búsqueda inteligente')}
                            </h2>
                            <button
                                type="button"
                                className={styles.closeButton}
                                onClick={handleClose}
                                aria-label={t('aiSearch.chat.close', 'Cerrar panel')}
                            >
                                ×
                            </button>
                        </div>
                        <div className={styles.drawerBody}>
                            <SearchChatPanel
                                locale={locale}
                                apiUrl={apiUrl}
                                isAuthenticated={isAuthenticated}
                                currentUrl={currentUrl}
                                destinations={destinations}
                                pageType={pageType}
                            />
                        </div>
                    </section>
                </div>
            )}
        </>
    );
}
