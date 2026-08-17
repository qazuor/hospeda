/**
 * @file photo-credit.ts
 * @description Turns a {@link MediaAttribution} into the pieces a renderer
 * needs to display a photo credit (H-125).
 *
 * Two surfaces show the same credit and must phrase it identically: the SSR
 * photo page (`ImageAttribution.astro`) and the detail page's lightbox island
 * (`ImageGallery.client.tsx`, which is React and cannot import an Astro
 * component). Composing the sentence in each of them is how they drift, so it
 * is composed once, here.
 *
 * The parts are returned separately rather than as one string because the
 * photographer's name is the only clickable half — "Photo by [Ana] on Unsplash"
 * links the name, not the sentence.
 */

import type { MediaAttribution } from './media';
import type { PhotoCreditParts } from './photo-credit.types';
import { resolveSafeExternalUrl } from './safe-external-url';

/** Translator shape, matching `createTranslations(locale).t`. */
type Translate = (
    key: string,
    fallback?: string,
    params?: Record<string, string | number>
) => string;

/** Public names of the stock providers. A host's own photo has no provider name. */
const PROVIDER_NAMES = { unsplash: 'Unsplash', pexels: 'Pexels' } as const;

export type { PhotoCreditParts } from './photo-credit.types';

/**
 * Compose a photo credit for display.
 *
 * Returns `undefined` when there is nothing to show — which is the common case,
 * since most hosts photograph their own place and never fill the field in.
 *
 * @param attribution - Stored credit, if any
 * @param t - Active translator
 * @returns The credit's renderable parts, or `undefined`
 */
export function formatPhotoCredit(
    attribution: MediaAttribution | undefined,
    t: Translate
): PhotoCreditParts | undefined {
    const photographer = attribution?.photographer?.trim();
    // No name, no credit: a licence or a bare link names nobody.
    if (!photographer) {
        return undefined;
    }

    const providerName =
        attribution?.provider === 'unsplash' || attribution?.provider === 'pexels'
            ? PROVIDER_NAMES[attribution.provider]
            : undefined;

    // Re-checked here even though the extractors already did it: this helper is
    // also called with data that never passed through them, and the write side
    // accepts `javascript:` (`z.string().url()` does not restrict the scheme).
    const url = resolveSafeExternalUrl(attribution?.sourceUrl);

    return {
        byline: t('common.attribution.byline', 'Foto por'),
        photographer,
        providerSuffix: providerName
            ? t('common.attribution.onProvider', 'en {{provider}}', { provider: providerName })
            : '',
        ...(url ? { url } : {}),
        ariaLabel: providerName
            ? t('common.attribution.ariaLabel', 'Perfil de {{photographer}} en {{provider}}', {
                  photographer,
                  provider: providerName
              })
            : t('common.attribution.ariaLabelNoProvider', 'Sitio de {{photographer}}', {
                  photographer
              })
    };
}
