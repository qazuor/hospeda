import { SIGNUP_DECLINED_SUBJECT, SignupDeclined } from '../../templates/billing/index.js';
import { resolveSignupDeclinedMessage } from './signup-declined-reason.js';

/**
 * Renders the `billing.signup-declined` outbox mail (S16, HOS-1675, HOS-1618, HOS-2193).
 *
 * `planName` is optional because rows queued before HOS-2193 carry none (absent or null): they
 * name only the vertical. A present but blank or non-string `planName` is invalid.
 *
 * @param input.data - The already-validated object payload of the outbox row.
 * @param input.subscriptionUrl - Absolute link to Mi Suscripcion.
 * @returns The subject and the React body.
 * @throws {TypeError} When a required payload field is missing or malformed.
 */
export function signupDeclined(input: {
    readonly data: Record<string, unknown>;
    readonly subscriptionUrl: string;
}) {
    const { data, subscriptionUrl } = input;
    if (
        typeof data.subscriptionId !== 'string' ||
        data.subscriptionId.trim() === '' ||
        typeof data.vertical !== 'string' ||
        data.vertical.trim() === '' ||
        (data.declineReason !== null && typeof data.declineReason !== 'string') ||
        typeof data.successionPredecessor !== 'boolean' ||
        (data.planName !== undefined &&
            data.planName !== null &&
            (typeof data.planName !== 'string' || data.planName.trim() === ''))
    )
        throw new TypeError('Faltan datos requeridos del aviso de alta rechazada');
    const { cause, retry } = resolveSignupDeclinedMessage({
        declineReason: data.declineReason as string | null,
        successionPredecessor: data.successionPredecessor
    });
    return {
        subject: SIGNUP_DECLINED_SUBJECT,
        react: (
            <SignupDeclined
                vertical={data.vertical}
                planName={typeof data.planName === 'string' ? data.planName : null}
                subscriptionUrl={subscriptionUrl}
                cause={cause}
                retry={retry}
            />
        )
    };
}
