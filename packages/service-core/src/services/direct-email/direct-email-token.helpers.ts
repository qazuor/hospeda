/**
 * @module direct-email-token.helpers
 *
 * Opt-out tokens of the direct email footer link (HOS-2685).
 *
 * The token is opaque: 32 random bytes, base64url. It is stored on the recipient row
 * (`direct_email_recipient.opt_out_token`, unique) and the public opt-out looks the row
 * up by it. It carries no address and no signature, so nothing in the link (which ends
 * up in mail archives, proxy logs and analytics) reveals who it was sent to, and no
 * secret or rotation is involved. Tokens do not expire: an opt-out link must keep working.
 */

import { randomBytes } from 'node:crypto';

/**
 * Token of the opt-out link in test sends and previews. No recipient row has it, so the
 * public endpoints answer the invalid-token response: the link renders but does nothing.
 */
export const DIRECT_EMAIL_NON_FUNCTIONAL_OPT_OUT_TOKEN = 'test';

/**
 * Generates the opt-out token of one recipient.
 *
 * @returns 43 URL-safe characters (256 bits of randomness)
 */
export function generateDirectEmailOptOutToken(): string {
    return randomBytes(32).toString('base64url');
}

/**
 * Masks the local part of an address for display on the public opt-out page.
 *
 * @param email - The address
 * @returns For example `j***@example.com`
 */
export function maskEmail(email: string): string {
    const at = email.lastIndexOf('@');
    if (at <= 0) return '***';
    return `${email.slice(0, 1)}***${email.slice(at)}`;
}

/**
 * Builds the web opt-out page URL of a token: `/{locale}/correos/baja/?token=...`.
 *
 * @param input.siteUrl - Web origin, with or without trailing slash
 * @param input.token - The opt-out token
 * @param input.locale - Page locale (default `es`)
 * @returns The absolute URL
 */
export function buildDirectEmailOptOutUrl(input: {
    readonly siteUrl: string;
    readonly token: string;
    readonly locale?: string;
}): string {
    const origin = input.siteUrl.replace(/\/+$/, '');
    return `${origin}/${input.locale ?? 'es'}/correos/baja/?token=${encodeURIComponent(input.token)}`;
}
