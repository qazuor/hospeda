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
    const { url, title, text = '', className = '' } = props;
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
            console.error('Share failed:', error);
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
            console.error('Copy failed:', error);
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
                    aria-label="Share via device"
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
                        aria-label="Share on WhatsApp"
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
                        aria-label="Share on Facebook"
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
                        aria-label="Share on Twitter"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white transition-colors hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2"
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
                aria-label={copied ? 'Link copied' : 'Copy link to clipboard'}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-gray-700 transition-colors hover:bg-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gray-400 focus-visible:outline-offset-2"
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
                    className="font-medium text-green-600 text-sm"
                    aria-live="polite"
                >
                    Copied!
                </span>
            )}
        </div>
    );
}
