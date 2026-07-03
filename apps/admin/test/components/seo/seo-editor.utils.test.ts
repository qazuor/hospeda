import { describe, expect, it } from 'vitest';
import {
    SEO_DEFAULT_LOCALE,
    SEO_LIMITS,
    buildSeoPayload,
    buildSeoPreviewDescription,
    buildSeoPreviewTitle,
    buildSeoPreviewUrl,
    getSeoCounterTone,
    normalizeSeoText,
    truncateSeoPreview
} from '../../../src/components/seo/seo-editor.utils';

describe('seo-editor.utils', () => {
    describe('SEO_LIMITS', () => {
        it('has expected title constraints', () => {
            expect(SEO_LIMITS.title.min).toBe(50);
            expect(SEO_LIMITS.title.max).toBe(60);
        });

        it('has expected description constraints with validationMax', () => {
            expect(SEO_LIMITS.description.min).toBe(120);
            expect(SEO_LIMITS.description.max).toBe(155);
            expect(SEO_LIMITS.description.validationMax).toBe(160);
        });
    });

    describe('SEO_DEFAULT_LOCALE', () => {
        it('defaults to es', () => {
            expect(SEO_DEFAULT_LOCALE).toBe('es');
        });
    });

    describe('getSeoCounterTone', () => {
        it('returns muted when length is 0', () => {
            expect(getSeoCounterTone({ length: 0, min: 50, max: 60 })).toBe(
                'text-muted-foreground'
            );
        });

        it('returns warning when below min', () => {
            expect(getSeoCounterTone({ length: 30, min: 50, max: 60 })).toBe('text-warning');
        });

        it('returns success when in optimal range', () => {
            expect(getSeoCounterTone({ length: 52, min: 50, max: 60 })).toBe('text-success');
        });

        it('returns warning when near max (within 5)', () => {
            expect(getSeoCounterTone({ length: 57, min: 50, max: 60 })).toBe('text-warning');
        });

        it('returns warning when over max but under validationMax', () => {
            expect(getSeoCounterTone({ length: 158, min: 120, max: 155, validationMax: 160 })).toBe(
                'text-warning'
            );
        });

        it('returns destructive when over validationMax', () => {
            expect(getSeoCounterTone({ length: 161, min: 120, max: 155, validationMax: 160 })).toBe(
                'text-destructive'
            );
        });

        it('returns destructive when over max and no validationMax', () => {
            expect(getSeoCounterTone({ length: 61, min: 50, max: 60 })).toBe('text-destructive');
        });
    });

    describe('buildSeoPreviewUrl', () => {
        it('builds a valid URL with slug', () => {
            expect(
                buildSeoPreviewUrl({
                    siteUrl: 'https://hospeda.com.ar',
                    locale: 'es',
                    pathSegment: 'alojamientos',
                    slug: 'casa-del-rio'
                })
            ).toBe('https://hospeda.com.ar/es/alojamientos/casa-del-rio/');
        });

        it('builds URL without slug when slug is empty', () => {
            expect(
                buildSeoPreviewUrl({
                    siteUrl: 'https://hospeda.com.ar',
                    locale: 'es',
                    pathSegment: 'alojamientos',
                    slug: ''
                })
            ).toBe('https://hospeda.com.ar/es/alojamientos/');
        });

        it('builds URL without slug when slug is null', () => {
            expect(
                buildSeoPreviewUrl({
                    siteUrl: 'https://hospeda.com.ar',
                    locale: 'es',
                    pathSegment: 'alojamientos',
                    slug: null
                })
            ).toBe('https://hospeda.com.ar/es/alojamientos/');
        });

        it('removes trailing slash from siteUrl before building', () => {
            expect(
                buildSeoPreviewUrl({
                    siteUrl: 'https://hospeda.com.ar/',
                    locale: 'es',
                    pathSegment: 'alojamientos',
                    slug: 'test'
                })
            ).toBe('https://hospeda.com.ar/es/alojamientos/test/');
        });
    });

    describe('buildSeoPayload', () => {
        it('returns null when both fields are empty', () => {
            expect(buildSeoPayload({ title: '', description: '' })).toBeNull();
        });

        it('returns null when both fields are whitespace', () => {
            expect(buildSeoPayload({ title: '   ', description: '  ' })).toBeNull();
        });

        it('returns only title when description is empty', () => {
            expect(buildSeoPayload({ title: 'My Title', description: '' })).toEqual({
                title: 'My Title'
            });
        });

        it('returns full object when both are filled', () => {
            expect(buildSeoPayload({ title: 'My Title', description: 'My Description' })).toEqual({
                title: 'My Title',
                description: 'My Description'
            });
        });
    });

    describe('buildSeoPreviewTitle', () => {
        it('uses override title when provided', () => {
            expect(buildSeoPreviewTitle({ title: 'Custom', fallbackTitle: 'Entity Name' })).toBe(
                'Custom | Hospeda'
            );
        });

        it('uses fallback when title is empty', () => {
            expect(buildSeoPreviewTitle({ title: '', fallbackTitle: 'Entity Name' })).toBe(
                'Entity Name | Hospeda'
            );
        });

        it('returns Hospeda when both are empty', () => {
            expect(buildSeoPreviewTitle({ title: '', fallbackTitle: '' })).toBe('Hospeda');
        });
    });

    describe('buildSeoPreviewDescription', () => {
        it('uses override when provided', () => {
            expect(
                buildSeoPreviewDescription({
                    description: 'Custom',
                    fallbackDescription: 'Fallback'
                })
            ).toBe('Custom');
        });

        it('uses fallback when description is empty', () => {
            expect(
                buildSeoPreviewDescription({ description: '', fallbackDescription: 'Fallback' })
            ).toBe('Fallback');
        });
    });

    describe('truncateSeoPreview', () => {
        it('returns text as-is when under limit', () => {
            expect(truncateSeoPreview({ text: 'Short', maxLength: 10 })).toBe('Short');
        });

        it('truncates with ellipsis when over limit', () => {
            // slice(0, maxLength - 1) + '…' = exactly maxLength visible chars
            expect(truncateSeoPreview({ text: 'Hello World', maxLength: 7 })).toBe('Hello …');
        });
    });

    describe('normalizeSeoText', () => {
        it('trims whitespace', () => {
            expect(normalizeSeoText('  hello  ')).toBe('hello');
        });

        it('returns empty string for null', () => {
            expect(normalizeSeoText(null)).toBe('');
        });

        it('returns empty string for undefined', () => {
            expect(normalizeSeoText(undefined)).toBe('');
        });
    });
});
