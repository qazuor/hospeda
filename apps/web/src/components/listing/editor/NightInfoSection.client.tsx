/**
 * @file NightInfoSection.client.tsx
 * @description Nightlife (`nightInfo`) fields of the venue owner editor
 * (HOS-1787 leaf 5.1, DEC-FAC-036 / DEC-FAC-040).
 *
 * The public page already renders these fields (HOS-1849 / 4.5); this is the
 * owner's side. Labels are the approved `venue.detail.nightInfo.*` keys — the
 * editor does not fork the copy the public page uses. Only the editor-only
 * wording (the price's unit, the "not informed" empty option, the notes'
 * labels) lives under `listing.owner.editor.nightInfo.*`.
 *
 * ## Units
 *
 * `entryPriceFrom` is stored in CENTAVOS, like every money column. The owner
 * types PESOS: `centsToPesosInputValue` / `parsePesosInputToCents` are the one
 * conversion pair, the same one `PriceSection` uses for `priceFrom`.
 *
 * ## Clearing
 *
 * All six writable fields clear to `null`, not to an empty string or to `0`.
 * `buildPatchPayload` owns that contract; this component only produces honest
 * form state (`''`, `null`, or a number).
 *
 * ## Policies (HOS-2060)
 *
 * The age, dress code and dress-code note are keys of the venue `policies`
 * JSONB now (`policies.minAge`, `policies.dressCode`, `policies.dressCodeNote`),
 * still claimed by this section in the catalog. They are edited through
 * `onPolicyChange`; an emptied control removes its key, which the PATCH sends
 * as `null` (delete that key) without touching any other policy.
 *
 * ## Minimum-age scope (HOS-2098)
 *
 * Under the age: «Rige todo el día» (also what an unset scope shows), «Rige
 * desde las HH:MM», or «Rige solo en un sector o actividad» with an es/en/pt
 * short text. The selector only exists while an age is set, and clearing the
 * age removes the scope too: a scope means nothing on its own.
 *
 * ## Localized notes (HOS-2504)
 *
 * Each es/en/pt note is a kit segmented `Tabs`. Inactive panels are unmounted,
 * but the save bar focuses the first invalid field by DOM id, so the tabs are
 * CONTROLLED: whenever a note's errors change, the first locale with an error
 * becomes the selected tab (its control is mounted and focusable), and a tab
 * with an error says so in its label. Field ids are unchanged.
 *
 * Each note is a `<fieldset>` whose visible `<legend>` names what goes in it
 * (HOS-2600): the tabs alone only said «Español / Inglés / Portugués», so two
 * notes in a row looked identical.
 */

import {
    VENUE_MIN_AGE_SCOPE_AREA_MAX,
    VENUE_MIN_AGE_SCOPE_KINDS,
    VenueDressCodeEnum,
    VenueEntryKindEnum,
    type VenueMinAgeScope,
    type VenueMinAgeScopeKind
} from '@repo/schemas';
import { type JSX, useEffect, useState } from 'react';
import { Field } from '@/components/account/ui/Field';
import { InputGroup } from '@/components/account/ui/InputGroup';
import { Section } from '@/components/account/ui/Section';
import { Select } from '@/components/account/ui/Select';
import { Tabs } from '@/components/account/ui/Tabs';
import { TextInput } from '@/components/account/ui/TextInput';
import { formatMonthYearLabel } from '@/lib/format-utils';
import { sectionHelpId } from '@/lib/help/section-help-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { isEmptyPolicyNote } from '@/lib/listing/listing-policies';
import { centsToPesosInputValue, parsePesosInputToCents } from '@/lib/listing/price-units';
import { LISTING_FIELD_PREFIX } from './field-ids';
import type { ListingEditData, ListingFieldChange } from './listing-edit-data';
import sectionStyles from './listing-section.module.css';
import styles from './NightInfoSection.module.css';
import type { ListingPolicyChange } from './PoliciesPanel.client';

/** The note shown while the owner has not written one. */
const EMPTY_NOTE = { es: '', en: '', pt: '' } as const;

/** The three locales of a note, in tab order. */
const NOTE_LOCALES = ['es', 'en', 'pt'] as const;

type NoteLocale = (typeof NOTE_LOCALES)[number];

