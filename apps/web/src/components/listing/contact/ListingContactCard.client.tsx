/**
 * @file ListingContactCard.client.tsx
 * @description Desktop sidebar contact card (HOS-2531, spec 7.7): arrival, departure and
 * guest fields that build the inquiry through the same `buildInquiryMessage` the mobile
 * sheet uses, the host form, and a "contact directly" row with the entitlement-gated
 * WhatsApp block and a phone link.
 */
import type { ComponentProps } from 'react';
import { useId, useState } from 'react';
import { ContactHost } from '@/components/accommodation/ContactHost.client';
import { WhatsAppContact } from '@/components/accommodation/WhatsAppContact.client';
import { FieldError } from '@/components/ui/FieldError';
import { GradientButton } from '@/components/ui/GradientButtonReact';
import { useListingConversationAction } from '@/hooks/use-listing-conversation-action';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/umami-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    buildInquiryMessage,
    toInquiryFields,
    validateInquiryFields
} from '@/lib/listing-contact/build-inquiry-message';
import styles from './ListingContactCard.module.css';

/** Public listing data for the sidebar card; WhatsApp entitlement resolves inside WhatsAppContact. */
export interface ListingContactCardProps {
    readonly accommodation: ComponentProps<typeof ContactHost>['accommodation'];
    readonly accommodationName: string;
    readonly hasWhatsapp: boolean;
    readonly whatsappPlansHref: string;
    /** Plan names shown in the WhatsApp upsell, read from the catalog by the page. */
    readonly gatePlanNames?: readonly string[];
    readonly phone?: string | null;
    readonly capacity?: number | null;
    /** Message prefilled from the search context; replaced once the visitor fills a field. */
    readonly initialMessage?: string;
    readonly locale: SupportedLocale;
}

type FieldName = 'checkIn' | 'checkOut' | 'guests';
type FieldValues = Readonly<Record<FieldName, string>>;

const fieldNames: readonly FieldName[] = ['checkIn', 'checkOut', 'guests'];
const emptyValues: FieldValues = { checkIn: '', checkOut: '', guests: '' };

