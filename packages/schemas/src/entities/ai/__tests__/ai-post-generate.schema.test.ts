import { describe, expect, it } from 'vitest';
import {
    AiPostGenerateDraftGenerationSchema,
    AiPostGenerateDraftSchema,
    AiPostGenerateRequestSchema,
    AiPostGenerateToneSchema
} from '../ai-post-generate.schema.js';

// ============================================================================
// Fixtures
// ============================================================================

const VALID_TOPIC = 'Carnaval de Concepción del Uruguay 2024';
const VALID_POINTS = ['Fechas: 3–11 de febrero', 'Comparsas internacionales'];

const VALID_REQUEST = {
    topic: VALID_TOPIC,
    points: VALID_POINTS
};

const MIN_TOPIC = 'abc'; // 3 chars — minimum
const MAX_TOPIC = 'a'.repeat(300); // 300 chars — maximum
const TOPIC_TOO_SHORT = 'ab'; // 2 chars — below minimum
const TOPIC_TOO_LONG = 'a'.repeat(301); // 301 chars — above maximum

const MIN_POINT = 'a'; // 1 char — minimum
const MAX_POINT = 'a'.repeat(200); // 200 chars — maximum
const POINT_TOO_LONG = 'a'.repeat(201); // 201 chars — above maximum

const VALID_TITLE = 'Carnaval 2024 en Concepción';
const VALID_SUMMARY = 'Un resumen breve y descriptivo del carnaval anual.';
const VALID_CONTENT =
    '<p>El carnaval de Concepción del Uruguay 2024 fue el más concurrido de la historia reciente. ' +
    'Miles de visitantes disfrutaron de las comparsas, la música y el espíritu festivo.</p>';

// ============================================================================
// AiPostGenerateToneSchema
// ============================================================================

