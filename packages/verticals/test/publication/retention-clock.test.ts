import { describe, expect, it } from 'vitest';
import {
    addCalendarMonthsUtc,
    announcedDeletionAt,
    archiveDueAt,
    retentionClockStart
} from '../../src/publication/retention-clock';

describe('TEST:V6:8 retention clock', () => {
    it('TEST:V6:8 uses the later pause end in either order', () => {
        const base = new Date('2026-01-01T00:00:00Z');
        const later = new Date('2026-02-01T00:00:00Z');
        expect(retentionClockStart({ inactiveSince: base, pauseEndedAt: later })).toEqual(later);
        expect(retentionClockStart({ inactiveSince: later, pauseEndedAt: base })).toEqual(later);
        expect(retentionClockStart({ inactiveSince: base, pauseEndedAt: null })).toEqual(base);
    });

    it('TEST:V6:9 clamps month ends, preserves UTC time and crosses years', () => {
        expect(
            addCalendarMonthsUtc({ at: new Date('2025-01-31T10:11:12Z'), months: 1 }).toISOString()
        ).toBe('2025-02-28T10:11:12.000Z');
        expect(
            addCalendarMonthsUtc({ at: new Date('2024-01-31T10:11:12Z'), months: 1 }).toISOString()
        ).toBe('2024-02-29T10:11:12.000Z');
        expect(
            addCalendarMonthsUtc({ at: new Date('2025-11-15T00:00:00Z'), months: 3 }).toISOString()
        ).toBe('2026-02-15T00:00:00.000Z');
        expect(
            addCalendarMonthsUtc({ at: new Date('2025-12-31T00:00:00Z'), months: 2 }).toISOString()
        ).toBe('2026-02-28T00:00:00.000Z');
    });

    it('TEST:V6:8 and TEST:V6:9 calculate archive deadlines and deletion distance when late', () => {
        const start = new Date('2026-01-31T00:00:00Z');
        const deadlines = { archiveAfterDays: 90, deletionAfterDays: 180, draftArchiveMonths: 1 };
        const pb4 = archiveDueAt({ transition: 'PB4', clockStart: start, deadlines });
        const pb5 = archiveDueAt({ transition: 'PB5', clockStart: start, deadlines });
        expect(pb4).toEqual(new Date(start.getTime() + 90 * 86_400_000));
        expect(pb5.toISOString()).toBe('2026-02-28T00:00:00.000Z');
        const archived = new Date('2026-05-01T00:00:00Z');
        const announced = announcedDeletionAt({
            archivedAt: archived,
            dueAt: pb4,
            clockStart: start,
            deletionAfterDays: 180
        });
        expect(
            announcedDeletionAt({
                archivedAt: pb4,
                dueAt: pb4,
                clockStart: start,
                deletionAfterDays: 180
            })
        ).toEqual(new Date(start.getTime() + 180 * 86_400_000));
        expect(announced.getTime() - archived.getTime()).toBe(90 * 86_400_000);
        expect(announced).toEqual(new Date(archived.getTime() + (180 - 90) * 86_400_000));
        const pb5Announced = announcedDeletionAt({
            archivedAt: archived,
            dueAt: pb5,
            clockStart: start,
            deletionAfterDays: 180
        });
        expect(pb5Announced.getTime()).toBeGreaterThan(archived.getTime());
    });
});
