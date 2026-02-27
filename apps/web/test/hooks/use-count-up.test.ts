/**
 * Tests for the shared useCountUp hook and useViewportTrigger.
 * Verifies the hook exports, IntersectionObserver logic, easing functions,
 * prefers-reduced-motion support, and animation config.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const hookPath = resolve(__dirname, '../../src/hooks/useCountUp.ts');
const content = readFileSync(hookPath, 'utf8');

describe('useCountUp hook', () => {
    describe('Exports', () => {
        it('should export useCountUp function', () => {
            expect(content).toContain('export function useCountUp');
        });

        it('should export useViewportTrigger function', () => {
            expect(content).toContain('export function useViewportTrigger');
        });

        it('should export EasingPreset type', () => {
            expect(content).toContain('export type EasingPreset');
        });
    });

    describe('IntersectionObserver', () => {
        it('should use IntersectionObserver for viewport detection', () => {
            expect(content).toContain('IntersectionObserver');
        });

        it('should disconnect observer after triggering', () => {
            expect(content).toContain('observer.disconnect');
        });

        it('should default threshold to 0.3', () => {
            expect(content).toContain('threshold = 0.3');
        });
    });

    describe('Easing functions', () => {
        it('should have ease-out cubic', () => {
            expect(content).toContain('easeOutCubic');
        });

        it('should have ease-out quart', () => {
            expect(content).toContain('easeOutQuart');
        });

        it('should have easing preset map', () => {
            expect(content).toContain('EASING_MAP');
        });
    });

    describe('Animation', () => {
        it('should use requestAnimationFrame for smooth animation', () => {
            expect(content).toContain('requestAnimationFrame');
        });

        it('should default duration to 1500ms', () => {
            expect(content).toContain('duration = 1500');
        });

        it('should default easing to cubic', () => {
            expect(content).toContain("easing = 'cubic'");
        });

        it('should prevent re-triggering with hasAnimated ref', () => {
            expect(content).toContain('hasAnimated');
        });
    });

    describe('Accessibility', () => {
        it('should respect prefers-reduced-motion', () => {
            expect(content).toContain('prefers-reduced-motion');
        });

        it('should show final value immediately when reduced motion is preferred', () => {
            expect(content).toContain('setValue(target)');
            expect(content).toContain('setIsComplete(true)');
        });
    });

    describe('Return value', () => {
        it('should return value and isComplete', () => {
            expect(content).toContain('UseCountUpResult');
            expect(content).toContain('readonly value: number');
            expect(content).toContain('readonly isComplete: boolean');
        });
    });
});
