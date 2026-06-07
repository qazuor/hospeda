import { describe, expect, it } from 'vitest';
import {
    AI_TEXT_IMPROVE_MAX_LENGTH,
    AiTextImproveFieldTypeSchema,
    AiTextImproveRequestSchema
} from '../ai-text-improve.schema.js';

// ============================================================================
// Fixtures
// ============================================================================

const VALID_DESCRIPTION = 'Hermoso departamento en el centro histórico, ideal para familias.';
const VALID_SUMMARY = 'Departamento céntrico y luminoso';
const VALID_FAQ_ANSWER = 'Sí, el desayuno está incluido en todas las tarifas.';
const SUMMARY_300_CHARS = 'a'.repeat(300);
const SUMMARY_301_CHARS = 'a'.repeat(301);
const DESCRIPTION_5001_CHARS = 'a'.repeat(5001);
const FAQ_ANSWER_1000_CHARS = 'a'.repeat(1000);
const FAQ_ANSWER_1001_CHARS = 'a'.repeat(1001);

const VALID_DESCRIPTION_REQUEST = {
    fieldValue: VALID_DESCRIPTION,
    fieldType: 'description' as const
};

const VALID_SUMMARY_REQUEST = {
    fieldValue: VALID_SUMMARY,
    fieldType: 'summary' as const
};

const VALID_FAQ_ANSWER_REQUEST = {
    fieldValue: VALID_FAQ_ANSWER,
    fieldType: 'faq_answer' as const
};

// ============================================================================
// AiTextImproveRequestSchema — happy paths
// ============================================================================

describe('AiTextImproveRequestSchema', () => {
    describe('when given a valid request', () => {
        it('should accept a description request', () => {
            // Arrange / Act
            const result = AiTextImproveRequestSchema.safeParse(VALID_DESCRIPTION_REQUEST);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a summary request', () => {
            const result = AiTextImproveRequestSchema.safeParse(VALID_SUMMARY_REQUEST);
            expect(result.success).toBe(true);
        });

        it('should accept a faq_answer request', () => {
            const result = AiTextImproveRequestSchema.safeParse(VALID_FAQ_ANSWER_REQUEST);
            expect(result.success).toBe(true);
        });

        it('should accept a request without locale (locale is optional)', () => {
            const result = AiTextImproveRequestSchema.safeParse(VALID_DESCRIPTION_REQUEST);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.locale).toBeUndefined();
            }
        });

        it.each(['es', 'en', 'pt'] as const)('should accept locale "%s"', (locale) => {
            const result = AiTextImproveRequestSchema.safeParse({
                ...VALID_DESCRIPTION_REQUEST,
                locale
            });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.locale).toBe(locale);
            }
        });
    });

    // ============================================================================
    // fieldValue: length validation
    // ============================================================================

    describe('when fieldValue length is invalid', () => {
        it('should reject empty fieldValue', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: '',
                fieldType: 'description'
            });
            expect(result.success).toBe(false);
        });

        it('should reject fieldValue exceeding 5000 chars for description', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: DESCRIPTION_5001_CHARS,
                fieldType: 'description'
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                const issue = result.error.issues[0];
                expect(issue?.path).toEqual(['fieldValue']);
                expect(issue?.code).toBe('too_big');
            }
        });

        it('should accept fieldValue of exactly 5000 chars for description (boundary)', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: 'a'.repeat(5000),
                fieldType: 'description'
            });
            expect(result.success).toBe(true);
        });

        it('should reject fieldValue exceeding 300 chars for summary', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: SUMMARY_301_CHARS,
                fieldType: 'summary'
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                const issue = result.error.issues[0];
                expect(issue?.path).toEqual(['fieldValue']);
                expect(issue?.code).toBe('too_big');
                expect(issue?.message).toContain('300 characters');
                expect(issue?.message).toContain("fieldType 'summary'");
            }
        });

        it('should reject fieldValue of 301 chars for summary (boundary)', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: SUMMARY_301_CHARS,
                fieldType: 'summary'
            });
            expect(result.success).toBe(false);
        });

        it('should accept fieldValue of exactly 300 chars for summary (boundary)', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: SUMMARY_300_CHARS,
                fieldType: 'summary'
            });
            expect(result.success).toBe(true);
        });

        it('should reject fieldValue exceeding 1000 chars for faq_answer', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: FAQ_ANSWER_1001_CHARS,
                fieldType: 'faq_answer'
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                const issue = result.error.issues[0];
                expect(issue?.path).toEqual(['fieldValue']);
                expect(issue?.code).toBe('too_big');
                expect(issue?.message).toContain('1000 characters');
                expect(issue?.message).toContain("fieldType 'faq_answer'");
            }
        });

        it('should reject fieldValue of 1001 chars for faq_answer (boundary)', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: FAQ_ANSWER_1001_CHARS,
                fieldType: 'faq_answer'
            });
            expect(result.success).toBe(false);
        });

        it('should accept fieldValue of exactly 1000 chars for faq_answer (boundary)', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: FAQ_ANSWER_1000_CHARS,
                fieldType: 'faq_answer'
            });
            expect(result.success).toBe(true);
        });
    });

    // ============================================================================
    // fieldType: enum validation
    // ============================================================================

    describe('when fieldType is invalid', () => {
        it('should reject unknown fieldType', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: VALID_DESCRIPTION,
                fieldType: 'title'
            });
            expect(result.success).toBe(false);
        });

        it('should reject empty fieldType', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: VALID_DESCRIPTION,
                fieldType: ''
            });
            expect(result.success).toBe(false);
        });

        it('should reject fieldType with wrong case', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: VALID_DESCRIPTION,
                fieldType: 'Description'
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // locale: validation
    // ============================================================================

    describe('when locale is invalid', () => {
        it('should reject an unknown locale', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                ...VALID_DESCRIPTION_REQUEST,
                locale: 'fr'
            });
            expect(result.success).toBe(false);
        });

        it('should reject a malformed locale', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                ...VALID_DESCRIPTION_REQUEST,
                locale: 'es-AR'
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // Strict mode: unknown keys
    // ============================================================================

    describe('when the request body has unknown keys', () => {
        it('should reject unknown keys at the route boundary (strict mode)', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                ...VALID_DESCRIPTION_REQUEST,
                extraField: 'should not be allowed'
            });
            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.issues.some((i) => i.code === 'unrecognized_keys')).toBe(true);
            }
        });

        it('should reject a typo in a known key (e.g. fieldvalue lowercase)', () => {
            const result = AiTextImproveRequestSchema.safeParse({
                fieldvalue: VALID_DESCRIPTION,
                fieldType: 'description'
            });
            expect(result.success).toBe(false);
        });
    });

    // ============================================================================
    // Per-field cap precision (superRefine)
    // ============================================================================

    describe('the per-field length cap', () => {
        it('should use the description cap (5000) and not the summary cap (300) for description requests', () => {
            // 500 chars is over the summary cap (300) but within the description cap (5000)
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: 'a'.repeat(500),
                fieldType: 'description'
            });
            expect(result.success).toBe(true);
        });

        it('should use the summary cap (300) and not the description cap (5000) for summary requests', () => {
            // 500 chars is within the description cap (5000) but over the summary cap (300)
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: 'a'.repeat(500),
                fieldType: 'summary'
            });
            expect(result.success).toBe(false);
        });

        it('should use the faq_answer cap (1000) and not the description cap (5000) for faq_answer requests', () => {
            // 2000 chars is within the description cap (5000) but over the faq_answer cap (1000)
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: 'a'.repeat(2000),
                fieldType: 'faq_answer'
            });
            expect(result.success).toBe(false);
        });

        it('should use the faq_answer cap (1000) and not the summary cap (300) for faq_answer requests', () => {
            // 500 chars is over the summary cap (300) but within the faq_answer cap (1000)
            const result = AiTextImproveRequestSchema.safeParse({
                fieldValue: 'a'.repeat(500),
                fieldType: 'faq_answer'
            });
            expect(result.success).toBe(true);
        });
    });
});

