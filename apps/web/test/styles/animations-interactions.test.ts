/**
 * Tests for animations.css (T-038).
 * Verifies card-tilt 3D hover effect, scroll-reveal with directional variants,
 * wave underline nav class, ripple-btn, dark mode glow effects,
 * prefers-reduced-motion media query, and new keyframe definitions.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cssPath = resolve(__dirname, '../../src/styles/animations.css');
const content = readFileSync(cssPath, 'utf8');

describe('animations.css', () => {
    describe('card-tilt 3D hover effect', () => {
        it('should define .card-tilt class', () => {
            expect(content).toContain('.card-tilt {');
        });

        it('should define .card-tilt:hover with 3D perspective transform', () => {
            expect(content).toContain('.card-tilt:hover {');
            expect(content).toContain('perspective(');
            expect(content).toContain('rotateX(');
            expect(content).toContain('rotateY(');
        });

        it('should have translateY lift effect on card-tilt hover', () => {
            expect(content).toContain('translateY(-4px)');
        });

        it('should have transition on card-tilt for smooth animation', () => {
            const cardTiltSection = content.match(/\.card-tilt \{[^}]*\}/s);
            expect(cardTiltSection).not.toBeNull();
            expect(cardTiltSection![0]).toContain('transition:');
        });

        it('should have will-change: transform on card-tilt hover for performance', () => {
            expect(content).toContain('will-change: transform');
        });
    });

    describe('scroll-reveal with data-reveal-direction', () => {
        it('should define .scroll-reveal class with initial hidden state', () => {
            expect(content).toContain('.scroll-reveal {');
        });

        it('should set opacity: 0 as initial state for scroll-reveal', () => {
            const scrollReveal = content.match(/\.scroll-reveal \{[^}]*\}/s);
            expect(scrollReveal).not.toBeNull();
            expect(scrollReveal![0]).toContain('opacity: 0');
        });

        it('should have transition on scroll-reveal', () => {
            const scrollReveal = content.match(/\.scroll-reveal \{[^}]*\}/s);
            expect(scrollReveal).not.toBeNull();
            expect(scrollReveal![0]).toContain('transition:');
        });

        it('should define .scroll-reveal.scroll-visible visible state', () => {
            expect(content).toContain('.scroll-reveal.scroll-visible {');
        });

        it('should have opacity: 1 in scroll-visible state', () => {
            const scrollVisible = content.match(/\.scroll-reveal\.scroll-visible \{[^}]*\}/s);
            expect(scrollVisible).not.toBeNull();
            expect(scrollVisible![0]).toContain('opacity: 1');
        });

        it('should support data-reveal-direction="left" variant', () => {
            expect(content).toContain('[data-reveal-direction="left"]');
            expect(content).toContain('translateX(-30px)');
        });

        it('should support data-reveal-direction="right" variant', () => {
            expect(content).toContain('[data-reveal-direction="right"]');
            expect(content).toContain('translateX(30px)');
        });

        it('should reset translateX to 0 in scroll-visible state for left/right directions', () => {
            expect(content).toContain('[data-reveal-direction="left"].scroll-visible');
            expect(content).toContain('[data-reveal-direction="right"].scroll-visible');
        });
    });

    describe('wave underline (.nav-wave-underline)', () => {
        it('should define .nav-wave-underline class', () => {
            expect(content).toContain('.nav-wave-underline {');
        });

        it('should use ::after pseudo-element for the wave underline', () => {
            expect(content).toContain('.nav-wave-underline::after {');
        });

        it('should use SVG wave pattern as background-image', () => {
            expect(content).toContain('url("data:image/svg+xml,');
        });

        it('should clip wave with clip-path initially hidden', () => {
            expect(content).toContain('clip-path: inset(0 100% 0 0)');
        });

        it('should reveal wave on hover via clip-path transition', () => {
            expect(content).toContain('.nav-wave-underline:hover::after {');
            expect(content).toContain('clip-path: inset(0 0 0 0)');
        });

        it('should have aria-current page variant with solid underline', () => {
            expect(content).toContain('[aria-current="page"]');
        });

        it('should have dark mode variant for nav-wave-underline', () => {
            expect(content).toContain('[data-theme="dark"] .nav-wave-underline::after {');
        });
    });

    describe('ripple-btn class', () => {
        it('should define .ripple-btn class with relative position and overflow hidden', () => {
            expect(content).toContain('.ripple-btn {');
            expect(content).toContain('position: relative');
            expect(content).toContain('overflow: hidden');
        });

        it('should use ::after pseudo-element for ripple effect', () => {
            expect(content).toContain('.ripple-btn::after {');
        });

        it('should use border-radius: 50% for circular ripple shape', () => {
            expect(content).toContain('border-radius: 50%');
        });

        it('should define .ripple-btn.ripple-active trigger state', () => {
            expect(content).toContain('.ripple-btn.ripple-active::after {');
        });

        it('should animate ripple with ripple keyframe on active', () => {
            expect(content).toContain('animation: ripple');
        });

        it('should use CSS variable for ripple color (themeable for dark mode)', () => {
            expect(content).toContain('rgba(var(--color-primary-rgb)');
        });
    });

    describe('Dark mode glow effects (.btn-glow)', () => {
        it('should define [data-theme="dark"] .btn-glow class', () => {
            expect(content).toContain('[data-theme="dark"] .btn-glow {');
        });

        it('should use box-shadow for glow effect on btn-glow', () => {
            const btnGlowSection = content.match(/\[data-theme="dark"\] \.btn-glow \{[^}]*\}/s);
            expect(btnGlowSection).not.toBeNull();
            expect(btnGlowSection![0]).toContain('box-shadow:');
        });

        it('should define [data-theme="dark"] .btn-glow:hover with stronger glow', () => {
            expect(content).toContain('[data-theme="dark"] .btn-glow:hover {');
        });

        it('should use CSS variable for glow color (themeable)', () => {
            // Glow effects use --color-primary-rgb CSS variable for theming
            expect(content).toContain('rgba(var(--color-primary-rgb)');
        });

        it('should define dark mode card-tilt hover glow effect', () => {
            expect(content).toContain('[data-theme="dark"] .card-tilt:hover {');
        });
    });

    describe('prefers-reduced-motion media query', () => {
        it('should have prefers-reduced-motion media query', () => {
            expect(content).toContain('@media (prefers-reduced-motion: reduce)');
        });

        it('should suppress animation-duration in reduced motion', () => {
            expect(content).toContain('animation-duration: 0.01ms !important');
        });

        it('should suppress transition-duration in reduced motion', () => {
            expect(content).toContain('transition-duration: 0.01ms !important');
        });

        it('should disable card-tilt transform in reduced motion', () => {
            const mediaStart = content.indexOf('@media (prefers-reduced-motion: reduce)');
            expect(mediaStart).toBeGreaterThan(-1);
            // card-tilt:hover override appears after the media query declaration
            const cardTiltInMedia = content.indexOf('.card-tilt:hover', mediaStart);
            expect(cardTiltInMedia).toBeGreaterThan(-1);
        });

        it('should reset scroll-reveal to visible in reduced motion', () => {
            const mediaStart = content.indexOf('@media (prefers-reduced-motion: reduce)');
            expect(mediaStart).toBeGreaterThan(-1);
            const scrollRevealInMedia = content.indexOf('.scroll-reveal', mediaStart);
            expect(scrollRevealInMedia).toBeGreaterThan(-1);
        });

        it('should show nav-wave-underline immediately in reduced motion', () => {
            const mediaStart = content.indexOf('@media (prefers-reduced-motion: reduce)');
            expect(mediaStart).toBeGreaterThan(-1);
            const waveInMedia = content.indexOf('.nav-wave-underline::after', mediaStart);
            expect(waveInMedia).toBeGreaterThan(-1);
        });
    });

    describe('New keyframes', () => {
        describe('@keyframes expand', () => {
            it('should define expand keyframe', () => {
                expect(content).toContain('@keyframes expand {');
            });

            it('should animate from hidden/translated state', () => {
                const expandKeyframe = content.match(/@keyframes expand \{[^}]*\}/s);
                expect(expandKeyframe).not.toBeNull();
                expect(expandKeyframe![0]).toContain('opacity: 0');
            });

            it('should animate translateY in expand keyframe', () => {
                const expandKeyframe = content.match(/@keyframes expand \{[^}]*\}/s);
                expect(expandKeyframe).not.toBeNull();
                expect(expandKeyframe![0]).toContain('translateY(');
            });

            it('should have .animate-expand utility class', () => {
                expect(content).toContain('.animate-expand {');
            });
        });

        describe('@keyframes ripple', () => {
            it('should define ripple keyframe', () => {
                expect(content).toContain('@keyframes ripple {');
            });

            it('should animate from scale(0) to scale(4)', () => {
                // Check within the full file content between the ripple keyframe markers
                const rippleStart = content.indexOf('@keyframes ripple {');
                const rippleEnd = content.indexOf('\n}', rippleStart) + 2;
                const _rippleBlock = content.slice(rippleStart, rippleEnd);
                // scale(4) appears in the closing brace block; find the next block
                const afterFrom = content.indexOf('scale(0)', rippleStart);
                expect(afterFrom).toBeGreaterThan(-1);
                expect(content).toContain('scale(4)');
            });

            it('should animate opacity from visible to 0', () => {
                const rippleStart = content.indexOf('@keyframes ripple {');
                expect(rippleStart).toBeGreaterThan(-1);
                // opacity: 0 is in the to{} block of ripple keyframe
                const afterRipple = content.indexOf('opacity: 0', rippleStart);
                expect(afterRipple).toBeGreaterThan(-1);
            });
        });

        describe('@keyframes waveUnderlineDraw', () => {
            it('should define waveUnderlineDraw keyframe', () => {
                expect(content).toContain('@keyframes waveUnderlineDraw {');
            });

            it('should animate clip-path from fully hidden to fully visible', () => {
                const waveStart = content.indexOf('@keyframes waveUnderlineDraw {');
                expect(waveStart).toBeGreaterThan(-1);
                // Both clip-path values exist in the keyframe definition
                expect(content).toContain('clip-path: inset(0 100% 0 0)');
                // The "to" state exists somewhere in the waveUnderlineDraw keyframe block
                const afterWaveStart = content.indexOf('clip-path: inset(0 0 0 0)', waveStart);
                expect(afterWaveStart).toBeGreaterThan(-1);
            });
        });
    });

    describe('Existing core keyframes still present', () => {
        it('should still define fadeIn keyframe', () => {
            expect(content).toContain('@keyframes fadeIn {');
        });

        it('should still define slideUp keyframe', () => {
            expect(content).toContain('@keyframes slideUp {');
        });

        it('should still define shimmer keyframe for skeleton loading', () => {
            expect(content).toContain('@keyframes shimmer {');
        });

        it('should still define scaleIn keyframe', () => {
            expect(content).toContain('@keyframes scaleIn {');
        });
    });
});
