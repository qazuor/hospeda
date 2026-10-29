import { describe, expect, it } from 'vitest';
import { step5bExitCode } from '../../../src/services/cutover-v6/step-5b.exit-code.js';

describe('step 5b exit code', () => {
    it.each([
        ['completed', 0],
        ['already_done', 0],
        ['dry_run', 0],
        ['partial', 1]
    ] as const)('maps %s to %i', (status, expected) => {
        // Act
        const code = step5bExitCode({ status });
        // Assert
        expect(code).toBe(expected);
    });
});
