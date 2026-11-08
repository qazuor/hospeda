/**
 * @file PoliciesPanel.client.tsx
 * @description The house-rules ("Políticas") panel shared by the listing owner
 * editor and the host accommodation editor (HOS-2060).
 *
 * It edits keys of the `policies` JSONB. Which keys it renders is the caller's
 * decision (`keys`): every vertical gets the shared base (payment methods,
 * pets, smoking, events), plus its own — accommodation adds check-in/out and
 * the maximum stay, experience the cancellation text and private groups, venue
 * the reservation policy. The night-only venue keys (`minAge`, `dressCode`,
 * `dressCodeNote`) are NOT here: the catalog assigns them to the `nightInfo`
 * section, whose own form edits them.
 *
 * The panel only produces honest state: an emptied control REMOVES its key
 * (`onChange(key, undefined)`), never writes `false`/`''`/`[]`, because an
 * absent policy means "not informed" and is not the same as "no". The caller's
 * diff turns a removed key into `null` in the PATCH (see
 * `buildListingPoliciesPatch`), which is how the API deletes it.
 */

import {
    LISTING_PAYMENT_METHODS,
    LISTING_PET_ADMISSION_VALUES,
    LISTING_SMOKING_VALUES,
    type ListingPetAdmission,
    type ListingSmokingPolicy,
    VENUE_RESERVATION_POLICY_VALUES,
    type VenueReservationPolicy
} from '@repo/schemas';
import type { JSX } from 'react';
import { TextField } from '@/components/ui/TextField';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    isEmptyPolicyNote,
    type ListingPolicyKey,
    type ListingPolicyNote,
    type ListingPolicyTimeWindow,
    type ListingPolicyValues,
    paymentMethodLabel
} from '@/lib/listing/listing-policies';
import fieldStyles from './editor-fields.module.css';
import styles from './PoliciesPanel.module.css';

/** Change callback: `undefined` removes the key. */
export type ListingPolicyChange = <K extends ListingPolicyKey>(
    key: K,
    value: ListingPolicyValues[K] | undefined
) => void;

/** Props for {@link PoliciesPanel}. */
export interface PoliciesPanelProps {
    readonly locale: SupportedLocale;
    /** Field-id namespace of the hosting editor (`'ce'`, `'acc'`). */
    readonly idPrefix: string;
    /** The policy keys this panel renders and owns, in render order. */
    readonly keys: readonly ListingPolicyKey[];
    readonly policies: ListingPolicyValues;
    /** Field errors keyed by dotted path (`policies.pets.admission`). */
    readonly errors: Readonly<Record<string, string | undefined>>;
    readonly onChange: ListingPolicyChange;
}

const LOCALES = ['es', 'en', 'pt'] as const;

/** Parses a tri-state select value into `true` / `false` / `undefined`. */
function readTriState(raw: string): boolean | undefined {
    if (raw === 'yes') return true;
    if (raw === 'no') return false;
    return undefined;
}

/** Inverse of {@link readTriState}. */
function writeTriState(value: boolean | undefined): string {
    if (value === true) return 'yes';
    if (value === false) return 'no';
    return '';
}

/** Parses a positive integer input, `undefined` when empty or invalid. */
function readNights(raw: string): number | undefined {
    const trimmed = raw.trim();
    if (trimmed === '') return undefined;
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : undefined;
}

/** Drops empty ends of a time window; `undefined` when nothing is left. */
function cleanWindow(window: ListingPolicyTimeWindow): ListingPolicyTimeWindow | undefined {
    const next = {
        ...(window.from ? { from: window.from } : {}),
        ...(window.to ? { to: window.to } : {})
    };
    return next.from || next.to ? next : undefined;
}

/**
 * The house-rules panel.
 *
 * @param props - Locale, id namespace, owned keys, state, errors and change callback.
 * @returns The panel, or `null` when it owns no key.
 */
