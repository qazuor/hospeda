import {
    CheckIcon,
    CopyIcon,
    FacebookIcon,
    ShareIcon,
    TwitterIcon,
    WhatsappIcon
} from '@repo/icons';
import { useState } from 'react';
import type { ReactElement } from 'react';
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
     * Locale for i18n translations
     * @default 'es'
     */
    readonly locale?: SupportedLocale;
}

/**
 * ShareButtons component provides social sharing and clipboard copy functionality.
 *
 * Uses Web Share API when available (mobile devices primarily), falling back to
 * direct social media links and clipboard copy. Includes WhatsApp, Facebook, Twitter/X,
 * and copy-to-clipboard functionality.
 *
 * @param props - Component props
 * @returns ShareButtons component
 *
 * @example
 * ```tsx
 * <ShareButtons
 *   url="https://example.com/page"
 *   title="Check this out"
 *   text="Amazing content"
 * />
 * ```
 */
export function ShareButtons(props: ShareButtonsProps): ReactElement {
    const { url, title, text = '', className = '', locale = 'es' } = props;
    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'ui' });
    const [copied, setCopied] = useState(false);
    const hasWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    /**
     * Handles Web Share API invocation.
     */
    const handleNativeShare = async (): Promise<void> => {
        if (!hasWebShare) return;

        try {
            await navigator.share({
                url,
                title,
                text
            });
        } catch (error) {
            // User cancelled or share failed - silently ignore
            webLogger.error('Share failed:', error);
        }
    };

    /**
     * Handles copy to clipboard functionality.
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
            webLogger.error('Copy failed:', error);
        }
    };

    /**
     * Constructs WhatsApp share URL.
     */
    const getWhatsAppUrl = (): string => {
        const message = text ? `${title} - ${text} ${url}` : `${title} ${url}`;
        return `https://wa.me/?text=${encodeURIComponent(message)}`;
    };

    /**
     * Constructs Facebook share URL.
     */
    const getFacebookUrl = (): string => {
        return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    };

    /**
     * Constructs Twitter/X share URL.
     */
    const getTwitterUrl = (): string => {
        const tweetText = text ? `${title} - ${text}` : title;
        return `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(tweetText)}`;
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {hasWebShare ? (
                <button
                    type="button"
                    onClick={handleNativeShare}
                    aria-label={t('accessibility.shareViaDevice')}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                    <ShareIcon
                        size={20}
                        className="mr-2 h-5 w-5"
                        aria-hidden="true"
                    />
                    Share
                </button>
            ) : (
                <>
                    <a
                        href={getWhatsAppUrl()}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t('accessibility.shareOnWhatsApp')}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white transition-colors hover:bg-green-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-green-500 focus-visible:outline-offset-2 dark:bg-green-600 dark:hover:bg-green-500"
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
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2 dark:bg-blue-700 dark:hover:bg-blue-600"
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
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white transition-colors hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                    >
                        <span className="sr-only">Share on Twitter</span>
                        <TwitterIcon
                            size={20}
                            weight="fill"
                            aria-hidden="true"
                        />
                    </a>
                </>
            )}

            <button
                type="button"
                onClick={handleCopyToClipboard}
                aria-label={copied ? t('accessibility.linkCopied') : t('accessibility.copyLink')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-alt text-text-secondary transition-colors hover:bg-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-border focus-visible:outline-offset-2"
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

            {copied && (
                <span
                    className="font-medium text-green-600 text-sm dark:text-green-400"
                    aria-live="polite"
                >
                    Copied!
                </span>
            )}
        </div>
    );
}
