/**
 * @file mask-email.test.ts
 * @description Cases for the email masking helper (HOS-2184).
 */
import { describe, expect, it } from 'vitest';
import { maskEmail } from '../../src/lib/mask-email';

describe('maskEmail', () => {
    it.each([
        ['leandro@gmail.com', 'lea***@gmail.com'],
        ['lea123@gmail.com', 'lea***@gmail.com'],
        ['lean@gmail.com', 'l***@gmail.com'],
        ['abc@x.com', 'a***@x.com'],
        ['ab@x.com', '***@x.com'],
        ['a@x.com', '***@x.com']
    ])('masks %s as %s', (email, expected) => {
        expect(maskEmail({ email })).toBe(expected);
    });

    it('keeps the part after the last @', () => {
        expect(maskEmail({ email: 'a@b@host.com' })).toBe('a***@host.com');
    });

    it.each([
        '',
        'no-at-sign',
        '@domain.com',
        'user@',
        42,
        null,
        undefined
    ])('returns null for %s', (email) => {
        expect(maskEmail({ email })).toBeNull();
    });
});
