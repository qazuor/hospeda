import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DestinationClimateSchema } from '@repo/schemas';
import { describe, expect, it } from 'vitest';

const SEEDED_WITH_CLIMATE = [
    '002-destination-colon.json',
    '005-destination-gualeguaychu.json',
    '011-destination-concepcion-del-uruguay.json'
];

const dataDir = resolve(__dirname, '../src/data/destination');

describe('featured destination climate seeds (SPEC-215)', () => {
    for (const file of SEEDED_WITH_CLIMATE) {
        it(`${file} carries a schema-valid climate object`, () => {
            const raw = JSON.parse(readFileSync(resolve(dataDir, file), 'utf8')) as {
                climate?: unknown;
            };
            expect(raw.climate).toBeDefined();
            const result = DestinationClimateSchema.safeParse(raw.climate);
            expect(result.success).toBe(true);
        });
    }
});
