import { formatNumber, type Locale, trans } from '@repo/i18n';
import type {
    LatePaymentRefundMailCopy,
    LatePaymentRefundMailCopyInput,
    LatePaymentRefundMailCopyResolver
} from '@repo/notifications';

function readCopy(locale: Locale, key: string): string {
    const value = trans[locale][key];
    if (typeof value !== 'string') throw new Error(`Missing notification copy key: ${key}`);
    return value;
}

function interpolate(value: string, replacements: Readonly<Record<string, string>>): string {
    return value.replace(/\{\{(product|amount)\}\}/g, (placeholder, name: string) => {
        const replacement = replacements[name];
        return replacement === undefined ? placeholder : replacement;
    });
}

/** The catalog name of the add-on in the mail's locale, or the stored name when there is none. */
function resolveProduct(input: LatePaymentRefundMailCopyInput): string {
    const catalogName = trans[input.locale][`billing.addon.${input.addonSlug}.name`];
    return typeof catalogName === 'string' && catalogName.length > 0
        ? catalogName
        : input.addonName;
}

/** The exact refunded amount, in its own currency; cents only when the amount has them. */
function resolveAmount(input: LatePaymentRefundMailCopyInput): string {
    return formatNumber({
        value: input.amountMinor / 100,
        locale: input.locale,
        options: {
            style: 'currency',
            currency: input.currency,
            currencyDisplay: 'symbol',
            ...(input.amountMinor % 100 === 0
                ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
                : {})
        }
    });
}

/**
 * Resolves the late payment refunded mail (HOS-2179 P-3, D3): the payment reached us after the
 * purchase closed, nothing was activated, and the amount was refunded.
 *
 * @param input - Locale, add-on identity and the refunded amount
 * @returns The localized subject, preview, heading and paragraphs
 */
export const resolveLatePaymentRefundMailCopy: LatePaymentRefundMailCopyResolver = (
    input
): LatePaymentRefundMailCopy => {
    const replacements = { product: resolveProduct(input), amount: resolveAmount(input) };
    const line = (key: string) =>
        interpolate(
            readCopy(input.locale, `notifications.latePaymentRefunded.${key}`),
            replacements
        );
    const heading = line('heading');
    return {
        subject: line('subject'),
        preview: heading,
        heading,
        paragraphs: [line('intro'), line('refunded'), line('timing'), line('closing')]
    };
};
