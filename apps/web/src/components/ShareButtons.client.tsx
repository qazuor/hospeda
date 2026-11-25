/**
 * @file ShareButtons.client.tsx
 * @description Share buttons React island.
 *
 * On mobile with Web Share API: tap → navigator.share().
 * Otherwise: tap → popover with WhatsApp, Facebook, X, Telegram, Copy URL.
 *
 * Hydrate with `client:visible` (caller's responsibility).
 *
 * Every action shares the canonical URL tagged with campaign UTMs (HOS-2359 §6.C.1):
 * `source` is the network (`whatsapp|facebook|x|telegram`), `share` for the native
 * share sheet and `copy` for the clipboard; `medium=share`; `campaign` is the entity
 * type the caller passes. The `url` prop itself stays canonical, so the page's
 * canonical, OG and JSON-LD URLs never carry UTMs.
 *
 * Listing detail pages pass `analytics` so each completed share emits
 * `listing_shared` (HOS-2579 §6.10.4): `native` when the share sheet resolves,
 * `copy` when the clipboard write succeeds and `network` when a network intent
 * link is clicked. Without the prop (events, posts) nothing is emitted.
 */

import { type ShareCampaign, type ShareUtmParams, withUtm } from '@repo/analytics';
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
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/umami-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { ContactOrigin } from '@/lib/listing-contact/listing-contact-events';
import { buildShareIntentUrl } from '@/lib/share-intents';
import { addToast } from '@/store/toast-store';
import styles from './ShareButtons.module.css';

/**
 * Listing context for the `listing_shared` event. Only listing detail pages
 * pass it; its absence keeps the component analytics-free.
 */
export interface ShareButtonsAnalytics {
    /** UUID of the shared listing. */
    readonly listingId: string;
    /** Vertical of the shared listing. */
    readonly vertical: 'accommodation' | 'experience' | 'venue';
    /** Surface the share trigger lives on. */
    readonly origin: ContactOrigin;
}

/** How a share was completed, as reported on `listing_shared`. */
type ShareMethod = 'native' | 'copy' | 'network';

/**
 * Props for the ShareButtons component.
 */
interface ShareButtonsProps {
    /** Canonical URL to share (UTMs are added per action, never here). */
    readonly url: string;
    /** Entity type being shared, used as `utm_campaign`. */
    readonly campaign: ShareCampaign;
    /** Page title for share metadata */
    readonly title: string;
    /** Locale for i18n strings */
    readonly locale: SupportedLocale;
    /** Optional CSS class override on the root element */
    readonly className?: string;
    /**
     * Icon-only trigger variants:
     * - `icon-overlay`: filled round trigger placed over a gallery photo.
     * - `icon`: round 44px outline trigger for headers and action bars (HOS-2579).
     */
    readonly appearance?: 'icon-overlay' | 'icon';
    /** When present, completed shares emit `listing_shared` (HOS-2579). */
    readonly analytics?: ShareButtonsAnalytics;
    /** Accessible name of the trigger, replacing «Compartir» (listing action bar, HOS-2579). */
    readonly label?: string;
    /**
     * Weight of the trigger glyph. Absent keeps the icon set's default (duotone),
     * which every existing caller relies on; the listing action bar passes
     * `regular` so its secondary glyphs share one stroke (HOS-2607).
     */
    readonly iconWeight?: 'regular';
}

