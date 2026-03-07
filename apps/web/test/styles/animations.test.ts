import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const cssPath = resolve(__dirname, '../../src/styles/global.css');
const css = readFileSync(cssPath, 'utf8');

describe('global.css - Animations and Motion Infrastructure', () => {
    describe('File loading', () => {
        it('should load the CSS file successfully with content', () => {
            // Arrange / Act - loaded at module level
            // Assert
            expect(css.length).toBeGreaterThan(0);
        });
    });

    describe('Scroll-reveal animation classes', () => {
        it('should define .scroll-reveal class', () => {
            // Arrange
            const selector = '.scroll-reveal';
            // Act / Assert
            expect(css).toContain(selector);
        });

        it('should set .scroll-reveal initial state to opacity 0', () => {
            // Arrange
            const block = css.slice(css.indexOf('.scroll-reveal {'));
            // Act / Assert
            expect(block).toContain('opacity: 0');
        });

        it('should apply translateY transform using --scroll-reveal-offset-y token', () => {
            // Arrange / Act / Assert
            expect(css).toContain('translateY(var(--scroll-reveal-offset-y))');
        });

        it('should define .scroll-reveal.revealed state with opacity 1', () => {
            // Arrange / Act / Assert
            expect(css).toContain('.scroll-reveal.revealed');
            const revealedIndex = css.indexOf('.scroll-reveal.revealed');
            const revealedBlock = css.slice(revealedIndex, css.indexOf('}', revealedIndex) + 1);
            expect(revealedBlock).toContain('opacity: 1');
        });

        it('should reset transform to translateY(0) when revealed', () => {
            // Arrange
            const revealedIndex = css.indexOf('.scroll-reveal.revealed');
            // Act
            const revealedBlock = css.slice(revealedIndex, css.indexOf('}', revealedIndex) + 1);
            // Assert
            expect(revealedBlock).toContain('translateY(0)');
        });

        it('should define .scroll-reveal-left for horizontal left-entry animation', () => {
            // Arrange / Act / Assert
            expect(css).toContain('.scroll-reveal-left');
        });

        it('should apply negative translateX using --scroll-reveal-offset-x on left variant', () => {
            // Arrange / Act / Assert
            expect(css).toContain('translateX(calc(-1 * var(--scroll-reveal-offset-x)))');
        });

        it('should define .scroll-reveal-right for horizontal right-entry animation', () => {
            // Arrange / Act / Assert
            expect(css).toContain('.scroll-reveal-right');
        });

        it('should apply positive translateX using --scroll-reveal-offset-x on right variant', () => {
            // Arrange / Act / Assert
            expect(css).toContain('translateX(var(--scroll-reveal-offset-x))');
        });

        it('should use transition shorthand for opacity and transform on scroll-reveal', () => {
            // Arrange
            const scrollBlock = css.slice(
                css.indexOf('.scroll-reveal {'),
                css.indexOf('}', css.indexOf('.scroll-reveal {')) + 1
            );
            // Act / Assert
            expect(scrollBlock).toContain('transition:');
            expect(scrollBlock).toContain('opacity');
            expect(scrollBlock).toContain('transform');
        });

        it('should use ease-out easing for scroll-reveal transitions', () => {
            // Arrange - check within scroll reveal blocks
            const scrollSection = css.slice(
                css.indexOf('.scroll-reveal'),
                css.indexOf('.wave-separator')
            );
            // Act / Assert
            expect(scrollSection).toContain('ease-out');
        });

        it('should use --scroll-reveal-duration token for transition duration', () => {
            // Arrange / Act / Assert
            expect(css).toContain('var(--scroll-reveal-duration)');
        });
    });

    describe('Wave separator', () => {
        it('should define .wave-separator class', () => {
            // Arrange / Act / Assert
            expect(css).toContain('.wave-separator');
        });

        it('should use position relative and overflow hidden on .wave-separator', () => {
            // Arrange
            const waveIndex = css.indexOf('.wave-separator {');
            const waveBlock = css.slice(waveIndex, css.indexOf('}', waveIndex) + 1);
            // Act / Assert
            expect(waveBlock).toContain('position: relative');
            expect(waveBlock).toContain('overflow: hidden');
        });

        it('should define .wave-separator::after pseudo-element', () => {
            // Arrange / Act / Assert
            expect(css).toContain('.wave-separator::after');
        });

        it('should use mask-image with inline SVG for the wave shape', () => {
            // Arrange
            const afterIndex = css.indexOf('.wave-separator::after');
            const afterBlock = css.slice(afterIndex, css.indexOf('}', afterIndex) + 1);
            // Act / Assert
            expect(afterBlock).toContain('mask-image:');
            expect(afterBlock).toContain('data:image/svg+xml');
        });

        it('should use --wave-separator-height token for the after element height', () => {
            // Arrange / Act / Assert
            expect(css).toContain('var(--wave-separator-height)');
        });
    });

    describe('Wave bottom clip-path variants', () => {
        it('should define .wave-bottom-hero', () => {
            expect(css).toContain('.wave-bottom-hero');
        });

        it('should define .wave-bottom-a', () => {
            expect(css).toContain('.wave-bottom-a');
        });

        it('should define .wave-bottom-b', () => {
            expect(css).toContain('.wave-bottom-b');
        });

        it('should define .wave-bottom-c', () => {
            expect(css).toContain('.wave-bottom-c');
        });

        it('should define .wave-bottom-d', () => {
            expect(css).toContain('.wave-bottom-d');
        });

        it('should use polygon() clip-path on wave-bottom variants', () => {
            // Arrange
            const waveHeroIndex = css.indexOf('.wave-bottom-hero');
            const waveBlock = css.slice(waveHeroIndex, css.indexOf('}', waveHeroIndex + 1) + 1);
            // Act / Assert
            expect(waveBlock).toContain('clip-path: polygon(');
        });

        it('should use calc() with 100% base in wave clip-path for responsive sizing', () => {
            // Arrange / Act / Assert
            expect(css).toContain('calc(100% -');
        });
    });

    describe('3D card transform animations', () => {
        it('should define .card-3d-featured class', () => {
            // Arrange / Act / Assert
            expect(css).toContain('.card-3d-featured');
        });

        it('should apply --perspective-card-featured token to .card-3d-featured', () => {
            // Arrange
            const cardIndex = css.indexOf('.card-3d-featured {');
            const cardBlock = css.slice(cardIndex, css.indexOf('}', cardIndex) + 1);
            // Act / Assert
            expect(cardBlock).toContain('perspective: var(--perspective-card-featured)');
        });

        it('should define .card-3d-featured-tilt for transform application', () => {
            // Arrange / Act / Assert
            expect(css).toContain('.card-3d-featured-tilt');
        });

        it('should apply --card-tilt-featured token to .card-3d-featured-tilt', () => {
            // Arrange
            const tiltIndex = css.indexOf('.card-3d-featured-tilt');
            const tiltBlock = css.slice(tiltIndex, css.indexOf('}', tiltIndex) + 1);
            // Act / Assert
            expect(tiltBlock).toContain('transform: var(--card-tilt-featured)');
        });

        it('should define .card-3d-secondary class', () => {
            // Arrange / Act / Assert
            expect(css).toContain('.card-3d-secondary');
        });

        it('should define .card-3d-secondary-tilt class', () => {
            // Arrange / Act / Assert
            expect(css).toContain('.card-3d-secondary-tilt');
        });

        it('should apply --perspective-card-secondary token to .card-3d-secondary', () => {
            // Arrange
            const secIndex = css.indexOf('.card-3d-secondary {');
            const secBlock = css.slice(secIndex, css.indexOf('}', secIndex) + 1);
            // Act / Assert
            expect(secBlock).toContain('perspective: var(--perspective-card-secondary)');
        });
    });

    describe('Parallax section', () => {
        it('should define .parallax-section class', () => {
            // Arrange / Act / Assert
            expect(css).toContain('.parallax-section');
        });

        it('should use background-attachment: fixed for desktop parallax', () => {
            // Arrange
            const parallaxIndex = css.indexOf('.parallax-section {');
            const parallaxBlock = css.slice(parallaxIndex, css.indexOf('}', parallaxIndex) + 1);
            // Act / Assert
            expect(parallaxBlock).toContain('background-attachment: fixed');
        });

        it('should disable background-attachment fixed on mobile via media query', () => {
            // Arrange
            const mobileParallaxSection = css.slice(
                css.indexOf('@media (width < 768px)'),
                css.indexOf('}', css.indexOf('@media (width < 768px)') + 1) + 2
            );
            // Act / Assert
            expect(mobileParallaxSection).toContain('background-attachment: scroll');
        });
    });

    describe('prefers-reduced-motion', () => {
        it('should define a @media (prefers-reduced-motion: reduce) block', () => {
            // Arrange / Act / Assert
            expect(css).toContain('@media (prefers-reduced-motion: reduce)');
        });

        it('should set opacity to 1 for scroll-reveal inside reduced-motion block', () => {
            // Arrange
            const reducedStart = css.indexOf('@media (prefers-reduced-motion: reduce)');
            const reducedEnd = css.indexOf('\n}', reducedStart) + 2;
            const reducedBlock = css.slice(reducedStart, reducedEnd);
            // Act / Assert
            expect(reducedBlock).toContain('opacity: 1');
        });

        it('should reset transform to none for scroll-reveal inside reduced-motion block', () => {
            // Arrange
            const reducedStart = css.indexOf('@media (prefers-reduced-motion: reduce)');
            const reducedEnd = css.indexOf('\n}', reducedStart) + 2;
            const reducedBlock = css.slice(reducedStart, reducedEnd);
            // Act / Assert
            expect(reducedBlock).toContain('transform: none');
        });

        it('should set transition to none for scroll-reveal inside reduced-motion block', () => {
            // Arrange
            const reducedStart = css.indexOf('@media (prefers-reduced-motion: reduce)');
            const reducedEnd = css.indexOf('\n}', reducedStart) + 2;
            const reducedBlock = css.slice(reducedStart, reducedEnd);
            // Act / Assert
            expect(reducedBlock).toContain('transition: none');
        });

        it('should include all three scroll-reveal variants in reduced-motion override', () => {
            // Arrange
            const reducedStart = css.indexOf('@media (prefers-reduced-motion: reduce)');
            const reducedEnd = css.indexOf('\n}', reducedStart) + 2;
            const reducedBlock = css.slice(reducedStart, reducedEnd);
            // Act / Assert
            expect(reducedBlock).toContain('.scroll-reveal');
            expect(reducedBlock).toContain('.scroll-reveal-left');
            expect(reducedBlock).toContain('.scroll-reveal-right');
        });

        it('should disable fixed parallax in reduced-motion block', () => {
            // Arrange
            const reducedStart = css.indexOf('@media (prefers-reduced-motion: reduce)');
            const reducedEnd = css.indexOf('\n}', reducedStart) + 2;
            const reducedBlock = css.slice(reducedStart, reducedEnd);
            // Act / Assert
            expect(reducedBlock).toContain('.parallax-section');
            expect(reducedBlock).toContain('background-attachment: scroll');
        });
    });

    describe('@layer base body/element defaults', () => {
        it('should define an @layer base block', () => {
            // Arrange / Act / Assert
            expect(css).toContain('@layer base {');
        });

        it('should apply bg-background and text-foreground to body via @apply', () => {
            // Arrange
            const baseIndex = css.indexOf('@layer base {');
            const baseEnd = css.indexOf('\n}', baseIndex) + 2;
            const baseBlock = css.slice(baseIndex, baseEnd);
            // Act / Assert
            expect(baseBlock).toContain('@apply bg-background text-foreground');
        });

        it('should apply border-border and outline-ring/50 to all elements', () => {
            // Arrange
            const baseIndex = css.indexOf('@layer base {');
            const baseEnd = css.indexOf('\n}', baseIndex) + 2;
            const baseBlock = css.slice(baseIndex, baseEnd);
            // Act / Assert
            expect(baseBlock).toContain('@apply border-border outline-ring/50');
        });
    });

    describe('Custom @utility definitions', () => {
        it('should define @utility shadow-card', () => {
            expect(css).toContain('@utility shadow-card {');
        });

        it('should define @utility shadow-nav', () => {
            expect(css).toContain('@utility shadow-nav {');
        });

        it('should define @utility text-2xs', () => {
            expect(css).toContain('@utility text-2xs {');
        });

        it('should define @utility tracking-ultra', () => {
            expect(css).toContain('@utility tracking-ultra {');
        });

        it('should define @utility hero-text-shadow for readability over hero images', () => {
            expect(css).toContain('@utility hero-text-shadow {');
        });

        it('should define @utility aspect-card for consistent card aspect ratio', () => {
            expect(css).toContain('@utility aspect-card {');
        });
    });
});
