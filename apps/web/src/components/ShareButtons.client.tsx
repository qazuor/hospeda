/**
 * @file ShareButtons.client.tsx
 * @description Share buttons React island.
 *
 * On mobile with Web Share API: tap → navigator.share().
 * Otherwise: tap → popover with WhatsApp, Facebook, X, Telegram, Copy URL.
 *
 * Hydrate with `client:visible` (caller's responsibility).
 */

import {
    CloseIcon,
    CopyIcon,
    FacebookIcon,
    ShareIcon,
    TelegramIcon,
    WhatsappIcon,
    XIcon
} from '@repo/icons';
import { useEffect, useRef, useState } from 'react';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import styles from './ShareButtons.module.css';

/**
 * Props for the ShareButtons component.
 */
interface ShareButtonsProps {
    /** Canonical URL to share */
    readonly url: string;
    /** Page title for share metadata */
    readonly title: string;
    /** Locale for i18n strings */
    readonly locale: SupportedLocale;
    /** Optional CSS class override on the root element */
    readonly className?: string;
    /** Compact icon-only trigger for placement over a gallery photo. */
    readonly appearance?: 'icon-overlay';
}

/** Checks whether the Web Share API is available on the device. */
function hasWebShareApi(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/** Checks whether the device is likely mobile (narrow viewport). */
function isMobileViewport(): boolean {
    return typeof window !== 'undefined' && window.innerWidth < 768;
}

/**
 * ShareButtons island — provides contextual sharing behavior.
 * On mobile with Web Share API support triggers native share sheet.
 * On desktop or unsupported mobile shows a popover with 5 share actions.
 */
export function ShareButtons({ url, title, locale, className, appearance }: ShareButtonsProps) {
    const { t } = createTranslations(locale);
    const isOverlay = appearance === 'icon-overlay';
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    // The overlay owns Escape only within its trigger and popup. Keep the legacy listener global.
    useEffect(() => {
        if (!isOpen) return;
        const root = rootRef.current;
        const keyTarget = isOverlay ? root : document;

        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === 'Escape') {
                if (isOverlay) event.stopPropagation();
                setIsOpen(false);
                triggerRef.current?.focus();
            }
        }

        function handleFocusOut(event: FocusEvent): void {
            if (!(event.relatedTarget instanceof Node) || !root?.contains(event.relatedTarget)) {
                setIsOpen(false);
            }
        }

        function handleClickOutside(event: MouseEvent): void {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(event.target as Node) &&
                !triggerRef.current?.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }

        keyTarget?.addEventListener('keydown', handleKeyDown as EventListener);
        if (isOverlay) root?.addEventListener('focusout', handleFocusOut);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            keyTarget?.removeEventListener('keydown', handleKeyDown as EventListener);
            if (isOverlay) root?.removeEventListener('focusout', handleFocusOut);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, isOverlay]);

    // Focus first popover item when opened
    useEffect(() => {
        if (isOpen && popoverRef.current) {
            const firstFocusable = popoverRef.current.querySelector<HTMLElement>('a, button');
            firstFocusable?.focus();
        }
    }, [isOpen]);

    async function handleMainClick(): Promise<void> {
        if (hasWebShareApi() && isMobileViewport()) {
            if (isOverlay && isOpen) {
                dismissPopover();
                return;
            }
            try {
                await navigator.share({ url, title });
            } catch (error) {
                if (isOverlay && !(error instanceof DOMException && error.name === 'AbortError')) {
                    setIsOpen(true);
                }
            }
            return;
        }
        setIsOpen((prev) => !prev);
    }

    function dismissPopover(): void {
        setIsOpen(false);
        if (isOverlay && rootRef.current?.contains(document.activeElement)) {
            triggerRef.current?.focus();
        }
    }

    async function handleCopyUrl(): Promise<void> {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            addToast({
                type: 'success',
                message: t('ui.accessibility.linkCopied', 'Link copiado')
            });
            setTimeout(() => setCopied(false), 2000);
        } catch {
            addToast({
                type: 'error',
                message: t('ui.errors.general', 'Ha ocurrido un error')
            });
        }
        dismissPopover();
    }

    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);

    const shareLinks = [
        {
            label: 'WhatsApp',
            href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
            icon: (
                <WhatsappIcon
                    size={20}
                    aria-hidden="true"
                />
            ),
            ariaLabel: t('ui.accessibility.shareOnWhatsApp', 'Compartir en WhatsApp')
        },
        {
            label: 'Facebook',
            href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
            icon: (
                <FacebookIcon
                    size={20}
                    aria-hidden="true"
                />
            ),
            ariaLabel: t('ui.accessibility.shareOnFacebook', 'Compartir en Facebook')
        },
        {
            label: 'X',
            href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
            icon: isOverlay ? (
                <XIcon
                    size={20}
                    aria-hidden="true"
                />
            ) : (
                <span
                    className={styles.xIcon}
                    aria-hidden="true"
                >
                    𝕏
                </span>
            ),
            ariaLabel: t('ui.accessibility.shareOnTwitter', 'Compartir en Twitter / X')
        },
        {
            label: 'Telegram',
            href: `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`,
            icon: (
                <TelegramIcon
                    size={20}
                    aria-hidden="true"
                />
            ),
            ariaLabel: isOverlay ? t('ui.accessibility.shareOnTelegram') : 'Compartir en Telegram'
        }
    ] as const;

    return (
        <div
            ref={rootRef}
            className={`${styles.root}${isOverlay ? ` ${styles.iconOverlay}` : ''}${className ? ` ${className}` : ''}`}
        >
            <button
                ref={triggerRef}
                type="button"
                className={styles.trigger}
                aria-label={t('ui.accessibility.shareViaDevice', 'Compartir')}
                aria-expanded={isOpen}
                aria-haspopup={isOverlay ? undefined : 'menu'}
                onClick={() => void handleMainClick()}
            >
                <ShareIcon
                    size={20}
                    aria-hidden="true"
                />
                {!isOverlay && (
                    <span className={styles.triggerLabel}>
                        {t('ui.actions.share', 'Compartir')}
                    </span>
                )}
            </button>

            {isOpen && (
                // biome-ignore lint/a11y/useAriaPropsSupportedByRole: both possible roles (group and menu) support an accessible name.
                <div
                    ref={popoverRef}
                    role={isOverlay ? 'group' : 'menu'}
                    aria-label={t('ui.accessibility.shareViaDevice', 'Compartir')}
                    className={styles.popover}
                >
                    <div className={styles.popoverHeader}>
                        <span className={styles.popoverTitle}>
                            {t('ui.actions.share', 'Compartir')}
                        </span>
                        <button
                            type="button"
                            className={styles.closeBtn}
                            aria-label={t('ui.accessibility.closeModal', 'Cerrar')}
                            onClick={dismissPopover}
                        >
                            <CloseIcon
                                size={16}
                                aria-hidden="true"
                            />
                        </button>
                    </div>

                    <ul
                        className={styles.list}
                        role={isOverlay ? undefined : 'presentation'}
                    >
                        {shareLinks.map((link) => (
                            <li
                                key={link.label}
                                role={isOverlay ? undefined : 'presentation'}
                            >
                                <a
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    role={isOverlay ? undefined : 'menuitem'}
                                    className={styles.item}
                                    aria-label={link.ariaLabel}
                                    onClick={dismissPopover}
                                >
                                    <span className={styles.itemIcon}>{link.icon}</span>
                                    <span className={styles.itemLabel}>{link.label}</span>
                                </a>
                            </li>
                        ))}
                        <li role={isOverlay ? undefined : 'presentation'}>
                            <button
                                type="button"
                                role={isOverlay ? undefined : 'menuitem'}
                                className={`${styles.item} ${styles.copyBtn}`}
                                aria-label={t('ui.accessibility.copyLink', 'Copiar enlace')}
                                onClick={() => void handleCopyUrl()}
                            >
                                <span className={styles.itemIcon}>
                                    <CopyIcon
                                        size={20}
                                        aria-hidden="true"
                                    />
                                </span>
                                <span className={styles.itemLabel}>
                                    {copied
                                        ? t('ui.accessibility.linkCopied', '¡Copiado!')
                                        : t('ui.accessibility.copyLink', 'Copiar enlace')}
                                </span>
                            </button>
                        </li>
                    </ul>
                </div>
            )}
        </div>
    );
}
