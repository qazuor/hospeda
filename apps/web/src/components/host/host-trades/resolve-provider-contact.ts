/**
 * @file resolve-provider-contact.ts
 * @description Turns the single free-text `contact` a provider entered into a
 * link a host can act on (HOS-2472).
 *
 * The directory API exposes one `contact` string, not separate channels, so the
 * channel is inferred from its shape: an e-mail address, a `wa.me` link, any
 * other web link, or (the fallback, same as the directory card) a phone number.
 * The href itself comes from {@link resolveContactHref}, the one place that
 * decides what a stored contact value links to.
 */

import { resolveContactHref } from './resolve-contact-href';

/** The channel a provider's contact resolves to. */
export type ProviderContactChannel = 'phone' | 'whatsapp' | 'email' | 'web';

/** A provider's contact, ready to render as a link. */
export interface ResolvedProviderContact {
    /** Which channel the value is. */
    readonly channel: ProviderContactChannel;
    /** The link to open it. */
    readonly href: string;
    /** Readable contact value; numeric WhatsApp recipients are shown as phones. */
    readonly display: string;
}

const EMAIL_PATTERN = /^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/;

/**
 * Resolves a provider's `contact` string to a channel and a link.
 *
 * @param params.contact - The `contact` field of the directory payload.
 * @returns The channel, the href and the readable display value.
 */
export function resolveProviderContact({
    contact
}: {
    readonly contact: string;
}): ResolvedProviderContact {
    const display = contact.trim();

    if (display.toLowerCase().startsWith('mailto:')) {
        return { channel: 'email', href: display, display: display.slice('mailto:'.length) };
    }
    if (EMAIL_PATTERN.test(display)) {
        return { channel: 'email', href: `mailto:${display}`, display };
    }

    const href = resolveContactHref(display);
    if (href.startsWith('tel:')) return { channel: 'phone', href, display };

    // `href` already passed the shared scheme allow-list inside
    // `resolveContactHref`; only the host decides the channel here.
    if (isWhatsAppHost({ href })) {
        const url = new URL(href);
        const phone =
            url.hostname === 'wa.me'
                ? url.pathname.slice(1) || url.searchParams.get('phone')
                : url.searchParams.get('phone');
        const digits = phone?.replace(/^\+/, '');
        // Only numeric recipient links are phone numbers; invitation links stay URLs.
        if (digits && /^\d{7,15}$/.test(digits)) {
            const formatted = digits
                .replace(/^54(9?)(11)(\d{4})(\d{4})$/, '+54 $1 $2 $3-$4')
                .replace(/^54(9?)(\d{4})(\d{6})$/, '+54 $1 $2 $3')
                .replace(/\s+/g, ' ');
            return {
                channel: 'whatsapp',
                href,
                display: formatted.startsWith('+') ? formatted : `+${digits}`
            };
        }
        return { channel: 'whatsapp', href, display };
    }
    return { channel: 'web', href, display };
}

const WHATSAPP_HOSTS: ReadonlySet<string> = new Set([
    'wa.me',
    'api.whatsapp.com',
    'chat.whatsapp.com'
]);

function isWhatsAppHost({ href }: { readonly href: string }): boolean {
    try {
        return WHATSAPP_HOSTS.has(new URL(href).hostname.toLowerCase());
    } catch {
        return false;
    }
}
