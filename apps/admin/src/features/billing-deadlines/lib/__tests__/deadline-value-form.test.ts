import { describe, expect, it } from 'vitest';
import { fromFormFields, toFormFields } from '../deadline-value-form';

describe('deadline value form mapping', () => {
    it.each([
        { days: 90 },
        { beforeArchiveDays: 7, beforeDeletionDays: 14 },
        { daysBefore: [10, 5, 2, 0] },
        { noticeDays: 60, contactDays: [30, 7] }
    ])('round trips $', (value) => {
        expect(fromFormFields({ fields: toFormFields({ value }) })).toEqual(value);
    });

    it('keeps nonnumeric list items as NaN for schema validation', () => {
        expect(
            fromFormFields({ fields: [{ name: 'daysBefore', kind: 'list', text: 'a, 3' }] })
        ).toEqual({ daysBefore: [Number.NaN, 3] });
    });
});
