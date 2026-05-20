/**
 * Pure helpers backing the "Contact support" CTA on the forbidden page.
 *
 * Lives in its own module (instead of inside `forbidden.tsx`) so unit tests
 * can import these symbols without evaluating React, environment validation,
 * or any other top-level side effects of the route file.
 *
 * @module routes/auth/forbidden.mailto
 */

/**
 * Hard-coded recipient for the "Contact support" mailto. Lives in source
 * because it never changes per environment and is shown directly in the UI —
 * surfacing it as an env var would invite divergence. Change in one place if
 * the address ever moves.
 */
export const SUPPORT_EMAIL = 'soporte@hospeda.com.ar';

/**
 * The reasons the forbidden page knows how to render — passed through to the
 * support mailto body so the recipient can prioritize the request.
 */
export type ForbiddenReason = 'host-missing-permission' | 'generic';

/**
 * Arguments for {@link buildSupportMailto}. RO-RO.
 */
export interface SupportMailtoArgs {
    readonly email: string | null;
    readonly userId: string | null;
    readonly reason: ForbiddenReason;
    readonly originalPath: string | undefined;
    readonly subjectLine: string;
    readonly bodyTemplate: string;
}

/**
 * Build the `mailto:` href for the "Contact support" CTA. The body template
 * may contain `{email}`, `{userId}`, `{reason}`, and `{originalPath}` tokens
 * which are interpolated here. Missing values render as an em dash so the
 * recipient never receives `null` or `undefined` in the message body.
 *
 * @param args - Arguments object.
 * @returns A fully-formed `mailto:` URL string.
 */
export const buildSupportMailto = (args: SupportMailtoArgs): string => {
    const { email, userId, reason, originalPath, subjectLine, bodyTemplate } = args;
    const body = bodyTemplate
        .replace('{email}', email ?? '—')
        .replace('{userId}', userId ?? '—')
        .replace('{reason}', reason)
        .replace('{originalPath}', originalPath ?? '—');
    const params = new URLSearchParams({
        subject: subjectLine,
        body
    });
    return `mailto:${SUPPORT_EMAIL}?${params.toString()}`;
};
