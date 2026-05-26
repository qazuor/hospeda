/**
 * SPEC-158 — Destination rich content + structured FAQs seed validation.
 *
 * Validates the 22 CITY destination seed JSON files (001-022). The checks are
 * GREEN before content lands (FAQ assertions are conditional on presence) and
 * tighten automatically per-city as each content task fills its JSON:
 *
 *   - description: present, markdown, within the SPEC-158 bounds (<= 8000).
 *   - faqs (when present): 5-7 entries, each valid against FaqCreatePayloadSchema,
 *     with the guaranteed baseline categories all present.
 *
 * The "all 22 cities have FAQs" completeness gate lives in the final-validation
 * task (T-041), not here, so this suite never blocks the branch mid-content.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// FAQ field bounds mirror BaseFaqSchema (packages/schemas/src/common/faq.schema.ts).
// They are inlined here so this content harness stays self-contained and does not
// pull the full @repo/schemas build graph into the seed test runner. The schema
// itself is the source of truth and is exercised at seed time (DestinationService
// .addFaq validates via FaqCreatePayloadSchema) and by the schema unit tests (T-004).
const QUESTION_MIN = 10;
const QUESTION_MAX = 300;
const ANSWER_MIN = 10;
const ANSWER_MAX = 2000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data', 'destination');

/** Categories guaranteed to be present in every destination that has FAQs. */
const BASELINE_CATEGORIES = ['Cómo llegar', 'Qué hacer', 'Cuándo visitar', 'Servicios'] as const;

const DESCRIPTION_MAX = 8000;
const DESCRIPTION_MIN = 30;
const FAQ_MIN = 5;
const FAQ_MAX = 7;

interface DestinationSeed {
    readonly id: string;
    readonly name: string;
    readonly destinationType: string;
    readonly description?: unknown;
    readonly faqs?: ReadonlyArray<{ question: string; answer: string; category?: string }>;
}

const cityFiles = readdirSync(DATA_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({
        file: f,
        data: JSON.parse(readFileSync(join(DATA_DIR, f), 'utf8')) as DestinationSeed
    }))
    .filter((entry) => entry.data.destinationType === 'CITY')
    .sort((a, b) => a.file.localeCompare(b.file));

describe('SPEC-158 destination content + FAQs', () => {
    it('finds the 22 CITY destination seed files', () => {
        expect(cityFiles.length).toBe(22);
    });

    describe.each(cityFiles)('$file', ({ data }) => {
        it('has a markdown description within bounds (<= 8000 chars)', () => {
            expect(typeof data.description).toBe('string');
            const description = data.description as string;
            expect(description.length).toBeGreaterThanOrEqual(DESCRIPTION_MIN);
            expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
        });

        it('has well-formed FAQs when present (5-7, valid, baseline categories)', () => {
            const faqs = data.faqs;
            if (!faqs || faqs.length === 0) return; // content not written yet — tolerated

            expect(faqs.length).toBeGreaterThanOrEqual(FAQ_MIN);
            expect(faqs.length).toBeLessThanOrEqual(FAQ_MAX);

            for (const faq of faqs) {
                expect(typeof faq.question).toBe('string');
                expect(faq.question.length).toBeGreaterThanOrEqual(QUESTION_MIN);
                expect(faq.question.length).toBeLessThanOrEqual(QUESTION_MAX);
                expect(typeof faq.answer).toBe('string');
                expect(faq.answer.length).toBeGreaterThanOrEqual(ANSWER_MIN);
                expect(faq.answer.length).toBeLessThanOrEqual(ANSWER_MAX);
            }

            const categories = new Set(faqs.map((f) => f.category));
            for (const baseline of BASELINE_CATEGORIES) {
                expect(categories.has(baseline), `missing baseline category "${baseline}"`).toBe(
                    true
                );
            }
        });
    });
});
