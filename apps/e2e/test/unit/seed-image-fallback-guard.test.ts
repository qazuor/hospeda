/**
 * HOS-922: regression guard for the E2E seed's image-failure policy.
 *
 * A transient Cloudinary upload failure once aborted the whole E2E seed, which
 * blocked a pull request that had touched no code at all. The runner now tells
 * `@repo/seed` to tolerate image failures **in CI** (the database is ephemeral
 * and no E2E test asserts that an image reached Cloudinary) while a local run
 * still fails loudly, so a real breakage of the image pipeline is not hidden
 * from whoever is working on it.
 *
 * The option is a single line of configuration inside a top-level script that
 * cannot be imported from a test (it runs `process.chdir` and a dynamic import
 * at module scope), so the policy is pinned by reading the source. Both halves
 * are asserted separately: that the option is passed at all, and that its value
 * is derived from `process.env.CI` rather than hard-coded — flipping it to an
 * unconditional `true` is a deliberate policy change and must not pass silently.
 *
 * @see HOS-922
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SEED_RUNNER = join(import.meta.dirname, '..', '..', 'seeds', 'e2e-seed.ts');

/**
 * Extracts the source of the `runSeed({ ... })` call, brace-balanced, so the
 * guard reads the actual call rather than anything else in the file that
 * happens to mention the same words.
 */
function readRunSeedCall(source: string): string {
    const callIndex = source.indexOf('runSeed({');
    if (callIndex === -1) {
        throw new Error('No `runSeed({` call found in the E2E seed runner.');
    }

    const openIndex = source.indexOf('{', callIndex);
    let depth = 0;

    for (let index = openIndex; index < source.length; index += 1) {
        const char = source[index];
        if (char === '{') depth += 1;
        if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(openIndex, index + 1);
            }
        }
    }

    throw new Error('Unbalanced braces in the `runSeed({ ... })` call.');
}

/**
 * Returns the lines of `block` that are not line comments, so a comment
 * mentioning an option cannot stand in for the option itself.
 */
function codeLines(block: string): readonly string[] {
    return block.split('\n').filter((line) => !line.trim().startsWith('//'));
}

describe('HOS-922: the E2E seed tolerates image failures in CI', () => {
    const source = readFileSync(SEED_RUNNER, 'utf-8');
    const runSeedCall = readRunSeedCall(source);
    const lines = codeLines(runSeedCall);

    it('passes allowRequiredFallback to runSeed', () => {
        // Act
        const optionLines = lines.filter((line) => line.includes('allowRequiredFallback'));

        // Assert
        expect(
            optionLines,
            'The E2E seed must pass `allowRequiredFallback` to runSeed, or a transient Cloudinary failure aborts the run and blocks the PR (HOS-922).'
        ).toHaveLength(1);
    });

    it('derives allowRequiredFallback from process.env.CI, not a hard-coded value', () => {
        // Act
        const optionLine = lines.find((line) => line.includes('allowRequiredFallback')) ?? '';

        // Assert
        expect(
            optionLine,
            'The value must come from `process.env.CI`: CI tolerates a transient upload failure, a local run still fails loudly (HOS-922).'
        ).toContain('process.env.CI');
    });
});
