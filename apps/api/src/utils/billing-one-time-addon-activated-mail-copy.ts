import { formatDate, type Locale, trans } from '@repo/i18n';
import type {
    OneTimeAddonActivatedMailCopy,
    OneTimeAddonActivatedMailCopyInput,
    OneTimeAddonActivatedMailCopyResolver
} from '@repo/notifications';

function readCopy(locale: Locale, key: string): string {
    const value = trans[locale][key];
    if (typeof value !== 'string') throw new Error(`Missing notification copy key: ${key}`);
    return value;
}

function interpolate(value: string, replacements: Readonly<Record<string, string>>): string {
    return value.replace(/\{\{(product|listing|date)\}\}/g, (placeholder, name: string) => {
        const replacement = replacements[name];
        return replacement === undefined ? placeholder : replacement;
    });
}

/** The catalog name of the add-on in the mail's locale, or the stored name when there is none. */
function resolveProduct(input: OneTimeAddonActivatedMailCopyInput): string {
    const catalogName = trans[input.locale][`billing.addon.${input.addonSlug}.name`];
    return typeof catalogName === 'string' && catalogName.length > 0
        ? catalogName
        : input.addonName;
}

/** The expiry as a market-local calendar date in the mail's locale. */
function resolveDate(input: { readonly endsAt: Date; readonly locale: Locale }): string {
    return formatDate({
        date: input.endsAt,
        locale: input.locale,
        options: {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'America/Argentina/Buenos_Aires'
        }
    });
}

/**
 * Resolves the one-time add-on activated mail (HOS-2405): «tu destaque está activo», naming the
 * add-on, the listing and the expiry.
 *
 * @param input - Locale, add-on identity, the listing's name and the expiry
 * @returns The localized subject, preview, heading, paragraphs and call to action
 */
export const resolveOneTimeAddonActivatedMailCopy: OneTimeAddonActivatedMailCopyResolver = (
    input
): OneTimeAddonActivatedMailCopy => {
    const replacements = {
        product: resolveProduct(input),
        listing: input.listingName ?? '',
        date: input.endsAt ? resolveDate({ endsAt: input.endsAt, locale: input.locale }) : ''
    };
    const line = (key: string) =>
        interpolate(
            readCopy(input.locale, `notifications.oneTimeAddonActivated.${key}`),
            replacements
        );
    const heading = line('heading');
    return {
        subject: line('subject'),
        preview: heading,
        heading,
        paragraphs: [
            line(input.listingName === null ? 'introWithoutListing' : 'intro'),
            ...(input.endsAt ? [line('endsAt')] : []),
            line('closing')
        ],
        cta: line('cta')
    };
};
