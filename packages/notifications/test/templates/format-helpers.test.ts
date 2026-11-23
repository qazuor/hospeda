/**
 * Regression suite for the email date formatter.
 *
 * WHY THIS FILE EXISTS AT ALL
 *
 * `formatDate` had no test, and its two JSDoc examples were only true when the
 * process happened to run at `TZ=UTC`. Production does — the API container runs
 * in UTC — so the emails came out right, and the defect was invisible. On a
 * developer machine at UTC-3 both examples came out a day early.
 *
 * That is the same defect the August 2026 smoke found on four screens (H-09,
 * H-63, H-73, H-84): a value that names a DAY, rendered in whatever timezone
 * the reader happens to be in. Here it was hidden by an environment variable
 * rather than absent, which is worse — the behaviour would have flipped the day
 * anyone set `TZ` on the container.
 *
 * DETERMINISM CONTRACT: no `new Date()` with no argument, and no reliance on the
 * runner's timezone. Every value below is a literal, and the expected output is
 * the same in every timezone — which is exactly the property being asserted.
 */

import { describe, expect, it } from 'vitest';
import {
    formatBillingCycleLabel,
    formatDate,
    formatDateTime
} from '../../src/templates/utils/format-helpers';

describe('formatDate — a day, not an instant', () => {
    it('renders a bare calendar date as the day it names', () => {
        // A Postgres `date` reaching a template — e.g. `servicedAt` on the
        // benefit-usage emails.
        expect(formatDate({ dateString: '2026-03-15' })).toBe('15 de marzo de 2026');
    });

    it('renders a UTC-midnight instant as the day it names', () => {
        // What every date picker in the admin writes.
        expect(formatDate({ dateString: '2026-12-01T00:00:00.000Z' })).toBe(
            '1 de diciembre de 2026'
        );
    });

    it('does not slip a day at the year boundary', () => {
        // The most alarming shape of the bug: a date that moves into the
        // previous YEAR, so a renewal notice for January dates itself December.
        expect(formatDate({ dateString: '2027-01-01T00:00:00.000Z' })).toBe('1 de enero de 2027');
    });

    it('keeps a mid-day instant on its own day', () => {
        expect(formatDate({ dateString: '2026-03-15T18:30:00.000Z' })).toBe('15 de marzo de 2026');
    });

    it('returns an empty string rather than the words "Invalid Date"', () => {
        // These land in an email body. `Invalid Date` in a subject line is worse
        // than an absent date, which the templates already render around.
        expect(formatDate({ dateString: '' })).toBe('');
        expect(formatDate({ dateString: 'no es una fecha' })).toBe('');
        expect(formatDate({ dateString: '2026-02-31' })).toBe('');
    });
});

describe('formatDateTime — an instant, in Argentina', () => {
    it('renders an instant as DD/MM/YYYY HH:mm in Buenos Aires time', () => {
        // 12:00 UTC is 09:00 at UTC-3, whatever timezone the runner has.
        expect(formatDateTime({ dateString: '2026-11-21T12:00:00.000Z' })).toBe('21/11/2026 09:00');
    });

    it('converts an offset instant to the same Argentine wall clock', () => {
        expect(formatDateTime({ dateString: '2026-11-21T09:00:00-03:00' })).toBe(
            '21/11/2026 09:00'
        );
    });

    it('moves to the previous day when the UTC time is before 03:00', () => {
        expect(formatDateTime({ dateString: '2026-03-01T01:30:00.000Z' })).toBe('28/02/2026 22:30');
    });

    it('uses a 24-hour clock with midnight as 00', () => {
        expect(formatDateTime({ dateString: '2026-11-21T03:05:00.000Z' })).toBe('21/11/2026 00:05');
        expect(formatDateTime({ dateString: '2026-11-21T23:45:00.000Z' })).toBe('21/11/2026 20:45');
    });

    it('returns an empty string rather than the words "Invalid Date"', () => {
        expect(formatDateTime({ dateString: '' })).toBe('');
        expect(formatDateTime({ dateString: 'no es una fecha' })).toBe('');
    });
});

describe('formatBillingCycleLabel — one map for three templates', () => {
    it.each([
        ['monthly', 'Mensual'],
        ['quarterly', 'Trimestral'],
        ['semiannual', 'Semestral'],
        ['annual', 'Anual']
    ])('labels %s as %s', (cycle, label) => {
        expect(formatBillingCycleLabel({ cycle })).toBe(label);
    });

    it('renders an unknown cycle as received, so the information stays visible', () => {
        expect(formatBillingCycleLabel({ cycle: 'weekly' })).toBe('weekly');
    });

    it('does not read inherited object keys as cycles', () => {
        expect(formatBillingCycleLabel({ cycle: 'constructor' })).toBe('constructor');
        expect(formatBillingCycleLabel({ cycle: '' })).toBe('');
    });
});
