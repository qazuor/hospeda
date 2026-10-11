import type { RetentionListing } from './publication-types';

/** Returns the later of the listing clock and the most recent pause end. */
export function retentionClockStart(args: {
    readonly inactiveSince: Date;
    readonly pauseEndedAt: Date | null;
}): Date {
    if (!args.pauseEndedAt || args.inactiveSince >= args.pauseEndedAt)
        return new Date(args.inactiveSince);
    return new Date(args.pauseEndedAt);
}

/** Adds calendar months in UTC, clamping a missing day to the target month's end. */
export function addCalendarMonthsUtc(args: { readonly at: Date; readonly months: number }): Date {
    const year = args.at.getUTCFullYear();
    const month = args.at.getUTCMonth() + args.months;
    const targetLastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(args.at.getUTCDate(), targetLastDay);
    return new Date(
        Date.UTC(
            year,
            month,
            day,
            args.at.getUTCHours(),
            args.at.getUTCMinutes(),
            args.at.getUTCSeconds(),
            args.at.getUTCMilliseconds()
        )
    );
}

/** Calculates PB4's day deadline or PB5's calendar-month deadline. */
export function archiveDueAt(args: {
    readonly transition: 'PB4' | 'PB5';
    readonly clockStart: Date;
    readonly deadlines: RetentionListing['deadlines'];
}): Date {
    switch (args.transition) {
        case 'PB4':
            return new Date(
                args.clockStart.getTime() + args.deadlines.archiveAfterDays * 86_400_000
            );
        case 'PB5':
            return addCalendarMonthsUtc({
                at: args.clockStart,
                months: args.deadlines.draftArchiveMonths
            });
    }
}

/** Preserves the clock distance between archive and deletion when archiving runs late. */
export function announcedDeletionAt(args: {
    readonly archivedAt: Date;
    readonly dueAt: Date;
    readonly clockStart: Date;
    readonly deletionAfterDays: number;
}): Date {
    const deletionDueAt = new Date(args.clockStart.getTime() + args.deletionAfterDays * 86_400_000);
    return new Date(args.archivedAt.getTime() + deletionDueAt.getTime() - args.dueAt.getTime());
}
