/** A Mercado Pago cron schedule used by the minute collision guard. */
export interface MpCronSchedule {
    /** Registered job name. */
    readonly name: string;
    /** Five-field cron expression. */
    readonly schedule: string;
}

/** Expanded minute ownership and collision findings for MP-calling schedules. */
export interface MpCronStaggerReport {
    /** Minutes used by each job. */
    readonly minutesByJob: ReadonlyMap<string, readonly number[]>;
    /** Minutes used by more than one job or minute zero. */
    readonly conflicts: readonly string[];
    /** Available nonzero minutes. */
    readonly freeMinutes: readonly number[];
}

/** Check a list of expanded minute fields for reserved-minute and collision rules. */
export function checkMpCronStagger(args: {
    readonly schedules: readonly MpCronSchedule[];
    readonly expandMinutes: (expression: string) => readonly number[];
}): MpCronStaggerReport {
    const minutesByJob = new Map<string, readonly number[]>();
    const owners = new Map<number, string[]>();
    for (const schedule of args.schedules) {
        const minutes = args.expandMinutes(schedule.schedule);
        minutesByJob.set(schedule.name, minutes);
        for (const minute of minutes) {
            const names = owners.get(minute) ?? [];
            names.push(schedule.name);
            owners.set(minute, names);
        }
    }
    const conflicts = [...owners.entries()]
        .filter(([minute, names]) => minute === 0 || names.length > 1)
        .map(([minute, names]) => `minute ${minute}: ${names.join(', ')}`);
    const freeMinutes = Array.from({ length: 59 }, (_, index) => index + 1).filter(
        (minute) => !owners.has(minute)
    );
    return { minutesByJob, conflicts, freeMinutes };
}

/** Format the author guidance required by AC-17 when a schedule collides. */
export function formatMpCronStaggerFailure(report: MpCronStaggerReport): string {
    const taken = [...report.minutesByJob.entries()]
        .map(([name, minutes]) => `${name}: ${minutes.join(', ')}`)
        .join('; ');
    return [
        `MP cron schedule conflict: ${report.conflicts.join('; ')}.`,
        `Taken minutes per job: ${taken}.`,
        `Free minutes: ${report.freeMinutes.join(', ')}.`,
        'Pick a free minute; prefer an odd minute that is not a multiple of 5 — */5 and */15 non-MP jobs fire on those — then re-run this test.'
    ].join(' ');
}
