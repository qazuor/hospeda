/**
 * @file error-pages.test.ts
 * @description Unit tests for 404 and 500 error pages.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src404 = readFileSync(resolve(__dirname, '../../src/pages/404.astro'), 'utf8');

const src500 = readFileSync(resolve(__dirname, '../../src/pages/500.astro'), 'utf8');

describe('404.astro', () => {
    it('should use ErrorLayout (crash-resistant, not BaseLayout)', () => {
        expect(src404).toContain('ErrorLayout');
    });

    it('should pass noindex to layout', () => {
        expect(src404).toContain('noindex={true}');
    });

    it('should use t() for all text', () => {
        expect(src404).toContain("t('error.404.heading')");
        expect(src404).toContain("t('error.404.message')");
        expect(src404).toContain("t('error.404.goHome')");
    });

    it('should not prerender (SSR for middleware rewrite)', () => {
        expect(src404).toContain('export const prerender = false');
    });

    it('should have a link to home', () => {
        expect(src404).toContain('homeUrl');
        expect(src404).toContain('href={homeUrl}');
    });

    it('should use buildUrl for home link', () => {
        expect(src404).toContain('buildUrl');
    });
});

describe('500.astro', () => {
    it('should use ErrorLayout (crash-resistant, not BaseLayout)', () => {
        expect(src500).toContain('ErrorLayout');
    });

    it('should pass noindex to layout', () => {
        expect(src500).toContain('noindex={true}');
    });

    it('should use t() for all text', () => {
        expect(src500).toContain("t('error.500.heading')");
        expect(src500).toContain("t('error.500.message')");
        expect(src500).toContain("t('error.500.retry')");
        expect(src500).toContain("t('error.500.goHome')");
    });

    it('should not prerender', () => {
        expect(src500).toContain('export const prerender = false');
    });

    it('should have a retry button using addEventListener (not inline onclick)', () => {
        expect(src500).toContain('retry-btn');
        expect(src500).toContain('addEventListener');
        expect(src500).not.toContain('onclick=');
    });

    it('should have a link to home', () => {
        expect(src500).toContain('homeUrl');
        expect(src500).toContain('href={homeUrl}');
    });
});
