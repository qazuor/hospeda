/**
 * @fileoverview
 * HOS-375 T-004 — guards the baseline half of the dual-write rule for
 * `users.is_system_account`.
 *
 * The two required staff fixtures must carry `isSystemAccount: true` so a fresh
 * database is built correct without running any data-migration. If the flag is
 * dropped from a fixture, the seeded staff accounts become ordinary authors:
 * `/autores/super-admin-user/` — titled "Super Admin" — becomes eligible for
 * indexing and the sitemap the moment it has a bio, an avatar and one published
 * item.
 *
 * The second test is the one that matters more than it looks. `users.seed.ts`'s
 * own JSDoc records a fixture key that silently stopped doing anything: `role`
 * survived in the JSON long after the column was dropped, because Zod strips
 * unknown keys and Drizzle's `.values()` iterates table columns rather than
 * object keys — so nothing failed, the value just never landed. A fixture
 * assertion alone would not catch a repeat of that; asserting the key SURVIVES
 * `UserCreateInputSchema` (the schema `UserService.create` parses through) is
 * what proves the value can actually reach the database.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UserCreateInputSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.resolve(__dirname, '../src/data/user/required');

const STAFF_FIXTURES = ['super-admin-user.json', 'admin-user.json'] as const;

/** Reads one required-user fixture as a plain object. */
function readFixture(fileName: string): Record<string, unknown> {
    const raw = readFileSync(path.join(FIXTURES_DIR, fileName), 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
}

describe('HOS-375 T-004: required staff fixtures carry isSystemAccount', () => {
    it.each(STAFF_FIXTURES)('%s declares isSystemAccount: true', (fileName) => {
        const fixture = readFixture(fileName);

        expect(fixture.isSystemAccount).toBe(true);
    });

    it('keeps the flag through UserCreateInputSchema, the schema the seed parses with', () => {
        // `UserService.create` parses its input through this schema, so a key it
        // strips never reaches the insert — silently, with no error anywhere.
        // See this file's header for the `role` precedent.
        const {
            $schema: _schema,
            id: _id,
            role: _role,
            ...fixture
        } = readFixture('admin-user.json') as Record<string, unknown>;

        const parsed = UserCreateInputSchema.parse({
            ...fixture,
            birthDate: undefined
        });

        expect(parsed.isSystemAccount).toBe(true);
    });

    it('defaults to false for a fixture that does not declare it', () => {
        // The complement of the assertion above: absence must mean "a person",
        // never "unset". A fixture author who forgets the key gets an ordinary
        // account, which is the safe direction — visible rather than hidden.
        const {
            $schema: _schema,
            id: _id,
            role: _role,
            isSystemAccount: _flag,
            ...fixture
        } = readFixture('admin-user.json') as Record<string, unknown>;

        const parsed = UserCreateInputSchema.parse({
            ...fixture,
            birthDate: undefined
        });

        expect(parsed.isSystemAccount).toBe(false);
    });
});
