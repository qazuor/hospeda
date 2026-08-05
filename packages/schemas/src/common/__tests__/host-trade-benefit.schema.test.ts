import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { HostTradeBenefitTypeEnum } from '../../enums/host-trade-benefit-type.enum.js';
import {
    HOST_TRADE_BENEFIT_MAX_PERCENTAGE,
    HOST_TRADE_BENEFIT_TEXT_MAX,
    HostTradeBenefitFieldsSchema,
    refineHostTradeBenefit
} from '../host-trade-benefit.schema.js';

/**
 * The composed schema exactly as consumers are meant to use it: the fields plus
 * the cross-field refinement. Testing the fields schema alone would assert the
 * permissive half and miss every rule that matters.
 */
const BenefitSchema = HostTradeBenefitFieldsSchema.superRefine(refineHostTradeBenefit);

/** Collects the `path.join('.')` of every issue, for order-independent assertions. */
const issuePathsOf = (result: z.SafeParseReturnType<unknown, unknown>): string[] =>
    result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));

/** Collects issue messages, so a rule is pinned to ITS message, not just "failed". */
const issueMessagesOf = (result: z.SafeParseReturnType<unknown, unknown>): string[] =>
    result.success ? [] : result.error.issues.map((issue) => issue.message);

describe('refineHostTradeBenefit', () => {
    describe('numeric benefit types require a value', () => {
        it.each([
            HostTradeBenefitTypeEnum.PERCENTAGE,
            HostTradeBenefitTypeEnum.FIXED_AMOUNT
        ])('rejects %s with no value', (benefitType) => {
            // Arrange
            const input = { benefitType };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            expect(issuePathsOf(result)).toContain('benefitValue');
            expect(issueMessagesOf(result)).toContain('zodError.hostTrade.benefitValue.required');
        });

        it.each([
            HostTradeBenefitTypeEnum.PERCENTAGE,
            HostTradeBenefitTypeEnum.FIXED_AMOUNT
        ])('rejects %s with an explicitly null value', (benefitType) => {
            // Arrange
            const input = { benefitType, benefitValue: null };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            expect(issueMessagesOf(result)).toContain('zodError.hostTrade.benefitValue.required');
        });

        it('accepts a percentage with a value', () => {
            // Arrange
            const input = { benefitType: HostTradeBenefitTypeEnum.PERCENTAGE, benefitValue: 15 };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('accepts a fixed amount in centavos', () => {
            // Arrange
            const input = {
                benefitType: HostTradeBenefitTypeEnum.FIXED_AMOUNT,
                benefitValue: 250_000
            };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('non-numeric benefit types reject a value', () => {
        it.each([
            HostTradeBenefitTypeEnum.TWO_FOR_ONE,
            HostTradeBenefitTypeEnum.SPECIAL_CONDITION
        ])('accepts %s with no value', (benefitType) => {
            // Arrange
            const input = { benefitType };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it.each([
            HostTradeBenefitTypeEnum.TWO_FOR_ONE,
            HostTradeBenefitTypeEnum.SPECIAL_CONDITION
        ])('rejects %s carrying a leftover value', (benefitType) => {
            // Arrange — the realistic case: the type was changed away from
            // PERCENTAGE and the old 15 was never cleared.
            const input = { benefitType, benefitValue: 15 };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            expect(issueMessagesOf(result)).toContain(
                'zodError.hostTrade.benefitValue.notAllowedForType'
            );
        });
    });

    describe('percentage ceiling', () => {
        it(`accepts exactly ${HOST_TRADE_BENEFIT_MAX_PERCENTAGE}%`, () => {
            // Arrange
            const input = {
                benefitType: HostTradeBenefitTypeEnum.PERCENTAGE,
                benefitValue: HOST_TRADE_BENEFIT_MAX_PERCENTAGE
            };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert — the boundary itself is valid: a 100% discount is "free",
            // which is a real offer, unlike 101%.
            expect(result.success).toBe(true);
        });

        it(`rejects ${HOST_TRADE_BENEFIT_MAX_PERCENTAGE + 1}%`, () => {
            // Arrange
            const input = {
                benefitType: HostTradeBenefitTypeEnum.PERCENTAGE,
                benefitValue: HOST_TRADE_BENEFIT_MAX_PERCENTAGE + 1
            };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            expect(issueMessagesOf(result)).toContain(
                'zodError.hostTrade.benefitValue.percentageMax'
            );
        });

        it('does NOT cap a fixed amount, which is centavos and legitimately large', () => {
            // Arrange — $5.000 = 500000 centavos, far above the percentage cap.
            const input = {
                benefitType: HostTradeBenefitTypeEnum.FIXED_AMOUNT,
                benefitValue: 500_000
            };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('a value with no type', () => {
        it('is rejected — an orphan number means nothing', () => {
            // Arrange
            const input = { benefitValue: 15 };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            expect(issueMessagesOf(result)).toContain(
                'zodError.hostTrade.benefitValue.requiresType'
            );
        });

        it('accepts an entirely absent benefit', () => {
            // Arrange — listings that predate the structured shape carry none.
            const input = {};

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('accepts an explicitly nulled benefit', () => {
            // Arrange
            const input = { benefitType: null, benefitValue: null, benefitText: null };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('value shape', () => {
        it('rejects a fractional percentage', () => {
            // Arrange
            const input = { benefitType: HostTradeBenefitTypeEnum.PERCENTAGE, benefitValue: 12.5 };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            expect(issueMessagesOf(result)).toContain('zodError.hostTrade.benefitValue.int');
        });

        it('rejects a zero value — a 0% discount is not a benefit', () => {
            // Arrange
            const input = { benefitType: HostTradeBenefitTypeEnum.PERCENTAGE, benefitValue: 0 };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            expect(issueMessagesOf(result)).toContain('zodError.hostTrade.benefitValue.positive');
        });

        it('rejects a negative value', () => {
            // Arrange
            const input = { benefitType: HostTradeBenefitTypeEnum.FIXED_AMOUNT, benefitValue: -1 };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            expect(issueMessagesOf(result)).toContain('zodError.hostTrade.benefitValue.positive');
        });
    });

    describe('fine print', () => {
        it(`accepts text at exactly ${HOST_TRADE_BENEFIT_TEXT_MAX} characters`, () => {
            // Arrange
            const input = {
                benefitType: HostTradeBenefitTypeEnum.TWO_FOR_ONE,
                benefitText: 'x'.repeat(HOST_TRADE_BENEFIT_TEXT_MAX)
            };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it(`rejects text over ${HOST_TRADE_BENEFIT_TEXT_MAX} characters`, () => {
            // Arrange
            const input = {
                benefitType: HostTradeBenefitTypeEnum.TWO_FOR_ONE,
                benefitText: 'x'.repeat(HOST_TRADE_BENEFIT_TEXT_MAX + 1)
            };

            // Act
            const result = BenefitSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
            expect(issuePathsOf(result)).toContain('benefitText');
        });
    });
});
