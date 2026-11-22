import type { ComponentProps } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { ContactHost } from '@/components/accommodation/ContactHost.client';
import {
    ContactPanelDraftContext,
    emptyContactDraft,
    useContactSubmission
} from '@/components/accommodation/contact-panel-draft';
import { WhatsAppContact } from '@/components/accommodation/WhatsAppContact.client';
import { Dialog, DialogBody, DialogHeader } from '@/components/shared/ui/Dialog.client';
import { FieldError } from '@/components/ui/FieldError';
import { WebEvents } from '@/lib/analytics/events';
import { trackEvent } from '@/lib/analytics/umami-client';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    buildInquiryMessage,
    validateInquiryFields
} from '@/lib/listing-contact/build-inquiry-message';
import type { ListingContactPanelOpen } from '@/lib/listing-contact/listing-contact-events';
import { onListingContactPanelOpen } from '@/lib/listing-contact/listing-contact-events';
import type { ListingContactPrice } from '@/lib/listing-contact/listing-contact-price';
import { getListingContactPrice } from '@/lib/listing-contact/listing-contact-price';
import styles from './ListingContactPanel.module.css';
import { markListingContactPanelReady } from './listing-contact-readiness';

/** The panel receives public listing data; contact entitlements resolve inside WhatsAppContact. */
export interface ListingContactPanelProps {
    readonly panelId: string;
    readonly accommodation: ComponentProps<typeof ContactHost>['accommodation'];
    readonly accommodationName: string;
    readonly ownerName: string;
    readonly price: ListingContactPrice;
    readonly hasWhatsapp: boolean;
    readonly whatsappPlansHref: string;
    /**
     * HOS-2554: catalog names of the plans that carry the host's WhatsApp number, read server-side and
     * handed down (the catalog reader is server-only). Empty when it could not be read.
     */
    readonly gatePlanNames?: readonly string[];
    readonly phone?: string | null;
    readonly email?: string | null;
    readonly capacity?: number | null;
    readonly locale: SupportedLocale;
}

/** One sheet per listing, opened by the shared listing contact bus. */
export function ListingContactPanel(props: ListingContactPanelProps) {
    return (
        <ListingContactSheet
            key={props.accommodation.id}
            {...props}
        />
    );
}

const fields = ['checkIn', 'checkOut', 'guests'] as const;
const emptyFields = { checkIn: '', checkOut: '', guests: '' };

