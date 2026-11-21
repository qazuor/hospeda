/** Resolves supported public partner contact fields to native links, keeping other rows as text. */
export function resolvePartnerContactLink({
    field,
    value
}: {
    readonly field: string;
    readonly value: string;
}): { readonly href: string; readonly channel: 'phone' | 'email' } | undefined {
    switch (field) {
        case 'homePhone':
        case 'workPhone':
        case 'mobilePhone': {
            const digits = value.replace(/\D/g, '');
            const prefix = value.trimStart().startsWith('+') ? '+' : '';
            return digits ? { href: `tel:${prefix}${digits}`, channel: 'phone' } : undefined;
        }
        case 'personalEmail':
        case 'workEmail': {
            const email = value.trim();
            // Keep mailto query and fragment delimiters out of the recipient value.
            const recipient = email.replace(/[%?#]/g, encodeURIComponent);
            return recipient ? { href: `mailto:${recipient}`, channel: 'email' } : undefined;
        }
        default:
            return undefined;
    }
}
