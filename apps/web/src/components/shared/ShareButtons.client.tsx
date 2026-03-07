import {
    CheckIcon,
    CopyIcon,
    FacebookIcon,
    ShareIcon,
    TwitterIcon,
    WhatsappIcon
} from '@repo/icons';
import type { JSX } from 'react';
import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';
import { webLogger } from '../../lib/logger';

/**
 * Props for the ShareButtons component.
 */
export interface ShareButtonsProps {
    /**
     * URL to share.
     */
    readonly url: string;
    /**
     * Title of the content to share.
     */
    readonly title: string;
    /**
     * Optional text description for sharing.
     */
    readonly text?: string;
    /**
     * Optional CSS class names to apply to the container.
     */
    readonly className?: string;
    /**
     * Locale for i18n translations.
     * @default 'es'
     */
    readonly locale?: SupportedLocale;
}

/**
 * ShareButtons component provides social sharing and clipboard copy functionality.
 *
 * Uses the Web Share API when available (primarily on mobile devices), falling back
 * to direct social media links for WhatsApp, Facebook, and Twitter/X, plus a
 * copy-to-clipboard button. The copied state resets automatically after 2 seconds.
 *
 * @param props - Component props following the RO-RO pattern.
 * @returns ShareButtons JSX element.
 *
 * @example
 * ```astro
 * <ShareButtons
 *   client:visible
 *   url="https://hospeda.com.ar/es/alojamientos/mi-cabana"
 *   title="Mi Cabana en el Rio"
 *   text="Alojamiento ideal para descansar en el litoral"
 *   locale={locale}
 * />
 * ```
 */
export function ShareButtons({
    url,
    title,
    text = '',
    className = '',
    locale = 'es'
}: ShareButtonsProps): JSX.Element {
    const { t } = useTranslation({ locale, namespace: 'ui' });
    const [copied, setCopied] = useState(false);

    // Detect Web Share API availability at render time (safe to call in SSR: typeof guard).
    const hasWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    /**
     * Triggers the native Web Share API dialog.
     * Silently ignores cancellations; logs unexpected errors.
     */
    const handleNativeShare = async (): Promise<void> => {
        if (!hasWebShare) return;

        try {
            await navigator.share({ url, title, text });
        } catch (error) {
            // AbortError = user cancelled. Log everything else.
            if (error instanceof Error && error.name !== 'AbortError') {
                webLogger.error('Native share failed:', error);
            }
        }
    };

    /**
     * Copies the URL to the clipboard and shows a temporary confirmation state.
     */
    const handleCopyToClipboard = async (): Promise<void> => {
        if (!navigator?.clipboard) return;

        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => {
                setCopied(false);
            }, 2000);
        } catch (error) {
            webLogger.error('Clipboard copy failed:', error);
        }
    };

    /**
     * Builds the WhatsApp share URL with an encoded message.
     */
    const getWhatsAppUrl = (): string => {
        const message = text ? `${title} - ${text} ${url}` : `${title} ${url}`;
        return `https://wa.me/?text=${encodeURIComponent(message)}`;
    };

    /**
     * Builds the Facebook sharer URL.
     */
    const getFacebookUrl = (): string =>
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

    /**
     * Builds the Twitter/X intent URL including optional description text.
     */
    const getTwitterUrl = (): string => {
        const tweetText = text ? `${title} - ${text}` : title;
        return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(tweetText)}`;
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {hasWebShare ? (
                /* Native share button - shown on devices that support the Web Share API */
                <button
                    type="button"
                    onClick={() => void handleNativeShare()}
                    aria-label={t('accessibility.shareViaDevice')}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                    <ShareIcon
                        size={20}
                        className="mr-2 h-5 w-5"
                        aria-hidden="true"
                    />
                    {t('share.label', 'Compartir')}
                </button>
            ) : (
                /**
                 * Fallback social links - shown when Web Share API is unavailable.
                 * Social platform brand colors are intentionally hardcoded per brand guidelines:
                 * - WhatsApp green (#25D366 / green-500)
                 * - Facebook blue (#1877F2 / blue-600)
                 * - X/Twitter black (#000000 / black)
                 */
                <>
                    <a
                        href={getWhatsAppUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('accessibility.shareOnWhatsApp')}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white transition-colors hover:bg-green-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-500 focus-visible:outline-offset-2"
                    >
                        <WhatsappIcon
                            size={20}
                            className="h-5 w-5"
                            aria-hidden="true"
                        />
                    </a>

                    <a
                        href={getFacebookUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('accessibility.shareOnFacebook')}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"
                    >
                        <FacebookIcon
                            size={20}
                            className="h-5 w-5"
                            aria-hidden="true"
                        />
                    </a>

                    <a
                        href={getTwitterUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('accessibility.shareOnTwitter')}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white transition-colors hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2"
                    >
                        <TwitterIcon
                            size={20}
                            weight="fill"
                            aria-hidden="true"
                        />
                    </a>
                </>
            )}

            {/* Copy to clipboard button - always visible regardless of Web Share API */}
            <button
                type="button"
                onClick={() => void handleCopyToClipboard()}
                aria-label={copied ? t('accessibility.linkCopied') : t('accessibility.copyLink')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-border focus-visible:outline-offset-2"
            >
                {copied ? (
                    <CheckIcon
                        size={20}
                        className="h-5 w-5"
                        aria-hidden="true"
                    />
                ) : (
                    <CopyIcon
                        size={20}
                        className="h-5 w-5"
                        aria-hidden="true"
                    />
                )}
            </button>

            {/* Confirmation text shown briefly after a successful copy */}
            {copied && (
                <span
                    className="font-medium text-secondary text-sm"
                    aria-live="polite"
                >
                    {t('share.copied', 'Copiado!')}
                </span>
            )}
        </div>
    );
}
