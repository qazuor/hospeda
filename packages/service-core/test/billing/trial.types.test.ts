/**
 * Unit tests for `resolvePlanTrialConfig` (HOS-110).
 *
 * Pure function, no mocks needed: reads `hasTrial` / `trialDays` off a plan's
 * raw `metadata` value and resolves to a safe "no trial" default whenever the
 * shape is malformed, missing, or absent — mirroring the defensive pattern
 * `mapDbToPlan` already uses in `plan.crud.ts`.
 *
 * Both `TrialService.startTrial` (apps/api) and the paid checkout's trial
 * eligibility check (`initiatePaidMonthlySubscription`) call this SAME
 * function so the two never drift on how they interpret the same metadata
 * shape — these tests pin that single source of truth.
 *
 * @module test/billing/trial.types
 */
import { describe, expect, it } from 'vitest';
import { resolvePlanTrialConfig } from '../../src/services/billing/addon/trial.types.js';

describe('resolvePlanTrialConfig', () => {
    describe('when metadata declares a valid trial', () => {
        it('should resolve hasTrial:true and the declared trialDays', () => {
            // Arrange
            const metadata = { hasTrial: true, trialDays: 14 };

            // Act
            const result = resolvePlanTrialConfig(metadata);

            // Assert
            expect(result).toEqual({ hasTrial: true, trialDays: 14 });
        });

        it('should resolve a different trialDays value for a different plan (e.g. owner-test-daily: 1 day)', () => {
            // Arrange
            const metadata = { hasTrial: true, trialDays: 1 };

            // Act
            const result = resolvePlanTrialConfig(metadata);

            // Assert
            expect(result).toEqual({ hasTrial: true, trialDays: 1 });
        });

        it('should ignore unrelated metadata keys alongside a valid trial config', () => {
            // Arrange
            const metadata = {
                hasTrial: true,
                trialDays: 14,
                slug: 'owner-basico',
                displayName: 'Basic',
                sortOrder: 1
            };

            // Act
            const result = resolvePlanTrialConfig(metadata);

            // Assert
            expect(result).toEqual({ hasTrial: true, trialDays: 14 });
        });
    });

    describe('when metadata explicitly declares no trial', () => {
        it('should resolve hasTrial:false and trialDays:0', () => {
            // Arrange
            const metadata = { hasTrial: false, trialDays: 0 };

            // Act
            const result = resolvePlanTrialConfig(metadata);

            // Assert
            expect(result).toEqual({ hasTrial: false, trialDays: 0 });
        });
    });

    describe('when fields are missing or malformed', () => {
        it('should default hasTrial to false when the key is missing', () => {
            // Arrange
            const metadata = { trialDays: 14 };

            // Act
            const result = resolvePlanTrialConfig(metadata);

            // Assert
            expect(result.hasTrial).toBe(false);
        });

        it('should default trialDays to 0 when the key is missing', () => {
            // Arrange
            const metadata = { hasTrial: true };

            // Act
            const result = resolvePlanTrialConfig(metadata);

            // Assert
            expect(result.trialDays).toBe(0);
        });

        it('should default hasTrial to false when its value is a non-boolean', () => {
            // Arrange — e.g. a stringly-typed legacy value
            const metadata = { hasTrial: 'true', trialDays: 14 };

            // Act
            const result = resolvePlanTrialConfig(metadata);

            // Assert
            expect(result.hasTrial).toBe(false);
        });

        it('should default trialDays to 0 when its value is a non-number', () => {
            // Arrange
            const metadata = { hasTrial: true, trialDays: '14' };

            // Act
            const result = resolvePlanTrialConfig(metadata);

            // Assert
            expect(result.trialDays).toBe(0);
        });

        it('should resolve both fields to safe defaults on a completely empty object', () => {
            // Arrange
            const metadata = {};

            // Act
            const result = resolvePlanTrialConfig(metadata);

            // Assert
            expect(result).toEqual({ hasTrial: false, trialDays: 0 });
        });
    });

    describe('when metadata is not an object', () => {
        it('should resolve safe defaults when metadata is null', () => {
            // Act
            const result = resolvePlanTrialConfig(null);

            // Assert
            expect(result).toEqual({ hasTrial: false, trialDays: 0 });
        });

        it('should resolve safe defaults when metadata is undefined', () => {
            // Act
            const result = resolvePlanTrialConfig(undefined);

            // Assert
            expect(result).toEqual({ hasTrial: false, trialDays: 0 });
        });

        it('should resolve safe defaults when metadata is a string (malformed JSONB read)', () => {
            // Act
            const result = resolvePlanTrialConfig('not-an-object');

            // Assert
            expect(result).toEqual({ hasTrial: false, trialDays: 0 });
        });

        it('should resolve safe defaults when metadata is a number', () => {
            // Act
            const result = resolvePlanTrialConfig(42);

            // Assert
            expect(result).toEqual({ hasTrial: false, trialDays: 0 });
        });

        it('should resolve safe defaults when metadata is an array', () => {
            // Act
            const result = resolvePlanTrialConfig([1, 2, 3]);

            // Assert
            expect(result).toEqual({ hasTrial: false, trialDays: 0 });
        });
    });
});
