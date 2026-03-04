/**
 * Tests for OptimizedImage and HeroImage components
 * Validates image optimization patterns by analyzing component source code
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const OPTIMIZED_IMAGE_PATH = resolve(__dirname, '../../../src/components/ui/OptimizedImage.astro');
const HERO_IMAGE_PATH = resolve(__dirname, '../../../src/components/ui/HeroImage.astro');

describe('OptimizedImage Component', () => {
    const source = readFileSync(OPTIMIZED_IMAGE_PATH, 'utf-8');

    it('has Props interface with src, alt, width, height', () => {
        expect(source).toContain('interface Props');
        expect(source).toContain('src: string');
        expect(source).toContain('alt: string');
        expect(source).toContain('width: number');
        expect(source).toContain('height: number');
    });

    it("defaults loading to 'lazy'", () => {
        expect(source).toMatch(/loading\s*=\s*['"]lazy['"]/);
    });

    it("defaults decoding to 'async'", () => {
        expect(source).toMatch(/decoding\s*=\s*['"]async['"]/);
    });

    it('has responsive sizes attribute with breakpoints', () => {
        expect(source).toContain('sizes?:');
        expect(source).toContain('max-width: 640px');
        expect(source).toContain('max-width: 1024px');
        expect(source).toContain('100vw');
        expect(source).toContain('50vw');
        expect(source).toContain('33vw');
    });

    it('generates srcset with width descriptors (320w, 640w, 1024w, 1920w)', () => {
        expect(source).toContain('const widths = [320, 640, 1024, 1920]');
        expect(source).toContain('srcset');
        expect(source).toMatch(/\$\{w\}w/); // Template literal for width descriptor
    });

    it('sets width and height attributes for CLS prevention', () => {
        expect(source).toMatch(/width=\{width\}/);
        expect(source).toMatch(/height=\{height\}/);
    });

    it('accepts custom class', () => {
        expect(source).toContain('class?: string');
        expect(source).toMatch(/class:list/);
    });

    it('has fetchpriority support', () => {
        expect(source).toContain('fetchpriority?:');
        expect(source).toContain("'high' | 'low' | 'auto'");
        expect(source).toMatch(/fetchpriority/);
    });

    it('filters srcset widths based on source width', () => {
        expect(source).toContain('.filter((w) => w <= width * 2)');
        expect(source).toContain("Don't upscale beyond 2x");
    });

    it('has opacity transition class', () => {
        expect(source).toContain('transition-opacity');
        expect(source).toContain('duration-300');
    });
});

describe('HeroImage Component', () => {
    const source = readFileSync(HERO_IMAGE_PATH, 'utf-8');

    it('uses eager loading', () => {
        expect(source).toMatch(/loading\s*=\s*["']eager["']/);
    });

    it('uses high fetchpriority', () => {
        expect(source).toMatch(/fetchpriority\s*=\s*["']high["']/);
    });

    it('has blur placeholder div', () => {
        expect(source).toContain('Blur placeholder background');
        expect(source).toContain('bg-surface-alt');
    });

    it('has animate-pulse class on placeholder', () => {
        expect(source).toContain('animate-pulse');
    });

    it('has onload handler to show image', () => {
        expect(source).toContain('onload=');
        expect(source).toContain("this.style.opacity='1'");
        expect(source).toContain('previousElementSibling');
        expect(source).toContain('.display=');
    });

    it('starts with opacity 0', () => {
        expect(source).toMatch(/style\s*=\s*["']opacity:\s*0/);
    });

    it('has object-cover class', () => {
        expect(source).toContain('object-cover');
    });

    it('placeholder has aria-hidden="true"', () => {
        expect(source).toMatch(/aria-hidden\s*=\s*["']true["']/);
    });
});
