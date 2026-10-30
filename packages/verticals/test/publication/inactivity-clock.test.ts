import { describe, expect, it } from 'vitest';
import { inactivityClockStart } from '../../src/publication/inactivity-clock';

describe('TEST:V9b:9 AC:V9b:9 inactivityClockStart', () => {
    const clockStart = new Date('2025-10-01T12:00:00.000Z');

    it('copies clockStart when there is no owner act', () => {
        const result = inactivityClockStart({ clockStart, lastOwnerActAt: null });
        expect(result).toEqual(clockStart);
        expect(result).not.toBe(clockStart);
    });

    it('keeps clockStart when the owner act is earlier', () => {
        expect(
            inactivityClockStart({
                clockStart,
                lastOwnerActAt: new Date('2025-09-01T12:00:00.000Z')
            })
        ).toEqual(clockStart);
    });

    it('uses the owner act when it is later', () => {
        const act = new Date('2025-11-01T12:00:00.000Z');
        expect(inactivityClockStart({ clockStart, lastOwnerActAt: act })).toEqual(act);
    });

    it('keeps clockStart when both instants are equal', () => {
        const act = new Date(clockStart);
        const result = inactivityClockStart({ clockStart, lastOwnerActAt: act });
        expect(result).toEqual(clockStart);
        expect(result).not.toBe(act);
    });

    it('counts an act before the V9b merge when it is later than the cut', () => {
        const act = new Date('2026-01-01T00:00:00.000Z');
        expect(
            inactivityClockStart({
                clockStart: new Date('2025-10-01T12:00:00.000Z'),
                lastOwnerActAt: act
            })
        ).toEqual(act);
    });
});
