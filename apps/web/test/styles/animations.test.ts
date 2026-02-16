import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const animationsCssPath = resolve(__dirname, '../../src/styles/animations.css');
const animationsCss = readFileSync(animationsCssPath, 'utf8');

describe('Animation System - animations.css', () => {
    describe('Keyframes', () => {
        it('should define fadeIn keyframe', () => {
            expect(animationsCss).toContain('@keyframes fadeIn');
        });

        it('should define slideUp keyframe', () => {
            expect(animationsCss).toContain('@keyframes slideUp');
        });

        it('should define scaleIn keyframe', () => {
            expect(animationsCss).toContain('@keyframes scaleIn');
        });

        it('should define shimmer keyframe', () => {
            expect(animationsCss).toContain('@keyframes shimmer');
        });
    });

    describe('Utility classes', () => {
        it('should define .animate-fade-in', () => {
            expect(animationsCss).toContain('.animate-fade-in');
        });

        it('should define .animate-slide-up', () => {
            expect(animationsCss).toContain('.animate-slide-up');
        });

        it('should define .animate-scale-in', () => {
            expect(animationsCss).toContain('.animate-scale-in');
        });

        it('should define .animate-shimmer', () => {
            expect(animationsCss).toContain('.animate-shimmer');
        });
    });

    describe('Stagger delays', () => {
        it('should define stagger delay utilities', () => {
            expect(animationsCss).toContain('.animate-delay-1');
            expect(animationsCss).toContain('.animate-delay-2');
            expect(animationsCss).toContain('.animate-delay-3');
            expect(animationsCss).toContain('.animate-delay-4');
            expect(animationsCss).toContain('.animate-delay-5');
            expect(animationsCss).toContain('.animate-delay-6');
        });
    });

    describe('Reduced motion', () => {
        it('should include prefers-reduced-motion media query', () => {
            expect(animationsCss).toContain('prefers-reduced-motion: reduce');
        });

        it('should disable animations for reduced motion', () => {
            expect(animationsCss).toContain('animation-duration: 0.01ms !important');
        });

        it('should disable transitions for reduced motion', () => {
            expect(animationsCss).toContain('transition-duration: 0.01ms !important');
        });

        it('should limit animation iterations for reduced motion', () => {
            expect(animationsCss).toContain('animation-iteration-count: 1 !important');
        });
    });
});

describe('Tailwind integration', () => {
    const tailwindCssPath = resolve(__dirname, '../../src/styles/tailwind.css');
    const tailwindCss = readFileSync(tailwindCssPath, 'utf8');

    it('should import animations.css in tailwind.css', () => {
        expect(tailwindCss).toContain('@import "./animations.css"');
    });
});
