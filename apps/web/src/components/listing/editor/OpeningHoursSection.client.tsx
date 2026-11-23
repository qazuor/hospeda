/**
 * @file OpeningHoursSection.client.tsx
 * @description Weekly opening-hours section of the listing owner editor
 * (SPEC-249 T-014, extracted in HOS-258; on the kit `HoursEditor` since
 * HOS-2491).
 *
 * Fully controlled: every edit produces a COMPLETE `OpeningHours` value,
 * preserving the timezone and the other days, so saving never drops existing
 * windows. A day nobody configured reads as CLOSED (HOS-906): «open with no
 * hours» is the state `DayScheduleSchema` rejects.
 *
 * ## Errors are shown at TWO levels (HOS-814)
 *
 * - **Per slot** — the exact `open`/`close` input that failed gets
 *   `aria-invalid` and its own message, read from the deepest Zod path
 *   (`openingHours.days.mon.shifts.0.close`).
 * - **Per section** — the aggregate `openingHours` entry (rolled up by
 *   `useZodForm`'s `aggregateFields`) shows under the week, described from
 *   Monday's switch, which carries the field id `focusFirstInvalidField` lands
 *   on. With a slot marked, the aggregate copy would repeat the same sentence,
 *   so it defers to the specific one.
 */

import type { OpeningHours } from '@repo/schemas';
import type { JSX } from 'react';
import {
    HOURS_WEEKDAYS,
    HoursEditor,
    type HoursWeek,
    type HoursWeekday
} from '@/components/account/ui/HoursEditor';
import { Section } from '@/components/account/ui/Section';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { LISTING_FIELD_PREFIX } from './field-ids';

const DEFAULT_TZ = 'America/Argentina/Buenos_Aires';

/** Identity of the aggregate `openingHours` field (HOS-385). */
const OPENING_HOURS_FIELD = { prefix: LISTING_FIELD_PREFIX, name: 'openingHours' } as const;

type StoredDay = { closed: boolean; shifts: Array<{ open: string; close: string }> };

/**
 * The stored schedule as the kit's week, a missing day reading CLOSED (HOS-906).
 *
 * @param value - The stored opening hours, or `null`.
 * @returns The week the editor shows.
 */
export function toHoursWeek(value: OpeningHours | null): HoursWeek {
    const days = (value?.days ?? {}) as Record<string, StoredDay | undefined>;
    const week = {} as Record<HoursWeekday, HoursWeek[HoursWeekday]>;
    for (const day of HOURS_WEEKDAYS) {
        const stored = days[day];
        week[day] = stored
            ? { closed: stored.closed, slots: stored.shifts.map((shift) => ({ ...shift })) }
            : { closed: true, slots: [] };
    }
    return week;
}

/**
 * The kit's week back as a complete `OpeningHours`, keeping the timezone.
 *
 * @param params - The edited `week` and the `previous` stored value.
 * @returns The value the form stores.
 */
export function fromHoursWeek({
    week,
    previous
}: {
    readonly week: HoursWeek;
    readonly previous: OpeningHours | null;
}): OpeningHours {
    const days: Record<string, StoredDay> = {};
    for (const day of HOURS_WEEKDAYS) {
        days[day] = {
            closed: week[day].closed,
            shifts: week[day].slots.map((slot) => ({ open: slot.open, close: slot.close }))
        };
    }
    // TYPE-WORKAROUND: rebuilt OpeningHours from the day map; structurally valid but TS can't infer the schema-derived shape from the plain literal.
    return { timezone: previous?.timezone ?? DEFAULT_TZ, days } as unknown as OpeningHours;
}

/** Dotted Zod path of one shift bound, as the error map keys it. */
function shiftFieldPath(day: HoursWeekday, index: number, bound: 'open' | 'close'): string {
    return `openingHours.days.${day}.shifts.${index}.${bound}`;
}

export interface OpeningHoursSectionProps {
    readonly locale: SupportedLocale;
    readonly value: OpeningHours | null;
    /** The form's whole dotted-path error map (HOS-814). */
    readonly errors: Readonly<Record<string, string>>;
    readonly onChange: (next: OpeningHours) => void;
    /** The listing's vertical, for the section help anchor. */
    readonly vertical: string;
}

/**
 * The opening-hours section on the kit.
 *
 * @param props - See {@link OpeningHoursSectionProps}.
 * @returns A kit `Section` with the `HoursEditor`.
 */
export function OpeningHoursSection({
    locale,
    value,
    errors,
    onChange,
    vertical
}: OpeningHoursSectionProps): JSX.Element {
    const t = createT(locale);
    const week = toHoursWeek(value);
    const hasShiftError = Object.keys(errors).some((key) => key.startsWith('openingHours.days.'));

    return (
        <Section
            title={t('account.ui.hoursEditor.title')}
            description={t('account.ui.hoursEditor.hint')}
            helpId={`section:${vertical}.horarios`}
        >
            <HoursEditor
                locale={locale}
                value={week}
                idBase={buildFieldId(OPENING_HOURS_FIELD)}
                firstControlId={buildFieldId(OPENING_HOURS_FIELD)}
                errorFor={(day, index, bound) => errors[shiftFieldPath(day, index, bound)]}
                error={hasShiftError ? undefined : errors.openingHours}
                onChange={(next) => onChange(fromHoursWeek({ week: next, previous: value }))}
            />
        </Section>
    );
}
