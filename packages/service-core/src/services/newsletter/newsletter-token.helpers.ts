/**
 * Newsletter HMAC token helpers (SPEC-101 T-101-10).
 *
 * Pure, dependency-free token generation and verification used by the
 * subscribe / verify / unsubscribe flows. No DB, no I/O — services pass in
 * the secret(s) and the helpers stick to crypto primitives.
 *
 * Two token shapes:
 *
 *   1. Verification token — short-lived (default 72h TTL). Embeds an issued-at
 *      timestamp so the API can enforce expiry without a DB round-trip.
 *
 *   2. Unsubscribe token  — stable, deterministic, never expires. The same
 *      (subscriberId, channel) pair always yields the same token under a
 *      given secret. Lets us inject it into every campaign email footer
 *      without rotating tokens between sends.
 *
 * Both tokens are base64url-encoded `<payload>.<signature>` strings. The
 * signature is HMAC-SHA256 over the payload bytes and is compared with
 * `timingSafeEqual` to defeat timing attacks.
 *
 * Key rotation: pass `secretPrev` as a second-chance secret. Verification
 * first tries `secret`, falls back to `secretPrev` if provided. This matches
 * the HOSPEDA_NEWSLETTER_HMAC_SECRET / HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV
 * env var pair specified in tech-analysis §9.1.
 *
 * @module services/newsletter/newsletter-token.helpers
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

/** Base class for newsletter token failures so callers can `instanceof`. */
export class NewsletterTokenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'NewsletterTokenError';
    }
}

/** Thrown when a token cannot be parsed, signature does not match, or fields are missing. */
export class InvalidTokenError extends NewsletterTokenError {
    constructor(message = 'Invalid newsletter token') {
        super(message);
        this.name = 'InvalidTokenError';
    }
}