// ============================================================================
// AiTextImproveFieldTypeSchema
// ============================================================================

describe('AiTextImproveFieldTypeSchema', () => {
    describe('enum resilience', () => {
        it('should include all members (description, summary, faq_answer)', () => {
            // CORRECT pattern: assert membership, NOT count — future versions may add members.
            const values = Object.values(AiTextImproveFieldTypeSchema.enum);
            expect(values).toContain('description');
            expect(values).toContain('summary');
            expect(values).toContain('faq_answer');
        });

        it('should expose values that match AI_TEXT_IMPROVE_MAX_LENGTH keys', () => {
            const enumValues = Object.values(AiTextImproveFieldTypeSchema.enum);
            const capKeys = Object.keys(AI_TEXT_IMPROVE_MAX_LENGTH);
            // Every enum member must have a corresponding cap entry (the cap table
            // is the spec-authoritative source of which fields the AI can improve).
            for (const value of enumValues) {
                expect(capKeys).toContain(value);
            }
        });
    });
});

// ============================================================================
// AI_TEXT_IMPROVE_MAX_LENGTH — owner-approved values
// ============================================================================

describe('AI_TEXT_IMPROVE_MAX_LENGTH', () => {
    it('should cap description at 5000 chars', () => {
        expect(AI_TEXT_IMPROVE_MAX_LENGTH.description).toBe(5000);
    });

    it('should cap summary at 300 chars (matches live form maxLength: 300)', () => {
        expect(AI_TEXT_IMPROVE_MAX_LENGTH.summary).toBe(300);
    });

    it('should cap faq_answer at 1000 chars (plain text FAQ answer budget)', () => {
        expect(AI_TEXT_IMPROVE_MAX_LENGTH.faq_answer).toBe(1000);
    });

    it('should be deeply readonly', () => {
        // Defensive: a downstream mutation would silently widen the cap.
        const original = AI_TEXT_IMPROVE_MAX_LENGTH.description;
        expect(() => {
            (AI_TEXT_IMPROVE_MAX_LENGTH as { description: number }).description = 9999;
        }).toThrow();
        expect(AI_TEXT_IMPROVE_MAX_LENGTH.description).toBe(original);
    });
});
