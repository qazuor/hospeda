import type { TranslationKey } from '@repo/i18n';
import { isApiError } from '@/lib/errors';

export const GRANT_REFUSAL_KEYS: Readonly<Record<string, TranslationKey>> = {
    ADMINISTRATIVE_ACTION_FORBIDDEN:
        'admin-billing.permanentGrants.refusals.ADMINISTRATIVE_ACTION_FORBIDDEN',
    PERMANENT_GRANT_NOT_FOUND: 'admin-billing.permanentGrants.refusals.PERMANENT_GRANT_NOT_FOUND',
    PERMANENT_GRANT_NOT_LIVE: 'admin-billing.permanentGrants.refusals.PERMANENT_GRANT_NOT_LIVE',
    PERMANENT_GRANT_VERTICAL_ALREADY_ANCHORED:
        'admin-billing.permanentGrants.refusals.PERMANENT_GRANT_VERTICAL_ALREADY_ANCHORED',
    PERMANENT_GRANT_ALREADY_LIVE:
        'admin-billing.permanentGrants.refusals.PERMANENT_GRANT_ALREADY_LIVE',
    PERMANENT_GRANT_REFERENCE_NOT_FOUND:
        'admin-billing.permanentGrants.refusals.PERMANENT_GRANT_REFERENCE_NOT_FOUND',
    PERMANENT_GRANT_FLOOR_NOT_CURRENT:
        'admin-billing.permanentGrants.refusals.PERMANENT_GRANT_FLOOR_NOT_CURRENT',
    INVALID_PERMANENT_GRANT_INPUT:
        'admin-billing.permanentGrants.refusals.INVALID_PERMANENT_GRANT_INPUT'
};

export function readGrantRefusal(error: unknown): string | null {
    if (!isApiError(error)) return null;
    const reason = (error.body as { error?: { reason?: unknown } } | undefined)?.error?.reason;
    return typeof reason === 'string' && reason.length > 0 ? reason : null;
}
