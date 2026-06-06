/**
 * Unit tests for `src/commands/db-superadmin-pass.ts`.
 *
 * Covers pure helper functions only: arg parsing, password generation,
 * validation, and SQL escaping. The interactive prompt, bcrypt hashing,
 * and docker exec calls are side-effecting and are not covered here.
 */

import { describe, expect, it } from 'bun:test';
import {
    escapeSqlString,
    generateRandomPassword,
    parseSuperAdminPassArgs,
    validatePasswordLength
} from '../src/commands/db-superadmin-pass.ts';

describe('parseSuperAdminPassArgs(argv)', () => {
    describe('defaults', () => {
        it('uses superadmin@hospeda.com when --email is not supplied', () => {
            expect(parseSuperAdminPassArgs([]).email).toBe('superadmin@hospeda.com');
        });

        it('generate is false by default', () => {
            expect(parseSuperAdminPassArgs([]).generate).toBe(false);
        });

        it('skipConfirm is false by default', () => {
            expect(parseSuperAdminPassArgs([]).skipConfirm).toBe(false);
        });
    });

    describe('--email=<value>', () => {
        it('sets email from --email= form', () => {
            expect(parseSuperAdminPassArgs(['--email=admin@example.com']).email).toBe(
                'admin@example.com'
            );
        });

        it('uses the last --email= value when supplied multiple times', () => {
            const parsed = parseSuperAdminPassArgs([
                '--email=first@example.com',
                '--email=second@example.com'
            ]);
            expect(parsed.email).toBe('second@example.com');
        });
    });

    describe('--generate', () => {
        it('enables generate mode', () => {
            expect(parseSuperAdminPassArgs(['--generate']).generate).toBe(true);
        });

        it('combine with --email and --yes', () => {
            const parsed = parseSuperAdminPassArgs([
                '--generate',
                '--email=admin@test.com',
                '--yes'
            ]);
            expect(parsed.generate).toBe(true);
            expect(parsed.email).toBe('admin@test.com');
            expect(parsed.skipConfirm).toBe(true);
        });
    });

    describe('--yes', () => {
        it('sets skipConfirm to true', () => {
            expect(parseSuperAdminPassArgs(['--yes']).skipConfirm).toBe(true);
        });

        it('does not affect email or generate', () => {
            const parsed = parseSuperAdminPassArgs(['--yes']);
            expect(parsed.email).toBe('superadmin@hospeda.com');
            expect(parsed.generate).toBe(false);
        });
    });

    describe('flag order is irrelevant', () => {
        it('parses identically regardless of order', () => {
            const a = parseSuperAdminPassArgs(['--yes', '--generate', '--email=x@y.com']);
            const b = parseSuperAdminPassArgs(['--email=x@y.com', '--generate', '--yes']);
            expect(a).toEqual(b);
        });
    });
});

describe('generateRandomPassword()', () => {
    it('returns a non-empty string', () => {
        const pw = generateRandomPassword();
        expect(typeof pw).toBe('string');
        expect(pw.length).toBeGreaterThan(0);
    });

    it('returns at least 12 characters (always passes validatePasswordLength)', () => {
        const pw = generateRandomPassword();
        expect(pw.length).toBeGreaterThanOrEqual(12);
        expect(validatePasswordLength(pw)).toBeNull();
    });

    it('returns a 32-character base64url string (24 bytes = 32 base64url chars)', () => {
        const pw = generateRandomPassword();
        expect(pw.length).toBe(32);
        // base64url uses A-Z a-z 0-9 - _ (no + / or padding =)
        expect(/^[A-Za-z0-9\-_]+$/.test(pw)).toBe(true);
    });

    it('returns different values on successive calls (statistically near-certain)', () => {
        const results = new Set(Array.from({ length: 10 }, () => generateRandomPassword()));
        // 10 calls should produce 10 unique values
        expect(results.size).toBe(10);
    });
});

describe('validatePasswordLength(password)', () => {
    it('returns null for a 12-character password (minimum allowed)', () => {
        expect(validatePasswordLength('a'.repeat(12))).toBeNull();
    });

    it('returns null for passwords longer than the minimum', () => {
        expect(validatePasswordLength('a'.repeat(24))).toBeNull();
        expect(validatePasswordLength('a'.repeat(100))).toBeNull();
    });

    it('returns an error message for an 11-character password (one below minimum)', () => {
        const result = validatePasswordLength('a'.repeat(11));
        expect(result).not.toBeNull();
        expect(result).toContain('12');
        expect(result).toContain('11');
    });

    it('returns an error message for an empty password', () => {
        const result = validatePasswordLength('');
        expect(result).not.toBeNull();
        expect(result).toContain('12');
    });

    it('returns an error message for a 1-character password', () => {
        const result = validatePasswordLength('x');
        expect(result).not.toBeNull();
        expect(result).toContain('12');
    });
});

describe('escapeSqlString(value)', () => {
    it('returns the input unchanged when no single quotes are present', () => {
        expect(escapeSqlString('superadmin@hospeda.com')).toBe('superadmin@hospeda.com');
    });

    it('doubles a single quote (SQL escaping)', () => {
        expect(escapeSqlString("O'Brien")).toBe("O''Brien");
    });

    it('doubles multiple single quotes', () => {
        expect(escapeSqlString("it's 'test'")).toBe("it''s ''test''");
    });

    it('handles an empty string', () => {
        expect(escapeSqlString('')).toBe('');
    });

    it('handles a string that is only a single quote', () => {
        expect(escapeSqlString("'")).toBe("''");
    });

    it('does not alter dollar signs (relevant for bcrypt hashes)', () => {
        const hash = '$2b$12$abc/defghijklmnopqrstuv';
        expect(escapeSqlString(hash)).toBe(hash);
    });
});
