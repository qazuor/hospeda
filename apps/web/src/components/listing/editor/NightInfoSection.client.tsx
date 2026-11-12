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
 */

import {
    VENUE_MIN_AGE_SCOPE_AREA_MAX,
    VENUE_MIN_AGE_SCOPE_KINDS,
    VenueDressCodeEnum,
    VenueEntryKindEnum,
    type VenueMinAgeScope,
    type VenueMinAgeScopeKind
} from '@repo/schemas';
import type { JSX } from 'react';
import { TextField } from '@/components/ui/TextField';
import { formatMonthYearLabel } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { isEmptyPolicyNote } from '@/lib/listing/listing-policies';
import { centsToPesosInputValue, parsePesosInputToCents } from '@/lib/listing/price-units';
import fieldStyles from './editor-fields.module.css';
import { LISTING_FIELD_PREFIX } from './field-ids';
import type { ListingEditData, ListingFieldChange } from './listing-edit-data';
import styles from './NightInfoSection.module.css';
import type { ListingPolicyChange } from './PoliciesPanel.client';

/** Id of the hint announced with the scope selector (HOS-2098). */
const AGE_SCOPE_HINT_ID = 'night-info-age-scope-hint';

/** Id of the hint announced with the "from a time" input (HOS-2098). */
const AGE_SCOPE_FROM_HINT_ID = 'night-info-age-scope-from-hint';

