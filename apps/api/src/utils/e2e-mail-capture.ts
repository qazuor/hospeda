/** Local-only configuration for routing outbox mail to an E2E capture server. */

/** Ensures mail capture is restricted to local site and capture URLs.
 * @param input - The configured capture URL and site URL.
 * @throws Error when either URL host is not local while capture is enabled.
 */
export function assertMailCaptureIsLocal(input: {
    readonly captureUrl: string | undefined;
    readonly siteUrl: string;
}): void {
    if (input.captureUrl === undefined) return;
    const localHosts = new Set(['localhost', '127.0.0.1']);
    if (
        !localHosts.has(new URL(input.siteUrl).hostname) ||
        !localHosts.has(new URL(input.captureUrl).hostname)
    ) {
        throw new Error(
            'HOSPEDA_E2E_MAIL_CAPTURE_URL is only allowed when HOSPEDA_SITE_URL and the capture URL use localhost or 127.0.0.1'
        );
    }
}

/** Resolves the API key and optional capture endpoint for outbox delivery.
 * @param input - The configured provider API key and capture URL.
 * @returns The client configuration, or null when delivery is disabled.
 */
export function resolveOutboxEmailClientConfig(input: {
    readonly apiKey: string | undefined;
    readonly captureUrl: string | undefined;
}): { readonly apiKey: string; readonly baseUrl?: string } | null {
    if (input.captureUrl !== undefined)
        return { apiKey: input.apiKey ?? 'e2e-mail-capture', baseUrl: input.captureUrl };
    if (input.apiKey !== undefined) return { apiKey: input.apiKey };
    return null;
}
