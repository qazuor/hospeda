import { describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';
import {
    DayScheduleSchema,
    OpeningHoursFields,
    OpeningHoursSchema,
    ShiftSchema
} from '../../src/common/opening-hours.schema.js';

// ============================================================================
// OpeningHoursSchema — SPEC-239 T-004
// ============================================================================

/** Helper: builds a DaySchedule object that is open with one shift. */
const openDay = (open: string, close: string) => ({
    closed: false,
    shifts: [{ open, close }]
});

/** Helper: builds a closed DaySchedule. */
const closedDay = () => ({ closed: true, shifts: [] });

/** A fully valid full-week payload used across multiple tests. */
const validFullWeek = {
    timezone: 'America/Argentina/Buenos_Aires',
    days: {
        mon: openDay('09:00', '22:00'),
        tue: openDay('09:00', '22:00'),
        wed: openDay('09:00', '22:00'),
        thu: openDay('09:00', '22:00'),
        fri: openDay('09:00', '23:00'),
        sat: openDay('10:00', '23:00'),
        sun: closedDay()
    }
};

describe('OpeningHoursSchema', () => {
    describe('valid inputs', () => {
        it('should parse a valid full-week schedule', () => {
            // Arrange / Act
            const result = OpeningHoursSchema.safeParse(validFullWeek);
            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse a schedule with a closed day (sun: closed)', () => {
            // Arrange
            const input = { ...validFullWeek };
            // Act
            const result = OpeningHoursSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.days.sun.closed).toBe(true);
                expect(result.data.days.sun.shifts).toHaveLength(0);
            }
        });

        it('should parse a day with multiple shifts (split schedule)', () => {
            // Arrange
            const input = {
                days: {
                    mon: {
                        closed: false,
                        shifts: [
                            { open: '09:00', close: '13:00' },
                            { open: '17:00', close: '22:00' }
                        ]
                    },
                    tue: closedDay(),
                    wed: closedDay(),
                    thu: closedDay(),
                    fri: closedDay(),
                    sat: closedDay(),
                    sun: closedDay()
                }
            };
            // Act
            const result = OpeningHoursSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.days.mon.shifts).toHaveLength(2);
            }
        });

        it('should accept schedule without timezone (optional field)', () => {
            // Arrange
            const { timezone: _tz, ...inputWithoutTz } = validFullWeek;
            // Act
            const result = OpeningHoursSchema.safeParse(inputWithoutTz);
            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept schedule with notes', () => {
            // Arrange
            const input = { ...validFullWeek, notes: 'Closed on national holidays.' };
            // Act
            const result = OpeningHoursSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept schedule with notesI18n', () => {
            // Arrange
            const input = {
                ...validFullWeek,
                notesI18n: {
                    es: 'Cerrado feriados',
                    en: 'Closed on holidays',
                    pt: 'Fechado feriados'
                }
            };
            // Act
            const result = OpeningHoursSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('invalid HH:mm format', () => {
        it('should reject a shift with invalid open time format', () => {
            // Arrange
            const input = {
                days: {
                    mon: { closed: false, shifts: [{ open: '9:00', close: '18:00' }] },
                    tue: closedDay(),
                    wed: closedDay(),
                    thu: closedDay(),
                    fri: closedDay(),
                    sat: closedDay(),
                    sun: closedDay()
                }
            };
            // Act
            const result = OpeningHoursSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error).toBeInstanceOf(ZodError);
            }
        });

        it('should reject a shift with time 24:00 (out of range)', () => {
            // Arrange
            const input = {
                days: {
                    mon: { closed: false, shifts: [{ open: '09:00', close: '24:00' }] },
                    tue: closedDay(),
                    wed: closedDay(),
                    thu: closedDay(),
                    fri: closedDay(),
                    sat: closedDay(),
                    sun: closedDay()
                }
            };
            // Act
            const result = OpeningHoursSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a shift with time "9:0" (missing zero-padding)', () => {
            // Arrange
            const input = {
                days: {
                    mon: { closed: false, shifts: [{ open: '9:0', close: '10:00' }] },
                    tue: closedDay(),
                    wed: closedDay(),
                    thu: closedDay(),
                    fri: closedDay(),
                    sat: closedDay(),
                    sun: closedDay()
                }
            };
            // Act
            const result = OpeningHoursSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(false);
        });
    });

    /**
     * HOS-813 — a shift may cross midnight.
     *
     * `close > open` used to be a hard rule, which made a night shift
     * unrepresentable: 22:00 -> 02:00 was rejected while 22:00 -> 23:59 saved.
     * That is the working schedule of a bar, a brewery or a parrilla, and of
     * nocturnal bird-watching and dawn fishing on the experiences side.
     *
     * The control below is deliberately the same pair the smoke used: only the
     * closing time differs between the accepted and the once-rejected case.
     */
    describe('midnight-crossing shifts (HOS-813)', () => {
        it('should accept a shift that crosses midnight (22:00 -> 02:00)', () => {
            // Arrange / Act
            const result = ShiftSchema.safeParse({ open: '22:00', close: '02:00' });
            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept the same-day control the crossing shift is compared against', () => {
            // Arrange / Act
            const result = ShiftSchema.safeParse({ open: '22:00', close: '23:59' });
            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a dawn shift that opens before midnight (23:30 -> 06:00)', () => {
            // Arrange / Act
            const result = ShiftSchema.safeParse({ open: '23:30', close: '06:00' });
            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a crossing shift inside a full weekly schedule', () => {
            // Arrange
            const hours = {
                timezone: 'America/Argentina/Buenos_Aires',
                days: {
                    mon: { closed: false, shifts: [{ open: '20:00', close: '02:00' }] },
                    tue: { closed: false, shifts: [{ open: '20:00', close: '02:00' }] },
                    wed: { closed: false, shifts: [{ open: '20:00', close: '02:00' }] },
                    thu: { closed: false, shifts: [{ open: '20:00', close: '02:00' }] },
                    fri: { closed: false, shifts: [{ open: '20:00', close: '04:00' }] },
                    sat: { closed: false, shifts: [{ open: '20:00', close: '04:00' }] },
                    sun: { closed: true, shifts: [] }
                }
            };
            // Act
            const result = OpeningHoursSchema.safeParse(hours);
            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a split day whose second shift crosses midnight', () => {
            // Arrange
            const day = {
                closed: false,
                shifts: [
                    { open: '12:00', close: '15:00' },
                    { open: '20:00', close: '01:00' }
                ]
            };
            // Act
            const result = DayScheduleSchema.safeParse(day);
            // Assert
            expect(result.success).toBe(true);
        });
    });

    /**
     * The ONE surviving window rule. Kept because `close === open` reads equally
     * as a zero-length shift and as a 24-hour one, and nothing in the value says
     * which. It is also what keeps HOS-814's field-marking fix a live path: had
     * every rejection been removed here, that fix would have had no case left to
     * show.
     */
    describe('ambiguous zero-length window', () => {
        it('should reject a shift where close equals open', () => {
            // Arrange / Act
            const result = ShiftSchema.safeParse({ open: '10:00', close: '10:00' });
            // Assert
            expect(result.success).toBe(false);
        });

        it('should report the rejection on `close`, where the editor marks it', () => {
            // Arrange / Act
            const result = ShiftSchema.safeParse({ open: '22:00', close: '22:00' });
            // Assert
            expect(result.success).toBe(false);
            if (result.success) throw new Error('expected a rejection');
            expect(result.error.issues[0]?.path).toEqual(['close']);
            expect(result.error.issues[0]?.message).toBe(
                'zodError.common.openingHours.shift.sameOpenAndClose'
            );
        });

        it('should still reject a malformed time regardless of ordering', () => {
            // Arrange / Act
            const result = ShiftSchema.safeParse({ open: '25:00', close: '02:00' });
            // Assert
            expect(result.success).toBe(false);
        });
    });
});

