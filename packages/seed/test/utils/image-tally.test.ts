import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatImageTally } from '../../src/utils/image-tally.js';
import type { ImageProcessingCounters } from '../../src/utils/seedContext.js';

/**
 * Builds a counters object with all four fields at zero unless overridden.
 */
function makeCounters(overrides: Partial<ImageProcessingCounters> = {}): ImageProcessingCounters {
    return { uploaded: 0, cached: 0, failures: 0, skippedExample: 0, ...overrides };
}

describe('formatImageTally — HOS-922', () => {
    describe('level', () => {
        it('logs at info when nothing failed', () => {
            // Arrange
            const counters = makeCounters({ uploaded: 12, cached: 30 });

            // Act
            const { level } = formatImageTally({ counters });

            // Assert
            expect(level).toBe('info');
        });

        it('raises the level to warn as soon as one image failed', () => {
            // Arrange
            const counters = makeCounters({ uploaded: 12, cached: 30, failures: 1 });

            // Act
            const { level } = formatImageTally({ counters });

            // Assert
            expect(level).toBe('warn');
        });

        it('stays at warn for a large batch of tolerated failures', () => {
            // Arrange
            const counters = makeCounters({ uploaded: 100, failures: 21 });

            // Act
            const { level } = formatImageTally({ counters });

            // Assert
            expect(level).toBe('warn');
        });
    });

    describe('message', () => {
        it('reports every counter verbatim', () => {
            // Arrange
            const counters = makeCounters({
                uploaded: 3,
                cached: 5,
                failures: 0,
                skippedExample: 7
            });

            // Act
            const { message } = formatImageTally({ counters });

            // Assert
            expect(message).toBe(
                '[seed:images] tally uploaded=3 cached=5 failures=0 skippedExample=7'
            );
        });

        it('says the failures were tolerated, and how many', () => {
            // Arrange
            const counters = makeCounters({ uploaded: 4325, failures: 21 });

            // Act
            const { message } = formatImageTally({ counters });

            // Assert
            expect(message).toContain('failures=21');
            expect(message).toContain('21 image failure(s) tolerated');
        });

        it('does NOT claim anything was tolerated on a clean run', () => {
            // Arrange
            const counters = makeCounters({ uploaded: 4325 });

            // Act
            const { message } = formatImageTally({ counters });

            // Assert
            expect(message).not.toContain('tolerated');
        });
    });
});

/**
 * A perfectly correct formatter nobody calls reports nothing. `runSeed` needs a
 * live database, so the wiring is pinned by reading the entry point instead.
 */
describe('formatImageTally is wired into runSeed — HOS-922', () => {
    const entryPoint = readFileSync(
        join(import.meta.dirname, '..', '..', 'src', 'index.ts'),
        'utf-8'
    );

    it('calls the formatter instead of interpolating the counters by hand', () => {
        // Assert
        expect(
            entryPoint,
            '`runSeed` must report the tally through `formatImageTally` so the level follows the failure count (HOS-922).'
        ).toContain('formatImageTally({ counters: imageCounters })');
    });

    it('logs the tally at warn when the formatter asks for it', () => {
        // Act
        const usesWarn = /tally\.level === 'warn'[\s\S]{0,120}logger\.warn\(tally\.message\)/.test(
            entryPoint
        );

        // Assert
        expect(
            usesWarn,
            'A tolerated image failure must reach the log as a warning, otherwise a Cloudinary degradation is invisible in CI (HOS-922).'
        ).toBe(true);
    });
});
