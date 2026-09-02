/**
 * @file PracticalInfoSection.client.tsx
 * @description The four practical ficha fields of an experience listing —
 * duration (HOS-898), what to bring and requirements (HOS-1046), cancellation
 * policy (HOS-1047) and the private-groups toggle (HOS-1056).
 *
 * ## One section, four issues
 *
 * They share a table, a PATCH and a heading in the owner's mental model ("lo
 * práctico de la salida"), so splitting them into four sections would give the
 * section nav four one-field entries and make the owner scroll past three
 * headings to fill in what is really one form.
 *
 * ## Experience-only, by SHAPE not by gate
 *
 * The orchestrator mounts this only for the `experience` vertical, and that is
 * a shape decision exactly like `MeetingPointSection`'s: these keys exist on
 * `ExperienceOwnerUpdateInputSchema` and not on the gastronomy one, so
 * rendering them for a restaurant would offer fields every save silently
 * strips. Do not "generalise" without adding the columns first.
 *
 * ## Nothing here is paid
 *
 * Owner decision (2026-09-01): all four ship from the BASIC tier. There is no
 * entitlement check in this file and there must not be one — the HOS-974 audit
 * found three entitlements that are granted and demanded by no route, and a key
 * per ficha field manufactures exactly that.
 *
 * ## Why the two checklists are textareas, one item per line
 *
 * A row repeater (input + "add" + "remove" per item) is the obvious
 * alternative and costs index-keyed state, focus management after a removal,
 * and its own CSS — to collect what is a short list of short lines. A textarea
 * lets the owner paste a list they already wrote somewhere else, and the
 * line/array conversion is two pure functions that a test can pin down. The
 * cost is no per-ITEM error placement; schema errors roll up to the field,
 * which is what `useZodForm` does for `openingHours` already.
 */

import type { JSX } from 'react';
import { TextField } from '@/components/ui/TextField';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { CommerceEditData, CommerceFieldChange } from './commerce-edit-data';
import styles from './editor-fields.module.css';
import { COMMERCE_FIELD_PREFIX } from './field-ids';

/**
 * Splits a textarea's contents into checklist items.
 *
 * Blank and whitespace-only lines are DROPPED rather than preserved as `''`:
 * the schema rejects an empty item, so keeping them would turn a stray blank
 * line — which every person leaves while typing a list — into a save that
 * fails with an error about a line the owner cannot see.
 *
 * @param raw - The raw textarea value.
 * @returns One trimmed item per non-blank line, in order.
 */
