import { z } from 'zod';
import type { SupportedLocale } from '../i18n';
import { createTranslations, toRegionalLocaleTag } from '../i18n';

/** Optional booking fields; supplying a guest count also requires the listing capacity. */
export type BuildInquiryMessageInput = {
    readonly locale: SupportedLocale;
    readonly checkIn?: string;
    readonly checkOut?: string;
} & (
    | { readonly guests?: undefined; readonly capacity?: number }
    | { readonly guests: number; readonly capacity: number }
);

/** Either a new draft or localized field errors; errors never replace the current draft. */
export type BuildInquiryMessageResult =
    | { readonly message: string; readonly errors?: never }
    | {
          readonly message?: never;
          readonly errors: Readonly<Partial<Record<'checkIn' | 'checkOut' | 'guests', string>>>;
      };

const dateSchema = z.string().date();
const capacitySchema = z.number().int().positive();

/** Validates optional booking fields without generating a draft. */
export function validateInquiryFields({
    locale,
    checkIn,
    checkOut,
    guests,
    capacity
}: BuildInquiryMessageInput): BuildInquiryMessageResult['errors'] {
    const { t } = createTranslations(locale);
    const errors: Partial<Record<'checkIn' | 'checkOut' | 'guests', string>> = {};
    if (checkIn && !dateSchema.safeParse(checkIn).success) {
        errors.checkIn = t('accommodations.detail.listingContact.errors.invalidDate');
    }
    if (checkOut && !dateSchema.safeParse(checkOut).success) {
        errors.checkOut = t('accommodations.detail.listingContact.errors.invalidDate');
    } else if (checkIn && checkOut && !errors.checkIn && checkOut <= checkIn) {
        errors.checkOut = t('accommodations.detail.listingContact.errors.checkOutAfterCheckIn');
    }
    if (guests !== undefined) {
        const limit = capacitySchema.safeParse(capacity);
        if (!limit.success) {
            errors.guests = t(
                'accommodations.detail.listingContact.errors.guestsCapacityUnavailable'
            );
        } else if (!Number.isInteger(guests) || guests < 1 || guests > limit.data) {
            errors.guests = t(
                'accommodations.detail.listingContact.errors.guestsRange',
                undefined,
                { capacity: limit.data }
            );
        }
    }
    return Object.keys(errors).length > 0 ? errors : undefined;
}

/** Builds a localized inquiry from valid booking fields without changing visitor input. */
export function buildInquiryMessage(input: BuildInquiryMessageInput): BuildInquiryMessageResult {
    const errors = validateInquiryFields(input);
    if (errors) return { errors };
    const { locale, checkIn, checkOut, guests } = input;
    const { t, tPlural } = createTranslations(locale);
    if (!checkIn && !checkOut && guests === undefined) {
        return { message: t('conversations.form.prefill.intro') };
    }

    const formatter = new Intl.DateTimeFormat(toRegionalLocaleTag({ locale }), {
        day: 'numeric',
        month: 'numeric',
        timeZone: 'UTC'
    });
    const from = checkIn ? formatter.format(new Date(checkIn)) : undefined;
    const until = checkOut ? formatter.format(new Date(checkOut)) : undefined;
    let dates: string | undefined;
    if (from && until) {
        dates = t('accommodations.detail.listingContact.inquiry.dates', undefined, {
            checkIn: from,
            checkOut: until
        });
    } else if (from) {
        dates = t('accommodations.detail.listingContact.inquiry.from', undefined, {
            checkIn: from
        });
    } else if (until) {
        dates = t('accommodations.detail.listingContact.inquiry.until', undefined, {
            checkOut: until
        });
    }
    if (guests === undefined) {
        return {
            message: t('accommodations.detail.listingContact.inquiry.withDates', undefined, {
                dates
            })
        };
    }
    const guestPhrase = tPlural('accommodations.detail.listingContact.inquiry.guests', guests);
    return {
        message: dates
            ? t('accommodations.detail.listingContact.inquiry.withDatesAndGuests', undefined, {
                  dates,
                  guests: guestPhrase
              })
            : t('accommodations.detail.listingContact.inquiry.withGuests', undefined, {
                  guests: guestPhrase
              })
    };
}