/** Thrown when a verification token's `iat` is older than the configured TTL. */
export class TokenExpiredError extends NewsletterTokenError {
    constructor(message = 'Newsletter verification token expired') {
        super(message);
        this.name = 'TokenExpiredError';
    }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Channel discriminator embedded in tokens. Mirrors NewsletterChannelEnum values. */
export type NewsletterTokenChannel = 'email' | 'whatsapp';

/** Decoded payload of a verification token. */
interface VerificationTokenPayload {
    /** Subscriber UUID. */
    sid: string;
    /** Channel (always 'email' in MVP). */
    ch: NewsletterTokenChannel;
    /** Issued-at, seconds since epoch. */
    iat: number;
}

/** Decoded payload of an unsubscribe token. No `iat` — stable across time. */
interface UnsubscribeTokenPayload {
    sid: string;
    ch: NewsletterTokenChannel;
}

/** Shared shape returned by both `verifyVerificationToken` and `verifyUnsubscribeToken`. */
export interface NewsletterTokenPayload {
    subscriberId: string;
    channel: NewsletterTokenChannel;
}

// ---------------------------------------------------------------------------
// Internal encoding helpers
// ---------------------------------------------------------------------------

const DEFAULT_VERIFICATION_TTL_HOURS = 72;

/** Encode a Buffer or string to base64url (no padding). */
function toBase64Url(input: Buffer | string): string {
    const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
    return buf.toString('base64url');
}

/** Decode a base64url string back to a UTF-8 string. Throws on invalid input. */
function fromBase64UrlToUtf8(input: string): string {
    if (!input) throw new InvalidTokenError('Empty token segment');
    return Buffer.from(input, 'base64url').toString('utf8');
}

/** Compute HMAC-SHA256(payload) returning the raw digest buffer. */
function sign(secret: string, payload: string): Buffer {
    return createHmac('sha256', secret).update(payload).digest();
}

/**
 * Constant-time compare between a base64url signature from a token and the
 * candidate digest computed locally. Returns false if lengths differ.
 */
function signaturesMatch(providedB64Url: string, expectedDigest: Buffer): boolean {
    let providedDigest: Buffer;
    try {
        providedDigest = Buffer.from(providedB64Url, 'base64url');
    } catch {
        return false;
    }
    if (providedDigest.length !== expectedDigest.length) return false;
    return timingSafeEqual(providedDigest, expectedDigest);
}

/**
 * Split a token into `[payloadSegment, signatureSegment]`. Throws on shape
 * violations so callers can convert to InvalidTokenError uniformly.
 */
function splitToken(token: string): { payloadSegment: string; signatureSegment: string } {
    if (typeof token !== 'string' || token.length === 0) {
        throw new InvalidTokenError('Token is empty');
    }
    const dotIndex = token.indexOf('.');
    if (dotIndex <= 0 || dotIndex === token.length - 1) {
        throw new InvalidTokenError('Token is malformed');
    }
    return {
        payloadSegment: token.slice(0, dotIndex),
        signatureSegment: token.slice(dotIndex + 1)
    };
}

/**
 * Verify a signature against the candidate secret list. Returns the secret
 * that matched so callers can know whether the rotation path was hit (the
 * value itself is not currently used, but it keeps the door open for
 * structured logging later). Returns null if no secret matches.
 */
function verifySignature(
    payloadSegment: string,
    signatureSegment: string,
    secrets: readonly string[]
): string | null {
    for (const secret of secrets) {
        if (!secret) continue;
        const expected = sign(secret, payloadSegment);
        if (signaturesMatch(signatureSegment, expected)) {
            return secret;
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Verification token (short-lived, TTL-checked)
// ---------------------------------------------------------------------------

/** Input for {@link generateVerificationToken}. */
export interface GenerateVerificationTokenInput {
    subscriberId: string;
    channel: NewsletterTokenChannel;
    /** Issue time — defaults to now. Exposed for deterministic tests. */
    issuedAt?: Date;
    secret: string;
}

/**
 * Generate a verification token. The `iat` field anchors the TTL check
 * performed at verify time.
 */
export function generateVerificationToken(input: GenerateVerificationTokenInput): string {
    const { subscriberId, channel, secret } = input;
    if (!secret) throw new InvalidTokenError('Missing newsletter HMAC secret');
    const iat = Math.floor((input.issuedAt ?? new Date()).getTime() / 1000);
    const payload: VerificationTokenPayload = { sid: subscriberId, ch: channel, iat };
    const payloadSegment = toBase64Url(JSON.stringify(payload));
    const signatureSegment = toBase64Url(sign(secret, payloadSegment));
    return `${payloadSegment}.${signatureSegment}`;
}

/** Input for {@link verifyVerificationToken}. */
export interface VerifyVerificationTokenInput {
    token: string;
    secret: string;
    /** Optional previous secret for graceful key rotation. */
    secretPrev?: string;
    /** Override the default 72h TTL window. */
    ttlHours?: number;
    /** Clock injection for tests. Defaults to `new Date()`. */
    now?: Date;
}

/**
 * Verify a verification token. Throws `InvalidTokenError` on shape or
 * signature failures and `TokenExpiredError` when `iat + ttlHours < now`.
 */
export function verifyVerificationToken(
    input: VerifyVerificationTokenInput
): NewsletterTokenPayload {
    const { token, secret, secretPrev } = input;
    const ttlHours = input.ttlHours ?? DEFAULT_VERIFICATION_TTL_HOURS;
    const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);

    const { payloadSegment, signatureSegment } = splitToken(token);
    const candidateSecrets = secretPrev ? [secret, secretPrev] : [secret];
    if (verifySignature(payloadSegment, signatureSegment, candidateSecrets) === null) {
        throw new InvalidTokenError('Verification token signature mismatch');
    }

    let payload: VerificationTokenPayload;
    try {
        const parsed = JSON.parse(fromBase64UrlToUtf8(payloadSegment));
        if (
            typeof parsed !== 'object' ||
            parsed === null ||
            typeof parsed.sid !== 'string' ||
            typeof parsed.ch !== 'string' ||
            typeof parsed.iat !== 'number'
        ) {
            throw new Error('shape');
        }
        payload = parsed as VerificationTokenPayload;
    } catch {
        throw new InvalidTokenError('Verification token payload malformed');
    }

    if (payload.ch !== 'email' && payload.ch !== 'whatsapp') {
        throw new InvalidTokenError('Verification token has unknown channel');
    }

    const ttlSeconds = ttlHours * 60 * 60;
    if (nowSeconds - payload.iat > ttlSeconds) {
        throw new TokenExpiredError();
    }
    if (payload.iat - nowSeconds > 60) {
        // Future-issued tokens beyond a one-minute skew are treated as invalid,
        // not expired — most likely a tampered payload.
        throw new InvalidTokenError('Verification token issued in the future');
    }

    return { subscriberId: payload.sid, channel: payload.ch };
}

// ---------------------------------------------------------------------------
// Unsubscribe token (stable, never expires)
// ---------------------------------------------------------------------------

/** Input for {@link generateUnsubscribeToken}. */
export interface GenerateUnsubscribeTokenInput {
    subscriberId: string;
    channel: NewsletterTokenChannel;
    secret: string;
}

/**
 * Generate a stable unsubscribe token for a subscriber+channel pair.
 *
 * Determinism note: the payload has no time component, so the same input
 * under the same secret always produces the same token. Rotating the secret
 * invalidates old footer links — handle via `secretPrev` at verify time.
 */
export function generateUnsubscribeToken(input: GenerateUnsubscribeTokenInput): string {
    const { subscriberId, channel, secret } = input;
    if (!secret) throw new InvalidTokenError('Missing newsletter HMAC secret');
    const payload: UnsubscribeTokenPayload = { sid: subscriberId, ch: channel };
    const payloadSegment = toBase64Url(JSON.stringify(payload));
    const signatureSegment = toBase64Url(sign(secret, payloadSegment));
    return `${payloadSegment}.${signatureSegment}`;
}

/** Input for {@link verifyUnsubscribeToken}. */
export interface VerifyUnsubscribeTokenInput {
    token: string;
    secret: string;
    /** Optional previous secret for graceful key rotation. */
    secretPrev?: string;
}

/**
 * Verify an unsubscribe token. Throws `InvalidTokenError` on any failure —
 * unlike the verification token, there is no expiry path.
 */
export function verifyUnsubscribeToken(input: VerifyUnsubscribeTokenInput): NewsletterTokenPayload {
    const { token, secret, secretPrev } = input;
    const { payloadSegment, signatureSegment } = splitToken(token);
    const candidateSecrets = secretPrev ? [secret, secretPrev] : [secret];
    if (verifySignature(payloadSegment, signatureSegment, candidateSecrets) === null) {
        throw new InvalidTokenError('Unsubscribe token signature mismatch');
    }

    let payload: UnsubscribeTokenPayload;
    try {
        const parsed = JSON.parse(fromBase64UrlToUtf8(payloadSegment));
        if (
            typeof parsed !== 'object' ||
            parsed === null ||
            typeof parsed.sid !== 'string' ||
            typeof parsed.ch !== 'string'
        ) {
            throw new Error('shape');
        }
        payload = parsed as UnsubscribeTokenPayload;
    } catch {
        throw new InvalidTokenError('Unsubscribe token payload malformed');
    }

    if (payload.ch !== 'email' && payload.ch !== 'whatsapp') {
        throw new InvalidTokenError('Unsubscribe token has unknown channel');
    }

    return { subscriberId: payload.sid, channel: payload.ch };
}