/** The note shown while the owner has not written one. */
const EMPTY_NOTE = { es: '', en: '', pt: '' } as const;

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
 * Three controls (es/en/pt) for one localized note.
 *
 * The `es` control carries the BARE Zod key so its DOM id is the one
 * `buildFieldId`/`focusFirstInvalidField` derive for the field; `en`/`pt` use
 * dotted paths, whose ids are the nested targets.
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
    const labelFor = (code: 'es' | 'en' | 'pt') =>
        code === 'es'
            ? t('listing.owner.editor.nightInfo.localeEs', 'Español')
            : code === 'en'
              ? t('listing.owner.editor.nightInfo.localeEn', 'Inglés')
              : t('listing.owner.editor.nightInfo.localePt', 'Portugués');

    const renderField = (code: 'es' | 'en' | 'pt') => {
        const name = code === 'es' ? baseName : `${baseName}.${code}`;

        return (
            <TextField
                key={code}
                prefix={LISTING_FIELD_PREFIX}
                name={name}
                label={labelFor(code)}
                labelClassName={fieldStyles.label}
                className={fieldStyles.input}
                error={code === 'es' ? (errors[baseName] ?? errors[name]) : errors[name]}
                value={values[code]}
                maxLength={maxLength}
                onChange={(event) => onChange({ ...values, [code]: event.target.value })}
            />
        );
    };

    return (
        <fieldset className={fieldStyles.section}>
            <legend className={fieldStyles.label}>{legend}</legend>
            <div className={styles.noteGrid}>{(['es', 'en', 'pt'] as const).map(renderField)}</div>
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
 * @returns The section, or an empty fragment for a non-venue listing.
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

    const updatedAt = data.entryPriceUpdatedAt === null ? null : new Date(data.entryPriceUpdatedAt);
    const hasValidUpdatedAt = updatedAt !== null && !Number.isNaN(updatedAt.getTime());

    return (
        <section
            className={fieldStyles.section}
            id="editor-nightInfo"
        >
            <TextField
                as="select"
                prefix={LISTING_FIELD_PREFIX}
                name="entryKind"
                label={t('venue.detail.nightInfo.entryLabel', 'Entrada')}
                labelClassName={fieldStyles.label}
                className={fieldStyles.input}
                error={errors.entryKind}
                value={data.entryKind}
                onChange={(event) => onFieldChange('entryKind', event.target.value)}
            >
                <option value="">
                    {t('listing.owner.editor.nightInfo.notInformed', 'No informado')}
                </option>
                {Object.values(VenueEntryKindEnum).map((kind) => (
                    <option
                        key={kind}
                        value={kind}
                    >
                        {t(`venue.detail.nightInfo.entryKind.${kind}`, kind)}
                    </option>
                ))}
            </TextField>

            {/* Kept mounted while not `paid` so its id remains the focus target
                for a stale error; `hidden` is what keeps it out of the UI. */}
            <div
                className={styles.priceField}
                data-testid="night-info-price-field"
                hidden={data.entryKind !== VenueEntryKindEnum.PAID}
            >
                <TextField
                    prefix={LISTING_FIELD_PREFIX}
                    name="entryPriceFrom"
                    label={t(
                        'listing.owner.editor.nightInfo.entryPriceFrom',
                        'Precio desde (en pesos)'
                    )}
                    labelClassName={fieldStyles.label}
                    className={fieldStyles.input}
                    error={errors.entryPriceFrom}
                    type="number"
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
                {hasValidUpdatedAt && (
                    <p className={fieldStyles.hint}>
                        {t(
                            'listing.owner.editor.nightInfo.priceUpdatedAt',
                            'Actualizado {{month}}',
                            {
                                month: formatMonthYearLabel({
                                    date: updatedAt,
                                    locale
                                })
                            }
                        )}
                    </p>
                )}
            </div>

            <TextField
                prefix={LISTING_FIELD_PREFIX}
                name="policies.minAge"
                label={t('venue.detail.nightInfo.minAgeLabel', 'Edad mínima')}
                labelClassName={fieldStyles.label}
                className={fieldStyles.input}
                error={errors['policies.minAge']}
                type="number"
                min={13}
                max={30}
                step={1}
                value={policies.minAge ?? ''}
                onChange={(event) => {
                    const raw = event.target.value.trim();
                    const parsed = raw === '' ? undefined : Number(raw);
                    const next =
                        parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined;
                    onPolicyChange('minAge', next);
                    // HOS-2098: no age, no scope.
                    if (next === undefined) onPolicyChange('minAgeScope', undefined);
                }}
            />

            {policies.minAge !== undefined && (
                <div
                    className={styles.scopeField}
                    data-testid="night-info-age-scope"
                >
                    <TextField
                        as="select"
                        prefix={LISTING_FIELD_PREFIX}
                        name="policies.minAgeScope"
                        label={t(
                            'listing.owner.editor.nightInfo.minAgeScopeLabel',
                            'Alcance de la edad mínima'
                        )}
                        labelClassName={fieldStyles.label}
                        className={fieldStyles.input}
                        error={errors['policies.minAgeScope']}
                        describedByExtraId={AGE_SCOPE_HINT_ID}
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
                    </TextField>
                    <p
                        id={AGE_SCOPE_HINT_ID}
                        className={fieldStyles.hint}
                    >
                        {t(
                            'listing.owner.editor.nightInfo.minAgeScopeHint',
                            'Se muestra junto a la edad mínima en tu ficha y el asistente lo usa para responder.'
                        )}
                    </p>
                    {scope.kind === 'from_time' && (
                        <TextField
                            prefix={LISTING_FIELD_PREFIX}
                            name="policies.minAgeScope.from"
                            label={t(
                                'listing.owner.editor.nightInfo.minAgeScopeFromLabel',
                                'Rige desde las'
                            )}
                            labelClassName={fieldStyles.label}
                            className={fieldStyles.input}
                            error={errors['policies.minAgeScope.from']}
                            describedByExtraId={AGE_SCOPE_FROM_HINT_ID}
                            type="time"
                            value={scope.from}
                            onChange={(event) =>
                                onPolicyChange('minAgeScope', {
                                    kind: 'from_time',
                                    from: event.target.value
                                })
                            }
                        />
                    )}
                    {scope.kind === 'from_time' && (
                        <p
                            id={AGE_SCOPE_FROM_HINT_ID}
                            className={fieldStyles.hint}
                        >
                            {t(
                                'listing.owner.editor.nightInfo.minAgeScopeFromHint',
                                'Rige desde esa hora hasta el cierre, incluida la madrugada después de la medianoche. Solo las horas del mismo día antes de esa hora quedan afuera.'
                            )}
                        </p>
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

            <I18nNoteField
                locale={locale}
                baseName="entryNoteI18n"
                legend={t('listing.owner.editor.nightInfo.entryNoteLabel', 'Nota (es/en/pt)')}
                values={data.entryNoteI18n}
                errors={errors}
                onChange={(next) => onFieldChange('entryNoteI18n', next)}
            />

            <TextField
                as="select"
                prefix={LISTING_FIELD_PREFIX}
                name="policies.dressCode"
                label={t('venue.detail.nightInfo.dressCodeLabel', 'Código de vestimenta')}
                labelClassName={fieldStyles.label}
                className={fieldStyles.input}
                error={errors['policies.dressCode']}
                value={policies.dressCode ?? ''}
                onChange={(event) => {
                    const value = event.target.value as VenueDressCodeEnum | '';
                    onPolicyChange('dressCode', value === '' ? undefined : value);
                }}
            >
                <option value="">
                    {t('listing.owner.editor.nightInfo.notInformed', 'No informado')}
                </option>
                {Object.values(VenueDressCodeEnum).map((value) => (
                    <option
                        key={value}
                        value={value}
                    >
                        {t(`venue.detail.nightInfo.dressCode.${value}`, value)}
                    </option>
                ))}
            </TextField>

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
                    onPolicyChange('dressCodeNote', isEmptyPolicyNote(next) ? undefined : next)
                }
            />
        </section>
    );
}
