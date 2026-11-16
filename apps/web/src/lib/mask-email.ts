/**
 * @file mask-email.ts
 * @description Pure helper that partially hides an email address so a signed-in
 * account can be recognised on screen without exposing the full address
 * (HOS-2184 OAuth consent page).
 *
 * Browser-safe: no server-only imports.
 *
 * @module mask-email
 */

/** Characters of the local part kept visible, by local-part length. */
function visibleLocalChars({ length }: { readonly length: number }): number {
    if (length >= 6) {
        return 3;
    }
    if (length >= 3) {
        return 1;
    }
    return 0;
}

/**
 * Masks the local part of an email address, keeping the domain.
 *
 * Short local parts reveal less: 6+ characters keep 3, 3 to 5 keep 1, and 1 to
 * 2 keep none, so a one-letter address is never shown whole.
 *
 * @param params.email - The address to mask
 * @returns e.g. `lea***@gmail.com`, or `null` when the value is not an address
 *
 * @example
 * ```ts
 * maskEmail({ email: 'leandro@gmail.com' }); // 'lea***@gmail.com'
 * maskEmail({ email: 'ab@x.com' }); // '***@x.com'
 * ```
 */
export function maskEmail({ email }: { readonly email: unknown }): string | null {
    if (typeof email !== 'string') {
        return null;
    }
    const trimmed = email.trim();
    const at = trimmed.lastIndexOf('@');
    if (at < 1 || at === trimmed.length - 1) {
        return null;
    }
    const local = trimmed.slice(0, at);
    const domain = trimmed.slice(at + 1);
    const visible = visibleLocalChars({ length: local.length });
    return `${local.slice(0, visible)}***@${domain}`;
}
