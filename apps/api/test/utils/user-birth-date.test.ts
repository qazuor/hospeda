/**
 * Tests for `withDomainBirthDate` (BETA-34).
 *
 * The four user write routes (protected PATCH/PUT, admin PATCH/PUT) accept
 * `birthDate` as an HTTP-layer string (`BirthDateHttpInputSchema`: a
 * `YYYY-MM-DD` string, `''`, or `null`/`undefined`) and must convert it to
 * the domain `Date | null` shape before calling `UserService.update`. This
 * suite covers the conversion helper in isolation from the route wiring
 * (route-level regression coverage lives in
 * `test/routes/user/protected/patch-mass-assignment.test.ts` and
 * `test/routes/user/birth-date-http-input.test.ts`).
 */

import { describe, expect, it } from 'vitest';
import { withDomainBirthDate } from '../../src/utils/user-birth-date';

describe('withDomainBirthDate', () => {
    it('converts a valid YYYY-MM-DD string to a Date', () => {
        const result = withDomainBirthDate<Record<string, unknown>>({ birthDate: '1990-05-15' });

        expect(result.birthDate).toBeInstanceOf(Date);
        expect((result.birthDate as Date).toISOString().startsWith('1990-05-15')).toBe(true);
    });

    it('converts an empty string to null (clears the field)', () => {
        const result = withDomainBirthDate<Record<string, unknown>>({ birthDate: '' });

        expect(result.birthDate).toBeNull();
    });

    it('passes null through as null', () => {
        const result = withDomainBirthDate<Record<string, unknown>>({ birthDate: null });

        expect(result.birthDate).toBeNull();
    });

    it('leaves the input unchanged when birthDate is absent', () => {
        const input = { firstName: 'Carlos' };
        const result = withDomainBirthDate(input);

        expect(result).toBe(input);
        expect(Object.hasOwn(result, 'birthDate')).toBe(false);
    });

    it('leaves the input unchanged when birthDate is already a Date', () => {
        const existingDate = new Date('1990-05-15T00:00:00.000Z');
        const input = { birthDate: existingDate };
        const result = withDomainBirthDate(input);

        expect(result).toBe(input);
        expect(result.birthDate).toBe(existingDate);
    });

    it('does not mutate the original input object', () => {
        const input = { birthDate: '1990-05-15', firstName: 'Carlos' };
        const result = withDomainBirthDate(input);

        expect(result).not.toBe(input);
        expect(input.birthDate).toBe('1990-05-15');
        expect(result.firstName).toBe('Carlos');
    });
});
