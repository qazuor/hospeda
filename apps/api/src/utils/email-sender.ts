/**
 * Deployment-aware email sender decoration.
 *
 * Staging and production send from the same provider, the same domain and the
 * same templates, so a message that lands in a personal inbox is otherwise
 * indistinguishable between the two. That ambiguity is dangerous: a
 * "your plan renews tomorrow" notice read as production when it came from
 * staging (or the reverse) leads to acting on the wrong environment.
 *
 * This module derives a visible marker from `HOSPEDA_DEPLOY_ENV` and applies
 * it to both the sender display name and the subject line, so the origin is
 * readable from the inbox list without opening the message.
 *
 * The derivation is deliberately fail-safe: only an explicitly recognised
 * non-production value produces a marker. An unset or unrecognised
 * `HOSPEDA_DEPLOY_ENV` — including a production deployment where the variable
 * was forgotten — yields the undecorated sender, so a misconfiguration can
 * never surface an internal marker to real customers.
 *
 * @module utils/email-sender
 */

import type { SendEmailInput, SendEmailResult } from '@repo/email';
import { sendEmail } from '@repo/email';
import { env } from './env';

/**
 * Markers applied per deploy environment.
 *
 * `prod` is intentionally absent: production must never be decorated. `test`
 * is intentionally absent as well — the test environment does not deliver to
 * real inboxes, and decorating it would change subjects that assertions in the
 * existing suites depend on.
 */
const DEPLOY_ENV_MARKERS: Readonly<Record<string, string>> = {
    preview: 'STAGING',
    dev: 'DEV'
};

/**
 * Input for {@link buildEmailEnvDecoration}.
 */
export interface BuildEmailEnvDecorationInput {
    /** Raw `HOSPEDA_DEPLOY_ENV` value. Unset and unknown values are treated as production. */
    readonly deployEnv?: string | undefined;

    /** Undecorated sender display name, e.g. `Hospeda`. */
    readonly baseFromName: string;
}

/**
 * Result of {@link buildEmailEnvDecoration}.
 */
export interface EmailEnvDecoration {
    /** Sender display name to hand to the transport, decorated when applicable. */
    readonly fromName: string;

    /**
     * Prefix to prepend to every subject line, including its trailing space.
     * `undefined` on production, so callers can pass it through untouched.
     */
    readonly subjectPrefix: string | undefined;
}

/**
 * Derives the environment marker for outbound email.
 *
 * @param input - Deploy environment and the undecorated sender name
 * @returns The decorated sender name and the subject prefix (or `undefined` on production)
 *
 * @example
 * ```ts
 * buildEmailEnvDecoration({ deployEnv: 'preview', baseFromName: 'Hospeda' });
 * // → { fromName: 'Hospeda [STAGING]', subjectPrefix: '[STAGING] ' }
 *
 * buildEmailEnvDecoration({ deployEnv: 'prod', baseFromName: 'Hospeda' });
 * // → { fromName: 'Hospeda', subjectPrefix: undefined }
 * ```
 */
export function buildEmailEnvDecoration(input: BuildEmailEnvDecorationInput): EmailEnvDecoration {
    const { deployEnv, baseFromName } = input;
    const marker = deployEnv ? DEPLOY_ENV_MARKERS[deployEnv] : undefined;

    if (!marker) {
        return { fromName: baseFromName, subjectPrefix: undefined };
    }

    return {
        fromName: `${baseFromName} [${marker}]`,
        subjectPrefix: `[${marker}] `
    };
}

/**
 * Resolves the sender configuration for the running deployment.
 *
 * Reads `HOSPEDA_EMAIL_FROM_EMAIL` / `HOSPEDA_EMAIL_FROM_NAME` and applies the
 * environment marker derived from `HOSPEDA_DEPLOY_ENV`. Every outbound email
 * path in this app must obtain its sender here rather than hardcoding one, so
 * the marker cannot be missed by a single call site.
 *
 * @returns Sender email, decorated sender name, and the subject prefix
 */
export function getEmailSender(): {
    readonly fromEmail: string;
    readonly fromName: string;
    readonly subjectPrefix: string | undefined;
} {
    const decoration = buildEmailEnvDecoration({
        deployEnv: env.HOSPEDA_DEPLOY_ENV,
        baseFromName: env.HOSPEDA_EMAIL_FROM_NAME ?? 'Hospeda'
    });

    return {
        fromEmail: env.HOSPEDA_EMAIL_FROM_EMAIL ?? 'noreply@hospeda.com.ar',
        fromName: decoration.fromName,
        subjectPrefix: decoration.subjectPrefix
    };
}

/**
 * Sends a transactional email with the deployment marker already applied.
 *
 * This is the only sanctioned entry point for `@repo/email` inside this app —
 * a static guard rejects direct `sendEmail` imports outside this module, since
 * calling the package directly silently drops the environment marker.
 *
 * @param input - Standard send input minus the sender fields, which are resolved here
 * @returns The provider result, unchanged
 */
export async function sendAppEmail(
    input: Omit<SendEmailInput, 'fromEmail' | 'fromName'>
): Promise<SendEmailResult> {
    const { fromEmail, fromName, subjectPrefix } = getEmailSender();

    return sendEmail({
        ...input,
        subject: subjectPrefix ? `${subjectPrefix}${input.subject}` : input.subject,
        fromEmail,
        fromName
    });
}
