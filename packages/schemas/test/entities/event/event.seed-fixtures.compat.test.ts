/**
 * Seed-fixture compatibility guard for `EventDateSchema` (HOS-280).
 *
 * Every event seed fixture under `packages/seed/src/data/event/*.json` predates
 * the `precision` field added to `EventDateSchema` — none of them carry it yet.
 * This test dynamically loads every real seed JSON's `date` block and asserts
 * it still `safeParse`s, and that the missing `precision` field defaults to
 * `EXACT` — proving backward compatibility per the additive-only Schema
 * Compatibility Policy (see `docs/guides/schema-compat-policy.md`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { EventDateSchema } from '../../../src/entities/event/subtypes/event.date.schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Anchored relative to this file (not process.cwd()):
// packages/schemas/test/entities/event -> packages/seed/src/data/event
const SEED_EVENT_DATA_DIR = path.resolve(__dirname, '../../../../seed/src/data/event');

interface SeedEventDateFixture {
    id: string;
    date: unknown;
}

/**
 * Loads every event seed fixture's `id` + `date` block from the real
 * `@repo/seed` JSON files.
 */
function loadSeedEventDateFixtures(): SeedEventDateFixture[] {
    const files = fs
        .readdirSync(SEED_EVENT_DATA_DIR)
        .filter((file) => file.endsWith('.json'))
        .sort();

    return files.map((file) => {
        const raw = fs.readFileSync(path.join(SEED_EVENT_DATA_DIR, file), 'utf-8');
        const parsed = JSON.parse(raw) as { id: string; date: unknown };
        return { id: parsed.id, date: parsed.date };
    });
}

describe('EventDateSchema compat — real @repo/seed event fixtures (HOS-280)', () => {
    const fixtures = loadSeedEventDateFixtures();

    it('finds seed event fixtures to validate', () => {
        // Arrange / Act: fixtures loaded at describe-time above

        // Assert
        expect(fixtures.length).toBeGreaterThan(0);
    });

    it.each(
        fixtures.map((fixture) => [fixture.id, fixture.date] as const)
    )('parses the "date" block of seed fixture %s', (_id, date) => {
        // Act
        const result = EventDateSchema.safeParse(date);

        // Assert
        expect(result.success).toBe(true);
    });

    it.each(
        fixtures.map((fixture) => [fixture.id, fixture.date] as const)
    )('defaults precision to EXACT for seed fixture %s (no precision field yet)', (_id, date) => {
        // Act
        const result = EventDateSchema.parse(date);

        // Assert
        expect(result.precision).toBe('EXACT');
    });
});