/** A share action's `utm_source`. */
type ShareSource = ShareUtmParams['source'];

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
export function ShareButtons({
    url,
    title,
    locale,
    campaign,
    className,
    appearance,
    analytics,
    label,
    iconWeight
}: ShareButtonsProps) {
    const { t } = createTranslations(locale);
    const sharedUrl = (source: ShareSource): string =>
        withUtm({ url, source, medium: 'share', campaign });
    const isOverlay = appearance === 'icon-overlay';
    const isIcon = appearance === 'icon';
    /** Both icon-only variants share the overlay's labelling and focus behaviour. */
    const isCompact = isOverlay || isIcon;

    /** Emits `listing_shared` for a completed share, only when `analytics` is passed. */
    function trackShare(method: ShareMethod): void {
        if (!analytics) return;
        trackEvent(WebEvents.ListingShared, {
            listing_id: analytics.listingId,
            vertical: analytics.vertical,
            origin: analytics.origin,
            method,
            locale
        });
    }
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    // The overlay owns Escape only within its trigger and popup. Keep the legacy listener global.
    useEffect(() => {
        if (!isOpen) return;
        const root = rootRef.current;
        const keyTarget = isCompact ? root : document;

        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === 'Escape') {
                if (isCompact) event.stopPropagation();
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
        if (isCompact) root?.addEventListener('focusout', handleFocusOut);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            keyTarget?.removeEventListener('keydown', handleKeyDown as EventListener);
            if (isCompact) root?.removeEventListener('focusout', handleFocusOut);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, isCompact]);

    // Focus first popover item when opened
    useEffect(() => {
        if (isOpen && popoverRef.current) {
            const firstFocusable = popoverRef.current.querySelector<HTMLElement>('a, button');
            firstFocusable?.focus();
        }
    }, [isOpen]);

    async function handleMainClick(): Promise<void> {
        if (hasWebShareApi() && isMobileViewport()) {
            if (isCompact && isOpen) {
                dismissPopover();
                return;
            }
            try {
                await navigator.share({ url: sharedUrl('share'), title });
                trackShare('native');
            } catch (error) {
                if (isCompact && !(error instanceof DOMException && error.name === 'AbortError')) {
                    setIsOpen(true);
                }
            }
            return;
        }
        setIsOpen((prev) => !prev);
    }

    function dismissPopover(): void {
        setIsOpen(false);
        if (isCompact && rootRef.current?.contains(document.activeElement)) {
            triggerRef.current?.focus();
        }
    }

    async function handleCopyUrl(): Promise<void> {
        try {
            await navigator.clipboard.writeText(sharedUrl('copy'));
            setCopied(true);
            trackShare('copy');
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

    const shareLinks = [
        {
            label: 'WhatsApp',
            href: buildShareIntentUrl({ network: 'whatsapp', url: sharedUrl('whatsapp'), title }),
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
            href: buildShareIntentUrl({ network: 'facebook', url: sharedUrl('facebook'), title }),
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
            href: buildShareIntentUrl({ network: 'x', url: sharedUrl('x'), title }),
            icon: isCompact ? (
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
            href: buildShareIntentUrl({ network: 'telegram', url: sharedUrl('telegram'), title }),
            icon: (
                <TelegramIcon
                    size={20}
                    aria-hidden="true"
                />
            ),
            ariaLabel: isCompact ? t('ui.accessibility.shareOnTelegram') : 'Compartir en Telegram'
        }
    ] as const;

    return (
        <div
            ref={rootRef}
            className={`${styles.root}${isOverlay ? ` ${styles.iconOverlay}` : ''}${isIcon ? ` ${styles.icon}` : ''}${className ? ` ${className}` : ''}`}
        >
            <button
                ref={triggerRef}
                type="button"
                className={styles.trigger}
                aria-label={label ?? t('ui.accessibility.shareViaDevice', 'Compartir')}
                aria-expanded={isOpen}
                aria-haspopup={isCompact ? undefined : 'menu'}
                onClick={() => void handleMainClick()}
            >
                {/* Both pairs written out: the icon-manifest analyzer and the
                    shipped-weights guard only see literal weights. */}
                {iconWeight === 'regular' ? (
                    <ShareIcon
                        size={20}
                        weight="regular"
                        aria-hidden="true"
                    />
                ) : (
                    <ShareIcon
                        size={20}
                        aria-hidden="true"
                    />
                )}
                {!isCompact && (
                    <span className={styles.triggerLabel}>
                        {t('ui.actions.share', 'Compartir')}
                    </span>
                )}
            </button>

            {isOpen && (
                // biome-ignore lint/a11y/useAriaPropsSupportedByRole: both possible roles (group and menu) support an accessible name.
                <div
                    ref={popoverRef}
                    role={isCompact ? 'group' : 'menu'}
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
                        role={isCompact ? undefined : 'presentation'}
                    >
                        {shareLinks.map((link) => (
                            <li
                                key={link.label}
                                role={isCompact ? undefined : 'presentation'}
                            >
                                <a
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    role={isCompact ? undefined : 'menuitem'}
                                    className={styles.item}
                                    aria-label={link.ariaLabel}
                                    onClick={() => {
                                        trackShare('network');
                                        dismissPopover();
                                    }}
                                >
                                    <span className={styles.itemIcon}>{link.icon}</span>
                                    <span className={styles.itemLabel}>{link.label}</span>
                                </a>
                            </li>
                        ))}
                        <li role={isCompact ? undefined : 'presentation'}>
                            <button
                                type="button"
                                role={isCompact ? undefined : 'menuitem'}
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