/**
 * The scope a newly picked kind starts from (HOS-2098). The time and the area
 * start empty on purpose: the owner fills them, and an empty one is a
 * validation error on save rather than an invented default.
 */
function scopeForKind(kind: VenueMinAgeScopeKind): VenueMinAgeScope {
    if (kind === 'from_time') return { kind, from: '' };
    if (kind === 'area') return { kind, area: { ...EMPTY_NOTE } };
    return { kind: 'all_day' };
}

/** One localized note control set. */
interface I18nNoteFieldProps {
    readonly locale: SupportedLocale;
    readonly baseName: 'entryNoteI18n' | 'policies.dressCodeNote' | 'policies.minAgeScope.area';
    readonly legend: string;
    /** Per-locale character cap; 200 (the notes' cap) when omitted. */
    readonly maxLength?: number;
    readonly values: { readonly es: string; readonly en: string; readonly pt: string };
    readonly errors: Readonly<Record<string, string | undefined>>;
    readonly onChange: (next: { es: string; en: string; pt: string }) => void;
}

/**
 * Three controls (es/en/pt) for one localized note, one per segmented tab.
 *
 * The `es` control carries the BARE Zod key so its DOM id is the one
 * `buildFieldId`/`focusFirstInvalidField` derive for the field; `en`/`pt` use
 * dotted paths, whose ids are the nested targets. The selected tab follows the
 * first locale with an error so that control is always mounted when the save
 * bar tries to focus it.
 */
function I18nNoteField({
    locale,
    baseName,
    legend,
    maxLength = 200,
    values,
    errors,
    onChange
}: I18nNoteFieldProps): JSX.Element {
    const { t } = createTranslations(locale);
    const nameOf = (code: NoteLocale) => (code === 'es' ? baseName : `${baseName}.${code}`);
    const errorOf = (code: NoteLocale): string | undefined =>
        code === 'es' ? (errors[baseName] ?? errors[nameOf(code)]) : errors[nameOf(code)];
    const firstWithError = NOTE_LOCALES.find((code) => errorOf(code) !== undefined);
    const errorSignature = NOTE_LOCALES.map((code) => errorOf(code) ?? '').join('\u0000');
    const [selected, setSelected] = useState<NoteLocale>(firstWithError ?? 'es');

    // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only when the errors change, so a manual tab choice is not overridden on every render
    useEffect(() => {
        if (firstWithError !== undefined) setSelected(firstWithError);
    }, [errorSignature]);

    const labelFor = (code: NoteLocale) =>
        code === 'es'
            ? t('listing.owner.editor.nightInfo.localeEs', 'Español')
            : code === 'en'
              ? t('listing.owner.editor.nightInfo.localeEn', 'Inglés')
              : t('listing.owner.editor.nightInfo.localePt', 'Portugués');

    return (
        <fieldset className={styles.noteGroup}>
            <legend className={styles.noteLegend}>{legend}</legend>
            <Tabs
                variant="segmented"
                ariaLabel={legend}
                value={selected}
                onValueChange={(id) => setSelected(id as NoteLocale)}
                items={NOTE_LOCALES.map((code) => ({
                    id: code,
                    label:
                        errorOf(code) === undefined
                            ? labelFor(code)
                            : `${labelFor(code)} (${t('listing.owner.editor.nightInfo.localeHasError', 'Con error')})`,
                    panel: (
                        <Field
                            locale={locale}
                            idParts={{ prefix: LISTING_FIELD_PREFIX, name: nameOf(code) }}
                            label={labelFor(code)}
                            error={errorOf(code)}
                        >
                            <TextInput
                                value={values[code]}
                                maxLength={maxLength}
                                onChange={(event) =>
                                    onChange({ ...values, [code]: event.target.value })
                                }
                            />
                        </Field>
                    )
                }))}
            />
        </fieldset>
    );
}

/** Props for {@link NightInfoSection}. */
export interface NightInfoSectionProps {
    readonly locale: SupportedLocale;
    readonly data: ListingEditData;
    readonly errors: Readonly<Record<string, string | undefined>>;
    readonly onFieldChange: ListingFieldChange;
    readonly onPolicyChange: ListingPolicyChange;
}

/**
 * Nightlife section of the venue editor.
 *
 * @param props - Locale, form state, field errors and the shared change handler.
 * @returns The kit section with the nightlife fields.
 */
