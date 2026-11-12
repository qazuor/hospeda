/**
 * @file AccommodationPolicyFields.client.tsx
 * @description The accommodation-only controls of the house-rules panel:
 * booking deposit and spoken languages (HOS-2120) and the private-events
 * details (HOS-2122).
 *
 * Split out of `PoliciesPanel.client.tsx` to keep that file under the size
 * limit; the panel decides WHEN each renders (by its `keys`), these components
 * only render. They follow the panel's honesty rule: an emptied control removes
 * its key (`undefined`), never writes `false`/`''`/`[]`.
 */

import { ACCOMMODATION_SPOKEN_LANGUAGES } from '@repo/schemas';
import type { JSX } from 'react';
import { TextField } from '@/components/ui/TextField';
import {
    isEmptyPolicyNote,
    type ListingDepositPolicyValue,
    type ListingEventsDetailsValue,
    type ListingPolicyNote,
    type ListingPolicyValues,
    spokenLanguageLabel
} from '@/lib/listing/listing-policies';
import fieldStyles from './editor-fields.module.css';
import styles from './PoliciesPanel.module.css';

/** Translator shape compatible with `createTranslations().t`. */
type Translate = (key: string, fallback?: string) => string;

const LOCALES = ['es', 'en', 'pt'] as const;
const EMPTY_NOTE: ListingPolicyNote = { es: '', en: '', pt: '' };

/** Props every field here shares. */
interface FieldBaseProps {
    readonly t: Translate;
    readonly idPrefix: string;
    readonly errors: Readonly<Record<string, string | undefined>>;
}

/** Parses an integer input; `undefined` when empty or not an integer. */
function readInteger(raw: string): number | undefined {
    const trimmed = raw.trim();
    if (trimmed === '') return undefined;
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : undefined;
}

/** Drops `undefined` members; returns `undefined` when nothing is left. */
function compactDetails(details: ListingEventsDetailsValue): ListingEventsDetailsValue | undefined {
    const entries = Object.entries(details).filter(([, value]) => value !== undefined);
    return entries.length > 0
        ? (Object.fromEntries(entries) as ListingEventsDetailsValue)
        : undefined;
}

/** A localized note editor (one input per locale), as the pets note uses. */
function PolicyNoteGrid({
    t,
    idPrefix,
    errors,
    path,
    notes,
    onChange
}: FieldBaseProps & {
    /** Dotted field path, e.g. `policies.deposit.notes`. */
    readonly path: string;
    readonly notes: ListingPolicyNote | undefined;
    readonly onChange: (notes: ListingPolicyNote | undefined) => void;
}): JSX.Element {
    const current = notes ?? EMPTY_NOTE;
    const localeLabel = (code: (typeof LOCALES)[number]) =>
        t(
            `listing.policies.locale.${code}`,
            code === 'es' ? 'Español' : code === 'en' ? 'Inglés' : 'Portugués'
        );
    return (
        <div className={styles.noteGrid}>
            {LOCALES.map((code) => {
                const name = code === 'es' ? path : `${path}.${code}`;
                return (
                    <TextField
                        key={code}
                        prefix={idPrefix}
                        name={name}
                        label={`${t('listing.policies.pets.notesLabel', 'Nota')} (${localeLabel(code)})`}
                        labelClassName={fieldStyles.hint}
                        className={fieldStyles.input}
                        error={errors[name]}
                        maxLength={200}
                        value={current[code]}
                        onChange={(event) => {
                            const next = { ...current, [code]: event.target.value };
                            onChange(isEmptyPolicyNote(next) ? undefined : next);
                        }}
                    />
                );
            })}
        </div>
    );
}

/**
 * Booking deposit ("seña"): yes / no / not informed, plus an optional
 * percentage and note while it is "yes". Switching to "no" drops both.
 *
 * @param props - Translator, id namespace, errors, the value and its setter.
 * @returns The deposit fieldset.
 */
