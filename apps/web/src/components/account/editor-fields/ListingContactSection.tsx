/**
 * @file ListingContactSection.tsx
 * @description The ONE contact section of both owner editors (HOS-2497, spec
 * HOS-2415 §6.9, D7 «fusión de contacto»).
 *
 * The accommodation editor (`ContactForm` + `ContactInfoSection`) and the
 * listing editor (`ContactSection` + `ListingPhoneField` + `WhatsappControls`)
 * used to render the same channels twice, with their own labels and markup.
 * What differs by vertical is now a parameter, never a branch on a vertical:
 *
 * - `whatsapp` is optional (an experience has no WhatsApp number);
 * - `whatsappVisibility` is optional (only a venue stores who sees the button).
 *   It always shows a choice: while nothing is stored the radio reads `PUBLIC`,
 *   the default the save applies (HOS-2557);
 * - `website` is optional (only an accommodation has one).
 *
 * The landline stays optional (HOS-2042). Each channel carries its own Zod key
 * as `name`, so ids, focus-on-error and the PATCH contract stay those of the
 * engine that renders it.
 */

import { Field } from '@/components/account/ui/Field';
import type { HelpAnchor } from '@/components/account/ui/help-anchor';
import { PhoneField } from '@/components/account/ui/PhoneField';
import { Radio, RadioGroup } from '@/components/account/ui/Radio';
import { Section } from '@/components/account/ui/Section';
import { TextInput } from '@/components/account/ui/TextInput';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { createT, type SupportedLocale } from '@/lib/i18n';
import styles from './EditorFields.module.css';

/** One contact channel: its Zod key, value, setter and error. */
export interface ContactChannel {
    /** The Zod key (also the field id name). */
    readonly name: string;
    readonly value: string;
    readonly onChange: (value: string) => void;
    readonly error?: string;
}

/** Who may see the WhatsApp button (venue only, HOS-2256). */
export interface WhatsappVisibilityControl {
    /** The Zod key of the choice (`whatsappVisibility`). */
    readonly name: string;
    /** Stored choice; `''` while none is stored (shown as the `PUBLIC` default). */
    readonly value: string;
    readonly onChange: (value: string) => void;
}

/** The visibility a WhatsApp number gets while the owner never picked one (HOS-2557). */
export const DEFAULT_WHATSAPP_VISIBILITY = 'PUBLIC';

/** The two visibility choices, in display order. */
const WHATSAPP_VISIBILITY_OPTIONS = ['PUBLIC', 'LOGGED_IN_ONLY'] as const;

/** Props of {@link ListingContactSection}. */
export interface ListingContactSectionProps {
    readonly locale: SupportedLocale;
    /** The editor's field id namespace (`acc`, `ce`). */
    readonly idPrefix: string;
    /** The editor's suffix map (the phone number inputs). */
    readonly suffixes: Readonly<Record<string, string>>;
    /** The section's help anchor. */
    readonly helpId: HelpAnchor;
    readonly phone: ContactChannel;
    readonly landline: ContactChannel;
    /** Omit when the vertical has no WhatsApp number. */
    readonly whatsapp?: ContactChannel;
    /** Omit when the vertical does not store who sees the button. */
    readonly whatsappVisibility?: WhatsappVisibilityControl;
    readonly email: ContactChannel;
    /** Omit when the vertical has no website field. */
    readonly website?: ContactChannel;
}

/**
 * The shared contact section.
 *
 * @param props - See {@link ListingContactSectionProps}.
 * @returns A kit `Section` with every contact channel the vertical has.
 */
export function ListingContactSection({
    locale,
    idPrefix,
    suffixes,
    helpId,
    phone,
    landline,
    whatsapp,
    whatsappVisibility,
    email,
    website
}: ListingContactSectionProps) {
    const t = createT(locale);
    const visibility = whatsappVisibility?.value || DEFAULT_WHATSAPP_VISIBILITY;

    return (
        <Section
            title={t('account.editorFields.contact.title')}
            description={t('account.editorFields.contact.publicHint')}
            helpId={helpId}
        >
            <div className={styles.stack}>
                {(
                    [
                        { channel: phone, key: 'phone', optional: false },
                        { channel: landline, key: 'landline', optional: true },
                        { channel: whatsapp, key: 'whatsapp', optional: false }
                    ] as const
                ).map(({ channel, key, optional }) =>
                    channel ? (
                        <Field
                            key={key}
                            locale={locale}
                            label={t(`account.editorFields.contact.${key}`)}
                            id={buildFieldId({
                                prefix: idPrefix,
                                name: channel.name,
                                suffix: suffixes[channel.name]
                            })}
                            error={channel.error}
                            optional={optional}
                        >
                            <PhoneField
                                locale={locale}
                                name={channel.name}
                                value={channel.value}
                                countryId={buildFieldId({
                                    prefix: idPrefix,
                                    name: channel.name,
                                    suffix: 'country'
                                })}
                                onValueChange={channel.onChange}
                            />
                        </Field>
                    ) : null
                )}
                {whatsappVisibility ? (
                    <RadioGroup
                        locale={locale}
                        legend={t('account.editorFields.contact.whatsappVisibility.legend')}
                        name={buildFieldId({ prefix: idPrefix, name: whatsappVisibility.name })}
                        value={visibility}
                        onValueChange={whatsappVisibility.onChange}
                        hint={
                            visibility === 'LOGGED_IN_ONLY'
                                ? t('account.editorFields.contact.whatsappVisibility.loggedInHint')
                                : t('account.editorFields.contact.whatsappVisibility.publicWarning')
                        }
                    >
                        {WHATSAPP_VISIBILITY_OPTIONS.map((option, index) => (
                            <Radio
                                key={option}
                                // The first radio carries the field id so focus-on-error
                                // (and the id contract) lands on the group.
                                id={
                                    index === 0
                                        ? buildFieldId({
                                              prefix: idPrefix,
                                              name: whatsappVisibility.name
                                          })
                                        : undefined
                                }
                                value={option}
                                label={t(
                                    `account.editorFields.contact.whatsappVisibility.${option}`
                                )}
                            />
                        ))}
                    </RadioGroup>
                ) : null}
                <div className={styles.stack}>
                    <Field
                        locale={locale}
                        label={t('account.editorFields.contact.email')}
                        id={buildFieldId({ prefix: idPrefix, name: email.name })}
                        error={email.error}
                    >
                        <TextInput
                            name={email.name}
                            type="email"
                            inputMode="email"
                            autoComplete="email"
                            value={email.value}
                            onChange={(event) => email.onChange(event.target.value)}
                        />
                    </Field>
                    {website ? (
                        <Field
                            locale={locale}
                            label={t('account.editorFields.contact.website')}
                            id={buildFieldId({ prefix: idPrefix, name: website.name })}
                            error={website.error}
                            optional
                        >
                            <TextInput
                                name={website.name}
                                type="url"
                                inputMode="url"
                                autoComplete="url"
                                value={website.value}
                                onChange={(event) => website.onChange(event.target.value)}
                            />
                        </Field>
                    ) : null}
                </div>
            </div>
        </Section>
    );
}
