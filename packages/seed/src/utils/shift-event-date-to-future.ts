interface EventDateWithIsoStrings {
    readonly start: string;
    readonly end?: string;
    readonly [key: string]: unknown;
}

/**
 * Shifts a past event date into the future by whole calendar years.
 * February 29 becomes February 28 when the target year is not a leap year.
 *
 * @param input.date - Event date with ISO string values and optional metadata.
 * @param input.now - Clock used to determine whether the event has passed.
 * @returns The original date object when it has not passed, otherwise a copy with shifted dates.
 * @throws Error when start or end is not a parseable ISO date.
 */
export function shiftEventDateToFuture<T extends EventDateWithIsoStrings>({
    date,
    now
}: {
    readonly date: T;
    readonly now: Date;
}): T {
    const validateDate = (value: string): void => {
        if (!/^\d{4}-\d{2}-\d{2}/.test(value) || Number.isNaN(Date.parse(value))) {
            throw new Error(`Event date is not an ISO date: ${value}`);
        }
    };

    validateDate(date.start);
    if (date.end !== undefined) validateDate(date.end);

    const end = date.end ?? date.start;
    if (Date.parse(end) >= now.getTime()) return date;

    const shiftByYears = (value: string, years: number): string => {
        const match = /^(\d{4})-(\d{2})-(\d{2})(.*)$/.exec(value);
        if (!match) throw new Error(`Event date is not an ISO date: ${value}`);

        const year = Number(match[1]) + years;
        const month = Number(match[2]);
        const day = Number(match[3]);
        const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        const shiftedDay = month === 2 && day === 29 && !isLeapYear ? '28' : match[3];
        return `${year.toString().padStart(4, '0')}-${match[2]}-${shiftedDay}${match[4]}`;
    };

    let years = 1;
    while (Date.parse(shiftByYears(end, years)) < now.getTime()) years += 1;

    return {
        ...date,
        start: shiftByYears(date.start, years),
        ...(date.end === undefined ? {} : { end: shiftByYears(date.end, years) })
    } as T;
}
