/**
 * Unit tests for AI usage reporting aggregate schemas (SPEC-173 T-018, SPEC-260).
 *
 * Coverage:
 *   - AiUsageTotalsSchema: valid parse + boundary values.
 *   - AiUsageMonthlyRowSchema: valid month format + rejects bad month strings.
 *   - AiUsageByUserRowSchema: valid UUID userId + null (anonymised).
 *   - AiUsageByFeatureRowSchema: valid feature string + rejects empty.
 *   - AiUsageByModelRowSchema (SPEC-260): valid model string + rejects empty.
 *   - AiUsageByProviderRowSchema (SPEC-260): valid provider string + rejects empty.
 *   - AiUsageByFeatureModelRowSchema (SPEC-260): valid (feature, model) combo + rejects empty fields.
 *   - AiUsageDailyRowSchema (SPEC-260): valid YYYY-MM-DD day + rejects bad formats.
 *   - Negative cases: negative integers, floats, wrong types.
 *
 * @module test/entities/ai/ai-usage-report.schema.test
 */

import { describe, expect, it } from 'vitest';
import {
    AiUsageByFeatureModelRowSchema,
    AiUsageByFeatureRowSchema,
    AiUsageByModelRowSchema,
    AiUsageByProviderRowSchema,
    AiUsageByUserRowSchema,
    AiUsageDailyRowSchema,
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

// ---------------------------------------------------------------------------
// AiUsageByModelRowSchema (SPEC-260)
// ---------------------------------------------------------------------------

describe('AiUsageByModelRowSchema', () => {
    describe('when given a valid model row', () => {
        it('should parse a known OpenAI model identifier', () => {
            // Arrange
            const input = {
                model: 'gpt-4o-mini',
                calls: 120,
                tokensIn: 240_000,
                tokensOut: 90_000,
                costMicroUsd: 90_000
            };

            // Act
            const result = AiUsageByModelRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.model).toBe('gpt-4o-mini');
            }
        });

        it('should parse an Anthropic model identifier', () => {
            // Arrange
            const input = {
                model: 'claude-3-5-haiku-20241022',
                calls: 40,
                tokensIn: 80_000,
                tokensOut: 30_000,
                costMicroUsd: 184_000
            };

            // Act
            const result = AiUsageByModelRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse a model row with zero cost (stub provider)', () => {
            // Arrange
            const input = {
                model: 'stub',
                calls: 5,
                tokensIn: 500,
                tokensOut: 200,
                costMicroUsd: 0
            };

            // Act
            const result = AiUsageByModelRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given an invalid model row', () => {
        it('should reject an empty model string', () => {
            // Arrange
            const input = {
                model: '',
                calls: 1,
                tokensIn: 10,
                tokensOut: 5,
                costMicroUsd: 1
            };

            // Act
            const result = AiUsageByModelRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a non-string model value', () => {
            // Arrange
            const input = {
                model: null as unknown,
                calls: 1,
                tokensIn: 10,
                tokensOut: 5,
                costMicroUsd: 1
            };

            // Act
            const result = AiUsageByModelRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject negative costMicroUsd', () => {
            // Arrange
            const input = {
                model: 'gpt-4o-mini',
                calls: 1,
                tokensIn: 100,
                tokensOut: 50,
                costMicroUsd: -500
            };

            // Act
            const result = AiUsageByModelRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// AiUsageByProviderRowSchema (SPEC-260)
// ---------------------------------------------------------------------------

describe('AiUsageByProviderRowSchema', () => {
    describe('when given a valid provider row', () => {
        it('should parse an "openai" provider row', () => {
            // Arrange
            const input = {
                provider: 'openai',
                calls: 80,
                tokensIn: 160_000,
                tokensOut: 60_000,
                costMicroUsd: 75_000
            };

            // Act
            const result = AiUsageByProviderRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.provider).toBe('openai');
            }
        });

        it('should parse an "anthropic" provider row', () => {
            // Arrange
            const input = {
                provider: 'anthropic',
                calls: 20,
                tokensIn: 40_000,
                tokensOut: 15_000,
                costMicroUsd: 95_000
            };

            // Act
            const result = AiUsageByProviderRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse a "stub" provider row with zero cost', () => {
            // Arrange
            const input = {
                provider: 'stub',
                calls: 3,
                tokensIn: 300,
                tokensOut: 120,
                costMicroUsd: 0
            };

            // Act
            const result = AiUsageByProviderRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given an invalid provider row', () => {
        it('should reject an empty provider string', () => {
            // Arrange
            const input = {
                provider: '',
                calls: 1,
                tokensIn: 10,
                tokensOut: 5,
                costMicroUsd: 1
            };

            // Act
            const result = AiUsageByProviderRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a missing provider field', () => {
            // Arrange — provider omitted
            const input = { calls: 1, tokensIn: 10, tokensOut: 5, costMicroUsd: 1 };

            // Act
            const result = AiUsageByProviderRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// AiUsageByFeatureModelRowSchema (SPEC-260)
// ---------------------------------------------------------------------------

describe('AiUsageByFeatureModelRowSchema', () => {
    describe('when given a valid feature × model row', () => {
        it('should parse a (chat, gpt-4o-mini) cross row', () => {
            // Arrange — mirrors the spec example response
            const input = {
                feature: 'chat',
                model: 'gpt-4o-mini',
                calls: 120,
                tokensIn: 240_000,
                tokensOut: 90_000,
                costMicroUsd: 90_000
            };

            // Act
            const result = AiUsageByFeatureModelRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.feature).toBe('chat');
                expect(result.data.model).toBe('gpt-4o-mini');
            }
        });

        it('should parse a (chat, claude-3-5-haiku-20241022) cross row', () => {
            // Arrange — mirrors the spec example response
            const input = {
                feature: 'chat',
                model: 'claude-3-5-haiku-20241022',
                calls: 40,
                tokensIn: 80_000,
                tokensOut: 30_000,
                costMicroUsd: 184_000
            };

            // Act
            const result = AiUsageByFeatureModelRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given an invalid feature × model row', () => {
        it('should reject an empty feature string', () => {
            // Arrange
            const input = {
                feature: '',
                model: 'gpt-4o-mini',
                calls: 1,
                tokensIn: 10,
                tokensOut: 5,
                costMicroUsd: 1
            };

            // Act
            const result = AiUsageByFeatureModelRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty model string', () => {
            // Arrange
            const input = {
                feature: 'chat',
                model: '',
                calls: 1,
                tokensIn: 10,
                tokensOut: 5,
                costMicroUsd: 1
            };

            // Act
            const result = AiUsageByFeatureModelRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a row missing the model field', () => {
            // Arrange — model omitted
            const input = {
                feature: 'chat',
                calls: 1,
                tokensIn: 10,
                tokensOut: 5,
                costMicroUsd: 1
            };

            // Act
            const result = AiUsageByFeatureModelRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// AiUsageDailyRowSchema (SPEC-260)
// ---------------------------------------------------------------------------

describe('AiUsageDailyRowSchema', () => {
    describe('when given a valid daily row', () => {
        it('should parse a standard YYYY-MM-DD day', () => {
            // Arrange
            const input = {
                day: '2026-06-15',
                calls: 50,
                tokensIn: 100_000,
                tokensOut: 40_000,
                costMicroUsd: 22_000
            };

            // Act
            const result = AiUsageDailyRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.day).toBe('2026-06-15');
            }
        });

        it('should parse the first day of a month (month boundary)', () => {
            // Arrange
            const input = {
                day: '2026-06-01',
                calls: 0,
                tokensIn: 0,
                tokensOut: 0,
                costMicroUsd: 0
            };

            // Act
            const result = AiUsageDailyRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should parse the last day of a year (year-end boundary)', () => {
            // Arrange
            const input = {
                day: '2025-12-31',
                calls: 10,
                tokensIn: 2_000,
                tokensOut: 800,
                costMicroUsd: 400
            };

            // Act
            const result = AiUsageDailyRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given an invalid day', () => {
        it("should reject 'YYYY-MM' (month format — missing day)", () => {
            // Arrange
            const input = {
                day: '2026-06',
                calls: 1,
                tokensIn: 1,
                tokensOut: 1,
                costMicroUsd: 1
            };

            // Act
            const result = AiUsageDailyRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an ISO datetime string (with time component)', () => {
            // Arrange
            const input = {
                day: '2026-06-15T00:00:00Z',
                calls: 1,
                tokensIn: 1,
                tokensOut: 1,
                costMicroUsd: 1
            };

            // Act
            const result = AiUsageDailyRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it("should reject 'YYYY-M-D' (missing leading zeros)", () => {
            // Arrange
            const input = {
                day: '2026-6-5',
                calls: 1,
                tokensIn: 1,
                tokensOut: 1,
                costMicroUsd: 1
            };

            // Act
            const result = AiUsageDailyRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty string', () => {
            // Arrange
            const input = { day: '', calls: 1, tokensIn: 1, tokensOut: 1, costMicroUsd: 1 };

            // Act
            const result = AiUsageDailyRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a missing day field', () => {
            // Arrange — day omitted
            const input = { calls: 5, tokensIn: 100, tokensOut: 50, costMicroUsd: 20 };

            // Act
            const result = AiUsageDailyRowSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});
