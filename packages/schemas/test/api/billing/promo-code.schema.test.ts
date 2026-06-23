/**
 * Tests for promo-code schemas — SPEC-262 T-004.
 *
 * Covers:
 *  - PromoEffectSchema discriminated union (all three branches, valid + invalid)
 *  - CreatePromoCodeSchema with the new effect field
 *  - UpdatePromoCodeSchema (unchanged)
 *  - PromoCodeResponseSchema backward compat (AC-4.3)
 *  - AC-1.2 (percentage ≤ 100), AC-1.3 (durationCycles > 0 or null), AC-5.4
 */
import { describe, expect, it } from 'vitest';
import {
    type CreatePromoCodeInput,
    CreatePromoCodeSchema,
    type PromoCodeResponse,
    PromoCodeResponseSchema,
    type PromoEffect,
    PromoEffectKindEnum,
    PromoEffectSchema,
    UpdatePromoCodeSchema,
    ValueKindEnum
} from '../../../src/api/billing/promo-code.schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const discountEffect = (
    valueKind: ValueKindEnum,
    value: number,
    durationCycles: number | null
): PromoEffect => ({
    kind: PromoEffectKindEnum.DISCOUNT,
    valueKind,
    value,
    durationCycles
});

// ---------------------------------------------------------------------------
// PromoEffectSchema — discount branch
// ---------------------------------------------------------------------------

