/**
 * @file PracticalInfoSection.client.tsx
 * @description The practical ficha fields of an experience listing —
 * duration (HOS-898), what to bring and requirements (HOS-1046).
 *
 * HOS-2060 moved the cancellation policy (HOS-1047) and the private-groups
 * toggle (HOS-1056) into `policies` (`policies.cancellation`,
 * `policies.privateGroups`); the catalog puts `policies` in the amenities
 * section, so they are edited by that page's Policies panel now.
 *
 * ## One section, several issues
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
 * `ExperienceOwnerUpdateInputSchema` and not on the venue one, so
 * rendering them for a restaurant would offer fields every save silently
 * strips. Do not "generalise" without adding the columns first.
 *
 * ## Nothing here is paid
 *
 * Owner decision (2026-09-01): all of them ship from the BASIC tier. There is no
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
import { Field } from '@/components/account/ui/Field';
import { Section } from '@/components/account/ui/Section';
import { Textarea } from '@/components/account/ui/Textarea';
import { TextInput } from '@/components/account/ui/TextInput';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { sectionHelpId } from '@/lib/help/section-help-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { LISTING_FIELD_ID_SUFFIXES, LISTING_FIELD_PREFIX } from './field-ids';
import type { ListingEditData, ListingFieldChange } from './listing-edit-data';
import styles from './listing-section.module.css';

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
    readonly data: ListingEditData;
    readonly errors: Readonly<{
        durationMinutes?: string;
        whatToBring?: string;
        requirements?: string;
    }>;
    readonly onFieldChange: ListingFieldChange;
}

export function PracticalInfoSection({
    locale,
    data,
    errors,
    onFieldChange
}: PracticalInfoSectionProps): JSX.Element {
    const { t } = createTranslations(locale);
    const idOf = (name: string) => ({ prefix: LISTING_FIELD_PREFIX, name });

    return (
        <Section
            id="editor-practicalInfo"
            title={t('listing.owner.editor.groups.practicalInfo', 'Lo práctico de la salida')}
            // Experience-only by shape (see the file docblock), so the anchor's
            // vertical is fixed rather than read from a prop.
            helpId={sectionHelpId({ vertical: 'experience', slug: 'datos-practicos' })}
        >
            <div className={styles.grid}>
                {/*
                 * Duration (HOS-898): TWO controls, ONE Zod field, like
                 * `contactInfo.mobilePhone`. Both carry the schema name
                 * `durationMinutes`; the minutes box takes its suffix from
                 * LISTING_FIELD_ID_SUFFIXES, the same map `focusFirstInvalidField`
                 * reads, so the control the error points at and the one focus
                 * lands on cannot drift.
                 */}
                <div className={styles.full}>
                    <div className={styles.pair}>
                        <Field
                            locale={locale}
                            id={buildFieldId({
                                ...idOf('durationMinutes'),
                                suffix: 'hours'
                            })}
                            label={t(
                                'listing.owner.editor.sections.durationHours',
                                'Duración — horas'
                            )}
                        >
                            <TextInput
                                type="number"
                                inputMode="numeric"
                                min={0}
                                step={1}
                                value={numberInputValue({ value: data.durationHours })}
                                placeholder={t(
                                    'listing.owner.editor.sections.durationHoursPlaceholder',
                                    'Ej.: 2'
                                )}
                                onChange={(event) => {
                                    onFieldChange(
                                        'durationHours',
                                        parseWholeNumberInput({ raw: event.target.value })
                                    );
                                }}
                            />
                        </Field>
                        <Field
                            locale={locale}
                            id={buildFieldId({
                                ...idOf('durationMinutes'),
                                suffix: LISTING_FIELD_ID_SUFFIXES.durationMinutes
                            })}
                            label={t(
                                'listing.owner.editor.sections.durationMinutes',
                                'Duración — minutos'
                            )}
                            // The error lives on the focus target: a rejected
                            // duration is reported in minutes.
                            error={errors.durationMinutes}
                        >
                            <TextInput
                                type="number"
                                inputMode="numeric"
                                min={0}
                                step={1}
                                value={numberInputValue({ value: data.durationMinutesPart })}
                                placeholder={t(
                                    'listing.owner.editor.sections.durationMinutesPlaceholder',
                                    'Ej.: 30'
                                )}
                                onChange={(event) => {
                                    onFieldChange(
                                        'durationMinutesPart',
                                        parseWholeNumberInput({ raw: event.target.value })
                                    );
                                }}
                            />
                        </Field>
                    </div>
                    <p className={styles.hint}>
                        {t(
                            'listing.owner.editor.sections.durationHint',
                            'Cuánto dura la experiencia. Dejá los dos campos vacíos si preferís no publicarlo.'
                        )}
                    </p>
                </div>

                {/* What to bring (HOS-1046) */}
                <Field
                    locale={locale}
                    idParts={idOf('whatToBring')}
                    label={t('listing.owner.editor.sections.whatToBring', 'Qué llevar')}
                    hint={t(
                        'listing.owner.editor.sections.whatToBringHint',
                        'Un ítem por línea. Lo que tiene que traer la persona que se anota.'
                    )}
                    error={errors.whatToBring}
                >
                    <Textarea
                        rows={4}
                        value={checklistItemsToLines({ items: data.whatToBring })}
                        placeholder={t(
                            'listing.owner.editor.sections.whatToBringPlaceholder',
                            'Repelente\nCalzado cerrado\nTraje de baño'
                        )}
                        onChange={(event) => {
                            onFieldChange(
                                'whatToBring',
                                linesToChecklistItems({ raw: event.target.value })
                            );
                        }}
                    />
                </Field>

                {/* Requirements (HOS-1046) */}
                <Field
                    locale={locale}
                    idParts={idOf('requirements')}
                    label={t('listing.owner.editor.sections.requirements', 'Requisitos')}
                    hint={t(
                        'listing.owner.editor.sections.requirementsHint',
                        'Un requisito por línea. Edad, estado físico, salud, lo que haga falta para poder participar.'
                    )}
                    error={errors.requirements}
                >
                    <Textarea
                        rows={4}
                        value={checklistItemsToLines({ items: data.requirements })}
                        placeholder={t(
                            'listing.owner.editor.sections.requirementsPlaceholder',
                            'Edad mínima 12 años\nSaber nadar\nNo apto para embarazadas'
                        )}
                        onChange={(event) => {
                            onFieldChange(
                                'requirements',
                                linesToChecklistItems({ raw: event.target.value })
                            );
                        }}
                    />
                </Field>
            </div>
        </Section>
    );
}
