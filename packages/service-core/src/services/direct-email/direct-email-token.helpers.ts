/**
 * @module direct-email-token.helpers
 *
 * Opt-out tokens of the direct email footer link (HOS-2685).
 *
 * Token = `<base64url(lowercased email)>.<base64url(HMAC-SHA256)>`, where the HMAC is
 * computed over `direct-email-opt-out:<lowercased email>` with the newsletter HMAC
 * secret. The prefix domain-separates it from the newsletter tokens (whose signature
 * covers the payload segment itself), so a newsletter token never verifies here and
 * no new secret is needed. Tokens do not expire: an opt-out link must keep working.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** Domain separation prefix of the signed message. */
export const DIRECT_EMAIL_OPT_OUT_PREFIX = 'direct-email-opt-out:';

/** A token that is empty, malformed, or whose signature does not match. */
export class DirectEmailTokenError extends Error {
    constructor(message = 'Invalid direct email opt-out token') {
        super(message);
        this.name = 'DirectEmailTokenError';
    }
}

/** Signs the domain-separated message for `email`. */
function sign(secret: string, email: string): Buffer {
    return createHmac('sha256', secret).update(`${DIRECT_EMAIL_OPT_OUT_PREFIX}${email}`).digest();
}

/**
 * Builds the opt-out token of an address.
 *
 * @param input.email - Recipient address (lowercased here)
 * @param input.secret - HMAC secret (`HOSPEDA_NEWSLETTER_HMAC_SECRET`)
 * @returns The signed token
 * @throws {DirectEmailTokenError} when the secret is empty
 */
export function generateDirectEmailOptOutToken(input: {
    readonly email: string;
    readonly secret: string;
}): string {
    if (!input.secret) throw new DirectEmailTokenError('Missing HMAC secret');
    const email = input.email.trim().toLowerCase();
    const payload = Buffer.from(email, 'utf8').toString('base64url');
    return `${payload}.${sign(input.secret, email).toString('base64url')}`;
}

/**
 * Verifies an opt-out token and returns the address it was issued for.
 *
 * The signature is compared in constant time against the current secret and, during a
 * rotation, the previous one.
 *
 * @param input.token - The token from the link
 * @param input.secret - Current HMAC secret
 * @param input.secretPrev - Previous HMAC secret, accepted during rotation
 * @returns The lowercased address
 * @throws {DirectEmailTokenError} on an empty, malformed or forged token
 */
export function verifyDirectEmailOptOutToken(input: {
    readonly token: string;
    readonly secret: string;
    readonly secretPrev?: string;
}): { readonly email: string } {
    const { token } = input;
    if (typeof token !== 'string' || token.length === 0) {
        throw new DirectEmailTokenError('Token is empty');
    }
    const dot = token.indexOf('.');
    if (dot <= 0 || dot === token.length - 1) {
        throw new DirectEmailTokenError('Token is malformed');
    }
    const payloadSegment = token.slice(0, dot);
    const signatureSegment = token.slice(dot + 1);
    const email = Buffer.from(payloadSegment, 'base64url').toString('utf8');
    if (email.length === 0 || email !== email.toLowerCase()) {
        throw new DirectEmailTokenError('Token is malformed');
    }
    const provided = Buffer.from(signatureSegment, 'base64url');
    const secrets = [input.secret, input.secretPrev].filter(
        (secret): secret is string => typeof secret === 'string' && secret.length > 0
    );
    for (const secret of secrets) {
        const expected = sign(secret, email);
        if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
            return { email };
        }
    }
    throw new DirectEmailTokenError('Token signature mismatch');
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
 * @param input.token - The signed token
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