function ListingContactSheet({
    panelId,
    ownerName,
    accommodation,
    accommodationName,
    price,
    hasWhatsapp,
    whatsappPlansHref,
    gatePlanNames = [],
    phone,
    email,
    capacity,
    locale
}: ListingContactPanelProps) {
    const [request, setRequest] = useState<ListingContactPanelOpen | null>(null);
    const { t } = createTranslations(locale);
    const titleId = useId();
    const ownerFirstName = ownerName.trim().split(/\s+/)[0];
    const display = getListingContactPrice({ price, locale });
    const whatsappRef = useRef<HTMLDivElement>(null);
    const formRef = useRef<HTMLDivElement>(null);
    const controls = useRef<Partial<Record<(typeof fields)[number], HTMLInputElement | null>>>({});
    const [values, setValues] = useState(emptyFields);
    const [draft, setDraft] = useState(() => buildInquiryMessage({ locale }).message ?? '');
    const [errors, setErrors] = useState<ReturnType<typeof validateInquiryFields>>();
    const [contactDraft, setContactDraft] = useState(emptyContactDraft);
    const draftRevision = useRef(0);
    const submission = useContactSubmission();
    const [messageEdited, setMessageEdited] = useState(false);
    const fieldId = useId();
    const guestLimit =
        capacity && Number.isInteger(capacity) && capacity > 0 ? capacity : undefined;

    function close() {
        // Retire a displayed confirmation, not one that arrives while closed.
        if (submission.submitState.phase === 'success') {
            submission.setSubmitState({ phase: 'idle' });
        }
        setRequest(null);
    }

    useEffect(() => {
        const unsubscribe = onListingContactPanelOpen(setRequest);
        const clearReady = markListingContactPanelReady({ panelId });
        return () => {
            unsubscribe();
            clearReady();
        };
    }, [panelId]);

    useEffect(() => {
        const target =
            request?.focus === 'whatsapp'
                ? whatsappRef.current
                : request?.focus === 'form'
                  ? formRef.current
                  : null;
        if (!target) return;
        // Dialog queues its default focus in the opening frame. Let it finish first.
        let focusFrame = 0;
        const openingFrame = requestAnimationFrame(() => {
            focusFrame = requestAnimationFrame(() => {
                target.scrollIntoView?.({ block: 'nearest' });
                target.focus({ preventScroll: true });
            });
        });
        return () => {
            cancelAnimationFrame(openingFrame);
            cancelAnimationFrame(focusFrame);
        };
    }, [request]);

    function syncFields() {
        draftRevision.current += 1;
        const { checkIn, checkOut, guests } = controls.current;
        const next = {
            checkIn: checkIn?.value ?? '',
            checkOut: checkOut?.value ?? '',
            guests: guests?.value ?? ''
        };
        const badCheckIn = checkIn?.validity.badInput;
        const badCheckOut = checkOut?.validity.badInput;
        const badGuests = guests?.validity.badInput;
        const input = {
            locale,
            checkIn: badCheckIn ? '' : next.checkIn,
            checkOut: badCheckOut ? '' : next.checkOut,
            ...(!badGuests && next.guests === ''
                ? { guests: undefined }
                : {
                      guests: badGuests ? Number.NaN : Number(next.guests),
                      capacity: guestLimit ?? 0
                  })
        };
        setValues(next);
        if (badCheckIn || badCheckOut) {
            const invalidDate = t('accommodations.detail.listingContact.errors.invalidDate');
            setErrors({
                ...validateInquiryFields(input),
                ...(badCheckIn && { checkIn: invalidDate }),
                ...(badCheckOut && { checkOut: invalidDate })
            });
            return;
        }
        if (messageEdited) {
            setErrors(validateInquiryFields(input));
            return;
        }
        const result = buildInquiryMessage(input);
        setErrors(result.errors);
        if (result.message !== undefined) setDraft(result.message);
    }

    function captureDraftReset() {
        const submittedRevision = draftRevision.current;
        return () => {
            if (draftRevision.current !== submittedRevision) return false;
            setValues(emptyFields);
            setDraft(buildInquiryMessage({ locale }).message ?? '');
            setErrors(undefined);
            setContactDraft(emptyContactDraft);
            setMessageEdited(false);
            for (const field of fields) {
                const control = controls.current[field];
                if (control) control.value = '';
            }
            return true;
        };
    }

    function trackShortcut({ channel }: { readonly channel: 'phone' | 'email' }) {
        trackEvent(WebEvents.ListingContactClicked, {
            listing_id: accommodation.id,
            vertical: 'accommodation',
            channel,
            origin: 'panel',
            locale
        });
    }

    const tel = phone?.trim().replace(/[\s().-]/g, '');
    const address = email?.trim();
    const phoneHref = tel && /^\+?\d+$/.test(tel) ? `tel:${tel}` : undefined;
    const emailHref =
        address && /^[^\s@?#]+@[^\s@?#]+$/.test(address) ? `mailto:${address}` : undefined;

    const body = (
        <DialogBody className={styles.body}>
            {display && (
                <p className={styles.price}>
                    <strong>{display.amount}</strong> {display.unit}
                </p>
            )}
            {(hasWhatsapp || phoneHref || emailHref) && (
                <div className={styles.shortcuts}>
                    {hasWhatsapp && (
                        <section
                            className={styles.whatsappRow}
                            ref={whatsappRef}
                            aria-label={t(
                                'accommodations.detail.listingContact.panel.shortcuts.whatsapp'
                            )}
                            tabIndex={-1}
                        >
                            <WhatsAppContact
                                accommodationId={accommodation.id}
                                accommodationName={accommodationName}
                                plansHref={whatsappPlansHref}
                                gatePlanNames={gatePlanNames}
                                locale={locale}
                                origin="panel"
                            />
                        </section>
                    )}
                    {phoneHref && (
                        <a
                            href={phoneHref}
                            onClick={() => trackShortcut({ channel: 'phone' })}
                        >
                            {t('accommodations.detail.listingContact.panel.shortcuts.phone')}
                        </a>
                    )}
                    {emailHref && (
                        <a
                            href={emailHref}
                            onClick={() => trackShortcut({ channel: 'email' })}
                        >
                            {t('accommodations.detail.listingContact.panel.shortcuts.email')}
                        </a>
                    )}
                </div>
            )}
            <section
                ref={formRef}
                aria-label={t('accommodations.detail.listingContact.bar.inquire')}
                tabIndex={-1}
                onSubmitCapture={(event) => {
                    // Native controls outside the form can hold partial entries without
                    // firing an event or exposing them through their serialized value.
                    const invalid = fields
                        .map((field) => controls.current[field])
                        .find((control) => control?.validity.badInput);
                    if (!invalid) return;
                    event.preventDefault();
                    event.stopPropagation();
                    syncFields();
                    invalid.focus();
                }}
            >
                <div className={styles.fields}>
                    {fields.map((field) => {
                        const id = `${fieldId}-${field}`;
                        const guests = field === 'guests';
                        const error = errors?.[field];
                        return (
                            <div
                                className={styles.field}
                                key={field}
                            >
                                <label htmlFor={id}>
                                    {t(`accommodations.detail.listingContact.fields.${field}`)}
                                </label>
                                <input
                                    id={id}
                                    ref={(control) => {
                                        controls.current[field] = control;
                                    }}
                                    type={guests ? 'number' : 'date'}
                                    min={guests ? 1 : undefined}
                                    max={guests ? guestLimit : undefined}
                                    defaultValue={values[field]}
                                    onInput={syncFields}
                                    onChange={guests ? undefined : syncFields}
                                    aria-invalid={Boolean(error)}
                                    aria-describedby={error ? `${id}-error` : undefined}
                                />
                                <FieldError
                                    id={`${id}-error`}
                                    message={error}
                                />
                            </div>
                        );
                    })}
                </div>
                <ContactPanelDraftContext.Provider
                    value={{
                        draft: contactDraft,
                        setDraft: (update) => {
                            draftRevision.current += 1;
                            setContactDraft(update);
                        },
                        submission,
                        captureDraftReset
                    }}
                >
                    <ContactHost
                        accommodation={accommodation}
                        locale={locale}
                        initialMessage={draft}
                        initialMessageInvalid={Boolean(errors)}
                        onMessageEdited={() => setMessageEdited(true)}
                        sourcePage="accommodation_contact_panel"
                        origin={request?.origin}
                    />
                </ContactPanelDraftContext.Provider>
            </section>
            <p className={styles.trust}>{t('accommodations.detail.listingContact.panel.trust')}</p>
        </DialogBody>
    );

    return (
        <Dialog
            variant="sheet"
            isOpen={request !== null}
            onClose={close}
            ariaLabelledBy={titleId}
        >
            <DialogHeader
                onClose={close}
                closeLabel={t('common.close')}
                titleId={titleId}
            >
                {ownerFirstName
                    ? t('accommodations.detail.listingContact.panel.title', undefined, {
                          name: ownerFirstName
                      })
                    : t('accommodations.detail.listingContact.bar.inquire')}
            </DialogHeader>
            {body}
        </Dialog>
    );
}
