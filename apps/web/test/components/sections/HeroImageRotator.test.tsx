/**
 * @file HeroImageRotator.test.tsx
 * @description Unit tests for HeroImageRotator.client.tsx island component.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/sections/HeroImageRotator.client.tsx'),
    'utf8'
);

describe('HeroImageRotator.client.tsx', () => {
    describe('accessibility', () => {
        it('should use role="img" on the container', () => {
            expect(src).toContain('role="img"');
        });

        it('should have aria-label on the container derived from active image alt', () => {
            expect(src).toContain('aria-label={activeAlt}');
        });

        it('should have aria-live="polite" for transition announcements', () => {
            expect(src).toContain('aria-live="polite"');
        });

        it('should have aria-atomic="true" on the container', () => {
            expect(src).toContain('aria-atomic="true"');
        });

        it('should mark individual images as aria-hidden', () => {
            expect(src).toContain('aria-hidden="true"');
        });

        it('should use empty alt on individual images', () => {
            expect(src).toContain('alt=""');
        });
    });

    describe('image dimensions', () => {
        it('should set explicit width on images', () => {
            expect(src).toContain('width="480"');
        });

        it('should set explicit height on images', () => {
            expect(src).toContain('height="540"');
        });
    });

    describe('behavior', () => {
        it('should track active image index in state', () => {
            expect(src).toContain('activeIndex');
        });

        it('should derive activeAlt from active image', () => {
            expect(src).toContain('activeAlt');
            expect(src).toContain('images[activeIndex]');
        });

        it('should clean up interval on unmount', () => {
            expect(src).toContain('clearInterval');
        });

        it('should use interval prop with default value', () => {
            expect(src).toContain('interval = 5000');
        });

        it('should load first image eagerly', () => {
            expect(src).toContain("loading={index === 0 ? 'eager' : 'lazy'}");
        });
    });

    describe('named export', () => {
        it('should export HeroImageRotator as named export', () => {
            expect(src).toContain('export function HeroImageRotator');
        });
    });
});
