/**
 * Sentry utility functions
 * @module utils/sentry
 */

/**
 * Builds a Sentry CSP report URI from a Sentry DSN.
 * Sentry accepts CSP violation reports at its security endpoint.
 *
 * @see https://docs.sentry.io/platforms/javascript/security-policy-reporting/
 *
 * DSN format: `https://{key}@{host}/{project_id}`
 * Report URI: `https://{host}/api/{project_id}/security/?sentry_key={key}`
 *
 * @param params - Object containing the Sentry DSN string
 * @param params.dsn - The Sentry DSN to parse
 * @returns The report URI string, or null if the DSN is invalid or missing required parts
 */
export function buildSentryReportUri({ dsn }: { dsn: string }): string | null {
    try {
        const url = new URL(dsn);
        const key = url.username;
        const projectId = url.pathname.replace(/\//g, '');
        const host = url.hostname;

        if (!key || !projectId || !host) {
            return null;
        }

        return `https://${host}/api/${projectId}/security/?sentry_key=${key}`;
    } catch {
        return null;
    }
}

/**
 * Anonymizes an email address for Sentry, keeping only the domain
 * (e.g. `"user@example.com"` -> `"***@example.com"`).
 *
 * Used before attaching a user's email to Sentry scope/context so PII never
 * leaves the app, while the domain remains available for triage (e.g.
 * spotting a spike of errors from one customer's email domain).
 *
 * Malformed addresses with more than one `@` (e.g. `"a@b@c.com"`) are
 * anonymized using the LAST `@`-delimited segment as the domain, matching
 * how mail clients / RFC 5321 treat the final `@` as the actual domain
 * separator.
 *
 * @param email - Email address to anonymize
 * @returns Anonymized email (e.g. `"***@example.com"`), or `"***"` if the
 *   address has no `@` at all
 */
export function anonymizeEmail(email: string): string {
    const lastAtIndex = email.lastIndexOf('@');
    if (lastAtIndex === -1) {
        return '***';
    }
    const domain = email.slice(lastAtIndex + 1);
    return domain ? `***@${domain}` : '***';
}
