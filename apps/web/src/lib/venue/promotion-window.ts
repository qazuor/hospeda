import type { PromotionWindow } from '@repo/schemas';
import type { VenueOpeningHoursEntry } from '@/data/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { computeOpenNowInZone, VENUE_OPEN_NOW_TIME_ZONE } from './open-now-in-zone';

const DAYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
] as const;

/** Uses venue-hours' DEC-FAC-052 shift evaluation in the venue time zone. */
export function isPromotionWindowActive({
    window,
    now,
    timeZone = VENUE_OPEN_NOW_TIME_ZONE
}: {
    readonly window: PromotionWindow;
    readonly now: Date;
    readonly timeZone?: string;
}): boolean {
    const openingHours: Record<string, VenueOpeningHoursEntry> = {};
    for (const weekday of window.weekdays) {
        const day = DAYS[(weekday + 6) % 7];
        openingHours[day] = {
            isOpen: true,
            shifts: [{ open: window.startTime, close: window.endTime }]
        };
    }
    return computeOpenNowInZone({ openingHours, now, timeZone }) === true;
}

/** Checks the recurring window and absolute promotion validity dates. */
export function isPromotionLive({
    promo,
    now
}: {
    readonly promo: {
        readonly window: PromotionWindow;
        readonly validFrom: string | Date;
        readonly validUntil?: string | Date | null;
    };
    readonly now: Date;
}): boolean {
    const from = new Date(promo.validFrom).getTime();
    const until =
        promo.validUntil == null ? Number.POSITIVE_INFINITY : new Date(promo.validUntil).getTime();
    return (
        now.getTime() >= from &&
        now.getTime() <= until &&
        isPromotionWindowActive({ window: promo.window, now })
    );
}

/** Formats selected weekdays and a local time range for a venue promotion. */
export function formatPromotionWindow({
    window,
    locale
}: {
    readonly window: PromotionWindow;
    readonly locale: SupportedLocale;
}): string {
    const { t } = createTranslations(locale);
    const selected = new Set(window.weekdays);
    const dayNames = DAYS.map((_, index) =>
        t(
            `venue.detail.promotions.window.days.${index}`,
            ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'][index] ?? ''
        )
    );
    let days: string;
    if (window.weekdays.length === 7)
        days = t('venue.detail.promotions.window.everyDay', 'Todos los días');
    else {
        const runs: number[][] = [];
        for (let index = 0; index < 7; ) {
            if (!selected.has((index + 1) % 7)) {
                index += 1;
                continue;
            }
            const run = [index];
            while (index < 6 && selected.has((index + 2) % 7)) {
                index += 1;
                run.push(index);
            }
            runs.push(run);
            index += 1;
        }
        days = runs
            .map((run, runIndex) => {
                const rawFirst = dayNames[run[0] ?? 0] ?? '';
                const first = runIndex === 0 ? rawFirst : rawFirst.toLocaleLowerCase(locale);
                const last = (dayNames[run[run.length - 1] ?? 0] ?? '').toLocaleLowerCase(locale);
                if (run.length >= 3)
                    return `${first} ${t('venue.detail.promotions.window.to', 'a')} ${last}`;
                if (run.length === 2)
                    return `${first} ${t('venue.detail.promotions.window.and', 'y')} ${last}`;
                return first;
            })
            .join(', ');
    }
    const time = (value: string) => (value.endsWith(':00') ? value.slice(0, 2) : value);
    return `${days}, ${time(window.startTime)} ${t('venue.detail.promotions.window.to', 'a')} ${time(window.endTime)}`;
}
