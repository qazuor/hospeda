import { describe, expect, it, vi } from 'vitest';
import { type CheckRunner, DOCTOR_CHECKS, runDoctor } from '../env-doctor.js';

describe('env-doctor', () => {
    it('runs the three local checks in order', () => {
        // Arrange
        expect(DOCTOR_CHECKS.map((c) => c.name)).toEqual([
            'env:check:usage',
            'env:check:local',
            'env:check:rules'
        ]);
    });

    it('reports no failures when every check passes', () => {
        // Arrange
        const runner: CheckRunner = vi.fn(() => 0);

        // Act
        const { failed } = runDoctor({ runner });

        // Assert
        expect(failed).toEqual([]);
    });

    it('collects the name of a failing check', () => {
        // Arrange: only the rules check fails
        const runner: CheckRunner = ({ script }) => (script === 'check-env-rules.ts' ? 1 : 0);

        // Act
        const { failed } = runDoctor({ runner });

        // Assert
        expect(failed).toEqual(['env:check:rules']);
    });

    it('runs ALL checks even when an earlier one fails (report-all, not stop-at-first)', () => {
        // Arrange: the first check fails
        const runner = vi.fn<CheckRunner>(({ script }) =>
            script === 'check-env-usage.ts' ? 1 : 0
        );

        // Act
        const { failed } = runDoctor({ runner });

        // Assert: all three still executed, only the failing one reported
        expect(runner).toHaveBeenCalledTimes(3);
        expect(failed).toEqual(['env:check:usage']);
    });

    it('reports every failure when multiple checks fail', () => {
        // Arrange
        const runner: CheckRunner = () => 1;

        // Act
        const { failed } = runDoctor({ runner });

        // Assert
        expect(failed).toEqual(['env:check:usage', 'env:check:local', 'env:check:rules']);
    });
});
