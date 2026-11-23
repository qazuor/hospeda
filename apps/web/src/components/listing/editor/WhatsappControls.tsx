/**
 * @file WhatsappControls.tsx
 * @description The venue WhatsApp number and the owner's choice of who may see
 * the button (HOS-2256 section 7.8, AC-16, AC-21).
 *
 * Two values, with "public" as the default (HOS-2557, owner decision): the radio
 * opens on "public" while the owner has not chosen, and the editor saves that
 * default together with the first number. Choosing "public" warns that the
 * number lands in the page HTML and can be copied by third parties.
 */

import type { JSX } from 'react';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { ContactWhatsappControls } from './ContactSection.client';
import styles from './editor-fields.module.css';
import { LISTING_FIELD_PREFIX } from './field-ids';
import { ListingPhoneField } from './ListingPhoneField';

/** The two values a venue owner can pick; mirrors `VenueWhatsappVisibilityEnum`. */
const OPTIONS = [
    {
        value: 'LOGGED_IN_ONLY',
        key: 'listing.owner.editor.contactField.whatsappVisibility.loggedInOnly',
        fallback: 'Solo usuarios logueados'
    },
    {
        value: 'PUBLIC',
        key: 'listing.owner.editor.contactField.whatsappVisibility.public',
        fallback: 'Público'
    }
] as const;

/** Props for {@link WhatsappControls}. */
interface WhatsappControlsProps {
    readonly locale: SupportedLocale;
    readonly controls: ContactWhatsappControls;
    readonly error?: string | undefined;
}

/**
 * WhatsApp number field plus the visibility radio group.
 *
 * @param props - Locale, the controls state/handlers and the number's error (RO-RO).
 */
export function WhatsappControls({ locale, controls, error }: WhatsappControlsProps): JSX.Element {
    const { t } = createTranslations(locale);
    const name = 'ce-whatsapp-mode';
    // HOS-2557: "public" is the default while no choice is stored.
    const mode = controls.mode || 'PUBLIC';

    return (
        <>
            <ListingPhoneField
                phoneKey="whatsapp"
                locale={locale}
                value={controls.number}
                onChange={controls.onNumberChange}
                error={error}
            />
            <fieldset className={styles.section}>
                <legend className={styles.label}>
                    {t(
                        'listing.owner.editor.contactField.whatsappVisibility.legend',
                        'Quién ve el botón de WhatsApp'
                    )}
                </legend>
                {OPTIONS.map((option, index) => (
                    <label
                        key={option.value}
                        className={styles.hint}
                    >
                        <input
                            // The first radio carries the field id so focus-on-error
                            // (and the id contract) lands on the group.
                            id={
                                index === 0
                                    ? buildFieldId({
                                          prefix: LISTING_FIELD_PREFIX,
                                          name: 'whatsappVisibility'
                                      })
                                    : undefined
                            }
                            type="radio"
                            name={name}
                            value={option.value}
                            checked={mode === option.value}
                            onChange={() => controls.onVisibilityChange(option.value)}
                        />{' '}
                        {t(option.key, option.fallback)}
                    </label>
                ))}
                <p className={styles.hint}>
                    {mode === 'LOGGED_IN_ONLY'
                        ? t(
                              'listing.owner.editor.contactField.whatsappVisibility.loggedInHint',
                              'El número no aparece en la página: solo lo ven las personas que iniciaron sesión.'
                          )
                        : t(
                              'listing.owner.editor.contactField.whatsappVisibility.publicWarning',
                              'Tu número va a quedar visible en la página y cualquiera puede copiarlo, incluidos programas automáticos.'
                          )}
                </p>
            </fieldset>
        </>
    );
}