export function DepositPolicyField({
    t,
    idPrefix,
    errors,
    deposit,
    onChange
}: FieldBaseProps & {
    readonly deposit: ListingDepositPolicyValue | undefined;
    readonly onChange: (deposit: ListingDepositPolicyValue | undefined) => void;
}): JSX.Element {
    const selectValue = deposit === undefined ? '' : deposit.required ? 'yes' : 'no';
    return (
        <fieldset
            key="deposit"
            className={styles.group}
        >
            <legend className={styles.groupTitle}>
                {t('listing.policies.deposit.label', 'Seña para reservar')}
            </legend>
            <TextField
                as="select"
                prefix={idPrefix}
                name="policies.deposit.required"
                label={t('listing.policies.deposit.editorLabel', '¿Pedís seña para reservar?')}
                labelClassName={fieldStyles.hint}
                className={fieldStyles.input}
                error={errors['policies.deposit.required'] ?? errors['policies.deposit']}
                value={selectValue}
                onChange={(event) => {
                    const raw = event.target.value;
                    if (raw === '') onChange(undefined);
                    else if (raw === 'no') onChange({ required: false });
                    else onChange({ ...(deposit?.required ? deposit : {}), required: true });
                }}
            >
                <option value="">{t('listing.policies.notInformed', 'No informado')}</option>
                <option value="yes">{t('listing.policies.yes', 'Sí')}</option>
                <option value="no">{t('listing.policies.no', 'No')}</option>
            </TextField>
            {deposit?.required === true && (
                <>
                    <TextField
                        prefix={idPrefix}
                        name="policies.deposit.percentage"
                        label={t(
                            'listing.policies.deposit.percentageLabel',
                            'Porcentaje de la seña (%)'
                        )}
                        labelClassName={fieldStyles.hint}
                        className={fieldStyles.input}
                        error={errors['policies.deposit.percentage']}
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        value={deposit.percentage ?? ''}
                        onChange={(event) => {
                            const { percentage: _previous, ...rest } = deposit;
                            const percentage = readInteger(event.target.value);
                            onChange(percentage === undefined ? rest : { ...rest, percentage });
                        }}
                    />
                    <PolicyNoteGrid
                        t={t}
                        idPrefix={idPrefix}
                        errors={errors}
                        path="policies.deposit.notes"
                        notes={deposit.notes}
                        onChange={(notes) => {
                            const { notes: _previous, ...rest } = deposit;
                            onChange(notes ? { ...rest, notes } : rest);
                        }}
                    />
                </>
            )}
        </fieldset>
    );
}

/**
 * Spoken languages: a multi-select over the closed list. Unticking the last
 * one removes the key.
 *
 * @param props - Translator, id namespace, errors, the value and its setter.
 * @returns The languages fieldset.
 */
export function SpokenLanguagesField({
    t,
    idPrefix,
    errors,
    languages,
    onChange
}: FieldBaseProps & {
    readonly languages: ListingPolicyValues['spokenLanguages'];
    readonly onChange: (languages: ListingPolicyValues['spokenLanguages']) => void;
}): JSX.Element {
    const selected = languages ?? [];
    return (
        <fieldset
            key="spokenLanguages"
            className={styles.group}
            id={`${idPrefix}-policies-spokenLanguages`}
        >
            <legend className={styles.groupTitle}>
                {t('listing.policies.spokenLanguages.label', 'Idiomas en que te atendemos')}
            </legend>
            <p className={fieldStyles.hint}>
                {t(
                    'listing.policies.spokenLanguages.editorHint',
                    'Marcá los idiomas en los que podés atender a los huéspedes.'
                )}
            </p>
            <div className={styles.optionGrid}>
                {ACCOMMODATION_SPOKEN_LANGUAGES.map((language) => (
                    <label
                        key={language}
                        className={fieldStyles.checkbox}
                    >
                        <input
                            type="checkbox"
                            checked={selected.includes(language)}
                            onChange={() => {
                                const next = selected.includes(language)
                                    ? selected.filter((item) => item !== language)
                                    : ACCOMMODATION_SPOKEN_LANGUAGES.filter(
                                          (item) => item === language || selected.includes(item)
                                      );
                                onChange(next.length > 0 ? next : undefined);
                            }}
                        />
                        {spokenLanguageLabel({ t, language })}
                    </label>
                ))}
            </div>
            {errors['policies.spokenLanguages'] && (
                <p
                    className={fieldStyles.hint}
                    role="alert"
                >
                    {errors['policies.spokenLanguages']}
                </p>
            )}
        </fieldset>
    );
}

