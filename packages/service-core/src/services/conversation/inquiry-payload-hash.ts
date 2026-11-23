/**
 * Binds an anonymous inquiry to the verification link that confirms it (HOS-2568).
 *
 * An unauthenticated submit only needs an email address, so anyone can park a payload on a
 * `PENDING_VERIFICATION` row under somebody else's email. If the link the victim later
 * clicks delivered whatever the row holds, the host would receive the attacker's text under
 * the victim's name and verified email. To prevent it, the link carries a hash of the exact
 * payload it was issued for, and verification delivers the stored payload only when the hash
 * still matches. Last submission wins on the row; an older link can never deliver newer text
 * and a newer link can never deliver older text.
 *
 * @module services/conversation/inquiry-payload-hash
 */
import { createHash, timingSafeEqual } from 'node:crypto';

/** The guest-supplied fields that are held until the email is verified. */
export interface InquiryPayload {
    /** Opening message text. */
    readonly message: string;
    /** Display name typed by the guest. */
    readonly guestName: string;
    /** Optional phone typed by the guest. */
    readonly guestPhone?: string | null;
    /** Declared check-in date (`YYYY-MM-DD`). */
    readonly checkIn?: string | null;
    /** Declared check-out date (`YYYY-MM-DD`). */
    readonly checkOut?: string | null;
    /** Declared guest count. */
    readonly guests?: number | null;
}

/**
 * Computes the SHA-256 (hex) of a canonical serialization of an inquiry payload.
 *
 * The serialization is a fixed-order JSON array with `null` for absent values, so equal
 * payloads always hash equally and no field boundary can be forged by moving text between
 * adjacent fields.
 *
 * @param input - `{ payload }` the held guest-supplied fields.
 * @returns `{ hash }` lowercase hex SHA-256.
 *
 * @example
 * ```ts
 * const { hash } = computeInquiryPayloadHash({ payload: { message: 'Hola', guestName: 'Ana' } });
 * ```
 */
export function computeInquiryPayloadHash({ payload }: { readonly payload: InquiryPayload }): {
    readonly hash: string;
} {
    const canonical = JSON.stringify([
        payload.message,
        payload.guestName,
        payload.guestPhone ?? null,
        payload.checkIn ?? null,
        payload.checkOut ?? null,
        payload.guests ?? null
    ]);
    return { hash: createHash('sha256').update(canonical, 'utf8').digest('hex') };
}

/**
 * Constant-time comparison of two hex hashes.
 *
 * @param input - `{ expected, actual }`; `actual` may be absent (token without the claim).
 * @returns `{ matches }` true only when both are present, equal in length and equal.
 */
export function inquiryHashesMatch({
    expected,
    actual
}: {
    readonly expected: string;
    readonly actual: unknown;
}): { readonly matches: boolean } {
    if (typeof actual !== 'string' || actual.length !== expected.length) {
        return { matches: false };
    }
    return {
        matches: timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(actual, 'utf8'))
    };
}
