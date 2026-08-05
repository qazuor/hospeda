/**
 * @fileoverview
 * HOS-375 — guards the baseline half of the dual-write rule for user slug
 * ASCII-conformance.
 *
 * `004-user-ana-rodríguez.json` and `002-user-carlos-martínez.json` used to
 * carry accented `slug` values (`ana-rodríguez`, `carlos-martínez`).
 * `UserSchema.slug` never constrained the character set, so seeding them was
 * never rejected — but `GET /api/v1/public/users/by-slug/:slug` validates the
 * `:slug` path param against `^[a-z0-9]+(?:[_-][a-z0-9]+)*$` and 400s before
 * the row is even looked up, so both authors' pages 404ed permanently.
 * `UserCreateInputSchema`/`UserUpdateInputSchema` now enforce the same
 * pattern (see `packages/schemas/src/entities/user/user.crud.schema.ts`), so
 * a NEW non-conforming fixture would fail loudly at seed time via
 * `UserService.create` — but that only fires when the seed actually runs.
 * This test catches the mistake at `pnpm test` time, before anyone seeds a
 * database with it, exactly like `required-staff-system-account.test.ts`
 * catches a dropped `isSystemAccount` flag.
 *
 * Scoped to `src/data/user/example/**` (the only directory where this class
 * of fixture — hand-curated example users, several with real Spanish surnames
 * — has ever carried an accented slug). The `id` field and filenames are
 * DELIBERATELY not covered here: `id` is the seed key that derives the
 * fixture's deterministic UUIDv5 and is referenced by other fixtures'
 * `ownerId`, so it must never be considered non-conforming and "fixed";
 * filenames are not seeded data at all.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURES_DIR = path.resolve(__dirname, '../src/data/user/example');

/** Same pattern `getBySlug.ts` and the write schemas enforce. */
const CONFORMING_SLUG_PATTERN = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

/** Every example user fixture file, in directory order. */
const FIXTURE_FILES = readdirSync(FIXTURES_DIR).filter((name) => name.endsWith('.json'));

/** Reads one example-user fixture as a plain object. */
function readFixture(fileName: string): Record<string, unknown> {
    const raw = readFileSync(path.join(FIXTURES_DIR, fileName), 'utf8');
    return JSON.parse(raw) as Record<string, unknown>;
}

describe('HOS-375: example user fixtures carry an ASCII-conforming slug', () => {
    it('has fixtures to check (non-vacuity guard)', () => {
        expect(FIXTURE_FILES.length).toBeGreaterThan(0);
    });

    it.each(FIXTURE_FILES)('%s declares a slug matching the public-route pattern', (fileName) => {
        const fixture = readFixture(fileName);

        expect(typeof fixture.slug).toBe('string');
        expect(fixture.slug as string).toMatch(CONFORMING_SLUG_PATTERN);
    });

    it('specifically covers the two fixtures that regressed (ana-rodriguez / carlos-martinez)', () => {
        const ana = readFixture('004-user-ana-rodríguez.json');
        const carlos = readFixture('002-user-carlos-martínez.json');

        expect(ana.slug).toBe('ana-rodriguez');
        expect(carlos.slug).toBe('carlos-martinez');
    });
});
