/**
 * @file PoliciesPanel.client.tsx
 * @description The house-rules ("Políticas") panel shared by the listing owner
 * editor and the host accommodation editor (HOS-2060).
 *
 * HOS-2488: kit fields (`Field` + controls); the panel has no title of its own,
 * the hosting kit `Section` provides it.
 *
 * It edits keys of the `policies` JSONB. Which keys it renders is the caller's
 * decision (`keys`): every vertical gets the shared base (payment methods,
 * pets, smoking, events), plus its own — accommodation adds check-in/out, the
 * booking deposit, spoken languages and the private-events details (HOS-2120,
 * HOS-2122; see `AccommodationPolicyFields.client.tsx`), experience the
 * cancellation text and private groups, venue the reservation policy. The
 * accommodation's maximum stay is edited next to the minimum on the capacity
 * page (HOS-2121), not here. The night-only venue keys (`minAge`, `dressCode`,
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
import { Checkbox, CheckboxGroup } from '@/components/account/ui/Checkbox';
import { Field } from '@/components/account/ui/Field';
import { Select } from '@/components/account/ui/Select';
import { Textarea } from '@/components/account/ui/Textarea';
import { TextInput } from '@/components/account/ui/TextInput';
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
import {
    DepositPolicyField,
    EventsDetailsField,
    SpokenLanguagesField
} from './AccommodationPolicyFields.client';
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
    const idOf = (name: string) => ({ prefix: idPrefix, name });

    const renderTriState = (key: 'eventsAllowed' | 'privateGroups', label: string) => (
        <Field
            key={key}
            locale={locale}
            idParts={idOf(`policies.${key}`)}
            label={label}
            error={errors[`policies.${key}`]}
        >
            <Select
                value={writeTriState(policies[key])}
                onChange={(event) => onChange(key, readTriState(event.target.value))}
            >
                <option value="">{notInformed}</option>
                <option value="yes">{yes}</option>
                <option value="no">{no}</option>
            </Select>
        </Field>
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
                        <Field
                            key={end}
                            locale={locale}
                            idParts={idOf(`policies.${key}.${end}`)}
                            label={
                                end === 'from'
                                    ? t('listing.policies.time.from', 'Desde')
                                    : t('listing.policies.time.to', 'Hasta')
                            }
                            error={errors[`policies.${key}.${end}`] ?? errors[`policies.${key}`]}
                        >
                            <TextInput
                                type="time"
                                value={window[end] ?? ''}
                                onChange={(event) =>
                                    onChange(
                                        key,
                                        cleanWindow({ ...window, [end]: event.target.value })
                                    )
                                }
                            />
                        </Field>
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
                <Field
                    locale={locale}
                    idParts={idOf('policies.pets.admission')}
                    label={t('listing.policies.pets.admissionLabel', '¿Se admiten mascotas?')}
                    error={errors['policies.pets.admission'] ?? errors['policies.pets']}
                >
                    <Select
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
                    </Select>
                </Field>
                {admits && (
                    <Checkbox
                        checked={pets.extraCost === true}
                        onChange={(event) =>
                            onChange('pets', { ...pets, extraCost: event.target.checked })
                        }
                        label={t(
                            'listing.policies.pets.extraCostLabel',
                            'Cobro un cargo extra por mascota'
                        )}
                    />
                )}
                {pets && (
                    <div className={styles.noteGrid}>
                        {LOCALES.map((code) => (
                            <Field
                                key={code}
                                locale={locale}
                                idParts={idOf(
                                    code === 'es'
                                        ? 'policies.pets.notes'
                                        : `policies.pets.notes.${code}`
                                )}
                                label={`${t('listing.policies.pets.notesLabel', 'Nota')} (${localeLabel(code)})`}
                                error={
                                    code === 'es'
                                        ? errors['policies.pets.notes']
                                        : errors[`policies.pets.notes.${code}`]
                                }
                            >
                                <TextInput
                                    maxLength={200}
                                    value={notes[code]}
                                    onChange={(event) => {
                                        const nextNotes = { ...notes, [code]: event.target.value };
                                        onChange('pets', {
                                            ...pets,
                                            notes: isEmptyPolicyNote(nextNotes)
                                                ? undefined
                                                : nextNotes
                                        });
                                    }}
                                />
                            </Field>
                        ))}
                    </div>
                )}
            </fieldset>
        );
    };

    /** Groups, long text and the accommodation sub-forms take the whole row. */
    const wide = (key: string, node: JSX.Element) => (
        <div
            key={key}
            className={styles.wide}
        >
            {node}
        </div>
    );

    const renderers: Readonly<Partial<Record<ListingPolicyKey, () => JSX.Element>>> = {
        paymentMethods: () => {
            const selected = policies.paymentMethods ?? [];
            return wide(
                'paymentMethods',
                // The wrapper carries the id focus-on-error lands on; the kit
                // group is a fieldset that takes no id.
                <div id={`${idPrefix}-policies-paymentMethods`}>
                    <CheckboxGroup
                        locale={locale}
                        legend={t('listing.policies.paymentMethods.label', 'Medios de pago')}
                        error={errors['policies.paymentMethods']}
                    >
                        {LISTING_PAYMENT_METHODS.map((method) => (
                            <Checkbox
                                key={method}
                                checked={selected.includes(method)}
                                onChange={() => {
                                    const next = selected.includes(method)
                                        ? selected.filter((item) => item !== method)
                                        : LISTING_PAYMENT_METHODS.filter(
                                              (item) => item === method || selected.includes(item)
                                          );
                                    onChange('paymentMethods', next.length > 0 ? next : undefined);
                                }}
                                label={paymentMethodLabel({ t, method })}
                            />
                        ))}
                    </CheckboxGroup>
                </div>
            );
        },
        pets: () => wide('pets', renderPets()),
        smokingAllowed: () => (
            <Field
                key="smokingAllowed"
                locale={locale}
                idParts={idOf('policies.smokingAllowed')}
                label={t('listing.policies.smokingAllowed.label', 'Fumar')}
                error={errors['policies.smokingAllowed']}
            >
                <Select
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
                </Select>
            </Field>
        ),
        eventsAllowed: () =>
            renderTriState(
                'eventsAllowed',
                t(
                    'listing.policies.eventsAllowed.editorLabel',
                    '¿Se pueden hacer eventos privados?'
                )
            ),
        checkIn: () =>
            wide(
                'checkIn',
                renderWindow('checkIn', t('listing.policies.checkIn.label', 'Check-in'))
            ),
        checkOut: () =>
            wide(
                'checkOut',
                renderWindow('checkOut', t('listing.policies.checkOut.label', 'Check-out'))
            ),
        deposit: () =>
            wide(
                'deposit',
                <DepositPolicyField
                    t={t}
                    idPrefix={idPrefix}
                    errors={errors}
                    deposit={policies.deposit}
                    onChange={(value) => onChange('deposit', value)}
                />
            ),
        spokenLanguages: () =>
            wide(
                'spokenLanguages',
                <SpokenLanguagesField
                    t={t}
                    idPrefix={idPrefix}
                    errors={errors}
                    languages={policies.spokenLanguages}
                    onChange={(value) => onChange('spokenLanguages', value)}
                />
            ),
        // Renders only while `eventsAllowed` is true; the caller lists it right
        // after `eventsAllowed` so the details sit under the yes/no.
        eventsDetails: () =>
            wide(
                'eventsDetails',
                <EventsDetailsField
                    t={t}
                    idPrefix={idPrefix}
                    errors={errors}
                    eventsAllowed={policies.eventsAllowed}
                    details={policies.eventsDetails}
                    onChange={(value) => onChange('eventsDetails', value)}
                />
            ),
        reservations: () => (
            <Field
                key="reservations"
                locale={locale}
                idParts={idOf('policies.reservations')}
                label={t('listing.policies.reservations.label', 'Reservas')}
                error={errors['policies.reservations']}
            >
                <Select
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
                </Select>
            </Field>
        ),
        privateGroups: () =>
            renderTriState(
                'privateGroups',
                t(
                    'listing.policies.privateGroups.editorLabel',
                    'Hago precio especial para grupos privados'
                )
            ),
        cancellation: () =>
            wide(
                'cancellation',
                <Field
                    locale={locale}
                    idParts={idOf('policies.cancellation')}
                    label={t('listing.policies.cancellation.label', 'Política de cancelación')}
                    error={errors['policies.cancellation']}
                >
                    <Textarea
                        limit={1500}
                        locale={locale}
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
                </Field>
            )
    };

    // The hosting page's kit `Section` gives the panel its title; the panel
    // only renders the hint and the fields.
    return (
        <div
            className={styles.panel}
            data-testid="policies-panel"
        >
            <p className={styles.hint}>
                {t(
                    'listing.policies.panelHint',
                    'Lo que no completes se muestra como "no informado", nunca como un "no".'
                )}
            </p>
            <div className={styles.grid}>{keys.map((key) => renderers[key]?.() ?? null)}</div>
        </div>
    );
}
