/**
 * Orchestrator-wiring test for the points-of-interest required seed
 * (HOS-113 T-025).
 *
 * `runRequiredSeeds()` in `src/required/index.ts` sequentially awaits ~20
 * other seed steps against a real service/DB layer, so it cannot be
 * exercised end-to-end in a unit test (that is HOS-113 T-028's integration
 * suite). This test instead statically inspects the orchestrator's SOURCE to
 * assert the wiring contract: `seedPointsOfInterest` is imported and called,
 * and — critically — called BEFORE `seedDestinations`, mirroring
 * `seedAttractions`'s ordering. The destination↔POI relationship seed step
 * (T-026, inside `seedDestinations`'s `relationBuilder`) resolves POI
 * seed-ids via `context.idMapper`, which is only populated once
 * `seedPointsOfInterest` has already run — running it after destinations
 * would silently produce zero relations (every `idMapper.getRealId` lookup
 * would miss).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ORCHESTRATOR_SOURCE_PATH = join(__dirname, '../../src/required/index.ts');

function readOrchestratorSource(): string {
    return readFileSync(ORCHESTRATOR_SOURCE_PATH, 'utf-8');
}

describe('required-seed orchestrator wiring: pointsOfInterest (HOS-113 T-025)', () => {
    it('should import seedPointsOfInterest from ./pointsOfInterest.seed.js', () => {
        const source = readOrchestratorSource();
        expect(source).toMatch(
            /import\s*\{\s*seedPointsOfInterest\s*\}\s*from\s*['"]\.\/pointsOfInterest\.seed\.js['"]/
        );
    });

    it('should call await seedPointsOfInterest(context) inside runRequiredSeeds', () => {
        const source = readOrchestratorSource();
        expect(source).toMatch(/await\s+seedPointsOfInterest\(context\)/);
    });

    it('should call seedPointsOfInterest BEFORE seedDestinations (id-mapping dependency)', () => {
        const source = readOrchestratorSource();
        const poiCallIndex = source.indexOf('await seedPointsOfInterest(context)');
        const destinationsCallIndex = source.indexOf('await seedDestinations(context)');

        expect(poiCallIndex).toBeGreaterThan(-1);
        expect(destinationsCallIndex).toBeGreaterThan(-1);
        expect(poiCallIndex).toBeLessThan(destinationsCallIndex);
    });

    it('should call seedPointsOfInterest AFTER seedAttractions (both precede destinations, same reason)', () => {
        const source = readOrchestratorSource();
        const attractionsCallIndex = source.indexOf('await seedAttractions(context)');
        const poiCallIndex = source.indexOf('await seedPointsOfInterest(context)');

        expect(attractionsCallIndex).toBeGreaterThan(-1);
        expect(poiCallIndex).toBeGreaterThan(-1);
        expect(attractionsCallIndex).toBeLessThan(poiCallIndex);
    });
});