describe('PromoEffectSchema — discount branch', () => {
    describe('valid payloads', () => {
        it('accepts a one-shot percentage discount (durationCycles = 1)', () => {
            const result = PromoEffectSchema.safeParse(
                discountEffect(ValueKindEnum.PERCENTAGE, 30, 1)
            );
            expect(result.success).toBe(true);
        });

        it('accepts a multi-cycle percentage discount (durationCycles = 3)', () => {
            const result = PromoEffectSchema.safeParse(
                discountEffect(ValueKindEnum.PERCENTAGE, 50, 3)
            );
            expect(result.success).toBe(true);
        });

        it('accepts a forever percentage discount (durationCycles = null)', () => {
            const result = PromoEffectSchema.safeParse(
                discountEffect(ValueKindEnum.PERCENTAGE, 100, null)
            );
            expect(result.success).toBe(true);
        });

        it('accepts a fixed discount (durationCycles = 1)', () => {
            const result = PromoEffectSchema.safeParse(
                discountEffect(ValueKindEnum.FIXED, 50000, 1)
            );
            expect(result.success).toBe(true);
        });

        it('accepts a fixed discount above 100 (centavos, not a percentage)', () => {
            const result = PromoEffectSchema.safeParse(discountEffect(ValueKindEnum.FIXED, 150, 1));
            expect(result.success).toBe(true);
        });

        it('accepts value = 0 for a percentage discount', () => {
            const result = PromoEffectSchema.safeParse(
                discountEffect(ValueKindEnum.PERCENTAGE, 0, 1)
            );
            expect(result.success).toBe(true);
        });
    });

    describe('invalid payloads (AC-1.2, AC-1.3, AC-5.4)', () => {
        it('rejects percentage value > 100 (AC-1.2)', () => {
            const result = PromoEffectSchema.safeParse(
                discountEffect(ValueKindEnum.PERCENTAGE, 150, 1)
            );
            expect(result.success).toBe(false);
        });

        it('rejects percentage value = 101 (boundary, AC-1.2)', () => {
            const result = PromoEffectSchema.safeParse(
                discountEffect(ValueKindEnum.PERCENTAGE, 101, null)
            );
            expect(result.success).toBe(false);
        });

        it('rejects negative value', () => {
            const result = PromoEffectSchema.safeParse(
                discountEffect(ValueKindEnum.PERCENTAGE, -1, 1)
            );
            expect(result.success).toBe(false);
        });

        it('rejects durationCycles = 0 (must be > 0 or null) (AC-1.3)', () => {
            const result = PromoEffectSchema.safeParse(
                discountEffect(ValueKindEnum.PERCENTAGE, 25, 0)
            );
            expect(result.success).toBe(false);
        });

        it('rejects durationCycles = -1 (AC-1.3)', () => {
            const result = PromoEffectSchema.safeParse(
                discountEffect(ValueKindEnum.PERCENTAGE, 25, -1)
            );
            expect(result.success).toBe(false);
        });

        it('rejects non-integer durationCycles', () => {
            const result = PromoEffectSchema.safeParse(
                discountEffect(ValueKindEnum.PERCENTAGE, 25, 1.5)
            );
            expect(result.success).toBe(false);
        });

        it('rejects non-integer value', () => {
            const result = PromoEffectSchema.safeParse(
                discountEffect(ValueKindEnum.PERCENTAGE, 25.5, 1)
            );
            expect(result.success).toBe(false);
        });

        it('rejects missing valueKind', () => {
            const result = PromoEffectSchema.safeParse({
                kind: 'discount',
                value: 25,
                durationCycles: 1
            });
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// PromoEffectSchema — trial_extension branch
// ---------------------------------------------------------------------------

describe('PromoEffectSchema — trial_extension branch', () => {
    describe('valid payloads', () => {
        it('accepts extraDays = 30', () => {
            const result = PromoEffectSchema.safeParse({
                kind: PromoEffectKindEnum.TRIAL_EXTENSION,
                extraDays: 30
            });
            expect(result.success).toBe(true);
        });

        it('accepts extraDays = 1 (minimum positive int)', () => {
            const result = PromoEffectSchema.safeParse({
                kind: PromoEffectKindEnum.TRIAL_EXTENSION,
                extraDays: 1
            });
            expect(result.success).toBe(true);
        });

        it('accepts a large number of days', () => {
            const result = PromoEffectSchema.safeParse({
                kind: PromoEffectKindEnum.TRIAL_EXTENSION,
                extraDays: 365
            });
            expect(result.success).toBe(true);
        });
    });

    describe('invalid payloads (AC-5.4)', () => {
        it('rejects extraDays = 0 (must be positive)', () => {
            const result = PromoEffectSchema.safeParse({
                kind: PromoEffectKindEnum.TRIAL_EXTENSION,
                extraDays: 0
            });
            expect(result.success).toBe(false);
        });

        it('rejects negative extraDays', () => {
            const result = PromoEffectSchema.safeParse({
                kind: PromoEffectKindEnum.TRIAL_EXTENSION,
                extraDays: -7
            });
            expect(result.success).toBe(false);
        });

        it('rejects non-integer extraDays', () => {
            const result = PromoEffectSchema.safeParse({
                kind: PromoEffectKindEnum.TRIAL_EXTENSION,
                extraDays: 7.5
            });
            expect(result.success).toBe(false);
        });

        it('rejects missing extraDays', () => {
            const result = PromoEffectSchema.safeParse({
                kind: PromoEffectKindEnum.TRIAL_EXTENSION
            });
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// PromoEffectSchema — comp branch
// ---------------------------------------------------------------------------

describe('PromoEffectSchema — comp branch', () => {
    describe('valid payloads', () => {
        it('accepts a comp effect with no extra fields', () => {
            const result = PromoEffectSchema.safeParse({ kind: PromoEffectKindEnum.COMP });
            expect(result.success).toBe(true);
        });

        it('strips unknown extra fields (Zod default strip)', () => {
            const result = PromoEffectSchema.safeParse({
                kind: PromoEffectKindEnum.COMP,
                value: 100,
                valueKind: 'percentage'
            });
            // Zod strips unknown keys by default, so this should succeed
            expect(result.success).toBe(true);
            if (result.success) {
                // The extra fields must be stripped — comp carries only `kind`
                const data = result.data as Record<string, unknown>;
                expect(data.value).toBeUndefined();
                expect(data.valueKind).toBeUndefined();
            }
        });
    });

    describe('invalid payloads', () => {
        it('rejects an unknown kind', () => {
            const result = PromoEffectSchema.safeParse({ kind: 'free_forever' });
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// CreatePromoCodeSchema — new effect field
// ---------------------------------------------------------------------------

describe('CreatePromoCodeSchema', () => {
    const baseDiscount: CreatePromoCodeInput = {
        code: 'SAVE25',
        effect: {
            kind: PromoEffectKindEnum.DISCOUNT,
            valueKind: ValueKindEnum.PERCENTAGE,
            value: 25,
            durationCycles: 1
        }
    };

    describe('valid payloads', () => {
        it('accepts a minimal discount payload', () => {
            const result = CreatePromoCodeSchema.safeParse(baseDiscount);
            expect(result.success).toBe(true);
        });

        it('accepts a full rich payload with all optional fields', () => {
            const result = CreatePromoCodeSchema.safeParse({
                ...baseDiscount,
                description: 'Launch discount',
                maxUses: 100,
                maxUsesPerUser: 2,
                validFrom: '2026-05-28T00:00:00.000Z',
                expiryDate: '2026-12-31T00:00:00.000Z',
                planRestrictions: ['owner-basico', 'owner-pro'],
                firstPurchaseOnly: true,
                isStackable: true,
                minAmount: 5000,
                isActive: true
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.validFrom).toBeInstanceOf(Date);
                expect(result.data.expiryDate).toBeInstanceOf(Date);
            }
        });

        it('accepts a multi-cycle percentage discount', () => {
            const result = CreatePromoCodeSchema.safeParse({
                code: 'LANZAMIENTO50',
                effect: {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.PERCENTAGE,
                    value: 50,
                    durationCycles: 3
                }
            });
            expect(result.success).toBe(true);
        });

        it('accepts a forever fixed discount (durationCycles = null)', () => {
            const result = CreatePromoCodeSchema.safeParse({
                code: 'FOREVER10',
                effect: {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.FIXED,
                    value: 10000,
                    durationCycles: null
                }
            });
            expect(result.success).toBe(true);
        });

        it('accepts a trial_extension code', () => {
            const result = CreatePromoCodeSchema.safeParse({
                code: 'FREEMONTH',
                effect: {
                    kind: PromoEffectKindEnum.TRIAL_EXTENSION,
                    extraDays: 30
                }
            });
            expect(result.success).toBe(true);
        });

        it('accepts a comp code', () => {
            const result = CreatePromoCodeSchema.safeParse({
                code: 'HOSPEDA_FREE',
                effect: { kind: PromoEffectKindEnum.COMP }
            });
            expect(result.success).toBe(true);
        });
    });

    describe('invalid payloads', () => {
        it('rejects a payload missing effect', () => {
            const result = CreatePromoCodeSchema.safeParse({ code: 'SAVE25' });
            expect(result.success).toBe(false);
        });

        it('rejects a percentage discount above 100 (AC-1.2)', () => {
            const result = CreatePromoCodeSchema.safeParse({
                code: 'BAD',
                effect: {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.PERCENTAGE,
                    value: 150,
                    durationCycles: 1
                }
            });
            expect(result.success).toBe(false);
        });

        it('rejects durationCycles = 0 (AC-1.3)', () => {
            const result = CreatePromoCodeSchema.safeParse({
                code: 'BAD',
                effect: {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.PERCENTAGE,
                    value: 25,
                    durationCycles: 0
                }
            });
            expect(result.success).toBe(false);
        });

        it('rejects negative extraDays in trial_extension', () => {
            const result = CreatePromoCodeSchema.safeParse({
                code: 'BADTRIAL',
                effect: {
                    kind: PromoEffectKindEnum.TRIAL_EXTENSION,
                    extraDays: -5
                }
            });
            expect(result.success).toBe(false);
        });

        it('rejects a code shorter than 3 characters', () => {
            const result = CreatePromoCodeSchema.safeParse({
                code: 'AB',
                effect: {
                    kind: PromoEffectKindEnum.DISCOUNT,
                    valueKind: ValueKindEnum.PERCENTAGE,
                    value: 25,
                    durationCycles: 1
                }
            });
            expect(result.success).toBe(false);
        });

        it('rejects null maxUses (optional, not nullable)', () => {
            const result = CreatePromoCodeSchema.safeParse({ ...baseDiscount, maxUses: null });
            expect(result.success).toBe(false);
        });
    });
});

// ---------------------------------------------------------------------------
// UpdatePromoCodeSchema (unchanged — just verify it still works)
// ---------------------------------------------------------------------------

describe('UpdatePromoCodeSchema', () => {
    it('accepts mutable fields only', () => {
        const result = UpdatePromoCodeSchema.safeParse({
            description: 'Updated',
            maxUses: 50,
            isActive: false
        });
        expect(result.success).toBe(true);
    });

    it('rejects attempts to change immutable fields (strict)', () => {
        const result = UpdatePromoCodeSchema.safeParse({
            description: 'Updated',
            discountValue: 99
        });
        expect(result.success).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// PromoCodeResponseSchema — backward compat (AC-4.3)
// ---------------------------------------------------------------------------

describe('PromoCodeResponseSchema — backward compat (AC-4.3)', () => {
    /**
     * The LEGACY response shape (no `effect` field).
     * Represents a one-shot percentage code returned before SPEC-262 migration.
     * This shape MUST parse correctly without errors.
     *
     * NOTE: UUIDv4 required — Zod v4 validates the version nibble ([1-8]).
     */
    const legacyOneShotResponse = {
        id: 'a1b2c3d4-e5f6-4789-8abc-def012345678',
        code: 'BIENVENIDO30',
        type: 'percentage',
        value: 30,
        active: true,
        timesRedeemed: 5,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
    };

    it('accepts a legacy one-shot response shape (type + value, no effect)', () => {
        const result = PromoCodeResponseSchema.safeParse(legacyOneShotResponse);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.type).toBe('percentage');
            expect(result.data.value).toBe(30);
            expect(result.data.effect).toBeUndefined();
        }
    });

    it('keeps type and value on a new discount code response', () => {
        const newDiscountResponse: PromoCodeResponse = {
            ...legacyOneShotResponse,
            code: 'LANZAMIENTO50',
            type: 'percentage',
            value: 50,
            effect: {
                kind: PromoEffectKindEnum.DISCOUNT,
                valueKind: ValueKindEnum.PERCENTAGE,
                value: 50,
                durationCycles: 3
            }
        };
        const result = PromoCodeResponseSchema.safeParse(newDiscountResponse);
        expect(result.success).toBe(true);
        if (result.success) {
            // Legacy fields still present
            expect(result.data.type).toBe('percentage');
            expect(result.data.value).toBe(50);
            // New effect field also present
            expect(result.data.effect?.kind).toBe(PromoEffectKindEnum.DISCOUNT);
        }
    });

    it('accepts a comp code response (type = comp, value = 0, effect.kind = comp)', () => {
        const compResponse: PromoCodeResponse = {
            ...legacyOneShotResponse,
            code: 'HOSPEDA_FREE',
            type: 'comp',
            value: 0,
            effect: { kind: PromoEffectKindEnum.COMP }
        };
        const result = PromoCodeResponseSchema.safeParse(compResponse);
        expect(result.success).toBe(true);
    });

    it('accepts a trial_extension code response', () => {
        const trialResponse: PromoCodeResponse = {
            ...legacyOneShotResponse,
            code: 'FREEMONTH',
            type: 'trial_extension',
            value: 0,
            effect: {
                kind: PromoEffectKindEnum.TRIAL_EXTENSION,
                extraDays: 30
            }
        };
        const result = PromoCodeResponseSchema.safeParse(trialResponse);
        expect(result.success).toBe(true);
    });

    it('accepts all optional fields on the legacy shape', () => {
        const result = PromoCodeResponseSchema.safeParse({
            ...legacyOneShotResponse,
            expiresAt: '2027-01-01T00:00:00.000Z',
            validFrom: '2026-06-01T00:00:00.000Z',
            maxUses: 100,
            maxUsesPerUser: 1,
            metadata: { description: 'Test discount' },
            validPlans: ['owner-basico'],
            newCustomersOnly: true,
            isStackable: false
        });
        expect(result.success).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Type-inference contract (compile-time check)
// ---------------------------------------------------------------------------

describe('exported type aliases', () => {
    it('CreatePromoCodeInput is assignable from the schema output', () => {
        const input: CreatePromoCodeInput = {
            code: 'TYPECHECK',
            effect: {
                kind: PromoEffectKindEnum.DISCOUNT,
                valueKind: ValueKindEnum.PERCENTAGE,
                value: 10,
                durationCycles: 1
            }
        };
        expect(input.code).toBe('TYPECHECK');
    });

    it('PromoEffect discriminated union narrows correctly', () => {
        const effect: PromoEffect = discountEffect(ValueKindEnum.PERCENTAGE, 25, 1);
        if (effect.kind === PromoEffectKindEnum.DISCOUNT) {
            expect(effect.valueKind).toBe(ValueKindEnum.PERCENTAGE);
            expect(effect.value).toBe(25);
        }
    });
});
