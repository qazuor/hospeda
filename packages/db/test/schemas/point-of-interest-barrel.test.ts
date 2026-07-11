/**
 * HOS-113 T-005 — barrel export smoke test.
 *
 * Verifies that both new POI Drizzle schemas are re-exported all the way up
 * the barrel chain (`destination/index.ts` -> `schemas/index.ts` ->
 * `src/index.ts`), the same path every other `@repo/db` consumer imports
 * through, so `pointsOfInterest` and `rDestinationPointOfInterest` are
 * importable from the package root.
 */
import { describe, expect, it } from 'vitest';

import { pointsOfInterest, rDestinationPointOfInterest } from '../../src/index.ts';

describe('POI schema barrel exports', () => {
    it('exports pointsOfInterest from the package root', () => {
        expect(pointsOfInterest).toBeDefined();
    });

    it('exports rDestinationPointOfInterest from the package root', () => {
        expect(rDestinationPointOfInterest).toBeDefined();
    });
});
