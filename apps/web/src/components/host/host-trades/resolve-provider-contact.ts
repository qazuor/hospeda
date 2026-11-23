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

import { resolveContactHref } from './TradeCard';

/** The channel a provider's contact resolves to. */
export type ProviderContactChannel = 'phone' | 'whatsapp' | 'email' | 'web';

/** A provider's contact, ready to render as a link. */
export interface ResolvedProviderContact {
    /** Which channel the value is. */
    readonly channel: ProviderContactChannel;
    /** The link to open it. */
    readonly href: string;
    /** The value as the provider wrote it, trimmed. */
    readonly display: string;
}

const EMAIL_PATTERN = /^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/;

/**
 * Resolves a provider's `contact` string to a channel and a link.
 *
 * @param params.contact - The `contact` field of the directory payload.
 * @returns The channel, the href and the trimmed display value.
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
    return { channel: isWhatsAppHost({ href }) ? 'whatsapp' : 'web', href, display };
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
