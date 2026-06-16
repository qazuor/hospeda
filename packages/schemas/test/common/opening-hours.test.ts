import { describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';
import {
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

    describe('close-before-open edge case', () => {
        it('should reject a shift where close equals open', () => {
            // Arrange / Act
            const result = ShiftSchema.safeParse({ open: '10:00', close: '10:00' });
            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a shift where close is before open', () => {
            // Arrange / Act
            const result = ShiftSchema.safeParse({ open: '18:00', close: '09:00' });
            // Assert
            expect(result.success).toBe(false);
        });

        it('should accept a shift where close is after open (midnight approach 23:59)', () => {
            // Arrange / Act
            const result = ShiftSchema.safeParse({ open: '23:00', close: '23:59' });
            // Assert
            expect(result.success).toBe(true);
        });
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
