/**
 * @file VenueDailySpecialRow.client.tsx
 * @description The pieces of one menú del día entry (HOS-1041), split out of
 * `VenueDailySpecialsManager.client.tsx` (HOS-2490): the editable fields of a
 * row of the kit `Repeater`, the read-only card of a locked section, and the
 * elapsed / scheduled notes both show.
 */

import type { JSX } from 'react';
import { Field } from '@/components/account/ui/Field';
import { TextInput } from '@/components/account/ui/TextInput';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import { centsToPesosInputValue, parsePesosInputToCents } from '@/lib/listing/price-units';
import styles from './VenueDailySpecialsManager.module.css';

/** One special, as held in form state. Ids are not carried — see the payload schema. */
export interface DailySpecialDraft {
    readonly title: string;
    readonly description: string;
    /** Price in CENTAVOS, or `null` for "a consultar". */
    readonly priceCents: number | null;
    /** Inclusive first day, `YYYY-MM-DD`. */
    readonly validFrom: string;
    /** Inclusive last day, `YYYY-MM-DD`. */
    readonly validUntil: string;
}

/**
 * The elapsed / scheduled note of an entry, computed against the owner's OWN
 * today: a hint about a row being edited, never the publish decision (that runs
 * server-side on the public read).
 *
 * @param props - The entry, today and the translator.
 * @returns The note, or nothing for a live entry.
 */
export function DailySpecialWindowNote({
    special,
    today,
    t
}: {
    readonly special: DailySpecialDraft;
    readonly today: string;
    readonly t: TranslationFn;
}): JSX.Element | null {
    if (special.validUntil < today) {
        return (
            <p className={styles.expiredNote}>
                {t('venue.owner.editor.dailySpecials.expired', 'Ya venció — no se está mostrando.')}
            </p>
        );
    }
    if (special.validFrom > today) {
        return (
            <p className={styles.scheduledNote}>
                {t(
                    'venue.owner.editor.dailySpecials.scheduled',
                    'Programado — todavía no se muestra.'
                )}
            </p>
        );
    }
    return null;
}

/**
 * The read-only card of a locked section (HOS-1854).
 *
 * @param props - The entry, today and the translator.
 * @returns The card.
 */
export function DailySpecialReadOnly({
    special,
    today,
    t
}: {
    readonly special: DailySpecialDraft;
    readonly today: string;
    readonly t: TranslationFn;
}): JSX.Element {
    return (
        <div className={styles.specialCard}>
            <p className={styles.readOnlyName}>{special.title}</p>
            {special.description ? <p className={styles.intro}>{special.description}</p> : null}
            <p className={styles.intro}>
                {special.priceCents === null
                    ? t('venue.owner.editor.dailySpecials.pricePlaceholder', 'Precio')
                    : `$${centsToPesosInputValue({ cents: special.priceCents })}`}
                {' · '}
                {t('venue.owner.editor.dailySpecials.from', 'Desde')} {special.validFrom}{' '}
                {t('venue.owner.editor.dailySpecials.until', 'Hasta')} {special.validUntil}
            </p>
            <DailySpecialWindowNote
                special={special}
                today={today}
                t={t}
            />
        </div>
    );
}

/** Props of {@link DailySpecialFields}. */
export interface DailySpecialFieldsProps {
    readonly special: DailySpecialDraft;
    readonly today: string;
    readonly locale: SupportedLocale;
    readonly t: TranslationFn;
    /** The section cannot be edited (a save was refused by the plan). */
    readonly readOnly: boolean;
    readonly onPatch: (patch: Partial<DailySpecialDraft>) => void;
}

/**
 * The editable fields of one entry (a row of the Repeater).
 *
 * @param props - See {@link DailySpecialFieldsProps}.
 * @returns The fields.
 */
export function DailySpecialFields({
    special,
    today,
    locale,
    t,
    readOnly,
    onPatch
}: DailySpecialFieldsProps): JSX.Element {
    return (
        <div className={styles.fields}>
            <Field
                locale={locale}
                label={t('venue.owner.editor.dailySpecials.titleLabel', 'Plato')}
            >
                <TextInput
                    value={special.title}
                    maxLength={150}
                    disabled={readOnly}
                    placeholder={t(
                        'venue.owner.editor.dailySpecials.titlePlaceholder',
                        'Milanesa a la napolitana con puré'
                    )}
                    onChange={(event) => onPatch({ title: event.target.value })}
                />
            </Field>
            <Field
                locale={locale}
                label={t('venue.owner.editor.dailySpecials.descriptionLabel', 'Detalle')}
                optional
            >
                <TextInput
                    value={special.description}
                    maxLength={500}
                    disabled={readOnly}
                    placeholder={t(
                        'venue.owner.editor.dailySpecials.descriptionPlaceholder',
                        'Con guarnición y postre'
                    )}
                    onChange={(event) => onPatch({ description: event.target.value })}
                />
            </Field>
            <div className={styles.inline}>
                <Field
                    locale={locale}
                    label={t('venue.owner.editor.dailySpecials.priceLabel', 'Precio en pesos')}
                    optional
                >
                    <TextInput
                        type="number"
                        min={0}
                        step={1}
                        inputMode="decimal"
                        disabled={readOnly}
                        value={centsToPesosInputValue({ cents: special.priceCents })}
                        onChange={(event) =>
                            onPatch({
                                priceCents: parsePesosInputToCents({ raw: event.target.value })
                            })
                        }
                    />
                </Field>
                <Field
                    locale={locale}
                    label={t('venue.owner.editor.dailySpecials.from', 'Desde')}
                >
                    <TextInput
                        type="date"
                        disabled={readOnly}
                        value={special.validFrom}
                        onChange={(event) => onPatch({ validFrom: event.target.value })}
                    />
                </Field>
                <Field
                    locale={locale}
                    label={t('venue.owner.editor.dailySpecials.until', 'Hasta')}
                >
                    <TextInput
                        type="date"
                        disabled={readOnly}
                        value={special.validUntil}
                        onChange={(event) => onPatch({ validUntil: event.target.value })}
                    />
                </Field>
            </div>
            <DailySpecialWindowNote
                special={special}
                today={today}
                t={t}
            />
        </div>
    );
}
