import {
    OWNER_BENEFITS,
    OWNER_FAQ,
    OWNER_FINAL_CTA,
    OWNER_HERO,
    OWNER_HOW_IT_WORKS
} from '@/lib/owners-page-data';
/**
 * Tests for owners-page-data.ts - Static localized content for the propietarios page.
 */
import { describe, expect, it } from 'vitest';

const SUPPORTED_LOCALES = ['es', 'en', 'pt'] as const;

describe('OWNER_HERO', () => {
    it('should have entries for all supported locales', () => {
        for (const locale of SUPPORTED_LOCALES) {
            expect(OWNER_HERO[locale]).toBeDefined();
        }
    });

    it.each(SUPPORTED_LOCALES)('should have all required fields for locale %s', (locale) => {
        const hero = OWNER_HERO[locale];
        expect(typeof hero.headline).toBe('string');
        expect(hero.headline.length).toBeGreaterThan(0);
        expect(typeof hero.subheadline).toBe('string');
        expect(hero.subheadline.length).toBeGreaterThan(0);
        expect(typeof hero.ctaPrimary).toBe('string');
        expect(hero.ctaPrimary.length).toBeGreaterThan(0);
        expect(typeof hero.ctaSecondary).toBe('string');
        expect(hero.ctaSecondary.length).toBeGreaterThan(0);
    });
});

describe('OWNER_BENEFITS', () => {
    it('should have entries for all supported locales', () => {
        for (const locale of SUPPORTED_LOCALES) {
            expect(OWNER_BENEFITS[locale]).toBeDefined();
        }
    });

    it.each(SUPPORTED_LOCALES)(
        'should have sectionTitle and sectionSubtitle for locale %s',
        (locale) => {
            const benefits = OWNER_BENEFITS[locale];
            expect(typeof benefits.sectionTitle).toBe('string');
            expect(benefits.sectionTitle.length).toBeGreaterThan(0);
            expect(typeof benefits.sectionSubtitle).toBe('string');
            expect(benefits.sectionSubtitle.length).toBeGreaterThan(0);
        }
    );

    it.each(SUPPORTED_LOCALES)('should have at least one benefit for locale %s', (locale) => {
        const { benefits } = OWNER_BENEFITS[locale];
        expect(Array.isArray(benefits)).toBe(true);
        expect(benefits.length).toBeGreaterThan(0);
    });

    it.each(SUPPORTED_LOCALES)(
        'should have icon, title, and description on each benefit for locale %s',
        (locale) => {
            const { benefits } = OWNER_BENEFITS[locale];
            for (const benefit of benefits) {
                expect(typeof benefit.icon).toBe('string');
                expect(benefit.icon.length).toBeGreaterThan(0);
                expect(typeof benefit.title).toBe('string');
                expect(benefit.title.length).toBeGreaterThan(0);
                expect(typeof benefit.description).toBe('string');
                expect(benefit.description.length).toBeGreaterThan(0);
            }
        }
    );

    it('should have the same number of benefits across all locales', () => {
        const counts = SUPPORTED_LOCALES.map((l) => OWNER_BENEFITS[l].benefits.length);
        const [first, ...rest] = counts;
        for (const count of rest) {
            expect(count).toBe(first);
        }
    });
});

describe('OWNER_HOW_IT_WORKS', () => {
    it('should have entries for all supported locales', () => {
        for (const locale of SUPPORTED_LOCALES) {
            expect(OWNER_HOW_IT_WORKS[locale]).toBeDefined();
        }
    });

    it.each(SUPPORTED_LOCALES)('should have exactly 3 steps for locale %s', (locale) => {
        const { steps } = OWNER_HOW_IT_WORKS[locale];
        expect(steps.length).toBe(3);
    });

    it.each(SUPPORTED_LOCALES)('should have sequential step numbers for locale %s', (locale) => {
        const { steps } = OWNER_HOW_IT_WORKS[locale];
        steps.forEach((step, idx) => {
            expect(step.number).toBe(idx + 1);
            expect(typeof step.title).toBe('string');
            expect(step.title.length).toBeGreaterThan(0);
            expect(typeof step.description).toBe('string');
            expect(step.description.length).toBeGreaterThan(0);
        });
    });
});

describe('OWNER_FAQ', () => {
    it('should have entries for all supported locales', () => {
        for (const locale of SUPPORTED_LOCALES) {
            expect(OWNER_FAQ[locale]).toBeDefined();
        }
    });

    it.each(SUPPORTED_LOCALES)('should have a sectionTitle for locale %s', (locale) => {
        expect(typeof OWNER_FAQ[locale].sectionTitle).toBe('string');
        expect(OWNER_FAQ[locale].sectionTitle.length).toBeGreaterThan(0);
    });

    it.each(SUPPORTED_LOCALES)('should have at least one FAQ for locale %s', (locale) => {
        const { faqs } = OWNER_FAQ[locale];
        expect(Array.isArray(faqs)).toBe(true);
        expect(faqs.length).toBeGreaterThan(0);
    });

    it.each(SUPPORTED_LOCALES)(
        'should have question and answer on each FAQ for locale %s',
        (locale) => {
            const { faqs } = OWNER_FAQ[locale];
            for (const faq of faqs) {
                expect(typeof faq.question).toBe('string');
                expect(faq.question.length).toBeGreaterThan(0);
                expect(typeof faq.answer).toBe('string');
                expect(faq.answer.length).toBeGreaterThan(0);
            }
        }
    );
});

describe('OWNER_FINAL_CTA', () => {
    it('should have entries for all supported locales', () => {
        for (const locale of SUPPORTED_LOCALES) {
            expect(OWNER_FINAL_CTA[locale]).toBeDefined();
        }
    });

    it.each(SUPPORTED_LOCALES)('should have all required fields for locale %s', (locale) => {
        const cta = OWNER_FINAL_CTA[locale];
        expect(typeof cta.title).toBe('string');
        expect(cta.title.length).toBeGreaterThan(0);
        expect(typeof cta.subtitle).toBe('string');
        expect(cta.subtitle.length).toBeGreaterThan(0);
        expect(typeof cta.ctaPrimary).toBe('string');
        expect(cta.ctaPrimary.length).toBeGreaterThan(0);
        expect(typeof cta.ctaSecondary).toBe('string');
        expect(cta.ctaSecondary.length).toBeGreaterThan(0);
    });
});
