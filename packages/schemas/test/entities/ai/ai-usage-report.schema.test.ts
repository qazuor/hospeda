/**
 * Unit tests for AI usage reporting aggregate schemas (SPEC-173 T-018).
 *
 * Coverage:
 *   - AiUsageTotalsSchema: valid parse + boundary values.
 *   - AiUsageMonthlyRowSchema: valid month format + rejects bad month strings.
 *   - AiUsageByUserRowSchema: valid UUID userId + null (anonymised).
 *   - AiUsageByFeatureRowSchema: valid feature string + rejects empty.
 *   - Negative cases: negative integers, floats, wrong types.
 *
 * @module test/entities/ai/ai-usage-report.schema.test
 */

import { describe, expect, it } from 'vitest';
import {
    AiUsageByFeatureRowSchema,
    AiUsageByUserRowSchema,
    AiUsageMonthlyRowSchema,
    AiUsageTotalsSchema
} from '../../../src/entities/ai/ai-usage-report.schema.js';

// ---------------------------------------------------------------------------
// AiUsageTotalsSchema
// ---------------------------------------------------------------------------

describe('AiUsageTotalsSchema', () => {
    describe('when given a valid totals object', () => {
        it('should parse all-zero values (empty window)', () => {
            // Arrange
            const input = { calls: 0, tokensIn: 0, tokensOut: 0, costMicroUsd: 0 };

            // Act
            const result = AiUsageTotalsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse realistic positive values', () => {
            // Arrange
            const input = { calls: 42, tokensIn: 10_000, tokensOut: 5_000, costMicroUsd: 8_500 };

            // Act
            const result = AiUsageTotalsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.calls).toBe(42);
                expect(result.data.costMicroUsd).toBe(8_500);
            }
        });
    });

    describe('when given invalid values', () => {
        it('should reject negative calls count', () => {
            // Arrange
            const input = { calls: -1, tokensIn: 0, tokensOut: 0, costMicroUsd: 0 };

            // Act
            const result = AiUsageTotalsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject negative costMicroUsd', () => {
            // Arrange
            const input = { calls: 1, tokensIn: 100, tokensOut: 50, costMicroUsd: -1 };

            // Act
            const result = AiUsageTotalsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject float values for integer fields', () => {
            // Arrange
            const input = { calls: 1.5, tokensIn: 100, tokensOut: 50, costMicroUsd: 0 };

            // Act
            const result = AiUsageTotalsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a missing required field', () => {
            // Arrange — tokensOut omitted
            const input = { calls: 1, tokensIn: 100, costMicroUsd: 0 };

            // Act
            const result = AiUsageTotalsSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// AiUsageMonthlyRowSchema
// ---------------------------------------------------------------------------

describe('AiUsageMonthlyRowSchema', () => {
    describe('when given a valid monthly row', () => {
        it('should parse a standard YYYY-MM month', () => {
            // Arrange
            const input = {
                month: '2026-06',
                calls: 100,
                tokensIn: 50_000,
                tokensOut: 25_000,
                costMicroUsd: 12_345
            };

            // Act
            const result = AiUsageMonthlyRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse month at year boundary (December)', () => {
            // Arrange
            const input = {
                month: '2025-12',
                calls: 0,
                tokensIn: 0,
                tokensOut: 0,
                costMicroUsd: 0
            };

            // Act
            const result = AiUsageMonthlyRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given an invalid month', () => {
        it("should reject 'YYYY-M' (missing leading zero)", () => {
            // Arrange
            const input = { month: '2026-6', calls: 1, tokensIn: 1, tokensOut: 1, costMicroUsd: 1 };

            // Act
            const result = AiUsageMonthlyRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a full ISO date string', () => {
            // Arrange
            const input = {
                month: '2026-06-01',
                calls: 1,
                tokensIn: 1,
                tokensOut: 1,
                costMicroUsd: 1
            };

            // Act
            const result = AiUsageMonthlyRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty string', () => {
            // Arrange
            const input = { month: '', calls: 1, tokensIn: 1, tokensOut: 1, costMicroUsd: 1 };

            // Act
            const result = AiUsageMonthlyRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// AiUsageByUserRowSchema
// ---------------------------------------------------------------------------

describe('AiUsageByUserRowSchema', () => {
    describe('when given a valid user row', () => {
        it('should parse a row with a valid UUID userId', () => {
            // Arrange
            const input = {
                userId: '550e8400-e29b-41d4-a716-446655440000',
                calls: 10,
                tokensIn: 500,
                tokensOut: 250,
                costMicroUsd: 75
            };

            // Act
            const result = AiUsageByUserRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse a row with null userId (anonymised deleted user)', () => {
            // Arrange
            const input = {
                userId: null,
                calls: 3,
                tokensIn: 150,
                tokensOut: 75,
                costMicroUsd: 20
            };

            // Act
            const result = AiUsageByUserRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.userId).toBeNull();
            }
        });
    });

    describe('when given an invalid user row', () => {
        it('should reject an invalid UUID string', () => {
            // Arrange
            const input = {
                userId: 'not-a-uuid',
                calls: 1,
                tokensIn: 10,
                tokensOut: 5,
                costMicroUsd: 1
            };

            // Act
            const result = AiUsageByUserRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject negative tokensIn', () => {
            // Arrange
            const input = {
                userId: '550e8400-e29b-41d4-a716-446655440000',
                calls: 1,
                tokensIn: -100,
                tokensOut: 50,
                costMicroUsd: 10
            };

            // Act
            const result = AiUsageByUserRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// AiUsageByFeatureRowSchema
// ---------------------------------------------------------------------------

describe('AiUsageByFeatureRowSchema', () => {
    describe('when given a valid feature row', () => {
        it('should parse a known feature identifier', () => {
            // Arrange
            const input = {
                feature: 'text_improve',
                calls: 25,
                tokensIn: 5_000,
                tokensOut: 3_000,
                costMicroUsd: 1_500
            };

            // Act
            const result = AiUsageByFeatureRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.feature).toBe('text_improve');
            }
        });

        it('should accept any non-empty feature string (forward-compatible)', () => {
            // Arrange — future feature not yet in the enum
            const input = {
                feature: 'summarize',
                calls: 5,
                tokensIn: 200,
                tokensOut: 80,
                costMicroUsd: 40
            };

            // Act
            const result = AiUsageByFeatureRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given an invalid feature row', () => {
        it('should reject an empty feature string', () => {
            // Arrange
            const input = {
                feature: '',
                calls: 1,
                tokensIn: 10,
                tokensOut: 5,
                costMicroUsd: 1
            };

            // Act
            const result = AiUsageByFeatureRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a non-string feature value', () => {
            // Arrange
            const input = {
                feature: 42 as unknown,
                calls: 1,
                tokensIn: 10,
                tokensOut: 5,
                costMicroUsd: 1
            };

            // Act
            const result = AiUsageByFeatureRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});
