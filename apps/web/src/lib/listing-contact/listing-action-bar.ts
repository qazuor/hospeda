/**
 * @file listing-action-bar.ts
 * @description Pure, server-side inputs of the icon-only mobile action bar
 * (HOS-2579 §6.10). The pages compute every public fact here, so the bar
 * island never reads contact info, socials or the session to decide what to
 * render.
 */

import { toTelHref } from './listing-channels';

/** Shape of a `tel:` href the bar accepts: optional `+`, then digits only. */
export const LISTING_BAR_TEL_HREF_PATTERN = /^tel:\+?\d{3,}$/;

/**
 * Resolves the «Llamar» href from the listing's public phones, in priority
 * order (accommodation: `phone`, then `landlinePhone`; venue and experience:
 * `mobilePhone`, then `workPhone`). Uses the same normalization as the channel
 * panel (`toTelHref`), and drops a value that leaves too few digits to dial.
 *
 * @param input.phones - Candidate phones, best first. Empty values are skipped.
 * @returns `{ href }`, `null` when the listing publishes no dialable phone.
 */
export function resolveListingBarPhoneHref({
    phones
}: {
    readonly phones: readonly (string | null | undefined)[];
}): { readonly href: string | null } {
    for (const phone of phones) {
        if (typeof phone !== 'string' || phone.trim().length === 0) continue;
        const href = toTelHref(phone.trim());
        if (LISTING_BAR_TEL_HREF_PATTERN.test(href)) return { href };
    }
    return { href: null };
}
