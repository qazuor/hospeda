/**
 * @file share-intents.ts
 * @description Share-intent URL builders for the four networks Hospeda shares to
 * (HOS-2359 §6.C.1). One place, so `ShareButtons` and the presentation index build
 * the exact same links.
 *
 * The URL handed in is shared as-is: the caller decorates it (with `withUtm` or a
 * `/go/` short link) before building the intent.
 */

/** Networks with a share-intent URL. */
export const SHARE_INTENT_NETWORKS = ['whatsapp', 'facebook', 'x', 'telegram'] as const;

/** A network with a share-intent URL. */
export type ShareIntentNetwork = (typeof SHARE_INTENT_NETWORKS)[number];

/** Input of {@link buildShareIntentUrl}. */
export interface BuildShareIntentUrlInput {
    /** Target network. */
    readonly network: ShareIntentNetwork;
    /** Absolute URL to share (already decorated by the caller). */
    readonly url: string;
    /** Title or message that accompanies the link, where the network accepts one. */
    readonly title: string;
}

/**
 * Builds the share-intent URL that opens `network`'s composer with `url` (and
 * `title`, where supported) prefilled.
 *
 * @param input - See {@link BuildShareIntentUrlInput}
 * @returns The intent URL
 */
export function buildShareIntentUrl({ network, url, title }: BuildShareIntentUrlInput): string {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title);
    switch (network) {
        case 'whatsapp':
            return `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
        case 'facebook':
            return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        case 'x':
            return `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
        case 'telegram':
            return `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
    }
}