/**
 * Private-events details: shown only while events are allowed (the caller
 * passes `eventsAllowed`). Each control is optional; emptying the last one
 * removes the key.
 *
 * @param props - Translator, id namespace, errors, whether events are allowed,
 *   the value and its setter.
 * @returns The details fieldset, or `null` when events are not allowed.
 */
export function EventsDetailsField({
    t,
    idPrefix,
    errors,
    eventsAllowed,
    details,
    onChange
}: FieldBaseProps & {
    readonly eventsAllowed: boolean | undefined;
    readonly details: ListingEventsDetailsValue | undefined;
    readonly onChange: (details: ListingEventsDetailsValue | undefined) => void;
}): JSX.Element | null {
    if (eventsAllowed !== true) return null;
    const current = details ?? {};
    const set = <K extends keyof ListingEventsDetailsValue>(
        key: K,
        value: ListingEventsDetailsValue[K] | undefined
    ) => onChange(compactDetails({ ...current, [key]: value }));
    return (
        <fieldset
            key="eventsDetails"
            className={styles.group}
            data-testid="events-details"
        >
            <legend className={styles.groupTitle}>
                {t('listing.policies.eventsDetails.title', 'Detalles de los eventos')}
            </legend>
            <div className={styles.pair}>
                <div className={styles.timeField}>
                    <TextField
                        prefix={idPrefix}
                        name="policies.eventsDetails.maxGuests"
                        label={t(
                            'listing.policies.eventsDetails.maxGuestsLabel',
                            'Máximo de invitados'
                        )}
                        labelClassName={fieldStyles.hint}
                        className={fieldStyles.input}
                        error={errors['policies.eventsDetails.maxGuests']}
                        type="number"
                        min={1}
                        max={1000}
                        step={1}
                        value={current.maxGuests ?? ''}
                        onChange={(event) => set('maxGuests', readInteger(event.target.value))}
                    />
                </div>
                <div className={styles.timeField}>
                    <TextField
                        prefix={idPrefix}
                        name="policies.eventsDetails.endTime"
                        label={t('listing.policies.eventsDetails.endTimeLabel', 'Horario límite')}
                        labelClassName={fieldStyles.hint}
                        className={fieldStyles.input}
                        error={errors['policies.eventsDetails.endTime']}
                        type="time"
                        value={current.endTime ?? ''}
                        onChange={(event) => set('endTime', event.target.value || undefined)}
                    />
                </div>
            </div>
            {/* Tri-state on purpose: "no amplified sound" is information a guest
                planning a quiet gathering wants, unlike an unticked box. */}
            <TextField
                as="select"
                prefix={idPrefix}
                name="policies.eventsDetails.amplifiedSound"
                label={t(
                    'listing.policies.eventsDetails.amplifiedSoundLabel',
                    'Se permite música o sonido amplificado'
                )}
                labelClassName={fieldStyles.hint}
                className={fieldStyles.input}
                error={errors['policies.eventsDetails.amplifiedSound']}
                value={
                    current.amplifiedSound === undefined
                        ? ''
                        : current.amplifiedSound
                          ? 'yes'
                          : 'no'
                }
                onChange={(event) => {
                    const raw = event.target.value;
                    set('amplifiedSound', raw === '' ? undefined : raw === 'yes');
                }}
            >
                <option value="">{t('listing.policies.notInformed', 'No informado')}</option>
                <option value="yes">{t('listing.policies.yes', 'Sí')}</option>
                <option value="no">{t('listing.policies.no', 'No')}</option>
            </TextField>
            <label className={fieldStyles.checkbox}>
                <input
                    type="checkbox"
                    checked={current.extraCost === true}
                    onChange={(event) => set('extraCost', event.target.checked || undefined)}
                />
                {t(
                    'listing.policies.eventsDetails.extraCostLabel',
                    'Cobro un cargo extra por evento'
                )}
            </label>
            <PolicyNoteGrid
                t={t}
                idPrefix={idPrefix}
                errors={errors}
                path="policies.eventsDetails.notes"
                notes={current.notes}
                onChange={(notes) => set('notes', notes)}
            />
        </fieldset>
    );
}
