/**
 * The approval link, sanitized (INV:D10, GUARD:G10, AC:B1:6).
 *
 * `authorize` answers with `approvalUrl`: the provider-hosted page where the
 * customer grants the permission to charge. Measured in production (EX-37,
 * 2026-09-16): the provider hands that link back BROKEN, with an
 * `activation=true` query parameter that opens a "this page does not exist"
 * screen, while the very same link without the parameter opens the normal
 * page. The API answers success with it, so nothing on our side errors: the
 * customer simply never subscribes.
 *
 * So the raw link is never shown. Everything outside this package reads it only
 * through {@link sanitizeApprovalUrl}; GUARD:G10
 * (`scripts/check-approval-url-sanitized.ts`) fails CI on any other read.
 *
 * What "sanitized" means here, and nothing more:
 *
 * 1. The link parses as an absolute URL; otherwise it is refused (`NOT_A_URL`).
 * 2. Its scheme is `https:`; otherwise it is refused (`NOT_HTTPS`). A payment
 *    page served over anything else is not shown to a customer.
 * 3. Every `activation` query parameter is removed, whatever its value (EX-37).
 *    Every other query pair is kept byte for byte, in its order; the rest of
 *    the link is the WHATWG URL serialization of what the provider sent.
 */
import { z } from 'zod';

/** The query parameter EX-37 measured breaking the approval page. */
export const BROKEN_APPROVAL_PARAMETER = 'activation';

/** Why an approval link could not be sanitized. */
export type ApprovalUrlRejection = 'NOT_A_URL' | 'NOT_HTTPS';

/** A link that cannot be shown to a customer, sanitized or not. */
export class ApprovalUrlRejectedError extends Error {
    readonly reason: ApprovalUrlRejection;

    /**
     * @param input.reason - Why the link was refused
     * @param input.message - Human-readable detail
     */
    constructor(input: { readonly reason: ApprovalUrlRejection; readonly message: string }) {
        super(input.message);
        this.name = 'ApprovalUrlRejectedError';
        this.reason = input.reason;
    }
}

const SanitizeApprovalUrlInputSchema = z.object({ approvalUrl: z.string() });

/**
 * Sanitizes the approval link an authorization returned, so it can be shown.
 *
 * Takes the authorize result itself (or any object with its `approvalUrl`), so
 * a caller never has to read the raw field: `sanitizeApprovalUrl(result)`.
 *
 * @param input.approvalUrl - The raw link, as the provider returned it
 * @returns `url`: the link with every `activation` parameter removed
 * @throws {ApprovalUrlRejectedError} When the link is not an absolute `https:` URL
 */
export function sanitizeApprovalUrl(input: { readonly approvalUrl: string }): {
    readonly url: string;
} {
    const { approvalUrl } = SanitizeApprovalUrlInputSchema.parse(input);
    let parsed: URL;
    try {
        parsed = new URL(approvalUrl.trim());
    } catch {
        throw new ApprovalUrlRejectedError({
            reason: 'NOT_A_URL',
            message: 'The approval link is not an absolute URL'
        });
    }
    if (parsed.protocol !== 'https:') {
        throw new ApprovalUrlRejectedError({
            reason: 'NOT_HTTPS',
            message: `The approval link uses ${parsed.protocol}, not https:`
        });
    }
    parsed.search = withoutParameter({
        search: parsed.search,
        name: BROKEN_APPROVAL_PARAMETER
    });
    return { url: parsed.href };
}

/**
 * The query string without every pair named `name`. Works on the raw pairs, so
 * the ones it keeps are not re-encoded (`URLSearchParams` would rewrite them).
 */
function withoutParameter(input: { readonly search: string; readonly name: string }): string {
    const kept = input.search
        .replace(/^\?/, '')
        .split('&')
        .filter((pair) => pair !== '' && pairName({ pair }) !== input.name);
    return kept.length === 0 ? '' : `?${kept.join('&')}`;
}

/** The decoded name of one `name=value` pair (the raw name if it does not decode). */
function pairName(input: { readonly pair: string }): string {
    const raw = (input.pair.split('=')[0] ?? '').replace(/\+/g, ' ');
    try {
        return decodeURIComponent(raw);
    } catch {
        return raw;
    }
}
