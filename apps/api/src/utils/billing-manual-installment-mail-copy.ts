import { formatDate, formatNumber, type Locale, trans } from '@repo/i18n';
import type {
    ManualInstallmentMailCopy,
    ManualInstallmentMailCopyInput,
    ManualInstallmentMailCopyResolver
} from '@repo/notifications';

function readCopy(locale: Locale, key: string): string {
    const value = trans[locale][key];
    if (typeof value !== 'string') throw new Error(`Missing notification copy key: ${key}`);
    return value;
}

function interpolate(value: string, replacements: Readonly<Record<string, string>>): string {
    return value.replace(/\{\{(plan|amount|date)\}\}/g, (placeholder, name: string) => {
        const replacement = replacements[name];
        return replacement === undefined ? placeholder : replacement;
    });
}

function resolvePlan(input: ManualInstallmentMailCopyInput): string {
    const catalogName = trans[input.locale][`billing.plan.${input.planSlug}.name`];
    return typeof catalogName === 'string' && catalogName.length > 0 ? catalogName : input.planName;
}

function resolveAmount(input: ManualInstallmentMailCopyInput): string {
    if (input.amountMinor === null || input.currency === null)
        return readCopy(input.locale, 'account.partner.installment.amountPending');
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

/** Resolves the opened installment email using the partner card's account copy. */
export const resolveManualInstallmentMailCopy: ManualInstallmentMailCopyResolver = (
    input
): ManualInstallmentMailCopy => {
    const plan = resolvePlan(input);
    const amount = resolveAmount(input);
    const date = formatDate({
        date: input.dueAt,
        locale: input.locale,
        options: {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'America/Argentina/Buenos_Aires'
        }
    });
    const interpolateCard = (key: string) =>
        interpolate(readCopy(input.locale, key), { plan, amount, date });
    const heading = readCopy(input.locale, 'notifications.manualInstallmentOpened.heading');
    return {
        subject: readCopy(input.locale, 'notifications.manualInstallmentOpened.subject'),
        preview: heading,
        heading,
        paragraphs: [
            readCopy(
                input.locale,
                `notifications.manualInstallmentOpened.${input.firstInstallment ? 'introFirst' : 'introRenewal'}`
            ),
            interpolateCard('account.partner.installment.plan'),
            interpolateCard(
                input.amountMinor === null
                    ? 'account.partner.installment.amountPending'
                    : 'account.partner.installment.amount'
            ),
            interpolateCard('account.partner.installment.dueOn'),
            readCopy(input.locale, 'account.partner.installment.howToPay')
        ],
        cta: readCopy(input.locale, 'notifications.manualInstallmentOpened.cta')
    };
};
