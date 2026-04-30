/**
 * @file ErrorBanner.test.ts
 * @description Source-reading unit tests for ErrorBanner.astro.
 * Astro components cannot be rendered in Vitest/jsdom so we assert on the
 * source text to verify variant handling, icon selection, and styling.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/components/ErrorBanner.astro'), 'utf8');

describe('ErrorBanner.astro', () => {
    describe('file structure', () => {
        it('has a JSDoc file header', () => {
            expect(src).toContain('@file ErrorBanner.astro');
        });

        it('defines a Props interface', () => {
            expect(src).toContain('interface Props');
        });

        it('defines BannerVariant type with three options', () => {
            expect(src).toContain("'error' | 'warning' | 'info'");
        });
    });

    describe('props', () => {
        it('accepts a required variant prop', () => {
            expect(src).toContain('readonly variant: BannerVariant');
        });

        it('accepts a required message prop', () => {
            expect(src).toContain('readonly message: string');
        });

        it('accepts an optional onRetryUrl prop', () => {
            expect(src).toContain('readonly onRetryUrl?: string');
        });
    });

    describe('icon imports from @repo/icons', () => {
        it('imports XCircleIcon for error variant', () => {
            expect(src).toContain('XCircleIcon');
            expect(src).toContain("from '@repo/icons'");
        });

        it('imports AlertTriangleIcon for warning variant', () => {
            expect(src).toContain('AlertTriangleIcon');
        });

        it('imports InfoIcon for info variant', () => {
            expect(src).toContain('InfoIcon');
        });
    });

    describe('icon rendering per variant', () => {
        it('renders XCircleIcon when variant is error', () => {
            expect(src).toContain("variant === 'error'");
            expect(src).toContain('<XCircleIcon');
        });

        it('renders AlertTriangleIcon when variant is warning', () => {
            expect(src).toContain("variant === 'warning'");
            expect(src).toContain('<AlertTriangleIcon');
        });

        it('renders InfoIcon when variant is info', () => {
            expect(src).toContain("variant === 'info'");
            expect(src).toContain('<InfoIcon');
        });

        it('uses fill weight for all icons', () => {
            expect(src).toContain('weight="fill"');
        });

        it('marks icons as aria-hidden', () => {
            expect(src).toContain('aria-hidden="true"');
        });
    });

    describe('aria roles', () => {
        it('uses role="alert" (assertive) for error and warning', () => {
            // The role is computed: error/warning → 'alert'
            expect(src).toContain("variant === 'info' ? 'status' : 'alert'");
        });

        it('sets aria-live based on variant', () => {
            expect(src).toContain("aria-live={variant === 'info' ? 'polite' : 'assertive'}");
        });
    });

    describe('message rendering', () => {
        it('renders the message in a paragraph', () => {
            expect(src).toContain('<p');
            expect(src).toContain('{message}');
        });

        it('applies the error-banner__message class', () => {
            expect(src).toContain('error-banner__message');
        });
    });

    describe('retry behaviour', () => {
        it('checks for default slot content', () => {
            expect(src).toContain("Astro.slots.has('default')");
        });

        it('renders slot when slot content is provided', () => {
            expect(src).toContain('{hasSlot && (');
            expect(src).toContain('<slot />');
        });

        it('renders default retry link when onRetryUrl is provided without slot', () => {
            expect(src).toContain('showDefaultRetry');
            expect(src).toContain('href={onRetryUrl}');
        });

        it('labels the retry link "Reintentar"', () => {
            expect(src).toContain('Reintentar');
        });
    });

    describe('variant modifier classes', () => {
        it('applies a BEM modifier class per variant', () => {
            expect(src).toContain('error-banner--${variant}');
        });

        it('applies error-banner--error CSS class', () => {
            expect(src).toContain('.error-banner--error');
        });

        it('applies error-banner--warning CSS class', () => {
            expect(src).toContain('.error-banner--warning');
        });

        it('applies error-banner--info CSS class', () => {
            expect(src).toContain('.error-banner--info');
        });
    });

    describe('styles', () => {
        it('uses --destructive token for error palette', () => {
            expect(src).toContain('var(--destructive)');
        });

        it('uses --warning token for warning palette', () => {
            expect(src).toContain('var(--warning)');
        });

        it('uses --info token for info palette', () => {
            expect(src).toContain('var(--info)');
        });

        it('uses --radius-card for border-radius', () => {
            expect(src).toContain('var(--radius-card');
        });

        it('uses --font-sans for text', () => {
            expect(src).toContain('var(--font-sans)');
        });

        it('respects prefers-reduced-motion', () => {
            expect(src).toContain('prefers-reduced-motion: reduce');
        });

        it('includes focus-visible rule on the retry link', () => {
            expect(src).toContain(':focus-visible');
        });
    });
});
