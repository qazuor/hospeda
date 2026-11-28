/**
 * @file receipt-direct.ts
 * @description Opens one payment receipt PDF straight from the server, with the
 * owner's session (HOS-2682).
 *
 * The «Ver recibo» button of the «Recibimos tu pago» email leads to
 * `/{lang}/mi-cuenta/recibos/{id}/`. That page forwards the visitor's `Cookie`
 * to the API's owner-only PDF route and streams the file back from the web
 * origin, so the browser opens the PDF itself, full page, with no account page
 * around it. A cross-origin `<a href>` to the API could not do this: the API is
 * another origin and the link would travel without the session.
 *
 * The API answers 404 for a receipt that does not exist AND for one that is
 * somebody else's (`apps/api/docs/error-contract.md`), and this module keeps
 * that: both become `notFound`, as does a malformed id, so nothing here reveals
 * whether an id exists.
 */

import { getApiUrl, getInternalApiUrl, getInternalRequestSecret } from '@/lib/env';

/**
 * The id shape the API's `z.string().uuid()` accepts, so a malformed id is a
 * «not found» here and never a 400 there.
 */
const RECEIPT_ID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** How long the server waits for the API to render the PDF. */
const RECEIPT_TIMEOUT_MS = 15_000;

/**
 * Whether a route param is a well-formed receipt id.
 *
 * @param params.value - The raw route param.
 * @returns `true` only for a UUID the API would accept.
 */
export function isReceiptId({ value }: { readonly value: string | undefined }): boolean {
    return typeof value === 'string' && RECEIPT_ID_PATTERN.test(value);
}

/** What opening a receipt resulted in. */
export type ReceiptDirectOutcome =
    /** The PDF, ready to be returned to the browser as is. */
    | { readonly kind: 'pdf'; readonly response: Response }
    /** Missing, somebody else's, or malformed: one answer for all three. */
    | { readonly kind: 'notFound' }
    /** The session the middleware saw is no longer valid at the API. */
    | { readonly kind: 'signIn' }
    /** Anything else: the API failed or could not be reached. */
    | { readonly kind: 'error' };

/**
 * Fetches the owner's receipt PDF from the API and wraps it for the browser.
 *
 * @param params.receiptId - The receipt id from the route.
 * @param params.cookieHeader - The visitor's raw `Cookie` header.
 * @param params.fetchImpl - Injected `fetch`, for tests.
 * @returns The outcome; never throws.
 */
export async function openOwnReceiptPdf({
    receiptId,
    cookieHeader,
    fetchImpl = fetch
}: {
    readonly receiptId: string | undefined;
    readonly cookieHeader: string | undefined;
    readonly fetchImpl?: typeof fetch;
}): Promise<ReceiptDirectOutcome> {
    if (!receiptId || !isReceiptId({ value: receiptId })) return { kind: 'notFound' };
    if (!cookieHeader) return { kind: 'signIn' };

    const internal = getInternalApiUrl();
    const base = internal ?? getApiUrl();
    const headers: Record<string, string> = { cookie: cookieHeader, Accept: 'application/pdf' };
    // Same rule as the API client (HOS-103): the shared secret only travels over
    // the internal network, so it can never leak through the public URL.
    const secret = internal ? getInternalRequestSecret() : undefined;
    if (secret) headers['X-Internal-Request'] = secret;

    let upstream: Response;
    try {
        upstream = await fetchImpl(
            `${base}/api/v1/protected/billing-subscription/receipts/${encodeURIComponent(receiptId)}/pdf`,
            { headers, signal: AbortSignal.timeout(RECEIPT_TIMEOUT_MS) }
        );
    } catch {
        return { kind: 'error' };
    }

    if (upstream.status === 404 || upstream.status === 400) return { kind: 'notFound' };
    if (upstream.status === 401) return { kind: 'signIn' };
    const contentType = upstream.headers.get('content-type') ?? '';
    if (!upstream.ok || !contentType.includes('application/pdf') || !upstream.body) {
        return { kind: 'error' };
    }

    const outgoing = new Headers({
        'Content-Type': 'application/pdf',
        // A receipt names a private person: never stored by any cache.
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff'
    });
    const disposition = upstream.headers.get('content-disposition');
    if (disposition) outgoing.set('Content-Disposition', disposition);
    const length = upstream.headers.get('content-length');
    if (length) outgoing.set('Content-Length', length);

    return {
        kind: 'pdf',
        response: new Response(upstream.body, { status: 200, headers: outgoing })
    };
}