/** Desktop contact card: booking fields, host form and direct-contact shortcuts. */
export function ListingContactCard({
    accommodation,
    accommodationName,
    hasWhatsapp,
    whatsappPlansHref,
    gatePlanNames = [],
    phone,
    capacity,
    initialMessage,
    locale
}: ListingContactCardProps) {
    const { t } = createTranslations(locale);
    const action = useListingConversationAction({ accommodationId: accommodation.id, locale });
    const fieldId = useId();
    const [values, setValues] = useState<FieldValues>(emptyValues);
    const [badInput, setBadInput] = useState<readonly FieldName[]>([]);
    const [draft, setDraft] = useState(
        () => initialMessage ?? buildInquiryMessage({ locale }).message ?? ''
    );
    const [errors, setErrors] = useState<ReturnType<typeof validateInquiryFields>>();
    const [messageEdited, setMessageEdited] = useState(false);
    const guestLimit =
        capacity && Number.isInteger(capacity) && capacity > 0 ? capacity : undefined;

    function update({
        field,
        value,
        bad
    }: {
        readonly field: FieldName;
        readonly value: string;
        readonly bad: boolean;
    }) {
        const next = { ...values, [field]: value };
        const nextBad = bad
            ? [...badInput.filter((f) => f !== field), field]
            : badInput.filter((f) => f !== field);
        setValues(next);
        setBadInput(nextBad);
        const input = {
            locale,
            checkIn: nextBad.includes('checkIn') ? '' : next.checkIn,
            checkOut: nextBad.includes('checkOut') ? '' : next.checkOut,
            ...(next.guests === '' && !nextBad.includes('guests')
                ? { guests: undefined }
                : {
                      guests: nextBad.includes('guests') ? Number.NaN : Number(next.guests),
                      capacity: guestLimit ?? 0
                  })
        };
        const invalidDate = t('accommodations.detail.listingContact.errors.invalidDate');
        const nativeErrors = {
            ...(nextBad.includes('checkIn') && { checkIn: invalidDate }),
            ...(nextBad.includes('checkOut') && { checkOut: invalidDate })
        };
        if (nextBad.length > 0 || messageEdited) {
            const found = { ...validateInquiryFields(input), ...nativeErrors };
            setErrors(Object.keys(found).length > 0 ? found : undefined);
            return;
        }
        const result = buildInquiryMessage(input);
        setErrors(result.errors);
        if (result.message !== undefined) setDraft(result.message);
    }

    // HOS-2534: the booking fields travel as columns only while they validate.
    const inquiry = errors ? undefined : toInquiryFields(values);
    const tel = phone?.trim().replace(/[\s().-]/g, '');
    const phoneHref = tel && /^\+?\d+$/.test(tel) ? `tel:${tel}` : undefined;

    return (
        <div className={styles.card}>
            {action.hasConversation ? (
                <>
                    <p>{t('accommodations.detail.listingContact.card.existingConversation')}</p>
                    <GradientButton
                        href={action.href}
                        label={action.label}
                        variant="accent"
                        flat
                        size="md"
                    />
                </>
            ) : (
                <>
                    <div className={styles.fields}>
                        {fieldNames.map((field) => {
                            const id = `${fieldId}-${field}`;
                            const guests = field === 'guests';
                            const error = errors?.[field];
                            return (
                                <div
                                    className={`${styles.field}${guests ? ` ${styles.fieldGuests}` : ''}`}
                                    key={field}
                                >
                                    <label htmlFor={id}>
                                        {t(`accommodations.detail.listingContact.fields.${field}`)}
                                    </label>
                                    <input
                                        id={id}
                                        type={guests ? 'number' : 'date'}
                                        min={guests ? 1 : undefined}
                                        max={guests ? guestLimit : undefined}
                                        step={guests ? 1 : undefined}
                                        placeholder={t(
                                            `accommodations.detail.listingContact.placeholders.${field}`
                                        )}
                                        value={values[field]}
                                        onChange={(event) =>
                                            update({
                                                field,
                                                value: event.currentTarget.value,
                                                bad: event.currentTarget.validity.badInput
                                            })
                                        }
                                        aria-invalid={Boolean(error)}
                                        aria-describedby={
                                            error
                                                ? `${id}-error`
                                                : !guests && !values[field]
                                                  ? `${id}-hint`
                                                  : undefined
                                        }
                                    />
                                    {!guests && !values[field] && (
                                        <small id={`${id}-hint`}>
                                            {t(
                                                `accommodations.detail.listingContact.placeholders.${field}`
                                            )}
                                        </small>
                                    )}
                                    <FieldError
                                        id={`${id}-error`}
                                        message={error}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <ContactHost
                        accommodation={accommodation}
                        locale={locale}
                        initialMessage={draft}
                        initialMessageInvalid={Boolean(errors)}
                        inquiry={inquiry}
                        onMessageEdited={() => setMessageEdited(true)}
                        origin="sidebar"
                    />
                </>
            )}
            {(hasWhatsapp || phoneHref) && (
                <section
                    className={styles.direct}
                    aria-label={t('accommodations.detail.listingContact.card.direct')}
                >
                    <p className={styles.directTitle}>
                        {t('accommodations.detail.listingContact.card.direct')}
                    </p>
                    {hasWhatsapp && (
                        <WhatsAppContact
                            accommodationId={accommodation.id}
                            accommodationName={accommodationName}
                            plansHref={whatsappPlansHref}
                            gatePlanNames={gatePlanNames}
                            locale={locale}
                            origin="sidebar"
                        />
                    )}
                    {phoneHref && (
                        <GradientButton
                            href={phoneHref}
                            variant="outline-primary"
                            size="md"
                            label={t('accommodations.detail.listingContact.panel.shortcuts.phone')}
                            onClick={() =>
                                trackEvent(WebEvents.ListingContactClicked, {
                                    listing_id: accommodation.id,
                                    vertical: 'accommodation',
                                    channel: 'phone',
                                    origin: 'sidebar',
                                    locale
                                })
                            }
                        />
                    )}
                </section>
            )}
        </div>
    );
}
