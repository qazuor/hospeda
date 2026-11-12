import { OwnManualInstallmentsResponseSchema } from '@repo/schemas';
import { formatSelfCancelDate } from '@/lib/billing/self-cancel';
import { getPlanName } from '@/lib/billing-i18n';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';

/** What the partner page shows for the open manual installment, or null when there is none. */
export function resolveManualInstallmentView(input: {
    readonly result: unknown;
    readonly vertical: string;
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
}): { readonly planLine: string; readonly amountLine: string; readonly dueLine: string } | null {
    if (
        !input.result ||
        typeof input.result !== 'object' ||
        !('ok' in input.result) ||
        input.result.ok !== true ||
        !('data' in input.result)
    )
        return null;
    const parsed = OwnManualInstallmentsResponseSchema.safeParse(input.result.data);
    if (!parsed.success) return null;
    const installment = parsed.data.installments.find((row) => row.vertical === input.vertical);
    if (!installment) return null;
    const date = formatSelfCancelDate({ iso: installment.dueAt, locale: input.locale });
    if (!date) return null;
    const planLine = input.t('account.partner.installment.plan', undefined, {
        plan: getPlanName({ plan: { ...installment.plan, description: '' }, t: input.t })
    });
    const amountLine = installment.amount
        ? input.t('account.partner.installment.amount', undefined, {
              amount: formatPrice({
                  amount: installment.amount.amountMinor / 100,
                  currency: installment.amount.currency,
                  locale: input.locale,
                  showDecimals: installment.amount.amountMinor % 100 !== 0
              })
          })
        : input.t('account.partner.installment.amountPending');
    const dueLine = input.t('account.partner.installment.dueOn', undefined, { date });
    return { planLine, amountLine, dueLine };
}
