import { z } from 'zod';
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';
import { LISTING_BAR_TEL_HREF_PATTERN } from './listing-action-bar';

const COPY = 'accommodations.detail.listingContact';
const emailSchema = z.email();

/** The public CTA and, for direct channels, its final destination. */
export type PriceCardAction =
    | { readonly kind: 'none' }
    | { readonly kind: 'inquire'; readonly labelKey: string }
    | {
          readonly kind: 'menu' | 'phone' | 'email';
          readonly labelKey: string;
          readonly href: string;
      };

/** Prefer a published menu, then a dialable phone, then email, then an available inquiry flow. */
export function resolvePriceCardAction({
    menuHref,
    phoneHref,
    email,
    canInquire = false
}: {
    readonly menuHref?: string;
    readonly phoneHref?: string | null;
    readonly email?: string | null;
    readonly canInquire?: boolean;
}): PriceCardAction {
    const safeMenuHref = resolveSafeExternalUrl(menuHref);
    if (safeMenuHref) return { kind: 'menu', labelKey: `${COPY}.bar.viewMenu`, href: safeMenuHref };
    if (phoneHref && LISTING_BAR_TEL_HREF_PATTERN.test(phoneHref)) {
        return { kind: 'phone', labelKey: `${COPY}.bar.actions.call`, href: phoneHref };
    }
    const address = emailSchema.safeParse(email?.trim());
    if (address.success) {
        const recipient = encodeURIComponent(address.data).replace('%40', '@');
        return {
            kind: 'email',
            labelKey: `${COPY}.summary.writeEmail`,
            href: `mailto:${recipient}`
        };
    }
    return canInquire
        ? { kind: 'inquire', labelKey: `${COPY}.summary.requestPrice` }
        : { kind: 'none' };
}
