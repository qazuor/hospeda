/**
 * @file AiSearchEntry.client.tsx
 * @description Entry point + drawer wrapper for the AI search panel (SPEC-265 D).
 *
 * Implements the **hybrid layout** decision: a CTA entry point on the
 * accommodations listing page that expands into a focused drawer/modal
 * overlay containing the SearchChatPanel. Closing the drawer collapses
 * back to the entry point (absorbs C4).
 *
 * Responsive:
 * - Desktop: right-side drawer (~520px wide, full height)
 * - Mobile: full-screen overlay
 *
 * Revives the previously-dead i18n keys `triggerLabel` (entry point button)
 * and `panelTitle` (drawer header).
 *
 * @module AiSearchEntry
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { useCallback, useEffect, useState } from 'react';
import styles from './AiSearchEntry.module.css';
import { SearchChatPanel } from './SearchChatPanel.client';

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
 * AiSearchEntry — hybrid layout entry point + drawer (SPEC-265 D).
 *
 * Renders a CTA button that opens a drawer overlay containing the
 * SearchChatPanel. The drawer is responsive: full-screen on mobile,
 * right-side drawer on desktop. Body scroll is locked while open,
 * and Escape closes the drawer.
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

    const handleOpen = useCallback((): void => setIsOpen(true), []);
    const handleClose = useCallback((): void => setIsOpen(false), []);

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

    return (
        <>
            {/* Entry point CTA — revives triggerLabel (SPEC-265 D) */}
            <button
                type="button"
                className={styles.entryButton}
                onClick={handleOpen}
                aria-label={t('aiSearch.triggerLabel', 'Buscá con IA')}
                data-testid="ai-search-entry"
            >
                <span
                    className={styles.entryIcon}
                    aria-hidden="true"
                >
                    ✨
                </span>
                {t('aiSearch.triggerLabel', 'Buscá con IA')}
            </button>

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
                        className={styles.drawer}
                        aria-label={t('aiSearch.panelTitle', 'Búsqueda inteligente')}
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
