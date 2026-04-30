/**
 * @file ShareButtons.client.tsx
 * @description Share buttons React island.
 *
 * On mobile with Web Share API: tap → navigator.share().
 * Otherwise: tap → popover with WhatsApp, Facebook, X, Telegram, Copy URL.
 *
 * Hydrate with `client:visible` (caller's responsibility).
 */

import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { addToast } from '@/store/toast-store';
import { FacebookIcon, ShareIcon, WhatsappIcon } from '@repo/icons';
import { CopyIcon } from '@repo/icons';
import { CloseIcon } from '@repo/icons';
import { useEffect, useRef, useState } from 'react';
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
export function ShareButtons({ url, title, locale, className }: ShareButtonsProps) {
    const { t } = createTranslations(locale);
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    // Close popover on outside click or Escape key
    useEffect(() => {
        if (!isOpen) return;

        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === 'Escape') {
                setIsOpen(false);
                triggerRef.current?.focus();
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

        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Focus first popover item when opened
    useEffect(() => {
        if (isOpen && popoverRef.current) {
            const firstFocusable = popoverRef.current.querySelector<HTMLElement>('a, button');
            firstFocusable?.focus();
        }
    }, [isOpen]);

    async function handleMainClick(): Promise<void> {
        if (hasWebShareApi() && isMobileViewport()) {
            try {
                await navigator.share({ url, title });
            } catch {
                // User cancelled or share failed — fall through silently
            }
            return;
        }
        setIsOpen((prev) => !prev);
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
        setIsOpen(false);
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
            icon: (
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
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                >
                    <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z" />
                </svg>
            ),
            ariaLabel: 'Compartir en Telegram'
        }
    ] as const;

    return (
        <div className={`${styles.root}${className ? ` ${className}` : ''}`}>
            <button
                ref={triggerRef}
                type="button"
                className={styles.trigger}
                aria-label={t('ui.accessibility.shareViaDevice', 'Compartir')}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                onClick={() => void handleMainClick()}
            >
                <ShareIcon
                    size={20}
                    aria-hidden="true"
                />
                <span className={styles.triggerLabel}>{t('ui.actions.share', 'Compartir')}</span>
            </button>

            {isOpen && (
                <div
                    ref={popoverRef}
                    role="menu"
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
                            onClick={() => setIsOpen(false)}
                        >
                            <CloseIcon
                                size={16}
                                aria-hidden="true"
                            />
                        </button>
                    </div>

                    <ul
                        className={styles.list}
                        role="presentation"
                    >
                        {shareLinks.map((link) => (
                            <li
                                key={link.label}
                                role="presentation"
                            >
                                <a
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    role="menuitem"
                                    className={styles.item}
                                    aria-label={link.ariaLabel}
                                    onClick={() => setIsOpen(false)}
                                >
                                    <span className={styles.itemIcon}>{link.icon}</span>
                                    <span className={styles.itemLabel}>{link.label}</span>
                                </a>
                            </li>
                        ))}
                        <li role="presentation">
                            <button
                                type="button"
                                role="menuitem"
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
