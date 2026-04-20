/**
 * @file avatar-utils.test.ts
 * @description Unit tests for the framework-agnostic avatar initials helper.
 */

import { describe, expect, it } from 'vitest';
import { INITIALS_PLACEHOLDER, getInitials, getInitialsFromName } from '../../src/lib/avatar-utils';

describe('getInitials', () => {
    it('returns first + last initial for multi-word names', () => {
        expect(getInitials({ name: 'Carlos Ramírez' })).toBe('CR');
        expect(getInitials({ name: 'Carlos Alberto Ramírez' })).toBe('CR');
    });

    it('returns first two letters for single-word names', () => {
        expect(getInitials({ name: 'carlos' })).toBe('CA');
        expect(getInitials({ name: 'a' })).toBe('A');
    });

    it('uppercases the result', () => {
        expect(getInitials({ name: 'ana maria' })).toBe('AM');
    });

    it('collapses extra whitespace between tokens', () => {
        expect(getInitials({ name: '  Jane   Doe  ' })).toBe('JD');
    });

    it('falls back to the email local part when name is empty', () => {
        expect(getInitials({ name: '', email: 'jane.doe@example.com' })).toBe('J');
        expect(getInitials({ email: 'x@y.com' })).toBe('X');
    });

    it('falls back to email when name is only whitespace', () => {
        expect(getInitials({ name: '   ', email: 'kim@site.org' })).toBe('K');
    });

    it('handles emails without an @ by using the full string', () => {
        expect(getInitials({ email: 'noat' })).toBe('N');
    });

    it('returns the default placeholder when nothing resolves', () => {
        expect(getInitials({})).toBe(INITIALS_PLACEHOLDER);
        expect(getInitials({ name: null, email: null })).toBe(INITIALS_PLACEHOLDER);
        expect(INITIALS_PLACEHOLDER).toBe('?');
    });

    it('respects a custom placeholder', () => {
        expect(getInitials({ placeholder: '' })).toBe('');
        expect(getInitials({ placeholder: 'U' })).toBe('U');
    });

    it('prefers name over email when both are present', () => {
        expect(getInitials({ name: 'Tom Smith', email: 'z@z.com' })).toBe('TS');
    });
});

describe('getInitialsFromName', () => {
    it('delegates to getInitials with a positional name', () => {
        expect(getInitialsFromName('Carlos Ramírez')).toBe('CR');
        expect(getInitialsFromName('carlos')).toBe('CA');
    });

    it('returns the default placeholder for empty/undefined input', () => {
        expect(getInitialsFromName(undefined)).toBe('?');
        expect(getInitialsFromName(null)).toBe('?');
        expect(getInitialsFromName('')).toBe('?');
    });
});