/**
 * HOS-906 — a day must resolve to open-with-shifts or closed. Before this
 * refine, `{ closed: false, shifts: [] }` — the exact default an untouched
 * day in the commerce opening-hours editor persisted on save — validated
 * successfully, so a host who edited only ONE day of the week ended up
 * saving that intermediate, undecided state on every other day.
 */
describe('day validity (HOS-906)', () => {
    it('should reject a day that is neither open nor closed (closed: false, shifts: [])', () => {
        // Arrange
        const day = { closed: false, shifts: [] };
        // Act
        const result = DayScheduleSchema.safeParse(day);
        // Assert
        expect(result.success).toBe(false);
    });

    it('should report the rejection on `closed`, with the HOS-906 message key', () => {
        // Arrange
        const day = { closed: false, shifts: [] };
        // Act
        const result = DayScheduleSchema.safeParse(day);
        // Assert
        expect(result.success).toBe(false);
        if (result.success) throw new Error('expected a rejection');
        expect(result.error.issues[0]?.path).toEqual(['closed']);
        expect(result.error.issues[0]?.message).toBe(
            'zodError.common.openingHours.day.notOpenOrClosed'
        );
    });

    it('should still accept a closed day with no shifts', () => {
        // Arrange / Act
        const result = DayScheduleSchema.safeParse(closedDay());
        // Assert
        expect(result.success).toBe(true);
    });

    it('should still accept an open day with at least one shift', () => {
        // Arrange / Act
        const result = DayScheduleSchema.safeParse(openDay('09:00', '18:00'));
        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject a full-week schedule where a single untouched day is neither open nor closed', () => {
        // Arrange — the real editor scenario: the host only ever touches
        // `mon`; every other day keeps the raw `dayOf()` default.
        const input = {
            ...validFullWeek,
            days: {
                ...validFullWeek.days,
                tue: { closed: false, shifts: [] }
            }
        };
        // Act
        const result = OpeningHoursSchema.safeParse(input);
        // Assert
        expect(result.success).toBe(false);
        if (result.success) throw new Error('expected a rejection');
        expect(
            result.error.issues.some((issue) => issue.path.join('.') === 'days.tue.closed')
        ).toBe(true);
    });

    it('should default `closed` to false and still reject a day with no shifts (default alone is not valid)', () => {
        // Arrange — omit `closed` entirely to exercise the schema default.
        const day = { shifts: [] };
        // Act
        const result = DayScheduleSchema.safeParse(day);
        // Assert
        expect(result.success).toBe(false);
    });
});

describe('OpeningHoursFields', () => {
    it('should expose an openingHours field as a key', () => {
        // Assert
        expect(OpeningHoursFields).toHaveProperty('openingHours');
    });

    it('should be spreadable into a z.object to form a valid entity schema', () => {
        // Arrange
        const EntitySchema = z.object({
            name: z.string(),
            ...OpeningHoursFields
        });
        // Act
        const result = EntitySchema.safeParse({
            name: 'Test Commerce',
            openingHours: validFullWeek
        });
        // Assert
        expect(result.success).toBe(true);
    });
});