export function NightInfoSection({
    locale,
    data,
    errors,
    onFieldChange,
    onPolicyChange
}: NightInfoSectionProps): JSX.Element {
    const { t } = createTranslations(locale);
    const { policies } = data;
    // HOS-2098: an unset scope IS "all day" (the default of existing venues).
    const scope: VenueMinAgeScope = policies.minAgeScope ?? { kind: 'all_day' };
    const idOf = (name: string) => ({ prefix: LISTING_FIELD_PREFIX, name });

    const updatedAt = data.entryPriceUpdatedAt === null ? null : new Date(data.entryPriceUpdatedAt);
    const hasValidUpdatedAt = updatedAt !== null && !Number.isNaN(updatedAt.getTime());
    const notInformed = t('listing.owner.editor.nightInfo.notInformed', 'No informado');

    return (
        <Section
            id="editor-nightInfo"
            title={t('listing.owner.editor.sectionNav.nightInfo', 'Info para salir')}
            helpId={sectionHelpId({ vertical: 'venue', slug: 'de-noche' })}
        >
            <div className={sectionStyles.grid}>
                <Field
                    locale={locale}
                    idParts={idOf('entryKind')}
                    label={t('venue.detail.nightInfo.entryLabel', 'Entrada')}
                    error={errors.entryKind}
                >
                    <Select
                        value={data.entryKind}
                        onChange={(event) => onFieldChange('entryKind', event.target.value)}
                    >
                        <option value="">{notInformed}</option>
                        {Object.values(VenueEntryKindEnum).map((kind) => (
                            <option
                                key={kind}
                                value={kind}
                            >
                                {t(`venue.detail.nightInfo.entryKind.${kind}`, kind)}
                            </option>
                        ))}
                    </Select>
                </Field>

                {/* Kept mounted while not `paid` so its id remains the focus target
                    for a stale error; `hidden` is what keeps it out of the UI. */}
                <div
                    className={styles.priceField}
                    data-testid="night-info-price-field"
                    hidden={data.entryKind !== VenueEntryKindEnum.PAID}
                >
                    {/* The «ARS» addon is aria-hidden, so the label states the unit. */}
                    <Field
                        locale={locale}
                        idParts={idOf('entryPriceFrom')}
                        label={t(
                            'listing.owner.editor.nightInfo.entryPriceFrom',
                            'Precio desde (en pesos)'
                        )}
                        error={errors.entryPriceFrom}
                        hint={
                            hasValidUpdatedAt
                                ? t(
                                      'listing.owner.editor.nightInfo.priceUpdatedAt',
                                      'Actualizado {{month}}',
                                      { month: formatMonthYearLabel({ date: updatedAt, locale }) }
                                  )
                                : undefined
                        }
                    >
                        <InputGroup
                            suffix="ARS"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            step={1}
                            value={centsToPesosInputValue({ cents: data.entryPriceFrom })}
                            onChange={(event) => {
                                onFieldChange(
                                    'entryPriceFrom',
                                    parsePesosInputToCents({ raw: event.target.value })
                                );
                            }}
                        />
                    </Field>
                </div>

                <Field
                    locale={locale}
                    idParts={idOf('policies.minAge')}
                    label={t('venue.detail.nightInfo.minAgeLabel', 'Edad mínima')}
                    error={errors['policies.minAge']}
                >
                    <TextInput
                        type="number"
                        min={13}
                        max={30}
                        step={1}
                        value={policies.minAge ?? ''}
                        onChange={(event) => {
                            const raw = event.target.value.trim();
                            const parsed = raw === '' ? undefined : Number(raw);
                            const next =
                                parsed !== undefined && Number.isFinite(parsed)
                                    ? parsed
                                    : undefined;
                            onPolicyChange('minAge', next);
                            // HOS-2098: no age, no scope.
                            if (next === undefined) onPolicyChange('minAgeScope', undefined);
                        }}
                    />
                </Field>

                <Field
                    locale={locale}
                    idParts={idOf('policies.dressCode')}
                    label={t('venue.detail.nightInfo.dressCodeLabel', 'Código de vestimenta')}
                    error={errors['policies.dressCode']}
                >
                    <Select
                        value={policies.dressCode ?? ''}
                        onChange={(event) => {
                            const value = event.target.value as VenueDressCodeEnum | '';
                            onPolicyChange('dressCode', value === '' ? undefined : value);
                        }}
                    >
                        <option value="">{notInformed}</option>
                        {Object.values(VenueDressCodeEnum).map((value) => (
                            <option
                                key={value}
                                value={value}
                            >
                                {t(`venue.detail.nightInfo.dressCode.${value}`, value)}
                            </option>
                        ))}
                    </Select>
                </Field>

                {policies.minAge !== undefined && (
                    <div
                        className={`${sectionStyles.full} ${styles.scopeField}`}
                        data-testid="night-info-age-scope"
                    >
                        <Field
                            locale={locale}
                            idParts={idOf('policies.minAgeScope')}
                            label={t(
                                'listing.owner.editor.nightInfo.minAgeScopeLabel',
                                'Alcance de la edad mínima'
                            )}
                            hint={t(
                                'listing.owner.editor.nightInfo.minAgeScopeHint',
                                'Se muestra junto a la edad mínima en tu ficha y el asistente lo usa para responder.'
                            )}
                            error={errors['policies.minAgeScope']}
                        >
                            <Select
                                value={scope.kind}
                                onChange={(event) =>
                                    onPolicyChange(
                                        'minAgeScope',
                                        scopeForKind(event.target.value as VenueMinAgeScopeKind)
                                    )
                                }
                            >
                                {VENUE_MIN_AGE_SCOPE_KINDS.map((kind) => (
                                    <option
                                        key={kind}
                                        value={kind}
                                    >
                                        {t(
                                            `listing.owner.editor.nightInfo.minAgeScopeOption.${kind}`,
                                            kind
                                        )}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        {scope.kind === 'from_time' && (
                            <Field
                                locale={locale}
                                idParts={idOf('policies.minAgeScope.from')}
                                label={t(
                                    'listing.owner.editor.nightInfo.minAgeScopeFromLabel',
                                    'Rige desde las'
                                )}
                                hint={t(
                                    'listing.owner.editor.nightInfo.minAgeScopeFromHint',
                                    'Rige desde esa hora hasta el cierre, incluida la madrugada después de la medianoche. Solo las horas del mismo día antes de esa hora quedan afuera.'
                                )}
                                error={errors['policies.minAgeScope.from']}
                            >
                                <TextInput
                                    type="time"
                                    value={scope.from}
                                    onChange={(event) =>
                                        onPolicyChange('minAgeScope', {
                                            kind: 'from_time',
                                            from: event.target.value
                                        })
                                    }
                                />
                            </Field>
                        )}
                        {scope.kind === 'area' && (
                            <I18nNoteField
                                locale={locale}
                                baseName="policies.minAgeScope.area"
                                legend={t(
                                    'listing.owner.editor.nightInfo.minAgeScopeAreaLabel',
                                    'Sector o actividad (es/en/pt)'
                                )}
                                maxLength={VENUE_MIN_AGE_SCOPE_AREA_MAX}
                                values={scope.area}
                                errors={errors}
                                onChange={(next) =>
                                    onPolicyChange('minAgeScope', { kind: 'area', area: next })
                                }
                            />
                        )}
                    </div>
                )}

                <div className={sectionStyles.full}>
                    <I18nNoteField
                        locale={locale}
                        baseName="entryNoteI18n"
                        legend={t(
                            'listing.owner.editor.nightInfo.entryNoteLabel',
                            'Nota sobre la entrada (es/en/pt)'
                        )}
                        values={data.entryNoteI18n}
                        errors={errors}
                        onChange={(next) => onFieldChange('entryNoteI18n', next)}
                    />
                </div>

                <div className={sectionStyles.full}>
                    <I18nNoteField
                        locale={locale}
                        baseName="policies.dressCodeNote"
                        legend={t(
                            'listing.owner.editor.nightInfo.dressCodeNoteLabel',
                            'Nota sobre el código de vestimenta (es/en/pt)'
                        )}
                        values={policies.dressCodeNote ?? EMPTY_NOTE}
                        errors={errors}
                        onChange={(next) =>
                            onPolicyChange(
                                'dressCodeNote',
                                isEmptyPolicyNote(next) ? undefined : next
                            )
                        }
                    />
                </div>
            </div>
        </Section>
    );
}
