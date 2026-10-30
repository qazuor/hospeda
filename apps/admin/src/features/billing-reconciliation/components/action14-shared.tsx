import type { TranslationKey } from '@repo/i18n';
import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isApiError } from '@/lib/errors';

/** Translation keys for action 14 settlement rejections. */
export const ACTION14_REJECTION_KEYS: Readonly<Record<string, TranslationKey>> = {
    REFUND_AMOUNT_INVALID:
        'admin-billing.reconciliationMarks.action14.rejections.REFUND_AMOUNT_INVALID',
    EXTERNAL_REFERENCE_INVALID:
        'admin-billing.reconciliationMarks.action14.rejections.EXTERNAL_REFERENCE_INVALID',
    REFUND_EXCEEDS_BALANCE:
        'admin-billing.reconciliationMarks.action14.rejections.REFUND_EXCEEDS_BALANCE',
    MANUAL_PAYMENT_SCOPE_REQUIRED:
        'admin-billing.reconciliationMarks.action14.rejections.MANUAL_PAYMENT_SCOPE_REQUIRED',
    MANUAL_PAYMENT_SCOPE_NOT_ALLOWED:
        'admin-billing.reconciliationMarks.action14.rejections.MANUAL_PAYMENT_SCOPE_NOT_ALLOWED',
    REFUND_SOURCE_NOT_FOUND:
        'admin-billing.reconciliationMarks.action14.rejections.REFUND_SOURCE_NOT_FOUND',
    REFUND_NOT_FOUND: 'admin-billing.reconciliationMarks.action14.rejections.REFUND_NOT_FOUND',
    ADMINISTRATIVE_ACTION_FORBIDDEN:
        'admin-billing.reconciliationMarks.action14.rejections.ADMINISTRATIVE_ACTION_FORBIDDEN',
    PAYMENT_NOT_REFUNDABLE:
        'admin-billing.reconciliationMarks.action14.rejections.PAYMENT_NOT_REFUNDABLE',
    REQUESTED_AMOUNT_MISMATCH:
        'admin-billing.reconciliationMarks.action14.rejections.REQUESTED_AMOUNT_MISMATCH',
    OPEN_REQUESTS_AMBIGUOUS:
        'admin-billing.reconciliationMarks.action14.rejections.OPEN_REQUESTS_AMBIGUOUS',
    REFUND_NOT_OPEN: 'admin-billing.reconciliationMarks.action14.rejections.REFUND_NOT_OPEN',
    REFUND_STATE_CHANGED:
        'admin-billing.reconciliationMarks.action14.rejections.REFUND_STATE_CHANGED',
    EXTERNAL_REFERENCE_ALREADY_SETTLED:
        'admin-billing.reconciliationMarks.action14.rejections.EXTERNAL_REFERENCE_ALREADY_SETTLED',
    RETAINED_PAYMENT_SUCCESSION_OPEN:
        'admin-billing.reconciliationMarks.action14.rejections.RETAINED_PAYMENT_SUCCESSION_OPEN',
    CHARGE_NOT_FOUND: 'admin-billing.reconciliationMarks.action14.rejections.CHARGE_NOT_FOUND',
    CHARGE_NOT_LINKED: 'admin-billing.reconciliationMarks.action14.rejections.CHARGE_NOT_LINKED',
    CHARGE_NOT_SETTLEABLE:
        'admin-billing.reconciliationMarks.action14.rejections.CHARGE_NOT_SETTLEABLE',
    CHARGE_NOT_APPROVED:
        'admin-billing.reconciliationMarks.action14.rejections.CHARGE_NOT_APPROVED',
    CHARGE_ALREADY_RECORDED:
        'admin-billing.reconciliationMarks.action14.rejections.CHARGE_ALREADY_RECORDED'
};

/** Maps an action 14 error to its existing localized message. */
export function readAction14Rejection({ error }: { readonly error: unknown }): TranslationKey {
    if (isApiError(error) && error.status >= 500)
        return 'admin-billing.reconciliationMarks.action14.serverError';
    const payload = isApiError(error) ? error.body : null;
    const reason =
        (payload as { error?: { reason?: string }; reason?: string } | null)?.error?.reason ??
        (payload as { reason?: string } | null)?.reason;
    return (
        (reason ? ACTION14_REJECTION_KEYS[reason] : undefined) ??
        'admin-billing.reconciliationMarks.action14.genericError'
    );
}

/** Renders one labeled action 14 input. */
export function Action14Field({
    label,
    value,
    onChange,
    type = 'text'
}: {
    readonly label: string;
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly type?: string;
}) {
    const id = useId();
    return (
        <div className="space-y-1">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}
