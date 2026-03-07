/**
 * @file accordion-faq.test.ts
 * @description Tests for AccordionFAQ.astro.
 * Validates props, native details/summary markup, single-open exclusivity
 * behaviour, accessibility attributes, and icon usage.
 *
 * AccordionFAQ.astro is a pure Astro component using native <details>/<summary>
 * elements. Behaviour tests verify structure and data-attributes used by the
 * inline JS that implements accordion exclusivity.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/shared/AccordionFAQ.astro');
const content = readFileSync(componentPath, 'utf8');

describe('AccordionFAQ.astro', () => {
    describe('File documentation', () => {
        it('should have JSDoc documentation at the top', () => {
            expect(content).toContain('/**');
            expect(content).toContain('*/');
        });

        it('should document the accordion/FAQ purpose', () => {
            expect(content.toLowerCase()).toMatch(/accordion|faq/);
        });
    });

    describe('Props interface', () => {
        it('should define FaqItem interface', () => {
            expect(content).toContain('interface FaqItem');
        });

        it('should define Props interface', () => {
            expect(content).toContain('interface Props');
        });

        it('should accept items prop as readonly array', () => {
            expect(content).toContain('readonly items');
        });

        it('should have question property in FaqItem', () => {
            expect(content).toContain('question: string');
        });

        it('should have answer property in FaqItem', () => {
            expect(content).toContain('answer: string');
        });

        it('should accept optional allowMultiple prop', () => {
            expect(content).toContain('allowMultiple?');
        });

        it('should accept optional ariaLabel prop', () => {
            expect(content).toContain('ariaLabel?');
        });

        it('should accept optional class prop', () => {
            expect(content).toContain('class?: string');
        });

        it('should default allowMultiple to false', () => {
            expect(content).toContain('allowMultiple = false');
        });

        it('should provide a default ariaLabel value', () => {
            expect(content).toContain("ariaLabel = 'Frequently asked questions'");
        });
    });

    describe('HTML structure', () => {
        it('should use a section element as the root wrapper', () => {
            expect(content).toContain('<section');
        });

        it('should render details elements for each FAQ item', () => {
            expect(content).toContain('<details');
        });

        it('should render summary elements as the clickable trigger', () => {
            expect(content).toContain('<summary');
        });

        it('should render question text inside summary', () => {
            expect(content).toContain('item.question');
        });

        it('should render answer text in the expandable body', () => {
            expect(content).toContain('item.answer');
        });

        it('should iterate over items using map', () => {
            expect(content).toContain('items.map');
        });

        it('should render a div or section for the answer body', () => {
            expect(content).toMatch(/<div\s|<section\s/);
        });
    });

    describe('Accordion exclusivity (single-open behaviour)', () => {
        it('should set data-accordion attribute on the section wrapper', () => {
            expect(content).toContain('data-accordion');
        });

        it('should set data-allow-multiple attribute from the allowMultiple prop', () => {
            expect(content).toContain('data-allow-multiple');
        });

        it('should pass allowMultiple as string boolean to data attribute', () => {
            expect(content).toContain("allowMultiple ? 'true' : 'false'");
        });

        it('should include an inline script for accordion exclusivity', () => {
            expect(content).toContain('<script>');
        });

        it('should initialise accordions with initAccordions function', () => {
            expect(content).toContain('initAccordions');
        });

        it('should guard against duplicate listeners with data-accordion-init flag', () => {
            expect(content).toContain('data-accordion-init');
        });

        it('should close sibling details when one is opened', () => {
            expect(content).toContain('sibling.open = false');
        });

        it('should listen to astro:page-load for view transition re-initialisation', () => {
            expect(content).toContain('astro:page-load');
        });
    });

    describe('Icon', () => {
        it('should import ChevronDownIcon from @repo/icons', () => {
            expect(content).toContain("import { ChevronDownIcon } from '@repo/icons'");
        });

        it('should render ChevronDownIcon inside summary', () => {
            expect(content).toContain('ChevronDownIcon');
        });

        it('should rotate chevron via group-open CSS variant', () => {
            expect(content).toContain('group-open:rotate-180');
        });

        it('should hide ChevronDownIcon from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Unique IDs per instance', () => {
        it('should generate a uid to namespace element IDs', () => {
            expect(content).toContain('uid');
            expect(content).toContain('Math.random()');
        });

        it('should build summaryId from uid and index', () => {
            expect(content).toContain('summaryId');
        });

        it('should build contentId from uid and index', () => {
            expect(content).toContain('contentId');
        });
    });

    describe('Accessibility', () => {
        it('should set aria-label on the section wrapper', () => {
            expect(content).toContain('aria-label={ariaLabel}');
        });

        it('should link summary to answer body via aria-controls', () => {
            expect(content).toContain('aria-controls={contentId}');
        });

        it('should provide role="region" on the answer body', () => {
            expect(content).toContain('role="region"');
        });

        it('should link answer region back to its summary via aria-labelledby', () => {
            expect(content).toContain('aria-labelledby={summaryId}');
        });

        it('should have focus-visible styles on summary for keyboard navigation', () => {
            expect(content).toContain('focus-visible:outline');
        });

        it('should apply cursor-pointer to summary for visual affordance', () => {
            expect(content).toContain('cursor-pointer');
        });
    });

    describe('Styling', () => {
        it('should use class:list for conditional class merging', () => {
            expect(content).toContain('class:list');
        });

        it('should use group class on details for CSS state targeting', () => {
            expect(content).toContain('group');
        });

        it('should add border styling to each details item', () => {
            expect(content).toContain('border');
        });

        it('should use rounded corners on details items', () => {
            expect(content).toContain('rounded-lg');
        });

        it('should use space-y for vertical spacing between items', () => {
            expect(content).toContain('space-y-2');
        });

        it('should use transition for smooth animation', () => {
            expect(content).toContain('transition-');
        });
    });
});
