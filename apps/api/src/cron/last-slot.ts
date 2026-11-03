import { MARKET_TIMEZONE } from '@repo/utils';
import { CronExpressionParser } from 'cron-parser';

/** Determine whether this invocation has no later scheduled firing today. */
export function isLastSlot(args: {
    readonly schedule: string;
    readonly now: Date;
    readonly newCycle: boolean;
}): boolean {
    if (args.newCycle) return true;

    const fields = CronExpressionParser.parse(args.schedule).fields;
    const hours = fields.hour.values;
    const minutes = fields.minute.values;
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: MARKET_TIMEZONE,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(args.now);
    const hour = Number(parts.find((part) => part.type === 'hour')?.value);
    const minute = Number(parts.find((part) => part.type === 'minute')?.value);
    const currentMinute = hour * 60 + minute;

    return !hours.some((scheduledHour) =>
        minutes.some((scheduledMinute) => scheduledHour * 60 + scheduledMinute > currentMinute)
    );
}
