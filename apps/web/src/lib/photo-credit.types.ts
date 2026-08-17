/**
 * @file photo-credit.types.ts
 * @description The SHAPE of a composed photo credit, with none of the copy.
 *
 * Split out from `photo-credit.ts` on purpose. The lightbox island consumes a
 * credit that was already composed on the server, so it needs the type and
 * nothing else — but `i18n-client-namespaces.guard.test.ts` walks the import
 * graph without distinguishing `import type` from a value import (deliberately:
 * an under-reported namespace renders raw key text in production, so the guard
 * errs toward over-reporting). Importing the formatter for its type alone would
 * therefore pull `common.attribution` into the browser's i18n payload for every
 * visitor, to serve strings the browser never reads.
 */

/** The renderable pieces of a photo credit, composed by `formatPhotoCredit`. */
export interface PhotoCreditParts {
    /** Leading copy, e.g. "Foto por". */
    readonly byline: string;
    /** The photographer's name — the only part that is ever a link. */
    readonly photographer: string;
    /** Trailing copy naming the stock provider, e.g. "en Unsplash". Empty when there is none. */
    readonly providerSuffix: string;
    /** Destination for the name, when the credit carries a usable link. */
    readonly url?: string;
    /** Accessible label for that link. */
    readonly ariaLabel: string;
}
