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
