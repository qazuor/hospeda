/**
 * Tests for NewsletterSection.astro.
 * Validates SectionWrapper usage, subscribed state conditional, form presence.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/content/NewsletterSection.astro');
const content = readFileSync(componentPath, 'utf8');

describe('NewsletterSection.astro', () => {
    describe('Props', () => {
        it('should accept optional locale prop', () => {
            expect(content).toContain('locale');
        });

        it('should accept optional isAuthenticated and isSubscribed props', () => {
            expect(content).toContain('isAuthenticated');
            expect(content).toContain('isSubscribed');
        });

        it('should accept optional isAuthenticated prop', () => {
            expect(content).toContain('isAuthenticated');
        });

        it('should accept optional isSubscribed prop', () => {
            expect(content).toContain('isSubscribed');
        });
    });

    describe('SectionWrapper usage', () => {
        it('should import SectionWrapper', () => {
            expect(content).toContain('SectionWrapper');
        });

        it('should use river variant with gradient overlay', () => {
            expect(content).toContain('variant="river"');
        });
    });

    describe('SectionHeader usage', () => {
        it('should import SectionHeader', () => {
            expect(content).toContain('SectionHeader');
        });
    });

    describe('i18n integration', () => {
        it('should import t function from lib/i18n', () => {
            expect(content).toContain("from '../../lib/i18n'");
        });

        it('should use t() for section header title', () => {
            expect(content).toContain("'newsletter.title'");
        });

        it('should use t() for accent subtitle', () => {
            expect(content).toContain("'newsletter.accentSubtitle'");
        });

        it('should use t() for already-subscribed message', () => {
            expect(content).toContain("'newsletter.alreadySubscribed'");
        });
    });

    describe('Subscribed state', () => {
        it('should conditionally show confirmation when subscribed', () => {
            expect(content).toContain('isSubscribed');
        });

        it('should show translated already-subscribed message', () => {
            expect(content).toContain("'newsletter.alreadySubscribed'");
        });
    });

    describe('Newsletter form', () => {
        it('should import NewsletterCTA component', () => {
            expect(content).toContain('NewsletterCTA');
        });

        it('should use client:visible directive for form island', () => {
            expect(content).toContain('client:visible');
        });
    });

    describe('Background fallback', () => {
        it('should have gradient background', () => {
            expect(content).toContain('bg-gradient-to-br');
            expect(content).toContain('from-primary-800');
        });
    });

    describe('Styling', () => {
        it('should use white text on dark overlay', () => {
            expect(content).toContain('text-white');
        });
    });
});
