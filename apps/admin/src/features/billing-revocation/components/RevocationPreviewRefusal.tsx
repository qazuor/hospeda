/**
 * @file RevocationPreviewRefusal.tsx
 * What the revocation screen (HOS-1678) shows when the preview is refused or
 * cannot be read. None of these states offers a note or a confirm button:
 *
 *  - 404 and 403 (by status, H15), a 5xx or an error without `reason`: the
 *    screen is unavailable;
 *  - a KNOWN `reason`: the revocation is blocked, with that reason's copy.
 *    `REFUND_EXCEEDS_BALANCE` is the Coord-351 block (an open or executed
 *    refund already claims the whole charge, H4);
 *  - an UNKNOWN `reason`: a generic block that shows the code for support (H8).
 */

import type { TranslationKey } from '@repo/i18n';
import { AlertCircleIcon } from '@repo/icons';
import { useTranslations } from '@/hooks/use-translations';
import { isApiError } from '@/lib/errors';
import {
    isKnownRevocationReason,
    REVOCATION_REASON_KEYS,
    readRevocationReason
} from '../revocation-reasons';

/** HTTP status for a subscription that does not exist. */
const NOT_FOUND_STATUS = 404;
/** HTTP status for an actor who may not revoke this subscription. */
const FORBIDDEN_STATUS = 403;
/** First HTTP status of a server failure. */
const SERVER_ERROR_STATUS = 500;

/** How a refused or failed preview reads. */
export type RevocationRefusal =
    | { readonly kind: 'unavailable'; readonly key: TranslationKey }
    | { readonly kind: 'blocked'; readonly reason: string };

/**
 * Classifies the error of the preview.
 *
 * @param input - The error the preview query holds.
 * @returns Whether the screen is unavailable (and which copy) or blocked (and why).
 */
export function classifyRevocationPreviewError({
    error
}: {
    readonly error: unknown;
}): RevocationRefusal {
    const status = isApiError(error) ? error.status : undefined;
    if (status === NOT_FOUND_STATUS) {
        return { kind: 'unavailable', key: 'admin-billing.subscriptionRevocation.notFound' };
    }
    if (status === FORBIDDEN_STATUS) {
        return { kind: 'unavailable', key: 'admin-billing.subscriptionRevocation.forbidden' };
    }
    const reason = readRevocationReason({ error });
    if (reason === null || status === undefined || status >= SERVER_ERROR_STATUS) {
        return { kind: 'unavailable', key: 'admin-billing.subscriptionRevocation.loadError' };
    }
    return { kind: 'blocked', reason };
}

/** Props of {@link RevocationPreviewRefusal}. RO-RO. */
export interface RevocationPreviewRefusalProps {
    /** The error the preview query holds. */
    readonly error: unknown;
}

/**
 * Renders a refused or failed preview, with no way to confirm.
 *
 * @param props - The preview error.
 */
export function RevocationPreviewRefusal({ error }: RevocationPreviewRefusalProps) {
    const { t } = useTranslations();
    const refusal = classifyRevocationPreviewError({ error });

    if (refusal.kind === 'unavailable') {
        return <RevocationUnavailable messageKey={refusal.key} />;
    }

    return (
        <div
            className="space-y-2"
            data-testid="subscription-revocation-blocked"
            data-reason={refusal.reason}
        >
            <p className="flex items-start gap-2 font-medium text-destructive">
                <AlertCircleIcon
                    size={16}
                    className="mt-0.5 shrink-0"
                />
                <span>{t('admin-billing.subscriptionRevocation.blocked.intro')}</span>
            </p>
            <p>
                {isKnownRevocationReason(refusal.reason)
                    ? t(REVOCATION_REASON_KEYS[refusal.reason])
                    : t('admin-billing.subscriptionRevocation.blocked.unknown', {
                          reason: refusal.reason
                      })}
            </p>
        </div>
    );
}

/** Props of {@link RevocationUnavailable}. RO-RO. */
export interface RevocationUnavailableProps {
    /** The copy to show. */
    readonly messageKey: TranslationKey;
}

/**
 * Renders the "unavailable" state: 404, 403 or a preview that could not be read.
 *
 * @param props - The copy key.
 */
export function RevocationUnavailable({ messageKey }: RevocationUnavailableProps) {
    const { t } = useTranslations();
    return <p data-testid="subscription-revocation-unavailable">{t(messageKey)}</p>;
}