export function PoliciesPanel({
    locale,
    idPrefix,
    keys,
    policies,
    errors,
    onChange
}: PoliciesPanelProps): JSX.Element | null {
    const { t } = createTranslations(locale);
    if (keys.length === 0) return null;

    const notInformed = t('listing.policies.notInformed', 'No informado');
    const yes = t('listing.policies.yes', 'Sí');
    const no = t('listing.policies.no', 'No');
    const localeLabel = (code: (typeof LOCALES)[number]) =>
        t(
            `listing.policies.locale.${code}`,
            code === 'es' ? 'Español' : code === 'en' ? 'Inglés' : 'Portugués'
        );

    const renderTriState = (key: 'eventsAllowed' | 'privateGroups', label: string) => (
        <TextField
            key={key}
            as="select"
            prefix={idPrefix}
            name={`policies.${key}`}
            label={label}
            labelClassName={styles.groupTitle}
            className={fieldStyles.input}
            error={errors[`policies.${key}`]}
            value={writeTriState(policies[key])}
            onChange={(event) => onChange(key, readTriState(event.target.value))}
        >
            <option value="">{notInformed}</option>
            <option value="yes">{yes}</option>
            <option value="no">{no}</option>
        </TextField>
    );

    const renderWindow = (key: 'checkIn' | 'checkOut', label: string) => {
        const window = policies[key] ?? {};
        return (
            <fieldset
                key={key}
                className={styles.group}
            >
                <legend className={styles.groupTitle}>{label}</legend>
                <div className={styles.pair}>
                    {(['from', 'to'] as const).map((end) => (
                        // TextField renders a bare label + input fragment; the
                        // wrapper keeps each pair in its own grid cell.
                        <div
                            key={end}
                            className={styles.timeField}
                        >
                            <TextField
                                prefix={idPrefix}
                                name={`policies.${key}.${end}`}
                                label={
                                    end === 'from'
                                        ? t('listing.policies.time.from', 'Desde')
                                        : t('listing.policies.time.to', 'Hasta')
                                }
                                labelClassName={fieldStyles.hint}
                                className={fieldStyles.input}
                                error={
                                    errors[`policies.${key}.${end}`] ?? errors[`policies.${key}`]
                                }
                                type="time"
                                value={window[end] ?? ''}
                                onChange={(event) =>
                                    onChange(
                                        key,
                                        cleanWindow({ ...window, [end]: event.target.value })
                                    )
                                }
                            />
                        </div>
                    ))}
                </div>
            </fieldset>
        );
    };

    const renderPets = () => {
        const pets = policies.pets;
        const notes: ListingPolicyNote = pets?.notes ?? { es: '', en: '', pt: '' };
        const admits = pets !== undefined && pets.admission !== 'no';
        return (
            <fieldset
                key="pets"
                className={styles.group}
            >
                <legend className={styles.groupTitle}>
                    {t('listing.policies.pets.label', 'Mascotas')}
                </legend>
                <TextField
                    as="select"
                    prefix={idPrefix}
                    name="policies.pets.admission"
                    label={t('listing.policies.pets.admissionLabel', '¿Se admiten mascotas?')}
                    labelClassName={fieldStyles.hint}
                    className={fieldStyles.input}
                    error={errors['policies.pets.admission'] ?? errors['policies.pets']}
                    value={pets?.admission ?? ''}
                    onChange={(event) => {
                        const admission = event.target.value as ListingPetAdmission | '';
                        onChange(
                            'pets',
                            admission === ''
                                ? undefined
                                : {
                                      ...(pets ?? {}),
                                      admission,
                                      ...(admission === 'no' ? { extraCost: undefined } : {})
                                  }
                        );
                    }}
                >
                    <option value="">{notInformed}</option>
                    {LISTING_PET_ADMISSION_VALUES.map((admission) => (
                        <option
                            key={admission}
                            value={admission}
                        >
                            {t(`listing.policies.pets.admission.${admission}`, admission)}
                        </option>
                    ))}
                </TextField>
                {admits && (
                    <label className={fieldStyles.checkbox}>
                        <input
                            type="checkbox"
                            checked={pets.extraCost === true}
                            onChange={(event) =>
                                onChange('pets', { ...pets, extraCost: event.target.checked })
                            }
                        />
                        {t(
                            'listing.policies.pets.extraCostLabel',
                            'Cobro un cargo extra por mascota'
                        )}
                    </label>
                )}
                {pets && (
                    <div className={styles.noteGrid}>
                        {LOCALES.map((code) => (
                            <TextField
                                key={code}
                                prefix={idPrefix}
                                name={
                                    code === 'es'
                                        ? 'policies.pets.notes'
                                        : `policies.pets.notes.${code}`
                                }
                                label={`${t('listing.policies.pets.notesLabel', 'Nota')} (${localeLabel(code)})`}
                                labelClassName={fieldStyles.hint}
                                className={fieldStyles.input}
                                error={
                                    code === 'es'
                                        ? errors['policies.pets.notes']
                                        : errors[`policies.pets.notes.${code}`]
                                }
                                maxLength={200}
                                value={notes[code]}
                                onChange={(event) => {
                                    const nextNotes = { ...notes, [code]: event.target.value };
                                    onChange('pets', {
                                        ...pets,
                                        notes: isEmptyPolicyNote(nextNotes) ? undefined : nextNotes
                                    });
                                }}
                            />
                        ))}
                    </div>
                )}
            </fieldset>
        );
    };

    const renderers: Readonly<Partial<Record<ListingPolicyKey, () => JSX.Element>>> = {
        paymentMethods: () => {
            const selected = policies.paymentMethods ?? [];
            return (
                <fieldset
                    key="paymentMethods"
                    className={styles.group}
                    id={`${idPrefix}-policies-paymentMethods`}
                >
                    <legend className={styles.groupTitle}>
                        {t('listing.policies.paymentMethods.label', 'Medios de pago')}
                    </legend>
                    <div className={styles.optionGrid}>
                        {LISTING_PAYMENT_METHODS.map((method) => (
                            <label
                                key={method}
                                className={fieldStyles.checkbox}
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.includes(method)}
                                    onChange={() => {
                                        const next = selected.includes(method)
                                            ? selected.filter((item) => item !== method)
                                            : LISTING_PAYMENT_METHODS.filter(
                                                  (item) =>
                                                      item === method || selected.includes(item)
                                              );
                                        onChange(
                                            'paymentMethods',
                                            next.length > 0 ? next : undefined
                                        );
                                    }}
                                />
                                {paymentMethodLabel({ t, method })}
                            </label>
                        ))}
                    </div>
                    {errors['policies.paymentMethods'] && (
                        <p
                            className={fieldStyles.hint}
                            role="alert"
                        >
                            {errors['policies.paymentMethods']}
                        </p>
                    )}
                </fieldset>
            );
        },
        pets: renderPets,
        smokingAllowed: () => (
            <TextField
                key="smokingAllowed"
                as="select"
                prefix={idPrefix}
                name="policies.smokingAllowed"
                label={t('listing.policies.smokingAllowed.label', 'Fumar')}
                labelClassName={styles.groupTitle}
                className={fieldStyles.input}
                error={errors['policies.smokingAllowed']}
                value={policies.smokingAllowed ?? ''}
                onChange={(event) => {
                    const value = event.target.value as ListingSmokingPolicy | '';
                    onChange('smokingAllowed', value === '' ? undefined : value);
                }}
            >
                <option value="">{notInformed}</option>
                {LISTING_SMOKING_VALUES.map((value) => (
                    <option
                        key={value}
                        value={value}
                    >
                        {t(`listing.policies.smokingAllowed.${value}`, value)}
                    </option>
                ))}
            </TextField>
        ),
        eventsAllowed: () =>
            renderTriState(
                'eventsAllowed',
                t(
                    'listing.policies.eventsAllowed.editorLabel',
                    '¿Se pueden hacer eventos privados?'
                )
            ),
        checkIn: () => renderWindow('checkIn', t('listing.policies.checkIn.label', 'Check-in')),
        checkOut: () => renderWindow('checkOut', t('listing.policies.checkOut.label', 'Check-out')),
        maxNights: () => (
            <TextField
                key="maxNights"
                prefix={idPrefix}
                name="policies.maxNights"
                label={t('listing.policies.maxNights.label', 'Máximo de noches')}
                labelClassName={styles.groupTitle}
                className={fieldStyles.input}
                error={errors['policies.maxNights']}
                type="number"
                min={policies.minNights ?? 1}
                max={365}
                step={1}
                value={policies.maxNights ?? ''}
                onChange={(event) => onChange('maxNights', readNights(event.target.value))}
            />
        ),
        reservations: () => (
            <TextField
                key="reservations"
                as="select"
                prefix={idPrefix}
                name="policies.reservations"
                label={t('listing.policies.reservations.label', 'Reservas')}
                labelClassName={styles.groupTitle}
                className={fieldStyles.input}
                error={errors['policies.reservations']}
                value={policies.reservations ?? ''}
                onChange={(event) => {
                    const value = event.target.value as VenueReservationPolicy | '';
                    onChange('reservations', value === '' ? undefined : value);
                }}
            >
                <option value="">{notInformed}</option>
                {VENUE_RESERVATION_POLICY_VALUES.map((value) => (
                    <option
                        key={value}
                        value={value}
                    >
                        {t(`listing.policies.reservations.${value}`, value)}
                    </option>
                ))}
            </TextField>
        ),
        privateGroups: () =>
            renderTriState(
                'privateGroups',
                t(
                    'listing.policies.privateGroups.editorLabel',
                    'Hago precio especial para grupos privados'
                )
            ),
        cancellation: () => (
            <TextField
                key="cancellation"
                as="textarea"
                prefix={idPrefix}
                name="policies.cancellation"
                label={t('listing.policies.cancellation.label', 'Política de cancelación')}
                labelClassName={styles.groupTitle}
                className={fieldStyles.textarea}
                error={errors['policies.cancellation']}
                maxLength={1500}
                placeholder={t(
                    'listing.policies.cancellation.placeholder',
                    'Si hay alerta meteorológica o baja el río, avisamos con 12 horas de anticipación y reprogramamos sin cargo.'
                )}
                value={policies.cancellation ?? ''}
                onChange={(event) =>
                    onChange(
                        'cancellation',
                        event.target.value === '' ? undefined : event.target.value
                    )
                }
            />
        )
    };

    return (
        <fieldset
            className={styles.panel}
            data-testid="policies-panel"
        >
            <legend className={fieldStyles.label}>
                {t('listing.policies.panelTitle', 'Políticas')}
            </legend>
            <p className={fieldStyles.hint}>
                {t(
                    'listing.policies.panelHint',
                    'Lo que no completes se muestra como "no informado", nunca como un "no".'
                )}
            </p>
            {keys.map((key) => renderers[key]?.() ?? null)}
        </fieldset>
    );
}