describe('AiPostGenerateToneSchema', () => {
    describe('when given valid tone values', () => {
        it('should accept "formal"', () => {
            // Arrange / Act
            const result = AiPostGenerateToneSchema.safeParse('formal');

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept "informal"', () => {
            // Arrange / Act
            const result = AiPostGenerateToneSchema.safeParse('informal');

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept "neutral"', () => {
            // Arrange / Act
            const result = AiPostGenerateToneSchema.safeParse('neutral');

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when given invalid tone values', () => {
        it('should reject an unknown tone string', () => {
            // Arrange / Act
            const result = AiPostGenerateToneSchema.safeParse('casual');

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty string', () => {
            // Arrange / Act
            const result = AiPostGenerateToneSchema.safeParse('');

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a number', () => {
            // Arrange / Act
            const result = AiPostGenerateToneSchema.safeParse(1);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// AiPostGenerateRequestSchema — happy paths
// ============================================================================

describe('AiPostGenerateRequestSchema', () => {
    describe('when given a valid request', () => {
        it('should accept topic + points only (all optional fields absent)', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse(VALID_REQUEST);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a request with all optional fields present', () => {
            // Arrange
            const input = {
                topic: VALID_TOPIC,
                points: VALID_POINTS,
                category: 'CARNIVAL',
                tone: 'informal',
                locale: 'es'
            };

            // Act
            const result = AiPostGenerateRequestSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a topic at the minimum length (3 chars)', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: MIN_TOPIC,
                points: VALID_POINTS
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a topic at the maximum length (300 chars)', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: MAX_TOPIC,
                points: VALID_POINTS
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a single-character key point (minimum per item)', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: VALID_TOPIC,
                points: [MIN_POINT]
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept exactly 10 key points (maximum)', () => {
            // Arrange
            const tenPoints = Array.from({ length: 10 }, (_, i) => `Point ${i + 1}`);

            // Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: VALID_TOPIC,
                points: tenPoints
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a point at the maximum length per item (200 chars)', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: VALID_TOPIC,
                points: [MAX_POINT]
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept locale "en"', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: VALID_TOPIC,
                points: VALID_POINTS,
                locale: 'en'
            });

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept locale "pt"', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: VALID_TOPIC,
                points: VALID_POINTS,
                locale: 'pt'
            });

            // Assert
            expect(result.success).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // Bound violations — topic
    // -------------------------------------------------------------------------

    describe('when topic is too short', () => {
        it('should reject a topic with 2 characters (below minimum of 3)', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: TOPIC_TOO_SHORT,
                points: VALID_POINTS
            });

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty topic', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: '',
                points: VALID_POINTS
            });

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('when topic is too long', () => {
        it('should reject a topic with 301 characters (above maximum of 300)', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: TOPIC_TOO_LONG,
                points: VALID_POINTS
            });

            // Assert
            expect(result.success).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // Bound violations — points array
    // -------------------------------------------------------------------------

    describe('when points array is empty', () => {
        it('should reject an empty points array (minimum is 1)', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: VALID_TOPIC,
                points: []
            });

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('when points array exceeds maximum', () => {
        it('should reject 11 key points (above maximum of 10)', () => {
            // Arrange
            const elevenPoints = Array.from({ length: 11 }, (_, i) => `Point ${i + 1}`);

            // Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: VALID_TOPIC,
                points: elevenPoints
            });

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('when a point item violates its own bounds', () => {
        it('should reject a point with 201 characters (above maximum of 200 per item)', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: VALID_TOPIC,
                points: [POINT_TOO_LONG]
            });

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a point with 0 characters (empty string)', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: VALID_TOPIC,
                points: ['']
            });

            // Assert
            expect(result.success).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // Invalid tone
    // -------------------------------------------------------------------------

    describe('when tone is invalid', () => {
        it('should reject an unknown tone value', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: VALID_TOPIC,
                points: VALID_POINTS,
                tone: 'sarcastic'
            });

            // Assert
            expect(result.success).toBe(false);
        });
    });

    // -------------------------------------------------------------------------
    // Invalid locale
    // -------------------------------------------------------------------------

    describe('when locale is invalid', () => {
        it('should reject an unsupported locale', () => {
            // Arrange / Act
            const result = AiPostGenerateRequestSchema.safeParse({
                topic: VALID_TOPIC,
                points: VALID_POINTS,
                locale: 'fr'
            });

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// AiPostGenerateDraftSchema
// ============================================================================

describe('AiPostGenerateDraftSchema', () => {
    describe('when given a valid draft', () => {
        it('should accept a well-formed draft', () => {
            // Arrange
            const input = {
                title: VALID_TITLE,
                summary: VALID_SUMMARY,
                content: VALID_CONTENT
            };

            // Act
            const result = AiPostGenerateDraftSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept content at the minimum length (100 chars)', () => {
            // Arrange
            const input = {
                title: VALID_TITLE,
                summary: VALID_SUMMARY,
                content: `<p>${'a'.repeat(96)}</p>`
            };

            // Act
            const result = AiPostGenerateDraftSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept content at the maximum length (50000 chars)', () => {
            // Arrange
            const input = {
                title: VALID_TITLE,
                summary: VALID_SUMMARY,
                content: 'a'.repeat(50000)
            };

            // Act
            const result = AiPostGenerateDraftSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a summary at the maximum length (300 chars)', () => {
            // Arrange
            const input = {
                title: VALID_TITLE,
                summary: 'a'.repeat(300),
                content: VALID_CONTENT
            };

            // Act
            const result = AiPostGenerateDraftSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when content is too short', () => {
        it('should reject content with 99 characters (below minimum of 100)', () => {
            // Arrange
            const input = {
                title: VALID_TITLE,
                summary: VALID_SUMMARY,
                content: 'a'.repeat(99)
            };

            // Act
            const result = AiPostGenerateDraftSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an empty content string', () => {
            // Arrange
            const input = {
                title: VALID_TITLE,
                summary: VALID_SUMMARY,
                content: ''
            };

            // Act
            const result = AiPostGenerateDraftSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('when content is too long', () => {
        it('should reject content with 50001 characters (above maximum of 50000)', () => {
            // Arrange
            const input = {
                title: VALID_TITLE,
                summary: VALID_SUMMARY,
                content: 'a'.repeat(50001)
            };

            // Act
            const result = AiPostGenerateDraftSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('when title is invalid', () => {
        it('should reject a title with fewer than 3 characters', () => {
            // Arrange
            const input = {
                title: 'ab',
                summary: VALID_SUMMARY,
                content: VALID_CONTENT
            };

            // Act
            const result = AiPostGenerateDraftSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a title with more than 150 characters', () => {
            // Arrange
            const input = {
                title: 'a'.repeat(151),
                summary: VALID_SUMMARY,
                content: VALID_CONTENT
            };

            // Act
            const result = AiPostGenerateDraftSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('when summary is invalid', () => {
        it('should reject a summary with fewer than 10 characters', () => {
            // Arrange
            const input = {
                title: VALID_TITLE,
                summary: 'Too short',
                content: VALID_CONTENT
            };

            // Act
            const result = AiPostGenerateDraftSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a summary with more than 300 characters', () => {
            // Arrange
            const input = {
                title: VALID_TITLE,
                summary: 'a'.repeat(301),
                content: VALID_CONTENT
            };

            // Act
            const result = AiPostGenerateDraftSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});

// ============================================================================
// AiPostGenerateDraftGenerationSchema — loose provider schema
// ============================================================================

describe('AiPostGenerateDraftGenerationSchema', () => {
    describe('when given all three required string fields', () => {
        it('should accept a well-formed object with standard-length strings', () => {
            // Arrange
            const input = {
                title: VALID_TITLE,
                summary: VALID_SUMMARY,
                content: VALID_CONTENT
            };

            // Act
            const result = AiPostGenerateDraftGenerationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a very short content that AiPostGenerateDraftSchema would reject', () => {
            // Arrange — content below the strict 100-char minimum
            const input = {
                title: 'Short',
                summary: 'Short summary',
                content: 'hi'
            };

            // Act
            const result = AiPostGenerateDraftGenerationSchema.safeParse(input);

            // Assert — loose schema has no length bounds, so this must pass
            expect(result.success).toBe(true);
        });

        it('should accept an empty string in all three fields (no min bounds)', () => {
            // Arrange
            const input = { title: '', summary: '', content: '' };

            // Act
            const result = AiPostGenerateDraftGenerationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(true);
        });
    });

    describe('when required fields are missing', () => {
        it('should reject an object missing "title"', () => {
            // Arrange
            const input = { summary: VALID_SUMMARY, content: VALID_CONTENT };

            // Act
            const result = AiPostGenerateDraftGenerationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an object missing "summary"', () => {
            // Arrange
            const input = { title: VALID_TITLE, content: VALID_CONTENT };

            // Act
            const result = AiPostGenerateDraftGenerationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject an object missing "content"', () => {
            // Arrange
            const input = { title: VALID_TITLE, summary: VALID_SUMMARY };

            // Act
            const result = AiPostGenerateDraftGenerationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });

    describe('when fields are non-string types', () => {
        it('should reject a numeric title', () => {
            // Arrange
            const input = { title: 42, summary: VALID_SUMMARY, content: VALID_CONTENT };

            // Act
            const result = AiPostGenerateDraftGenerationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });

        it('should reject a null content', () => {
            // Arrange
            const input = { title: VALID_TITLE, summary: VALID_SUMMARY, content: null };

            // Act
            const result = AiPostGenerateDraftGenerationSchema.safeParse(input);

            // Assert
            expect(result.success).toBe(false);
        });
    });
});
