/**
 * @file StuckRefundPicker.tsx
 * Selector of a stuck refund (HOS-2560), used by «Retry with MP» and the remainder settlement in
 * place of pasting the refund id.
 */

import type { StuckRefund } from '@repo/schemas';
import { type Ref, useId } from 'react';
import { Label } from '@/components/ui/label';
import { useTranslations } from '@/hooks/use-translations';
import { stuckRefundOptionLabel } from '../stuck-refund-format';

/** What a form needs to pick its refund from the stuck-refund list. */
export type StuckRefundPickerProps = {
    /** The stuck refunds on the list's current page. */
    readonly refunds: readonly StuckRefund[];
    /** The selected refund id; empty when none is selected. */
    readonly value: string;
    readonly onChange: (refundId: string) => void;
    /** Lets the list focus this selector when a row's action picks its refund. */
    readonly selectRef?: Ref<HTMLSelectElement>;
};

/** Renders the native selector of stuck refunds. */
export function StuckRefundPicker({ refunds, value, onChange, selectRef }: StuckRefundPickerProps) {
    const { t, locale } = useTranslations();
    const id = useId();
    const now = new Date();
    return (
        <div className="space-y-1 sm:col-span-2">
            <Label htmlFor={id}>{t('admin-billing.proposedRefunds.picker.label')}</Label>
            <select
                id={id}
                ref={selectRef}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={value}
                onChange={(event) => onChange(event.target.value)}
            >
                <option value="">{t('admin-billing.proposedRefunds.picker.placeholder')}</option>
                {refunds.map((refund) => (
                    <option
                        key={refund.refundId}
                        value={refund.refundId}
                    >
                        {stuckRefundOptionLabel({ refund, locale, now, t })}
                    </option>
                ))}
            </select>
            {refunds.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    {t('admin-billing.proposedRefunds.picker.empty')}
                </p>
            ) : null}
        </div>
    );
}