export function linesToChecklistItems({ raw }: { readonly raw: string }): readonly string[] {
    return raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

/**
 * Renders checklist items back into a textarea value.
 *
 * The inverse of {@link linesToChecklistItems} only up to blank lines, which is
 * deliberate: the round trip normalises the owner's list instead of preserving
 * gaps that mean nothing to the ficha.
 *
 * @param items - The stored checklist.
 * @returns One item per line.
 */
export function checklistItemsToLines({ items }: { readonly items: readonly string[] }): string {
    return items.join('\n');
}

/**
 * Splits a stored duration into whole hours plus the leftover minutes.
 *
 * `null` becomes `{ hours: null, minutes: null }` — an owner who never declared
 * a duration must see two EMPTY boxes, not two zeroes, because "0 h 0 min" reads
 * as a declared duration of nothing.
 *
 * @param totalMinutes - The persisted duration, or `null`.
 * @returns The hours/minutes pair to seed the two inputs with.
 */
export function splitDuration({ totalMinutes }: { readonly totalMinutes: number | null }): {
    readonly hours: number | null;
    readonly minutes: number | null;
} {
    if (totalMinutes === null || !Number.isFinite(totalMinutes)) {
        return { hours: null, minutes: null };
    }
    return {
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60
    };
}

/**
 * Recombines the two inputs into the single stored duration.
 *
 * Both boxes empty means "not declared" (`null`), NOT zero — that is the whole
 * reason the editor keeps hours and minutes as two independent pieces of form
 * state instead of re-deriving them from the total on every render. Deriving
 * would make the boxes jump while the owner types ("90" in minutes would
 * rewrite itself to "1 h 30 min" mid-keystroke); keeping them independent means
 * what you type stays where you typed it, and the join happens once, here.
 *
 * @param hours - Whole hours, or `null` when the box is empty.
 * @param minutes - Leftover minutes, or `null` when the box is empty.
 * @returns The total in minutes, or `null` when nothing was entered.
 */
export function joinDuration({
    hours,
    minutes
}: {
    readonly hours: number | null;
    readonly minutes: number | null;
}): number | null {
    if (hours === null && minutes === null) return null;
    return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * Parses a whole-number input back to `number | null`.
 *
 * An empty box is `null`, not `0`. Anything unparseable is `null` too: the
 * controls are `type="number"`, so the only way to reach this with junk is a
 * browser handing over a partial value mid-typing.
 *
 * @param raw - The raw input value.
 * @returns The parsed integer, or `null`.
 */
export function parseWholeNumberInput({ raw }: { readonly raw: string }): number | null {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

/** Renders a nullable number as an input value; `null` renders as empty. */
function numberInputValue({ value }: { readonly value: number | null }): string {
    return value === null ? '' : String(value);
}

export interface PracticalInfoSectionProps {
    readonly locale: SupportedLocale;
    readonly data: CommerceEditData;
    readonly errors: Readonly<{
        durationMinutes?: string;
        whatToBring?: string;
        requirements?: string;
        cancellationPolicy?: string;
    }>;
    readonly onFieldChange: CommerceFieldChange;
}

export function PracticalInfoSection({
    locale,
    data,
    errors,
    onFieldChange
}: PracticalInfoSectionProps): JSX.Element {
    const { t } = createTranslations(locale);

    return (
        <section
            className={styles.section}
            id="editor-practicalInfo"
        >
            {/* Duration (HOS-898) — two boxes, one stored number. */}
            <TextField
                prefix={COMMERCE_FIELD_PREFIX}
                name="durationHours"
                label={t('commerce.owner.editor.sections.durationHours', 'Duración — horas')}
                labelClassName={styles.label}
                className={styles.input}
                error={errors.durationMinutes}
                type="number"
                min={0}
                step={1}
                value={numberInputValue({ value: data.durationHours })}
                placeholder="2"
                onChange={(event) => {
                    onFieldChange(
                        'durationHours',
                        parseWholeNumberInput({ raw: event.target.value })
                    );
                }}
            />

            <TextField
                prefix={COMMERCE_FIELD_PREFIX}
                name="durationMinutesPart"
                label={t('commerce.owner.editor.sections.durationMinutes', 'Duración — minutos')}
                labelClassName={styles.label}
                className={styles.input}
                type="number"
                min={0}
                step={1}
                value={numberInputValue({ value: data.durationMinutesPart })}
                placeholder="30"
                onChange={(event) => {
                    onFieldChange(
                        'durationMinutesPart',
                        parseWholeNumberInput({ raw: event.target.value })
                    );
                }}
            />

            <p className={styles.hint}>
                {t(
                    'commerce.owner.editor.sections.durationHint',
                    'Cuánto dura la experiencia. Dejá los dos campos vacíos si preferís no publicarlo.'
                )}
            </p>

            {/* What to bring (HOS-1046) */}
            <TextField
                as="textarea"
                prefix={COMMERCE_FIELD_PREFIX}
                name="whatToBring"
                label={t('commerce.owner.editor.sections.whatToBring', 'Qué llevar')}
                labelClassName={styles.label}
                className={styles.textarea}
                error={errors.whatToBring}
                rows={4}
                value={checklistItemsToLines({ items: data.whatToBring })}
                placeholder={t(
                    'commerce.owner.editor.sections.whatToBringPlaceholder',
                    'Repelente\nCalzado cerrado\nTraje de baño'
                )}
                onChange={(event) => {
                    onFieldChange(
                        'whatToBring',
                        linesToChecklistItems({ raw: event.target.value })
                    );
                }}
            />

            <p className={styles.hint}>
                {t(
                    'commerce.owner.editor.sections.whatToBringHint',
                    'Un ítem por línea. Lo que tiene que traer la persona que se anota.'
                )}
            </p>

            {/* Requirements (HOS-1046) */}
            <TextField
                as="textarea"
                prefix={COMMERCE_FIELD_PREFIX}
                name="requirements"
                label={t('commerce.owner.editor.sections.requirements', 'Requisitos')}
                labelClassName={styles.label}
                className={styles.textarea}
                error={errors.requirements}
                rows={4}
                value={checklistItemsToLines({ items: data.requirements })}
                placeholder={t(
                    'commerce.owner.editor.sections.requirementsPlaceholder',
                    'Edad mínima 12 años\nSaber nadar\nNo apto para embarazadas'
                )}
                onChange={(event) => {
                    onFieldChange(
                        'requirements',
                        linesToChecklistItems({ raw: event.target.value })
                    );
                }}
            />

            <p className={styles.hint}>
                {t(
                    'commerce.owner.editor.sections.requirementsHint',
                    'Un requisito por línea. Edad, estado físico, salud, lo que haga falta para poder participar.'
                )}
            </p>

            {/* Cancellation policy (HOS-1047) — free text, see the schema JSDoc. */}
            <TextField
                as="textarea"
                prefix={COMMERCE_FIELD_PREFIX}
                name="cancellationPolicy"
                label={t(
                    'commerce.owner.editor.sections.cancellationPolicy',
                    'Política de cancelación'
                )}
                labelClassName={styles.label}
                className={styles.textarea}
                error={errors.cancellationPolicy}
                rows={4}
                maxLength={1500}
                value={data.cancellationPolicy}
                placeholder={t(
                    'commerce.owner.editor.sections.cancellationPolicyPlaceholder',
                    'Si hay alerta meteorológica o baja el río, avisamos con 12 horas de anticipación y reprogramamos sin cargo.'
                )}
                onChange={(event) => {
                    onFieldChange('cancellationPolicy', event.target.value);
                }}
            />

            <p className={styles.hint}>
                {t(
                    'commerce.owner.editor.sections.cancellationPolicyHint',
                    'Qué pasa si la salida no sale: lluvia, viento, bajante del río, o si no se junta el mínimo de gente.'
                )}
            </p>

            {/* Private groups (HOS-1056) — a toggle and nothing else. */}
            <label className={styles.checkbox}>
                <input
                    type="checkbox"
                    checked={data.acceptsPrivateGroups}
                    onChange={(event) => {
                        onFieldChange('acceptsPrivateGroups', event.target.checked);
                    }}
                />
                {t(
                    'commerce.owner.editor.sections.acceptsPrivateGroups',
                    'Hago precio especial para grupos privados'
                )}
            </label>

            <p className={styles.hint}>
                {t(
                    'commerce.owner.editor.sections.acceptsPrivateGroupsHint',
                    'Si lo activás, la ficha invita a escribirte para consultar por grupos. No publicamos ningún tarifario.'
                )}
            </p>
        </section>
    );
}
