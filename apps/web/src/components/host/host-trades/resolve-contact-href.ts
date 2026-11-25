/** The shared scheme allow-list for provider-authored contact values. */
import { resolveSafeExternalUrl } from '@/lib/safe-external-url';

/** Resolves a stored web/WhatsApp contact or phone number to a safe href. */
export function resolveContactHref(contact: string): string {
    const trimmed = contact.trim();
    const externalHref = resolveSafeExternalUrl(trimmed);
    if (externalHref) return externalHref;
    if (trimmed.startsWith('tel:')) return trimmed;
    if (trimmed.startsWith('wa.me/') || trimmed.startsWith('wa.me?')) {
        const waHref = resolveSafeExternalUrl(`https://${trimmed}`);
        if (waHref) return waHref;
    }
    return `tel:${trimmed.replace(/[\s\-()]/g, '')}`;
}
